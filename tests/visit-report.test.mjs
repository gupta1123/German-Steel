import test from 'node:test';
import assert from 'node:assert/strict';
import { buildVisitReport, loadVisitReportRows, VISIT_REPORT_CATEGORIES } from '../lib/visit-report.ts';
import { visitsApi } from '../lib/visits-api.ts';

test('modern visit types classify identically in the cards and detail rows', () => {
  const rows = [
    { id: 101, visitType: 'DEALER_VISIT', clientAccountId: 42, retailAccountName: 'Retail Test' },
    { id: 102, visitType: 'PROJECT_SITE_VISIT', projectId: 31, projectName: 'Project Test' },
    { id: 103, visitType: 'INSTITUTIONAL_VISIT', institutionId: 21, institutionName: 'Institution Test' },
    { id: 104, type: 'Unknown', customerName: 'Other Test' },
  ];
  const { categorizedVisits, details } = buildVisitReport(rows);
  assert.deepEqual(categorizedVisits, { Shop: 1, 'Site Visit': 1, Architect: 0, Engineer: 0, Builder: 0, Others: 2 });
  for (const category of VISIT_REPORT_CATEGORIES) {
    assert.equal(categorizedVisits[category], details.filter(row => row.category === category).length);
  }
  assert.deepEqual(details.map(row => row.customerHref), ['/dashboard/customers/42', '/dashboard/projects/31', '/dashboard/institutions/21', null]);
  assert.deepEqual(details.filter(row => row.category === 'Others').map(row => row.customerName), ['Institution Test', 'Other Test']);
});

test('the screenshot case with twelve canonical dealer visits no longer mislabels them Others', () => {
  const { categorizedVisits, details } = buildVisitReport(Array.from({ length: 12 }, (_, id) => ({ id, visitType: 'DEALER_VISIT', clientAccountId: 42 })));
  assert.equal(categorizedVisits.Shop, 12);
  assert.equal(categorizedVisits.Others, 0);
  assert.equal(details.filter(row => row.category === 'Shop').length, 12);
});

test('legacy customer categories and whitespace/case variants remain supported', () => {
  const { details } = buildVisitReport([
    { clientType: ' dealer ' }, { customerType: 'retail' }, { type: 'Site Visit' },
    { clientType: 'ARCHITECT', visitType: 'INSTITUTIONAL_VISIT', institutionId: 21 },
    { customerType: 'Engineer' }, { type: 'builder' }, { clientType: 'other', visitType: 'PROJECT_SITE_VISIT' },
  ]);
  assert.deepEqual(details.map(row => row.category), ['Shop', 'Shop', 'Site Visit', 'Architect', 'Engineer', 'Builder', 'Site Visit']);
  assert.equal(details[3].customerHref, '/dashboard/institutions/21');
});

test('institution visits use their own name and ID even when unrelated IDs are also present', () => {
  const { details } = buildVisitReport([
    { id: 999, visitType: 'INSTITUTIONAL_VISIT', clientAccountId: 42, projectId: 31, institutionId: 21, retailAccountName: 'Wrong retail', projectName: 'Wrong project', institutionName: 'Right institution' },
    { id: 998, visitType: 'PROJECT_SITE_VISIT', clientAccountId: 42, institutionId: 21, projectId: 31, projectName: 'Right project' },
  ]);
  assert.equal(details[0].customerHref, '/dashboard/institutions/21');
  assert.equal(details[0].customerName, 'Right institution');
  assert.equal(details[1].customerHref, '/dashboard/projects/31');
  assert.equal(details[1].customerName, 'Right project');
});

test('missing, invalid, or ambiguous parent IDs never become broken customer links', () => {
  const { details } = buildVisitReport([
    { id: 999, visitType: 'INSTITUTIONAL_VISIT', clientAccountId: 42 },
    { id: 998 }, { id: 997, institutionId: 0 }, { id: 996, projectId: -1 },
    { id: 995, clientAccountId: 1.5 }, { id: 994, institutionId: 'bad' },
    { id: 993, clientAccountId: 42, projectId: 31 },
  ]);
  assert.ok(details.every(row => row.customerHref === null));
  assert.equal(buildVisitReport([{ institutionId: '21', parentName: 'Fallback institution' }]).details[0].customerHref, '/dashboard/institutions/21');
});

