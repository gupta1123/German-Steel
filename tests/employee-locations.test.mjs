import test from 'node:test';
import assert from 'node:assert/strict';
import { validCoordinates, locationTimestamp, locationAge, latestLocationMarkers, journeyLocationMarkers, groupNearbyPoints, sortEmployeesByLocationUpdate } from '../lib/employee-locations.ts';

test('employee panel sorts by latest GPS timestamp, then case-insensitive name', () => {
  const employees = [
    { id: 1, name: 'Zoya', hasLocation: true, locationTimestamp: 300 },
    { id: 2, name: 'Arun', hasLocation: true, locationTimestamp: 100 },
    { id: 3, name: 'Bhargav', hasLocation: true, locationTimestamp: 200 },
    { id: 4, name: 'ashish', hasLocation: true, locationTimestamp: 200 },
  ];
  const original = structuredClone(employees);
  assert.deepEqual(sortEmployeesByLocationUpdate(employees).map(e => e.id), [1, 4, 3, 2]);
  assert.deepEqual(employees, original);
});

test('missing or invalid update times and employees without GPS sort last A–Z', () => {
  const employees = [
    { id: 1, name: 'Zoya', hasLocation: true, locationTimestamp: NaN },
    { id: 2, name: 'Bhargav', hasLocation: false, locationTimestamp: 999 },
    { id: 3, name: 'Arun', hasLocation: true, locationTimestamp: null },
    { id: 4, name: 'Yash', hasLocation: true, locationTimestamp: 100 },
    { id: 5, name: 'Chirag', hasLocation: true, locationTimestamp: Infinity },
    { id: 6, name: 'Deepak' },
  ];
  assert.deepEqual(sortEmployeesByLocationUpdate(employees).map(e => e.id), [4, 3, 2, 5, 6, 1]);
});

test('location refresh reorders employees and identical names have stable ID ties', () => {
  const employees = [
    { id: 2, name: 'Arun', hasLocation: true, locationTimestamp: 100 },
    { id: 1, name: 'arun', hasLocation: true, locationTimestamp: 100 },
  ];
  assert.deepEqual(sortEmployeesByLocationUpdate(employees).map(e => e.id), [1, 2]);
  employees[0].locationTimestamp = 200;
  assert.deepEqual(sortEmployeesByLocationUpdate(employees).map(e => e.id), [2, 1]);
  assert.deepEqual(sortEmployeesByLocationUpdate([]), []);
});

test('coordinates reject missing, infinite, out-of-range and null-island values', () => {
  for (const point of [[null, 72], ['', 72], [NaN, 72], [Infinity, 72], [91, 72], [18, 181], [0, 0]]) assert.equal(validCoordinates(...point), false);
  for (const point of [[18, 72], [0, 72], [18, 0], ['18', '72'], [-90, -180]]) assert.equal(validCoordinates(...point), true);
});
test('API timestamps use India time and preserve explicit offsets', () => {
  assert.equal(locationTimestamp('2026-08-31', '00:15:00.123'), Date.parse('2026-08-30T18:45:00.123Z'));
  assert.equal(locationTimestamp('2026-08-31T00:15:00Z'), Date.parse('2026-08-31T00:15:00Z'));
  assert.equal(locationTimestamp('bad date', 'xx'), null);
});
test('old or unknown GPS never implies online presence', () => {
  const now = Date.parse('2026-08-31T12:00:00Z');
  assert.equal(locationAge(now - 2 * 60_000, now).fresh, true);
  assert.equal(locationAge(now - 15 * 60_000, now).fresh, false);
  assert.equal(locationAge(now - 2 * 86400_000, now).label, 'Updated 2 days ago');
  assert.equal(locationAge(null, now).fresh, false);
  assert.equal(locationAge(now + 86400_000, now).label, 'Update time unavailable');
});
test('last-known markers deduplicate by employee, select newest valid fix, and retain older dates', () => {
  const row = { empId: 32, empName: 'Officer', latitude: 12.97, longitude: 77.59, updatedAt: '2026-08-13', updatedTime: '17:00:00' };
  const markers = latestLocationMarkers([row, { ...row, updatedAt: '2026-08-29', latitude: 13 }, { ...row, updatedAt: '2026-08-31', latitude: NaN }]);
  assert.equal(markers.length, 1);
  assert.equal(markers[0].lat, 13);
  assert.equal(markers[0].updatedAt, locationTimestamp('2026-08-29', '17:00:00'));
});
test('journeys obey local date boundaries, stable chronological order and preserve unmapped visit gaps', () => {
  const point = { id: 1, employeeId: 32, employeeName: 'Officer', storeName: 'Store', lat: 12, lng: 77, coordinateSource: 'CHECKIN', visitDate: '2026-08-01', checkinTime: '00:01:00' };
  const result = journeyLocationMarkers([
    { ...point, id: 4, visitDate: '2026-09-01' },
    { ...point, id: 3, visitDate: '2026-08-31', checkinTime: '23:59:59' },
    { ...point, id: 2, checkinTime: '10:00:00', lat: 0, lng: 0 },
    point, point,
  ], '2026-08-01', '2026-08-31');
  assert.equal(result.total, 3);
  assert.equal(result.unmapped, 1);
  assert.deepEqual(result.markers.map(m => [m.visitId, m.order]), [[1, 1], [3, 3]]);
  assert.equal(result.markers[0].coordinateSource, 'CHECKIN');
});
test('overlapping points group without mutating GPS or losing records', () => {
  const points = [{ x: 1, y: 2, id: 1 }, { x: 1, y: 2, id: 2 }, { x: 200, y: 200, id: 3 }];
  const original = structuredClone(points);
  assert.deepEqual(groupNearbyPoints(points).map(group => group.length), [2, 1]);
  assert.deepEqual(points, original);
  assert.deepEqual(groupNearbyPoints([{ x: 0, y: 0 }, { x: 60, y: 0 }, { x: 30, y: 0 }]).map(group => group.length), [3]);
});
