import test from 'node:test';
import assert from 'node:assert/strict';
import { adminRemovalPaths, adminRemovalsApi, hasAdminRemovalRole, removalReference } from '../lib/admin-removals-api.ts';
import { removeRecord } from '../lib/removal-api.ts';
import { normalizeMeetingDetails } from '../lib/meetings-api.ts';

const cases = [
  [adminRemovalPaths.visit(17), '/api/admin/visits/17/cancel', 'VISIT'],
  [adminRemovalPaths.pricing(17), '/api/admin/pricing/17/remove', 'PRICING'],
  [adminRemovalPaths.note(17), '/api/admin/notes/17/remove', 'NOTE'],
  [adminRemovalPaths.projectSale(17), '/api/admin/project-sales/17/void', 'PROJECT_SALE'],
  [adminRemovalPaths.file(17), '/api/admin/files/17/remove', 'FILE'],
  [adminRemovalPaths.retailBrand(17), '/api/admin/retail-brands/17/remove', 'RETAIL_BRAND_USAGE'],
  [adminRemovalPaths.meetingAttendee(4, 17), '/api/admin/meetings/4/attendees/17/remove', 'MEETING_ATTENDEE'],
  [adminRemovalPaths.meetingExpense(4, 17), '/api/admin/meetings/4/expenses/17/remove', 'MEETING_EXPENSE'],
  [adminRemovalPaths.meetingGift(4, 17), '/api/admin/meetings/4/gifts/17/remove', 'MEETING_GIFT'],
];

for (const [path, expected, type] of cases) {
  test(`${type}: uses the supplied route, POST, admin token and reason body`, async t => {
    const fetch = t.mock.method(globalThis, 'fetch', async () => Response.json({ id: 17, active: false }));
    assert.equal(path, expected);
    await removeRecord('admin-token', path, { reason: '  Duplicate entry  ' });
    assert.equal(fetch.mock.callCount(), 1);
    const [url, init] = fetch.mock.calls[0].arguments;
    assert.equal(new URL(url).pathname, expected);
    assert.equal(init.method, 'POST');
    assert.equal(init.headers.Authorization, 'Bearer admin-token');
    assert.equal(init.headers['Content-Type'], 'application/json');
    assert.deepEqual(JSON.parse(init.body), { reason: 'Duplicate entry' });
    assert.deepEqual(removalReference(path), { type, id: 17 });
  });
}

test('requires a nonblank reason and limits it to 500 characters before any request', async t => {
  const fetch = t.mock.method(globalThis, 'fetch', async () => Response.json({}));
  await assert.rejects(removeRecord('admin-token', adminRemovalPaths.visit(1), { reason: '   ' }), /reason/);
  await assert.rejects(removeRecord('admin-token', adminRemovalPaths.visit(1), { reason: 'x'.repeat(501) }), /500/);
  assert.equal(fetch.mock.callCount(), 0);
  await removeRecord('admin-token', adminRemovalPaths.visit(1), { reason: 'x'.repeat(500) });
  assert.equal(fetch.mock.callCount(), 1);
});

test('does not fall back or retry on undeployed endpoints or protected records', async t => {
  for (const status of [403, 404, 409]) {
    const fetch = t.mock.method(globalThis, 'fetch', async () => Response.json({ message: 'Remove linked expenses first' }, { status }));
    await assert.rejects(removeRecord('admin-token', adminRemovalPaths.visit(1), { reason: 'Wrong entry' }), /Remove linked expenses first/);
    assert.equal(fetch.mock.callCount(), 1);
    fetch.mock.restore();
  }
});

test('new calls require the actual ADMIN role, including account authorities', () => {
  assert.equal(hasAdminRemovalRole('ADMIN'), true);
  assert.equal(hasAdminRemovalRole('ROLE_ADMIN'), true);
  assert.equal(hasAdminRemovalRole('HO_ADMIN', { authorities: [{ authority: 'ROLE_ADMIN' }] }), true);
  for (const role of ['MANAGER', 'HO_ADMIN', 'OWNER', 'DEVELOPER', 'FIELD_OFFICER', null]) assert.equal(hasAdminRemovalRole(role), false);
});

test('loads record-removal history with GET and accepts an empty history', async t => {
  const fetch = t.mock.method(globalThis, 'fetch', async () => Response.json([]));
  assert.deepEqual(await adminRemovalsApi.history('admin-token', 'FILE', 17), []);
  const [url, init] = fetch.mock.calls[0].arguments;
  assert.equal(new URL(url).pathname, '/api/admin/removals/FILE/17');
  assert.equal(init.body, undefined);
  assert.equal(init.headers.Authorization, 'Bearer admin-token');
});

test('meeting history keeps active and inactive child item IDs', async t => {
  const history = { meetingId: 4, attendees: [{ id: 17, active: false }], expenses: [{ id: 18, active: true }], gifts: [] };
  const fetch = t.mock.method(globalThis, 'fetch', async () => Response.json(history));
  assert.deepEqual(await adminRemovalsApi.meetingItems('admin-token', 4), history);
  assert.equal(new URL(fetch.mock.calls[0].arguments[0]).pathname, '/api/admin/meetings/4/items/history');
});

test('normal meeting details exclude inactive items and update totals and attendee field names', () => {
  const result = normalizeMeetingDetails({ id: 4, meetingType: 'Dealer', status: 'CLOSED', createdByEmployeeId: 2,
    attendees: [{ id: 17, attendeeName: 'Active Person', active: true, present: true }, { id: 18, attendeeName: 'Removed Person', active: false, present: true }],
    expenses: [{ id: 20, amount: 100, active: true }, { id: 21, amount: 200, active: false }],
    gifts: [{ id: 30, attendeeId: 17, quantity: 2, active: true }, { id: 31, quantity: 5, active: false }],
  });
  assert.equal(result.attendees.length, 1);
  assert.equal(result.attendees[0].name, 'Active Person');
  assert.equal(result.actualAttendeeCount, 1);
  assert.equal(result.actualExpenseTotal, 100);
  assert.equal(result.actualGiftQuantity, 2);
  assert.equal(result.gifts[0].meetingAttendeeId, 17);
});
