import test from 'node:test';
import assert from 'node:assert/strict';
import { groupOfficerTargets, summarizeTargets, targetAchieved } from '../lib/officer-targets.ts';

const employees = [
  { id: 1, firstName: 'Bangalore', lastName: 'Officer', role: 'ROLE_FIELD_OFFICER', employeeId: 101 },
  { id: 2, firstName: 'Unassigned', lastName: 'Officer', role: 'Field Officer' },
  { id: 3, firstName: 'Admin', role: 'ROLE_ADMIN' },
  { id: 4, firstName: 'Manager', role: 'office manager' },
];
const target = (overrides = {}) => ({ id: 10, employeeId: 1, storeId: 42, targetTons: 10, effectiveFulfilledTons: 2, targetType: 'MONTHLY', month: 8, year: 2026, ...overrides });

test('groups store allocations by officer and includes unassigned officers, never admins/managers', () => {
  const groups = groupOfficerTargets(employees, [target(), target({ id: 11, storeId: 43, targetTons: 20, effectiveFulfilledTons: 5 }), target({ employeeId: 3 }), target({ employeeId: 4 })]);
  assert.equal(groups.length, 2);
  const assigned = groups.find((row) => row.id === 1);
  assert.deepEqual([assigned.target, assigned.achieved, assigned.remaining, assigned.storeCount, assigned.code], [30, 7, 23, 2, '101']);
  assert.equal(assigned.percent, 7 / 30 * 100);
  assert.equal(groups.find((row) => row.id === 2).targets.length, 0);
});

test('counts unique stores for daily targets, preserving each dated allocation', () => {
  const [row] = groupOfficerTargets([employees[0]], [target({ targetType: 'DAILY', targetDate: '2026-08-01' }), target({ id: 11, targetType: 'DAILY', targetDate: '2026-08-02' })]);
  assert.equal(row.storeCount, 1);
  assert.equal(row.targets.length, 2);
  assert.equal(row.target, 20);
});

test('uses authoritative effective achievement, including zero; falls back to manual then sales', () => {
  assert.equal(targetAchieved(target({ effectiveFulfilledTons: 0, fulfilledTons: 4, salesTons: 8 })), 0);
  assert.equal(targetAchieved(target({ effectiveFulfilledTons: null, fulfilledTons: 4, salesTons: 8 })), 4);
  assert.equal(targetAchieved(target({ effectiveFulfilledTons: null, fulfilledTons: null, salesTons: 8 })), 8);
});

test('overachievement at one store does not cancel another store remaining target', () => {
  const totals = summarizeTargets([target({ effectiveFulfilledTons: 15 }), target({ id: 11, storeId: 43, effectiveFulfilledTons: 0 })]);
  assert.deepEqual(totals, { target: 20, achieved: 15, remaining: 10, percent: 75 });
  assert.deepEqual(summarizeTargets([]), { target: 0, achieved: 0, remaining: 0, percent: 0 });
});

test('retains API allocations whose officer is missing from a partial directory', () => {
  const rows = groupOfficerTargets([], [target({ employeeName: 'Existing officer' })]);
  assert.equal(rows[0].name, 'Existing officer');
  assert.equal(rows[0].target, 10);
});
