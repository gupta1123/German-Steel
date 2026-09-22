import { getApiErrorMessage } from './api-error.ts';

const BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://ec2-18-211-58-135.compute-1.amazonaws.com:8081';

export interface ExpenseType {
  id: number;
  name: string;
  code?: string;
}

export interface ExpenseRow {
  id: number;
  employeeId: number;
  employeeName: string;
  expenseTypeId?: number;
  type: string;
  subType?: string;
  expenseDate: string;
  submissionDate?: string | null;
  amount: number;
  approvalStatus: string;
  approvalPersonEmployeeId?: number | null;
  paymentMethod?: string | null;
  description?: string | null;
  rejectionReason?: string | null;
  reimbursementAmount?: number | null;
}

const recordOf = (v: unknown): Record<string, unknown> | null => v && typeof v === 'object' && !Array.isArray(v) ? v as Record<string, unknown> : null;
const stringOf = (...vals: unknown[]): string => { for (const v of vals) if (typeof v === 'string' && v.trim()) return v.trim(); return ''; };
const numberOf = (...vals: unknown[]): number | null => { for (const v of vals) { if (typeof v === 'number' && Number.isFinite(v)) return v; if (typeof v === 'string' && v.trim() && Number.isFinite(Number(v))) return Number(v); } return null; };
const sourceRecord = (v: unknown): Record<string, unknown> | null => { const o = recordOf(v); const d = recordOf(o?.data); return d ?? o; };
const pageItems = (v: unknown): unknown[] => {
  if (Array.isArray(v)) return v;
  const r = recordOf(v); if (!r) return [];
  if (Array.isArray(r.content)) return r.content;
  if (Array.isArray(r.data)) return r.data;
  const d = recordOf(r.data); return d && Array.isArray(d.content) ? d.content : [];
};
const pageMeta = (v: unknown, fallbackSize: number) => {
  const src = sourceRecord(v);
  const totalElements = numberOf(src?.totalElements, src?.total) ?? 0;
  const totalPages = numberOf(src?.totalPages) ?? Math.max(1, Math.ceil(totalElements / Math.max(1, fallbackSize)));
  const number = numberOf(src?.number, src?.page) ?? 0;
  const size = numberOf(src?.size) ?? fallbackSize;
  return { totalElements, totalPages, number, size };
};
const readBody = async (res: Response): Promise<unknown> => {
  if (res.status === 204) return undefined;
  const t = (await res.text()).trim(); if (!t) return undefined;
  try { return JSON.parse(t) as unknown; } catch { return t; }
};
const request = async (path: string, token: string, init: RequestInit = {}): Promise<unknown> => {
  const res = await fetch(`${BASE_URL}${path}`, { ...init, cache: 'no-store', headers: { Accept: 'application/json', Authorization: `Bearer ${token}`, ...(init.body ? { 'Content-Type': 'application/json' } : {}), ...init.headers } });
  if (!res.ok) throw new Error(await getApiErrorMessage(res, `Request failed (${res.status})`));
  return readBody(res);
};

const normalizeExpense = (value: unknown): ExpenseRow | null => {
  const item = recordOf(value); if (!item) return null;
  const id = numberOf(item.id, item.expenseId);
  const employeeId = numberOf(item.employeeId);
  if (id == null || employeeId == null) return null;
  return {
    id,
    employeeId,
    employeeName: stringOf(item.employeeName, item.employee_name) || `Employee ${employeeId}`,
    expenseTypeId: numberOf(item.expenseTypeId, item.typeId) ?? undefined,
    type: stringOf(item.type, item.expenseType, item.category) || 'Expense',
    subType: stringOf(item.subType, item.sub_type) || undefined,
    expenseDate: stringOf(item.expenseDate, item.date, item.expense_date) || '',
    submissionDate: stringOf(item.submissionDate) || null,
    amount: numberOf(item.amount) ?? 0,
    approvalStatus: stringOf(item.approvalStatus, item.status) || 'SUBMITTED',
    approvalPersonEmployeeId: numberOf(item.approvalPersonEmployeeId, item.approverId),
    paymentMethod: stringOf(item.paymentMethod) || null,
    description: stringOf(item.description) || null,
    rejectionReason: stringOf(item.rejectionReason) || null,
    reimbursementAmount: numberOf(item.reimbursementAmount),
  };
};

export const expensesApi = {
  async getTypes(token: string, page = 0, size = 50): Promise<{ content: ExpenseType[]; totalElements: number; totalPages: number }> {
    const data = await request(`/api/hr/expenses/types?page=${page}&size=${size}`, token);
    const items = pageItems(data).flatMap((v) => {
      const item = recordOf(v); if (!item) return [];
      const id = numberOf(item.id, item.typeId);
      const name = stringOf(item.name, item.type, item.label);
      if (id == null || !name) return [];
      return [{ id, name, code: stringOf(item.code) || undefined }];
    });
    const meta = pageMeta(data, size);
    return { content: items, totalElements: meta.totalElements, totalPages: meta.totalPages };
  },
  async getByEmployee(token: string, employeeId: number, from: string, to: string, page = 0, size = 50): Promise<{ content: ExpenseRow[]; totalElements: number; totalPages: number; number: number; size: number }> {
    const data = await request(`/api/hr/expenses/by-employee/${employeeId}?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}&page=${page}&size=${size}`, token);
    const items = pageItems(data).flatMap((v) => { const n = normalizeExpense(v); return n ? [n] : []; });
    const meta = pageMeta(data, size);
    return { content: items, ...meta };
  },
  async getByStatus(token: string, status: string, page = 0, size = 50): Promise<{ content: ExpenseRow[]; totalElements: number; totalPages: number; number: number; size: number }> {
    const data = await request(`/api/hr/expenses/by-status?status=${encodeURIComponent(status)}&page=${page}&size=${size}`, token);
    const items = pageItems(data).flatMap((v) => { const n = normalizeExpense(v); return n ? [n] : []; });
    const meta = pageMeta(data, size);
    return { content: items, ...meta };
  },
  async create(token: string, payload: Record<string, unknown>): Promise<unknown> {
    return request(`/api/hr/expenses`, token, { method: 'POST', body: JSON.stringify(payload) });
  },
  async action(token: string, expenseId: number, payload: { approvalPersonEmployeeId: number; approvalStatus: 'APPROVED' | 'REJECTED'; rejectionReason?: string | null; reimbursementAmount?: number | null; reimbursedDate?: string | null }): Promise<void> {
    // Pending contract: do not actually mutate during tests — caller should handle pending UI
    // Real endpoint: POST /api/hr/expenses/{expenseId}/action
    await request(`/api/hr/expenses/${expenseId}/action`, token, { method: 'POST', body: JSON.stringify(payload) });
  },
};
