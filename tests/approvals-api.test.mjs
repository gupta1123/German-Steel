import test from 'node:test';
import assert from 'node:assert/strict';

// Safe mocks for verified contract: GET /api/hr/attendance/requests/by-status?status={PENDING|APPROVED|REJECTED}&page=0&size=50
// Verified 200 with uppercase statuses. Incorrect candidates must NOT be used:
// - GET /api/hr/attendance/requests?status=... -> 405
// - GET /request/getByStatus?status=... -> 404

const makePage = (status, page, size, totalElements) => {
  const totalPages = Math.max(1, Math.ceil(totalElements / size));
  const start = page * size;
  const remaining = Math.max(0, totalElements - start);
  const count = Math.min(size, remaining);
  const content = Array.from({ length: count }, (_, i) => {
    const id = page * size + i + 1 + (status === 'PENDING' ? 0 : status === 'APPROVED' ? 1000 : 2000);
    return {
      id,
      employeeId: 10 + (id % 5),
      employeeName: `Employee ${10 + (id % 5)}`,
      requestDate: '2026-02-10T09:00:00Z',
      requestedStatus: 'full day',
      logDate: '2026-02-10',
      actionDate: status === 'PENDING' ? null : '2026-02-11T10:00:00Z',
      status,
      reason: `Reason ${id}`,
      description: `Description ${id}`,
    };
  });
  return {
    content,
    pageable: { pageNumber: page, pageSize: size, offset: page * size, paged: true, unpaged: false, sort: { empty: true, sorted: false, unsorted: true } },
    totalPages,
    totalElements,
    last: page >= totalPages - 1,
    size,
    number: page,
    sort: { empty: true, sorted: false, unsorted: true },
    numberOfElements: content.length,
    first: page === 0,
    empty: content.length === 0,
  };
};

const withMockFetch = async (handler, fn) => {
  const prev = globalThis.fetch;
  globalThis.fetch = handler;
  try {
    return await fn();
  } finally {
    globalThis.fetch = prev;
  }
};

test('getByStatus uses only verified endpoint with uppercase statuses and handles paginated response', async () => {
  const requestedUrls = [];
  await withMockFetch(async (url) => {
    requestedUrls.push(url);
    const u = new URL(url);
    const status = u.searchParams.get('status');
    const page = Number(u.searchParams.get('page') ?? '0');
    const size = Number(u.searchParams.get('size') ?? '50');
    // Verify only verified path is used
    assert.ok(u.pathname === '/api/hr/attendance/requests/by-status', `unexpected path ${u.pathname}`);
    assert.ok(['PENDING', 'APPROVED', 'REJECTED'].includes(status), `status must be uppercase, got ${status}`);
    assert.equal(u.searchParams.get('page'), String(page));
    assert.equal(u.searchParams.get('size'), String(size));
    const totalElements = status === 'PENDING' ? 3 : status === 'APPROVED' ? 2 : 1;
    const pageBody = makePage(status, page, size, totalElements);
    return new Response(JSON.stringify(pageBody), { status: 200, headers: { 'Content-Type': 'application/json' } });
  }, async () => {
    const { approvalsApi } = await import('../lib/approvals-api.ts');

    for (const status of ['PENDING', 'APPROVED', 'REJECTED']) {
      const page = await approvalsApi.getByStatus('test-token', status, 0, 50);
      assert.equal(page.content.length, status === 'PENDING' ? 3 : status === 'APPROVED' ? 2 : 1);
      assert.equal(page.totalElements, status === 'PENDING' ? 3 : status === 'APPROVED' ? 2 : 1);
      assert.equal(page.number, 0);
      assert.equal(page.size, 50);
      // Preserves required request fields
      for (const r of page.content) {
        assert.ok(typeof r.id === 'number');
        assert.ok(typeof r.employeeId === 'number');
        assert.ok(typeof r.employeeName === 'string' && r.employeeName.length > 0);
        assert.ok(typeof r.requestDate === 'string');
        assert.ok(typeof r.logDate === 'string');
        assert.ok(typeof r.status === 'string');
        assert.ok(typeof r.requestedStatus === 'string');
      }
    }

    // Ensure incorrect candidates were never requested
    for (const url of requestedUrls) {
      const u = new URL(url);
      assert.equal(u.pathname, '/api/hr/attendance/requests/by-status');
      assert.notEqual(u.pathname, '/api/hr/attendance/requests');
      assert.notEqual(u.pathname, '/request/getByStatus');
    }

    // Case-insensitive input must still be sent uppercase
    requestedUrls.length = 0;
    const lower = await approvalsApi.getByStatus('test-token', 'pending', 0, 50);
    assert.equal(lower.content.length, 3);
    assert.ok(requestedUrls[0].includes('status=PENDING'));
  });
});

