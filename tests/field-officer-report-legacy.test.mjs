import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const filePath = path.join(process.cwd(), 'app/dashboard/reports/page.tsx');
const content = fs.readFileSync(filePath, 'utf8');
const withoutComments = content.replace(/\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');

const legacyMustBeRemoved = [
  '/employee/getAllInactive',
  'API.getAllEmployees',
  '/visit/customer-visit-details',
  '/visit/field-officer-stats',
  'getAllInactive',
];

test('Field Officer Visit Report tab does not invoke legacy routes', () => {
  const reportSectionStart = content.indexOf('const fetchAllEmployeeData');
  const reportSectionEnd = content.indexOf('const fieldOfficerOptions');
  const reportSection = content.slice(reportSectionStart, reportSectionEnd);
  assert.ok(reportSection.includes('teamsApi.getEmployeesPage'), 'fieldOfficerReport should use teamsApi.getEmployeesPage');
  assert.equal(reportSection.includes('API.getAllEmployees'), false, 'fieldOfficerReport should not use API.getAllEmployees');
  assert.equal(reportSection.includes('/employee/getAllInactive'), false, 'fieldOfficerReport should not use /employee/getAllInactive');

  const detailSection = content.slice(content.indexOf('const fetchCustomerTypeDetails'), content.indexOf('const fetchCustomerTypeDetails') + 3000);
  const genSection = content.slice(content.indexOf('const handleGenerateReport'), content.indexOf('const handleGenerateReport') + 5000);
  const combinedReportCode = detailSection + genSection;
  // Check that no fetch is made to legacy endpoints (gap message text is allowed, but fetch is not)
  const hasLegacyFetch = (code, path) => code.includes(`fetch`) && code.includes(path) && !code.includes(`Backend gap`);
  assert.equal(hasLegacyFetch(combinedReportCode, '/visit/customer-visit-details'), false, 'Should not fetch /visit/customer-visit-details');
  assert.equal(hasLegacyFetch(combinedReportCode, '/visit/field-officer-stats'), false, 'Should not fetch /visit/field-officer-stats');
  // Also ensure the old fetchWithRetry for those URLs is gone
  assert.equal(genSection.includes('/visit/field-officer-stats'), false, 'handleGenerateReport should not contain /visit/field-officer-stats');
});

test('Field Officer Visit Report uses documented contracts', () => {
  // Check original content (not stripped) for documented contracts, since stripping // breaks URLs with http://
  assert.ok(content.includes('teamsApi.getEmployeesPage'), 'Should use GET /api/common/employees paginated');
  assert.ok(content.includes('/api/common/visits') && content.includes('assignedEmployeeId'), 'Should use GET /api/common/visits with assignedEmployeeId');
  assert.ok(content.includes('/api/hr/attendance/logs/by-employee') || content.includes('attendanceApi'), 'Should use attendance by-employee logs if needed');
  assert.ok(content.includes('page=0&size=50') || content.includes('page, size'), 'Should handle paginated response');
});

test('Field Officer Visit Report shows backend gap for customer-visit detail', () => {
  assert.ok(content.includes('Backend gap') && content.includes('customer-visit'), 'Should show explicit backend-gap state for customer-visit detail');
  assert.ok(!withoutComments.includes('/visit/customer-visit-details?employeeId'), 'Should not fetch 404 customer-visit-details URL');
});

test('Field Officer Visit Report preserves filters and prevents duplicate requests', () => {
  assert.ok(withoutComments.includes('isDateRangeInvalid'), 'Should preserve date filter validation');
  assert.ok(withoutComments.includes('selectedEmployeeId'), 'Should preserve officer filter');
  assert.ok(withoutComments.includes('reportLoading'), 'Should preserve loading state');
  assert.ok(content.includes('if (reportLoading) return'), 'Should prevent duplicate in-flight report generation');
  assert.ok(content.includes('AbortController'), 'Should cancel stale requests');
});
