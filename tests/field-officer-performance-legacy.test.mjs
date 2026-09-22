import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const componentPath = path.join(process.cwd(), 'components/FieldOfficerPerformanceReport.tsx');
const content = fs.readFileSync(componentPath, 'utf8');
const withoutComments = content.replace(/\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');

const legacyMustBeRemoved = [
  '/report/field-officer-performance',
  'getFieldOfficerPerformance',
  'API.getFieldOfficerPerformance',
  '/api/report/field-officer-performance',
];

test('Field Officer Performance tab does not invoke legacy aggregate routes (actual fetch)', () => {
  for (const pattern of legacyMustBeRemoved) {
    // Check for actual fetch/API call, not just comment
    const hasFetch = withoutComments.includes(pattern) && (withoutComments.includes('fetch(') || withoutComments.includes('API.'));
    // More precise: check if pattern appears in a fetch or API call context
    if (withoutComments.includes(pattern)) {
      // Allow gap comment that mentions the legacy route but not as a fetch
      const isGapMention = withoutComments.includes('Backend gap') && withoutComments.includes(pattern);
      // For this test, we want to ensure no actual fetch to that pattern
      // Check if the pattern is inside a fetch or API call
      const fetchPattern = new RegExp(`fetch\\s*\\([^)]*${pattern.replace(/\//g, '\\/')}`);
      const apiPattern = new RegExp(`API\\.${pattern.replace(/\//g, '\\/')}`);
      const hasActualCall = fetchPattern.test(withoutComments) || apiPattern.test(withoutComments) || withoutComments.includes(`API.getFieldOfficerPerformance`);
      assert.equal(hasActualCall, false, `Legacy aggregate should not be fetched: ${pattern}`);
    }
  }
  // Ensure no direct fetch to that endpoint
  assert.equal(withoutComments.includes("fetch(") && withoutComments.includes("/report/field-officer-performance"), false, 'Should not fetch /report/field-officer-performance');
  assert.equal(withoutComments.includes("API.getFieldOfficerPerformance"), false, 'Should not call API.getFieldOfficerPerformance');
});

test('Field Officer Performance uses documented paginated employees for selector and shows gap', () => {
  // Parent page already uses teamsApi.getEmployeesPage for officers, component should not refetch via legacy
  // Component should show explicit backend-gap message
  assert.ok(content.includes('Backend gap') && content.includes('field-officer-performance'), 'Should show explicit backend-gap for aggregate');
  assert.ok(content.includes('No 404 request was made') || content.includes('no aggregate contract'), 'Gap message should mention no 404');
  // Should preserve filters and duplicate guard
  assert.ok(withoutComments.includes('isLoading') && withoutComments.includes('if (isLoading) return'), 'Should guard duplicate requests via isLoading');
  assert.ok(content.includes('Date range') && content.includes('Field officer'), 'Should preserve officer/city/team filters');
});

test('Field Officer Performance does not invent aggregate contract', () => {
  // Ensure it does not try to build an aggregate from paginated visits/attendance as a workaround
  // The gap implementation should not call /api/common/visits for aggregate
  const hasVisitsAggregate = withoutComments.includes('/api/common/visits') && withoutComments.includes('from') && withoutComments.includes('assignedEmployeeId') && withoutComments.includes('targetValue');
  // For this tab, visits aggregate is not needed; it should just show gap
  assert.equal(hasVisitsAggregate, false, 'Should not invent visits aggregate for performance');
});
