import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { RetailAPI, resolvePricingOfficerName } from '../lib/retail-api.ts';

const employees = [
  { id: 59, firstName: 'Sunil', lastName: 'Vachheta' },
  { id: 67, firstName: 'Ashish', lastName: 'Vyas' },
];

test('pricing records resolve their own officer by employee ID, not the selected filter or list position', () => {
  assert.equal(resolvePricingOfficerName({ createdByEmployeeId: 67, createdByEmployeeName: '' }, employees), 'Ashish Vyas');
  assert.equal(resolvePricingOfficerName({ createdByEmployeeId: 59, createdByEmployeeName: '' }, employees), 'Sunil Vachheta');
});

test('a supplied officer name is retained even if the employee is inactive or absent from the directory', () => {
  assert.equal(resolvePricingOfficerName({ createdByEmployeeId: 99, createdByEmployeeName: ' former officer ' }, employees), 'Former Officer');
  assert.equal(resolvePricingOfficerName({ createdByEmployeeId: 59, createdByEmployeeName: 'CANONICAL NAME' }, employees), 'Canonical Name');
});

test('blank names fall back to the directory and single-part names are supported', () => {
  assert.equal(resolvePricingOfficerName({ createdByEmployeeId: 59, createdByEmployeeName: '   ' }, employees), 'Sunil Vachheta');
  assert.equal(resolvePricingOfficerName({ createdByEmployeeId: 1, createdByEmployeeName: '' }, [{ id: 1, firstName: ' faizan ', lastName: '' }]), 'Faizan');
});

test('unknown authors are explicitly identified without assigning another officer to the price', () => {
  assert.equal(resolvePricingOfficerName({ createdByEmployeeId: 99, createdByEmployeeName: '' }, employees), 'Employee #99');
  assert.equal(resolvePricingOfficerName({ createdByEmployeeId: null, createdByEmployeeName: '' }, employees), '—');
  assert.equal(resolvePricingOfficerName({ createdByEmployeeId: 59, createdByEmployeeName: '' }, []), 'Employee #59');
});

test('names update when the employee directory arrives after the prices', () => {
  const row = { createdByEmployeeId: 59, createdByEmployeeName: '' };
  assert.equal(resolvePricingOfficerName(row, []), 'Employee #59');
  assert.equal(resolvePricingOfficerName(row, employees), 'Sunil Vachheta');
  const source = fs.readFileSync(new URL('../app/dashboard/pricing/page.tsx', import.meta.url), 'utf8');
  assert.match(source, /resolvePricingOfficerName\(row, employees\).*\[rows, employees\]/);
  assert.match(source, /title=\{row\.officerName\}>\{row\.officerName\}/);
  assert.match(source, /whitespace-normal break-words/);
});

test('pricing API preserves employee IDs, supports the legacy creator fields, and keeps filtering and pagination intact', async (t) => {
  t.mock.method(globalThis, 'fetch', async (url, options) => {
    const parsed = new URL(url);
    assert.equal(parsed.pathname, '/api/retail/pricing');
    assert.equal(parsed.searchParams.get('assignedEmployeeId'), '59');
    assert.equal(parsed.searchParams.get('page'), '1');
    assert.equal(parsed.searchParams.get('size'), '25');
    assert.equal(parsed.searchParams.get('from'), '2026-10-28');
    assert.equal(options.headers.Authorization, 'Bearer test-token');
    return Response.json({ data: { number: 1, size: 25, totalElements: 27, totalPages: 2, content: [
      { id: 1, createdByEmployeeId: '59', createdByEmployeeName: null },
      { id: 2, employeeId: '67', employeeName: 'ASHISH VYAS' },
      { id: 3, createdByEmployeeId: 59, createdByEmployeeName: 'Sunil Vachheta', employeeId: 67, employeeName: 'Wrong Name' },
      { id: 4, createdByEmployeeId: 59, employeeId: 67, employeeName: 'Wrong Name' },
    ] } });
  });
  const result = await RetailAPI.getPricing('test-token', { assignedEmployeeId: 59, page: 1, size: 25, from: '2026-10-28' });
  assert.deepEqual(result.content.map(row => row.createdByEmployeeId), [59, 67, 59, 59]);
  assert.deepEqual(result.content.map(row => resolvePricingOfficerName(row, employees)), ['Sunil Vachheta', 'Ashish Vyas', 'Sunil Vachheta', 'Sunil Vachheta']);
  assert.deepEqual([result.number, result.size, result.totalElements, result.totalPages], [1, 25, 27, 2]);
});
