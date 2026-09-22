import test from 'node:test';
import assert from 'node:assert/strict';

// Mock fetch to test new employees endpoint handling
const mockEmployeesPage = (page, size, totalElements, content) => ({
  content,
  totalElements,
  totalPages: Math.ceil(totalElements / size),
  number: page,
  size,
  first: page === 0,
  last: page >= Math.ceil(totalElements / size) - 1,
  empty: content.length === 0,
});

const makeEmployee = (id, active = true, role = 'Field Officer') => ({
  id,
  firstName: `First${id}`,
  lastName: `Last${id}`,
  email: `user${id}@test.com`,
  role,
  departmentName: 'Sales',
  primaryContact: '1234567890',
  city: 'Mumbai',
  state: 'Maharashtra',
  regionIds: [id, id + 100],
  active,
  // No userDto with password/username — new contract only returns profile fields
});

test('default active employee list uses active=true&page=0&size=50 and handles paginated response', async () => {
  const requestedUrls = [];
  const originalFetch = global.fetch;
  global.fetch = async (url, opts) => {
    requestedUrls.push(url);
    const u = new URL(url);
    // Verify correct endpoint and default params
    assert.equal(u.pathname, '/api/common/employees');
    assert.equal(u.searchParams.get('active'), 'true');
    assert.equal(u.searchParams.get('page'), '0');
    assert.equal(u.searchParams.get('size'), '50');
    // Should not include legacy params
    assert.equal(u.searchParams.has('q') && u.searchParams.get('q') === '', false);
    const page = Number(u.searchParams.get('page'));
    const size = Number(u.searchParams.get('size'));
    const allActive = [makeEmployee(1), makeEmployee(2), makeEmployee(3)];
    const start = page * size;
    const content = allActive.slice(start, start + size);
    const body = mockEmployeesPage(page, size, allActive.length, content);
    return new Response(JSON.stringify(body), { status: 200, headers: { 'Content-Type': 'application/json' } });
  };

  try {
    const { teamsApi } = await import('../lib/teams-api.ts');
    const result = await teamsApi.getEmployeesPage('test-token', { active: true, page: 0, size: 50 });
    assert.equal(result.content.length, 3);
    assert.equal(result.totalElements, 3);
    assert.equal(result.totalPages, 1);
    assert.equal(result.number, 0);
    assert.deepEqual(result.content[0].regionIds, [1, 101], 'Should preserve top-level regionIds for list rendering');
    assert.deepEqual(result.content[0].updatePayload.regionIds, [1, 101], 'Should preserve regionIds for edit payloads');
    // Verify no legacy endpoint was called
    for (const url of requestedUrls) {
      assert.ok(!url.includes('/employee/getAll'), 'Should not call legacy /employee/getAll');
      assert.ok(!url.includes('/employee/getAllInactive'), 'Should not call legacy /employee/getAllInactive');
      assert.ok(url.includes('/api/common/employees'), 'Should use new endpoint');
    }
    // Verify no password in response (userName is allowed for edit-username feature)
    for (const emp of result.content) {
      assert.ok(!('password' in emp) || emp.password === undefined, 'Should not have password');
      assert.ok(!emp.userDto || !emp.userDto.password, 'Should not have password in userDto');
    }
  } finally {
    global.fetch = originalFetch;
  }
});

test('inactive records use active=false and filters are only sent when selected', async () => {
  const requestedUrls = [];
  const originalFetch = global.fetch;
  global.fetch = async (url) => {
    requestedUrls.push(url);
    const u = new URL(url);
    const body = mockEmployeesPage(0, 50, 1, [makeEmployee(99, false)]);
    return new Response(JSON.stringify(body), { status: 200, headers: { 'Content-Type': 'application/json' } });
  };

  try {
    const { teamsApi } = await import('../lib/teams-api.ts');
    // Active false for archived
    const inactiveResult = await teamsApi.getEmployeesPage('test-token', { active: false, page: 0, size: 50 });
    assert.equal(inactiveResult.content[0].active, false);
    assert.ok(requestedUrls[0].includes('active=false'), 'Should send active=false for inactive');

    requestedUrls.length = 0;
    // With q and role filters
    const filteredResult = await teamsApi.getEmployeesPage('test-token', { active: true, page: 1, size: 25, q: 'john', role: 'MANAGER' });
    const url = new URL(requestedUrls[0]);
    assert.equal(url.searchParams.get('q'), 'john');
    assert.equal(url.searchParams.get('role'), 'MANAGER');
    assert.equal(url.searchParams.get('page'), '1');
    assert.equal(url.searchParams.get('size'), '25');

    // Without optional filters, they should not be sent
    requestedUrls.length = 0;
    await teamsApi.getEmployeesPage('test-token', { active: true, page: 0, size: 50 });
    const url2 = new URL(requestedUrls[0]);
    assert.equal(url2.searchParams.has('q'), false, 'Should not send empty q');
    assert.equal(url2.searchParams.has('role'), false, 'Should not send empty role');
    assert.equal(url2.searchParams.has('status'), false, 'Should not send empty status');
    assert.equal(url2.searchParams.has('regionId'), false);
    assert.equal(url2.searchParams.has('teamId'), false);
    assert.equal(url2.searchParams.has('managerId'), false);
  } finally {
    global.fetch = originalFetch;
  }
});

test('handles paginated response content and totalElements correctly', async () => {
  const originalFetch = global.fetch;
  global.fetch = async (url) => {
    const u = new URL(url);
    const page = Number(u.searchParams.get('page'));
    const size = Number(u.searchParams.get('size'));
    // Simulate 120 total employees, page 0 size 50 -> 50, page 1 -> 50, page 2 -> 20
    const totalElements = 120;
    const start = page * size;
    const content = Array.from({ length: Math.min(size, totalElements - start) }, (_, i) => makeEmployee(start + i + 1));
    const body = mockEmployeesPage(page, size, totalElements, content);
    return new Response(JSON.stringify(body), { status: 200, headers: { 'Content-Type': 'application/json' } });
  };

  try {
    const { teamsApi } = await import('../lib/teams-api.ts');
    const page0 = await teamsApi.getEmployeesPage('test-token', { active: true, page: 0, size: 50 });
    assert.equal(page0.content.length, 50);
    assert.equal(page0.totalElements, 120);
    assert.equal(page0.totalPages, 3);
    assert.equal(page0.number, 0);

    const page2 = await teamsApi.getEmployeesPage('test-token', { active: true, page: 2, size: 50 });
    assert.equal(page2.content.length, 20);
    assert.equal(page2.number, 2);
    assert.equal(page2.totalPages, 3);
  } finally {
    global.fetch = originalFetch;
  }
});

test('does not duplicate requests for same page', async () => {
  let callCount = 0;
  const originalFetch = global.fetch;
  global.fetch = async () => {
    callCount++;
    const body = mockEmployeesPage(0, 50, 1, [makeEmployee(1)]);
    return new Response(JSON.stringify(body), { status: 200, headers: { 'Content-Type': 'application/json' } });
  };

  try {
    const { teamsApi } = await import('../lib/teams-api.ts');
    // Simulate two rapid calls for same page - should be two separate fetches, but not a loop
    await teamsApi.getEmployeesPage('test-token', { active: true, page: 0, size: 50 });
    await teamsApi.getEmployeesPage('test-token', { active: true, page: 0, size: 50 });
    assert.equal(callCount, 2, 'Should make exactly 2 calls, not a loop');
  } finally {
    global.fetch = originalFetch;
  }
});
