import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { getTaskRelatedRecord } from '../lib/task-related-record.ts';
import { tasksApi } from '../lib/tasks-api.ts';

test('project, institution, and retail complaints open their own record types', () => {
  assert.deepEqual(getTaskRelatedRecord({ projectId: 42 }), { href: '/dashboard/projects/42', label: 'View Project' });
  assert.deepEqual(getTaskRelatedRecord({ institutionId: 67 }), { href: '/dashboard/institutions/67', label: 'View Institution' });
  assert.deepEqual(getTaskRelatedRecord({ clientAccountId: 59 }), { href: '/dashboard/customers/59', label: 'View Store' });
});

test('project linkage takes precedence over parent institution and legacy store context', () => {
  assert.deepEqual(getTaskRelatedRecord({ projectId: 42, institutionId: 67, clientAccountId: 59 }), { href: '/dashboard/projects/42', label: 'View Project' });
  assert.deepEqual(getTaskRelatedRecord({ institutionId: 67, clientAccountId: 59 }), { href: '/dashboard/institutions/67', label: 'View Institution' });
});

test('missing or invalid IDs cannot navigate to a customer-not-found page', () => {
  for (const id of [undefined, null, 0, -1, 1.5, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1]) {
    assert.equal(getTaskRelatedRecord({ projectId: id, institutionId: id, clientAccountId: id }), null);
  }
  assert.equal(getTaskRelatedRecord({}), null);
  assert.deepEqual(getTaskRelatedRecord({ projectId: 0, institutionId: null, clientAccountId: 59 }), { href: '/dashboard/customers/59', label: 'View Store' });
});

const makeTask = (id, links) => ({ id, taskTitle: `Complaint ${id}`, taskType: 'COMPLAINT', status: 'OPEN', priority: 'HIGH', dueDate: '2026-10-29', ...links });

test('detail enrichment preserves visible-list parent IDs when rich details omit them', async (t) => {
  const visible = [makeTask(1, { projectId: 42 }), makeTask(2, { institutionId: 67 }), makeTask(3, { clientAccountId: 59 })];
  t.mock.method(globalThis, 'fetch', async (url) => {
    const parsed = new URL(url);
    if (parsed.pathname === '/api/tasks/visible') return Response.json({ content: visible, totalPages: 1, totalElements: 3, number: 0, size: 50 });
    assert.equal(parsed.pathname, '/api/Task/getById');
    return Response.json({ ...makeTask(Number(parsed.searchParams.get('id')), {}), taskDescription: 'Full description' });
  });
  const page = await tasksApi.getComplaintsPage('test-token');
  assert.deepEqual(page.content.map(getTaskRelatedRecord), [
    { href: '/dashboard/projects/42', label: 'View Project' },
    { href: '/dashboard/institutions/67', label: 'View Institution' },
    { href: '/dashboard/customers/59', label: 'View Store' },
  ]);
  assert.ok(page.content.every((task) => task.taskDescription === 'Full description'));
});

test('parent links returned only in task details are retained, with project priority', async (t) => {
  t.mock.method(globalThis, 'fetch', async (url) => {
    if (new URL(url).pathname === '/api/tasks/visible') return Response.json({ content: [makeTask(1, {})], totalPages: 1, totalElements: 1 });
    return Response.json(makeTask(1, { projectId: 42, institutionId: 67 }));
  });
  const page = await tasksApi.getComplaintsPage('test-token');
  assert.deepEqual(getTaskRelatedRecord(page.content[0]), { href: '/dashboard/projects/42', label: 'View Project' });
});

test('parent navigation still works when detail enrichment fails', async (t) => {
  t.mock.method(globalThis, 'fetch', async (url) => {
    if (new URL(url).pathname === '/api/tasks/visible') return Response.json({ content: [makeTask(1, { projectId: 42 })], totalPages: 1, totalElements: 1 });
    return Response.json({ message: 'Temporarily unavailable' }, { status: 503 });
  });
  const page = await tasksApi.getComplaintsPage('test-token');
  assert.deepEqual(getTaskRelatedRecord(page.content[0]), { href: '/dashboard/projects/42', label: 'View Project' });
});

test('complaint cards use the resolved record and disable the action for unlinked tasks', () => {
  const page = fs.readFileSync(new URL('../app/dashboard/complaints/page.tsx', import.meta.url), 'utf8');
  assert.match(page, /relatedRecord: getTaskRelatedRecord\(task\)/);
  assert.match(page, /disabled=\{!task.relatedRecord\} onClick=\{\(\) => handleViewRelatedRecord\(task\)\}/);
  assert.match(page, /router.push\(task.relatedRecord.href\)/);
  assert.match(page, /nav.return.to/);
  assert.doesNotMatch(page, /handleViewStore|router.push\(`\/dashboard\/customers\/\$\{storeId\}`\)/);
});
