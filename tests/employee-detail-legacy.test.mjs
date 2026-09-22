import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const filePath = path.join(process.cwd(), 'app/dashboard/employee/[id]/page.tsx');
const content = fs.readFileSync(filePath, 'utf8');

const legacyCodePatterns = [
  'API.getEmployeeById(',
  'API.getEmployeeStatsOptimized(',
  'API.getEmployeeDashboardSummary(',
  'API.getEmployeeById',
  '/expense/getByEmployeeAndDate',
  '/brand/getByDateRangeForEmployee',
  'getLiveLocation',
];

test('Employee detail page does not invoke legacy routes', () => {
  // Check for actual legacy code invocations, not gap-report comments
  for (const pattern of legacyCodePatterns) {
    // Allow the gap-report comment that mentions the missing direct GET, but not actual calls
    const withoutGapComment = content.replace(/\/\/.*No legacy.*/g, '').replace(/Backend gap:.*/g, '');
    assert.equal(withoutGapComment.includes(pattern), false, `Legacy code still present: ${pattern}`);
  }
  // Ensure no direct fetch to legacy employee endpoints
  assert.equal(content.includes('fetch(`http://ec2-18-211-58-135.compute-1.amazonaws.com:8081/employee/getById'), false);
  assert.equal(content.includes('fetch(`http://ec2-18-211-58-135.compute-1.amazonaws.com:8081/expense/getByEmployeeAndDate'), false);
  assert.equal(content.includes('fetch(`http://ec2-18-211-58-135.compute-1.amazonaws.com:8081/brand/getByDateRangeForEmployee'), false);
});

test('Employee detail page uses documented new contracts', () => {
  const required = [
    'visitsApi.getCommonVisits',
    'attendanceApi.getByEmployee',
    'expensesApi.getByEmployee',
    'date-range-breakdown',
    '/api/hr/targets?employeeId',
    '/api/hr/tracking/current-location',
    '/api/hr/tracking/location-history',
  ];
  for (const snippet of required) {
    assert.ok(content.includes(snippet), `Missing required new contract usage: ${snippet}`);
  }
  // Verify visits uses assignedEmployeeId with pagination/date filters (from/to)
  assert.ok(content.includes('assignedEmployeeId: employeeIdNum'), 'Visits should use assignedEmployeeId');
  assert.ok(content.includes('from: startDate'), 'Visits should use from LocalDate');
  assert.ok(content.includes('to: endDate'), 'Visits should use to LocalDate');
});

test('Employee fetch uses documented direct GET /api/common/employees/{id}', () => {
  assert.ok(content.includes('teamsApi.getEmployeeById'), 'Should use documented direct GET getEmployeeById');
  assert.ok(content.includes('/api/common/employees'), 'Should reference documented URL /api/common/employees/{id}');
  assert.equal(content.includes('API.getEmployeeById'), false, 'Should not use legacy API.getEmployeeById');
  assert.equal(content.includes('API.getAllEmployees'), false, 'Should not fetch entire directory via API.getAllEmployees');
});

test('Pagination and LocalDate handling present', () => {
  assert.ok(content.includes('page: visitPage - 1'), 'Visits should use pagination page = visitPage -1');
  assert.ok(content.includes('from: startDate'), 'Should use from/to LocalDate');
  assert.ok(content.includes('to: endDate'), 'Should use from/to LocalDate');
});
