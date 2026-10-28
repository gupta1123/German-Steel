import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const filePath = path.join(process.cwd(), 'app/dashboard/reports/page.tsx');
const content = fs.readFileSync(filePath, 'utf8');
const withoutComments = content.replace(/\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');

test('Field Officer Visit Report tab does not invoke legacy routes', () => {
  const reportSectionStart = content.indexOf('const fetchAllEmployeeData');
  const reportSectionEnd = content.indexOf('const fieldOfficerOptions');
  const reportSection = content.slice(reportSectionStart, reportSectionEnd);
  assert.ok(reportSection.includes('teamsApi.getEmployeesPage'), 'fieldOfficerReport should use teamsApi.getEmployeesPage');
  assert.equal(reportSection.includes('API.getAllEmployees'), false, 'fieldOfficerReport should not use API.getAllEmployees');
  assert.equal(reportSection.includes('/employee/getAllInactive'), false, 'fieldOfficerReport should not use /employee/getAllInactive');

  const genSection = content.slice(content.indexOf('const handleGenerateReport'), content.indexOf('const handleGenerateReport') + 5000);
  assert.equal(genSection.includes('/visit/customer-visit-details'), false);
  assert.equal(genSection.includes('/visit/field-officer-stats'), false);
});

test('Field Officer Visit Report uses documented contracts', () => {
  assert.ok(content.includes('teamsApi.getEmployeesPage'), 'Should use GET /api/common/employees paginated');
  assert.ok(content.includes('visitsApi.getCommonVisits') && content.includes('assignedEmployeeId'), 'Should use common visits with assignedEmployeeId');
  assert.ok(content.includes('reportsApi.employeeCounts'), 'Attendance and visit totals come from the documented counts report');
  assert.ok(content.includes('loadVisitReportRows'), 'Should retrieve all visit pages');
});

test('summary and drill-down share the generated snapshot and use real customer routes', () => {
  assert.match(content, /const \{ categorizedVisits, details \} = buildVisitReport\(visitsContent\)/);
  assert.match(content, /reportVisits\.filter\(visit => visit\.category === selectedCustomerTypeForDetails\)/);
  assert.match(content, /onClick=\{\(\) => setSelectedCustomerTypeForDetails\(category\)\}/);
  assert.match(content, /setReportContext\(\{ employeeName: selectedEmployeeName, from: startDate, to: endDate \}\)/);
  assert.match(content, /href=\{detail\.customerHref\}/);
  assert.ok(!content.includes('/CustomerDetailPage/'));
  assert.ok(!content.includes('fetchCustomerTypeDetails'), 'Category selection must not refetch different data');
});

test('Field Officer Visit Report preserves filters and prevents duplicate requests', () => {
  assert.ok(withoutComments.includes('isDateRangeInvalid'), 'Should preserve date filter validation');
  assert.ok(withoutComments.includes('selectedEmployeeId'), 'Should preserve officer filter');
  assert.ok(withoutComments.includes('reportLoading'), 'Should preserve loading state');
  assert.ok(content.includes('if (reportLoading) return'), 'Should prevent duplicate in-flight report generation');
  assert.ok(content.includes('AbortController'), 'Should bound report requests');
});
