import test from 'node:test';
import assert from 'node:assert/strict';
import { applyApprovedAttendanceRequests } from '../lib/attendance-display.ts';

const log = (date, status, employeeId = 8) => ({ id: date, employeeId, employeeName: 'Test employee', attendanceDate: date, date, checkinDate: date, checkoutDate: null, attendanceStatus: status });
const request = (id, date, duration, status, employeeId = 8) => ({ id, employeeId, employeeName: 'Test employee', logDate: date, requestedStatus: duration, status, requestDate: date, actionDate: `${date}T10:00:00` });

test('approved corrections override logs without mutating API data', () => {
  const logs = [log('2026-09-17', 'HALF_DAY'), log('2026-09-21', 'PRESENT')];
  const result = applyApprovedAttendanceRequests(logs, [request(4, '2026-09-17', 'FULL_DAY', 'APPROVED'), request(7, '2026-09-21', 'FULL_DAY', 'APPROVED')]);
  assert.deepEqual(result.map(row => row.attendanceStatus), ['FULL_DAY', 'FULL_DAY']);
  assert.equal(logs[0].attendanceStatus, 'HALF_DAY');
});

test('pending and rejected requests do not override attendance', () => {
  const logs = [log('2026-09-19', 'PRESENT'), log('2026-09-29', 'FULL_DAY')];
  const result = applyApprovedAttendanceRequests(logs, [request(6, '2026-09-19', 'HALF_DAY', 'PENDING'), request(9, '2026-09-29', 'HALF_DAY', 'REJECTED')]);
  assert.deepEqual(result.map(row => row.attendanceStatus), ['PRESENT', 'FULL_DAY']);
});

test('latest approval wins, employee records stay separate, and approval without log is displayed', () => {
  const result = applyApprovedAttendanceRequests([log('2026-09-17', 'ABSENT')], [request(2, '2026-09-17', 'HALF_DAY', 'APPROVED'), request(1, '2026-09-17', 'FULL_DAY', 'APPROVED'), request(3, '2026-09-17', 'FULL_DAY', 'APPROVED', 9)]);
  assert.equal(result.find(row => row.employeeId === 8).attendanceStatus, 'HALF_DAY');
  assert.equal(result.find(row => row.employeeId === 9).attendanceStatus, 'FULL_DAY');
});
