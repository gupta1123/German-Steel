import test from 'node:test';
import assert from 'node:assert/strict';
import { suggestEmployeeId, employeeIdExists } from '../lib/employee-id.ts';

test('increments highest ID including archived records, preserves padding, and ignores duplicates', () => {
  assert.equal(suggestEmployeeId([{ employeeId: 'EMP-001' }, { employeeId: 'EMP-027' }, { employeeId: 'EMP-027' }, { employeeId: 'EMP-030' }]), 'EMP-031');
  assert.equal(suggestEmployeeId([{ employeeId: 'EMP-999' }]), 'EMP-1000');
});
test('uses most common ID series, not unrelated test IDs or database IDs', () => {
  assert.equal(suggestEmployeeId([{ employeeId: 'GS001' }, { employeeId: 'GS009' }, { employeeId: 'TEST20260831' }, { id: 99999, userDto: { employeeId: 123 } }]), 'GS010');
  assert.equal(suggestEmployeeId([{ employeeId: 9 }, { employeeId: 17 }]), '18');
  assert.equal(suggestEmployeeId([{ employeeId: '9007199254740993' }]), '9007199254740994');
});
test('handles empty directories and detects reused IDs case-insensitively', () => {
  assert.equal(suggestEmployeeId([]), 'EMP-001');
  assert.equal(suggestEmployeeId([{ employeeId: null }, { employeeId: 'Legacy' }]), 'EMP-001');
  assert.equal(employeeIdExists([{ employeeId: 'emp-001' }], ' EMP-001 '), true);
  assert.equal(employeeIdExists([{ employeeId: 'EMP-001' }], 'EMP-002'), false);
});