test('location and visit date fields survive normalization, and empty reports have zero category counts', () => {
  const { details } = buildVisitReport([{ scheduledVisitDate: '2026-10-28', actualCheckinAt: '2026-10-28T09:00:00', actualCheckoutAt: '2026-10-28T10:00:00', locationCity: 'Ahmedabad', locationTaluka: 'Daskroi', locationState: 'Gujarat' }]);
  assert.equal(details[0].lastVisited, '2026-10-28T10:00:00');
  assert.deepEqual([details[0].city, details[0].taluka, details[0].state], ['Ahmedabad', 'Daskroi', 'Gujarat']);
  assert.deepEqual(buildVisitReport([]), { details: [], categorizedVisits: { Shop: 0, 'Site Visit': 0, Architect: 0, Engineer: 0, Builder: 0, Others: 0 } });
});

const filters = { assignedEmployeeId: 59, from: '2026-10-22', to: '2026-10-28', size: 100 };

test('all visit pages, including wrapped pages, contribute to both counts and details', async (t) => {
  const rows = Array.from({ length: 212 }, (_, id) => ({ id: id + 1, visitType: 'INSTITUTIONAL_VISIT', institutionId: 21, institutionName: `Institution ${id + 1}` }));
  const requests = [];
  t.mock.method(globalThis, 'fetch', async (url, init) => {
    const search = new URL(url).searchParams;
    requests.push(Number(search.get('page')));
    assert.equal(search.get('assignedEmployeeId'), '59');
    assert.equal(search.get('from'), filters.from);
    assert.equal(search.get('to'), filters.to);
    assert.equal(search.get('size'), '100');
    assert.equal(init.headers.Authorization, 'Bearer test-token');
    const page = Number(search.get('page'));
    const body = { content: rows.slice(page * 100, (page + 1) * 100), number: page, size: 100, totalElements: 212, totalPages: 3, last: page === 2 };
    return Response.json(page === 1 ? { data: body } : body);
  });
  const loaded = await loadVisitReportRows(page => visitsApi.getCommonVisits('test-token', { ...filters, page }));
  assert.deepEqual(requests, [0, 1, 2]);
  assert.equal(loaded.length, 212);
  const report = buildVisitReport(loaded);
  assert.equal(report.categorizedVisits.Others, 212);
  assert.equal(report.details.filter(row => row.category === 'Others').length, 212);
});

test('plain-array and empty responses terminate without requesting nonexistent pages', async (t) => {
  const fetchMock = t.mock.method(globalThis, 'fetch', async () => Response.json([{ id: 1, visitType: 'DEALER_VISIT', clientAccountId: 42 }]));
  assert.equal((await loadVisitReportRows(page => visitsApi.getCommonVisits('test-token', { ...filters, page }))).length, 1);
  assert.equal(fetchMock.mock.callCount(), 1);
  assert.deepEqual(await loadVisitReportRows(async page => ({ content: [], number: page, last: true })), []);
});

test('later-page failures and unexpected pages fail the report instead of showing partial counts', async (t) => {
  t.mock.method(globalThis, 'fetch', async url => new URL(url).searchParams.get('page') === '0'
    ? Response.json({ content: [{ id: 1 }], number: 0, last: false, totalPages: 2 })
    : Response.json({ message: 'Visit service unavailable' }, { status: 503 }));
  await assert.rejects(loadVisitReportRows(page => visitsApi.getCommonVisits('test-token', { ...filters, page })), /Visit service unavailable/);
  await assert.rejects(loadVisitReportRows(async () => ({ content: [], number: 5, last: false })), /unexpected page/);
});

test('the report timeout signal reaches the visits request', async (t) => {
  const controller = new AbortController();
  t.mock.method(globalThis, 'fetch', async (_url, init) => {
    assert.equal(init.signal, controller.signal);
    init.signal.throwIfAborted();
    return Response.json([]);
  });
  controller.abort();
  await assert.rejects(visitsApi.getCommonVisits('test-token', { ...filters, page: 0 }, controller.signal), { name: 'AbortError' });
});
