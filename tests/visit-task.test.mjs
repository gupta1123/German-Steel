import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeVisitTask } from '../lib/visit-task.ts';

test('maps visit API field names for both record types', () => {
  for (const taskType of ['requirement', 'complaint']) {
    const task = normalizeVisitTask({
      id: 29, taskTitle: 'Delivery request', taskDesciption: 'Send product details',
      taskDescription: 'Send product details', taskType, dueDate: '2026-08-29',
      assignedToId: 32, assignedToName: 'Field Officer A', priority: ' LOW ',
      status: 'Assigned', visitId: 43, storeName: 'Dealer A', storeCity: 'BENGALURU SOUTH',
      createdAt: '2026-08-28', updatedAt: '2026-08-29', imageCount: 0,
    });
    assert.equal(task.title, 'Delivery request');
    assert.equal(task.description, 'Send product details');
    assert.equal(task.assignedTo, 'Field Officer A');
    assert.equal(task.priority, 'low');
    assert.equal(task.type, taskType);
    assert.equal(task.createdAt, '2026-08-28');
    assert.equal(task.dueDate, '2026-08-29');
    assert.equal(task.storeCity, 'BENGALURU SOUTH');
  }
});

test('supports both API description spellings and legacy normalized fields', () => {
  assert.equal(normalizeVisitTask({ taskDesciption: 'Legacy spelling' }).description, 'Legacy spelling');
  assert.equal(normalizeVisitTask({ taskDescription: '', taskDesciption: 'Fallback' }).description, 'Fallback');
  const task = normalizeVisitTask({ title: 'Title', description: 'Description', assignedTo: 'Officer', type: 'requirement' });
  assert.equal(task.title, 'Title');
  assert.equal(task.description, 'Description');
  assert.equal(task.assignedTo, 'Officer');
});

test('missing and null values do not invent employee names or dates', () => {
  const task = normalizeVisitTask({ taskTitle: null, taskDescription: null, assignedToName: null, dueDate: null });
  assert.equal(task.title, '');
  assert.equal(task.description, '');
  assert.equal(task.assignedTo, '');
  assert.equal(task.dueDate, '');
  assert.equal(task.assignedToId, undefined);
});

test('preserves assignment and attachment metadata without treating objects as labels', () => {
  const task = normalizeVisitTask({ assignedToId: '32', assignedTo: { id: 32 }, assignedByName: 'Manager', imageCount: 2 });
  assert.equal(task.assignedToId, 32);
  assert.equal(task.assignedTo, '');
  assert.equal(task.assignedBy, 'Manager');
  assert.equal(task.imageCount, 2);
});
