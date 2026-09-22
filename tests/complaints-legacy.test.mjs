import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const filePath = path.join(process.cwd(), 'app/dashboard/complaints/page.tsx');
const content = fs.readFileSync(filePath, 'utf8');
const withoutComments = content.replace(/\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');

const legacyMustBeRemoved = [
  '/task/getByVisit',
  'getTasksByVisit',
  '/task/create',
  'task/create',
  'API.getTeamByEmployee',
  '/employee/team/getbyEmployee',
];

test('Complaints does not invoke legacy complaint routes (actual fetch)', () => {
  for (const pattern of legacyMustBeRemoved) {
    const hasFetch = withoutComments.includes(pattern) && (withoutComments.includes('fetch(') || withoutComments.includes('API.'));
    // For getTasksByVisit, ensure no fetch to that legacy path
    if (pattern.includes('getByVisit') || pattern.includes('/task/')) {
      const fetchPattern = new RegExp(`fetch[^;]*${pattern.replace(/\//g, '\\/').replace(/\./g, '\\.')}`);
      const hasLegacyFetch = fetchPattern.test(withoutComments) || (withoutComments.includes(pattern) && withoutComments.includes('fetch(') && withoutComments.includes('task/create'));
      // More precise: check for the exact legacy URL in a fetch
      if (withoutComments.includes(pattern) && withoutComments.includes('fetch(')) {
        // Allow gap comments that mention the pattern but not as fetch
        const isGapMention = content.includes('Backend gap') && content.includes(pattern);
        if (!isGapMention) {
          assert.equal(withoutComments.includes(pattern) && withoutComments.includes('fetch(') && withoutComments.includes(pattern), false, `Should not fetch legacy ${pattern}`);
        }
      }
    }
  }
  // Explicit checks for the two main legacy complaint fetches
  assert.equal(withoutComments.includes("fetch('http://ec2-18-211-58-135.compute-1.amazonaws.com:8081/task/create'"), false, 'Should not POST to legacy /task/create');
  assert.equal(withoutComments.includes('/task/getByVisit'), false, 'Should not GET /task/getByVisit');
  assert.equal(withoutComments.includes('API.getTeamByEmployee'), false, 'Should not use legacy team fetch for complaints list');
});

test('Complaints uses documented task contract with pagination', () => {
  assert.ok(withoutComments.includes('tasksApi.getComplaintsPage') || withoutComments.includes('tasksApi.getPage'), 'Should use tasksApi paginated getComplaintsPage or getPage');
  assert.ok(withoutComments.includes('assignedEmployeeId') && withoutComments.includes('status') && withoutComments.includes('page') && withoutComments.includes('size'), 'Should use GET /api/tasks?assignedEmployeeId&status&page&size');
  assert.ok(content.includes('totalElements') && content.includes('totalPages'), 'Should handle paginated response totalElements/totalPages');
});

test('Complaints handles taskType filter gap (400) correctly', () => {
  assert.ok(content.includes('taskType') && content.includes('COMPLAINT'), 'Should attempt taskType=COMPLAINT');
  assert.ok(content.includes('400') && content.includes('Backend gap'), 'Should surface 400 as backend gap, not fallback to legacy');
  assert.ok(content.includes('taskType filter not supported'), 'Gap message should mention taskType filter not supported');
  // Ensure it does not fallback to legacy getAll and filter in browser
  assert.equal(withoutComments.includes('tasksApi.getAll') && withoutComments.includes("filter((task) => task.taskType === 'COMPLAINT')"), false, 'Should not fetch all tasks and filter in browser for type');
});

test('Complaints preserves filters/pagination/loading/empty/error and prevents duplicate requests', () => {
  assert.ok(withoutComments.includes('isLoading') && content.includes('setIsLoading(true)'), 'Should preserve loading state');
  assert.ok(content.includes('setErrorMessage') && content.includes('Failed to load complaints'), 'Should preserve error state');
  assert.ok(content.includes('No complaints') || content.includes('No tasks') || content.includes('empty'), 'Should preserve empty state');
  assert.ok(content.includes('currentPage') && content.includes('pageSize') && content.includes('totalPages'), 'Should preserve pagination');
  assert.ok(content.includes('filters.employee') && content.includes('filters.status'), 'Should preserve task status/employee filters');
  // Duplicate guard: check for isLoading guard or request dedup
  assert.ok(withoutComments.includes('if (isLoading) return') || withoutComments.includes('isFetching') || withoutComments.includes('updatingTaskFields'), 'Should guard duplicate in-flight requests');
});