test('getAll aggregates three statuses via verified endpoint and getAllPagesForStatus handles pagination', async () => {
  await withMockFetch(async (url) => {
    const u = new URL(url);
    const status = u.searchParams.get('status');
    const page = Number(u.searchParams.get('page') ?? '0');
    const size = Number(u.searchParams.get('size') ?? '50');
    // Simulate PENDING has 65 records -> 2 pages (50 + 15)
    const totalElements = status === 'PENDING' ? 65 : status === 'APPROVED' ? 2 : 0;
    const body = makePage(status, page, size, totalElements);
    return new Response(JSON.stringify(body), { status: 200, headers: { 'Content-Type': 'application/json' } });
  }, async () => {
    const { approvalsApi } = await import('../lib/approvals-api.ts');

    const all = await approvalsApi.getAll('test-token');
    // getAll fetches page 0 only per status -> 50 + 2 + 0 = 52
    assert.equal(all.length, 52);

    const paged = await approvalsApi.getAllPagesForStatus('test-token', 'PENDING');
    assert.equal(paged.length, 65);
    // Empty state for REJECTED (0 records)
    const empty = await approvalsApi.getByStatus('test-token', 'REJECTED', 0, 50);
    assert.equal(empty.empty, true);
    assert.equal(empty.content.length, 0);
  });
});

test('getByStatus surfaces 401/403 and network errors for auth/error states', async () => {
  await withMockFetch(async (url) => {
    const u = new URL(url);
    const status = u.searchParams.get('status');
    if (status === 'PENDING') {
      return new Response(JSON.stringify({ message: 'Unauthorized' }), { status: 401, headers: { 'Content-Type': 'application/json' } });
    }
    return new Response(JSON.stringify(makePage(status, 0, 50, 1)), { status: 200, headers: { 'Content-Type': 'application/json' } });
  }, async () => {
    const { approvalsApi, ApprovalsApiError } = await import('../lib/approvals-api.ts');
    await assert.rejects(() => approvalsApi.getByStatus('bad-token', 'PENDING', 0, 50), (err) => {
      assert.ok(err instanceof ApprovalsApiError);
      assert.equal(err.status, 401);
      return true;
    });
  });
});

test('updateStatus calls verified POST action endpoint with actionByEmployeeId and uppercase status', async () => {
  const calls = [];
  await withMockFetch(async (url, init) => {
    calls.push({ url, init });
    const u = new URL(url);
    assert.equal(u.pathname, '/api/hr/attendance/requests/42/action');
    assert.equal(init.method, 'POST');
    const body = JSON.parse(init.body);
    assert.equal(body.actionByEmployeeId, 7);
    assert.ok(['APPROVED', 'REJECTED'].includes(body.status), `status must be uppercase, got ${body.status}`);
    assert.ok(String(init.headers.Authorization).includes('Bearer test-token'));
    return new Response(JSON.stringify({
      id: 42,
      employeeId: 10,
      requestDate: '2026-02-10',
      logDate: '2026-02-10',
      requestedStatus: 'FULL_DAY',
      status: body.status,
    }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  }, async () => {
    const { approvalsApi, ApprovalsApiError } = await import('../lib/approvals-api.ts');
    const approved = await approvalsApi.updateStatus('test-token', 42, 'approved', 7);
    assert.equal(approved.id, 42);
    assert.equal(approved.status, 'APPROVED');
    assert.equal(calls.length, 1);

    // Backwards-compat: (token, id, action, 'full day', actionBy)
    const rejected = await approvalsApi.updateStatus('test-token', 42, 'rejected', 'full day', 7);
    assert.equal(rejected.status, 'REJECTED');

    // Missing actionBy must fail before fetch
    calls.length = 0;
    await assert.rejects(() => approvalsApi.updateStatus('test-token', 42, 'approved', 'full day'), (err) => {
      assert.ok(err instanceof ApprovalsApiError);
      assert.equal(err.status, 400);
      return true;
    });
    assert.equal(calls.length, 0, 'must not call fetch without actionByEmployeeId');
  });
});

test('removed incorrect candidates return 405/404 if called directly', async () => {
  await withMockFetch(async (url) => {
    const u = new URL(url);
    if (u.pathname === '/api/hr/attendance/requests' && !u.pathname.includes('by-status')) {
      return new Response(JSON.stringify({ message: 'Method Not Allowed' }), { status: 405, headers: { 'Content-Type': 'application/json' } });
    }
    if (u.pathname === '/request/getByStatus') {
      return new Response(JSON.stringify({ message: 'Not Found' }), { status: 404, headers: { 'Content-Type': 'application/json' } });
    }
    return new Response(JSON.stringify(makePage('PENDING', 0, 50, 1)), { status: 200, headers: { 'Content-Type': 'application/json' } });
  }, async () => {
    const res405 = await fetch('http://localhost/api/hr/attendance/requests?status=PENDING&page=0&size=50');
    assert.equal(res405.status, 405);
    const res404 = await fetch('http://localhost/request/getByStatus?status=pending');
    assert.equal(res404.status, 404);
  });
});
