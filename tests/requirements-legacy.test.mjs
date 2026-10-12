import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const filePath = path.join(process.cwd(), 'app/dashboard/requirements/page.tsx');
const content = fs.readFileSync(filePath, 'utf8');
const withoutComments = content.replace(/\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');
const tasksApiContent = fs.readFileSync(path.join(process.cwd(), 'lib/tasks-api.ts'), 'utf8');
const tasksApiWithoutComments = tasksApiContent.replace(/\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');

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
  assert.ok(tasksApiWithoutComments.includes('/api/tasks/visible?') && tasksApiWithoutComments.includes('page: String(page)') && tasksApiWithoutComments.includes('size: String(pageSize)'), 'Should fetch the paginated visible-task contract');
  assert.ok(tasksApiContent.includes('totalElements') && tasksApiContent.includes('totalPages'), 'Should calculate type-specific pagination metadata');
  assert.ok(content.includes('currentPage') && content.includes('pageSize'), 'Should manage currentPage and pageSize state');
});

test('Requirements filters mixed task pages by type before slicing', () => {
  assert.ok(tasksApiWithoutComments.includes("getTaskTypePage(token, 'REQUIREMENT', opts)"), 'Should request the requirement-specific page');
  assert.ok(tasksApiWithoutComments.includes('getAllVisibleTasks(token, params)'), 'Should inspect all server pages before filtering task type');
  assert.ok(tasksApiWithoutComments.includes('task.taskType === taskType') && tasksApiWithoutComments.includes('matchingTasks.slice(page * size'), 'Should filter task type before computing page content');
  assert.ok(tasksApiWithoutComments.includes('/api/Task/getById?id=${task.id}'), 'Should enrich visible cards with the existing task-details API');
  assert.ok(content.includes('task.taskDesciption'), 'Should show requirement descriptions in cards');
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
