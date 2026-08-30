export function localExpenseDate(date = new Date()): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

export function expenseApprovalPayload(amount: number, date = new Date()) {
  if (!Number.isFinite(amount) || amount <= 0) throw new Error('Expense amount must be greater than zero.');
  // Approval is not proof of payment. Do not invent reimbursement dates or methods.
  return { approvalStatus: 'Approved', approvalDate: localExpenseDate(date), reimbursementAmount: amount };
}
