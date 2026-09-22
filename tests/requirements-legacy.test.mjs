import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const filePath = path.join(process.cwd(), 'app/dashboard/requirements/page.tsx');
const content = fs.readFileSync(filePath, 'utf8');
const withoutComments = content.replace(/\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');

const legacyMustBeRemoved = [
  '/task/getByVisit',
  'getTasksByVisit',
  '/task/create',
  'task/create',
  'API.getTeamByEmployee',
  '/employee/team/getbyEmployee',
  'getAll()',
];

test('Requirements does not invoke legacy requirement routes (actual fetch)', () => {
  for (const pattern of legacyMustBeRemoved) {
    if (pattern === 'getAll()') {
      // Ensure tasksApi.getAll is NOT used — server-side pagination replaces it
      assert.equal(withoutComments.includes('tasksApi.getAll('), false, 'Should not use tasksApi.getAll — use paginated getRequirementsPage instead');
      continue;
    }
    if (withoutComments.includes(pattern) && withoutComments.includes('fetch(')) {
      const isGapMention = content.includes('Backend gap') && content.includes(pattern);
      if (!isGapMention) {
        assert.fail(`Should not fetch legacy ${pattern}`);
      }
    }
  }
  assert.equal(withoutComments.includes("fetch('http://ec2-18-211-58-135.compute-1.amazonaws.com:8081/task/create'"), false, 'Should not POST to legacy /task/create');
  assert.equal(withoutComments.includes('/task/getByVisit'), false, 'Should not GET /task/getByVisit');
  assert.equal(withoutComments.includes('API.getTeamByEmployee'), false, 'Should not use legacy team fetch for requirements list');
});

test('Requirements uses documented task contract with server-side pagination', () => {
  assert.ok(withoutComments.includes('tasksApi.getRequirementsPage'), 'Should use tasksApi.getRequirementsPage');
  assert.ok(withoutComments.includes('assignedEmployeeId') && withoutComments.includes('status') && withoutComments.includes('page') && withoutComments.includes('size'), 'Should use GET /api/tasks?assignedEmployeeId&status&page&size');
  assert.ok(content.includes('totalElements') && content.includes('totalPages'), 'Should handle paginated response totalElements/totalPages');
  assert.ok(content.includes('currentPage') && content.includes('pageSize'), 'Should manage currentPage and pageSize state');
});

test('Requirements handles taskType filter gap (400) correctly', () => {
  assert.ok(content.includes('taskType') && content.includes('REQUIREMENT'), 'Should attempt taskType=REQUIREMENT');
  assert.ok(content.includes('400') && content.includes('Backend gap'), 'Should surface 400 as backend gap, not fallback to legacy');
  assert.ok(content.includes('taskType filter not supported') || content.includes('taskType=REQUIREMENT') && content.includes('returned 400'), 'Gap message should mention taskType 400');
  // Ensure it does not fallback to legacy getAll and filter in browser
  assert.equal(withoutComments.includes('tasksApi.getAll') && withoutComments.includes("filter((task) => task.taskType === 'REQUIREMENT')"), false, 'Should not fetch all tasks and filter in browser for type');
});

test('Requirements preserves filters/pagination/loading/empty/error and prevents refresh loops', () => {
  assert.ok(withoutComments.includes('isLoading') && content.includes('setIsLoading(true)'), 'Should preserve loading state');
  assert.ok(content.includes('setErrorMessage') && content.includes('Failed to load requirements'), 'Should preserve error state');
  assert.ok(content.includes('No requirements') || content.includes('empty'), 'Should preserve empty state');
  assert.ok(content.includes('currentPage') && content.includes('pageSize') && content.includes('totalPages'), 'Should preserve pagination');
  assert.ok(content.includes('filters.employee') && content.includes('filters.status'), 'Should preserve task status/employee filters');
  // Duplicate guard: check for requestId dedup
  assert.ok(withoutComments.includes('fetchRequestIdRef') || withoutComments.includes('isFetching') || withoutComments.includes('requestId'), 'Should guard duplicate in-flight requests via requestId');
  assert.ok(withoutComments.includes('if (requestId !== fetchRequestIdRef.current) return'), 'Should abort stale fetches with requestId check');
});
