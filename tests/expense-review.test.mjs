import test from 'node:test';
import assert from 'node:assert/strict';
import { expenseApprovalPayload, localExpenseDate } from '../lib/expense-review.ts';

test('approves the actual amount without fabricated payment metadata', () => {
  assert.deepEqual(expenseApprovalPayload(100, new Date(2026, 7, 31, 0, 15)), {
    approvalStatus: 'Approved', approvalDate: '2026-08-31', reimbursementAmount: 100,
  });
  assert.equal(expenseApprovalPayload(1.25).reimbursementAmount, 1.25);
});
test('uses the local calendar date and rejects invalid amounts', () => {
  assert.equal(localExpenseDate(new Date(2026, 7, 31, 0, 1)), '2026-08-31');
  for (const value of [0, -1, NaN, Infinity]) assert.throws(() => expenseApprovalPayload(value));
});
