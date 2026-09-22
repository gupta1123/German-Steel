import { getApiErrorMessage } from './api-error.ts';
import { toTitleCase } from './utils.ts';

const APPROVALS_API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://ec2-18-211-58-135.compute-1.amazonaws.com:8081';
const DEFAULT_PAGE_SIZE = 50;

export type AttendanceRequestStatus = 'PENDING' | 'APPROVED' | 'REJECTED';

export interface ApprovalRequest {
  id: number;
  employeeId: number;
  employeeName: string;
  requestDate: string;
  requestedStatus: string;
  logDate: string;
  actionDate: string | null;
  status: string;
  description?: string;
  reason?: string;
  actionByEmployeeId?: number | null;
  actionByEmployeeName?: string | null;
  isDuplicate?: boolean;
  duplicateCount?: number;
  duplicateIndex?: number;
}

export interface ApprovalPage {
  content: ApprovalRequest[];
  number: number;
  size: number;
  totalElements: number;
  totalPages: number;
  first: boolean;
  last: boolean;
  empty: boolean;
}

export class ApprovalsApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = 'ApprovalsApiError';
    this.status = status;
  }
}

const recordOf = (value: unknown): Record<string, unknown> | null =>
  value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : null;

const stringOf = (...values: unknown[]): string => {
  for (const value of values) if (typeof value === 'string' && value.trim()) return value.trim();
  return '';
};

const numberOf = (...values: unknown[]): number | null => {
  for (const value of values) {
    if (typeof value === 'number' && Number.isFinite(value)) return value;
    if (typeof value === 'string' && value.trim() && Number.isFinite(Number(value))) return Number(value);
  }
  return null;
};

const sourceRecord = (value: unknown): Record<string, unknown> | null => {
  const outer = recordOf(value);
  const data = recordOf(outer?.data);
  return data ?? outer;
};

const readResponseBody = async (response: Response): Promise<unknown> => {
  if (response.status === 204) return undefined;
  const text = (await response.text()).trim();
  if (!text) return undefined;
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return text;
  }
};

const request = async (path: string, token: string, init: RequestInit = {}): Promise<unknown> => {
  const response = await fetch(`${APPROVALS_API_BASE_URL}${path}`, {
    ...init,
    cache: 'no-store',
    headers: {
      Accept: 'application/json',
      Authorization: `Bearer ${token}`,
      ...(init.body ? { 'Content-Type': 'application/json' } : {}),
      ...init.headers,
    },
  });
  if (!response.ok) {
    throw new ApprovalsApiError(await getApiErrorMessage(response, `Request failed (${response.status})`), response.status);
  }
  return readResponseBody(response);
};

const normalizeApproval = (value: unknown): ApprovalRequest | null => {
  const item = recordOf(value) ?? sourceRecord(value);
  if (!item) return null;
  const id = numberOf(item.id, item.requestId);
  const employeeId = numberOf(item.employeeId);
  if (id == null || employeeId == null) return null;
  return {
    id,
    employeeId,
    employeeName: toTitleCase(stringOf(item.employeeName, item.employee_name)) || `Employee ${employeeId}`,
    requestDate: stringOf(item.requestDate, item.request_date, item.createdAt) || new Date().toISOString(),
    requestedStatus: stringOf(item.requestedStatus, item.requested_status, item.attendance, item.attendanceStatus) || 'NOT_SPECIFIED',
    logDate: stringOf(item.logDate, item.log_date, item.attendanceDate) || stringOf(item.requestDate) || new Date().toISOString(),
    actionDate: stringOf(item.actionDate, item.action_date) || null,
    status: stringOf(item.status) || 'PENDING',
    description: stringOf(item.description) || undefined,
    reason: stringOf(item.reason, item.description, item.remarks) || undefined,
    actionByEmployeeId: numberOf(item.actionByEmployeeId, item.action_by_employee_id) ?? null,
    actionByEmployeeName: toTitleCase(stringOf(item.actionByEmployeeName, item.action_by_employee_name)) || null,
  };
};

const normalizePage = (value: unknown, content: ApprovalRequest[]): ApprovalPage => {
  const source = sourceRecord(value) ?? {};
  // Spring Data Page fields: content, number, size, totalElements, totalPages, first, last, empty, pageable
  const number = numberOf(source.number, source.page) ?? 0;
  const size = numberOf(source.size) ?? (content.length || DEFAULT_PAGE_SIZE);
  const totalElements = numberOf(source.totalElements, source.total) ?? content.length;
  const totalPages = numberOf(source.totalPages) ?? Math.max(1, Math.ceil(totalElements / Math.max(1, size)));
  const first = typeof source.first === 'boolean' ? source.first : number === 0;
  const last = typeof source.last === 'boolean' ? source.last : number >= totalPages - 1;
  const empty = typeof source.empty === 'boolean' ? source.empty : content.length === 0;
  return { content, number, size, totalElements, totalPages, first, last, empty };
};

const normalizeStatus = (status: string): AttendanceRequestStatus => {
  const upper = status.trim().toUpperCase();
  if (upper === 'PENDING' || upper === 'APPROVED' || upper === 'REJECTED') return upper as AttendanceRequestStatus;
  throw new ApprovalsApiError(`Invalid attendance request status: ${status}. Expected PENDING, APPROVED, or REJECTED.`, 400);
};

export const approvalsApi = {
  /**
   * Verified contract: GET /api/hr/attendance/requests/by-status?status={PENDING|APPROVED|REJECTED}&page=0&size=50
   * Returns 200 with paginated ApiPage<ApprovalRequest>.
   * @see Verified 2026-02 against current backend — all three uppercase statuses return 200.
   * Removed incorrect candidates:
   * - GET /api/hr/attendance/requests?status=... -> 405
   * - GET /request/getByStatus?status=... -> 404
   */
  async getByStatus(
    token: string,
    status: AttendanceRequestStatus | string,
    page: number = 0,
    size: number = DEFAULT_PAGE_SIZE,
  ): Promise<ApprovalPage> {
    const normalized = normalizeStatus(status);
    const path = `/api/hr/attendance/requests/by-status?status=${encodeURIComponent(normalized)}&page=${page}&size=${size}`;
    const data = await request(path, token);
    // Backend returns paginated envelope; handle both {content,...} and raw array fallbacks safely
    const rawItems = Array.isArray(data)
      ? data
      : (() => {
          const src = sourceRecord(data);
          if (src && Array.isArray(src.content)) return src.content as unknown[];
          if (Array.isArray((data as Record<string, unknown>)?.content)) return (data as Record<string, unknown>).content as unknown[];
          return [];
        })();
    const content = rawItems.flatMap((v) => {
      const n = normalizeApproval(v);
      return n ? [n] : [];
    });
    return normalizePage(data, content);
  },

  /**
   * Verified contract: GET /api/hr/attendance/requests/by-employee/{employeeId}?page=0&size=50
   * Auth: self (#employeeId == principal.employeeId()) or ADMIN / MANAGER.
   * Returns paginated requests for one employee — used by attendance day-case join.
   * Callers should catch 401/403 per employee (e.g. field role viewing others) and treat as [].
   */
  async getRequestsByEmployee(
    token: string,
    employeeId: number,
    page: number = 0,
    size: number = DEFAULT_PAGE_SIZE,
  ): Promise<ApprovalPage> {
    const path = `/api/hr/attendance/requests/by-employee/${encodeURIComponent(String(employeeId))}?page=${page}&size=${size}`;
    const data = await request(path, token);
    const rawItems = Array.isArray(data)
      ? data
      : (() => {
          const src = sourceRecord(data);
          if (src && Array.isArray(src.content)) return src.content as unknown[];
          if (Array.isArray((data as Record<string, unknown>)?.content)) return (data as Record<string, unknown>).content as unknown[];
          return [];
        })();
    const content = rawItems.flatMap((v) => {
      const n = normalizeApproval(v);
      return n ? [n] : [];
    });
    return normalizePage(data, content);
  },

  /**
   * Load all three statuses (PENDING, APPROVED, REJECTED) — each via the verified by-status endpoint.
   * Handles pagination by fetching only the first page (page 0, size 50) per the spec. For complete pagination
   * callers should use getByStatus with explicit page/size.
   */
  async getAll(token: string): Promise<ApprovalRequest[]> {
    const statuses: AttendanceRequestStatus[] = ['PENDING', 'APPROVED', 'REJECTED'];
    const pages = await Promise.all(statuses.map((s) => this.getByStatus(token, s, 0, DEFAULT_PAGE_SIZE)));
    const all = pages.flatMap((p) => p.content);
    return Array.from(new Map(all.map((r) => [r.id, r])).values());
  },

  /**
   * Fetch all pages for a single status (helper for pagination tests/mocks).
   */
  async getAllPagesForStatus(token: string, status: AttendanceRequestStatus | string): Promise<ApprovalRequest[]> {
    const first = await this.getByStatus(token, status, 0, DEFAULT_PAGE_SIZE);
    const all = [...first.content];
    for (let p = 1; p < first.totalPages; p += 1) {
      const next = await this.getByStatus(token, status, p, DEFAULT_PAGE_SIZE);
      all.push(...next.content);
    }
    return all;
  },

  /**
   * Approve/Reject mutation — verified backend contract:
   * POST /api/hr/attendance/requests/{requestId}/action
   * Body: { actionByEmployeeId: number, status: 'APPROVED' | 'REJECTED' }
   * Auth: ADMIN / MANAGER / SCOPE_ALL_ZONES_ALL_MODULES.
   * Returns the updated AttendanceRequestDto.
   *
   * NOTE: backend only flips ApprovalStatus; it does NOT rewrite
   * requestedStatus (FULL_DAY/HALF_DAY) and does NOT touch AttendanceLog.
   * The `attendance` arg is kept for backwards-compat but is not sent.
   */
  async updateStatus(
    token: string,
    id: number,
    status: 'approved' | 'rejected' | 'APPROVED' | 'REJECTED',
    attendanceOrActionBy?: string | number,
    actionByEmployeeId?: number,
  ): Promise<ApprovalRequest> {
    const upper = status.trim().toUpperCase();
    if (upper !== 'APPROVED' && upper !== 'REJECTED') {
      throw new ApprovalsApiError(
        `Invalid action status: ${status}. Expected approved or rejected.`,
        400,
      );
    }
    // Backwards-compat: updateStatus(token, id, action, 'full day', actionBy)
    // or updateStatus(token, id, action, actionBy)
    const resolvedActionBy =
      typeof actionByEmployeeId === 'number'
        ? actionByEmployeeId
        : typeof attendanceOrActionBy === 'number'
          ? attendanceOrActionBy
          : null;
    if (resolvedActionBy == null || !Number.isFinite(resolvedActionBy)) {
      throw new ApprovalsApiError(
        'actionByEmployeeId is required to approve/reject an attendance request.',
        400,
      );
    }
    if (!Number.isFinite(id)) {
      throw new ApprovalsApiError('Invalid attendance request id.', 400);
    }
    const path = `/api/hr/attendance/requests/${encodeURIComponent(String(id))}/action`;
    const data = await request(path, token, {
      method: 'POST',
      body: JSON.stringify({ actionByEmployeeId: resolvedActionBy, status: upper }),
    });
    const normalized = normalizeApproval(data);
    if (!normalized) {
      throw new ApprovalsApiError('Unexpected response from attendance action endpoint.', 500);
    }
    return normalized;
  },
};
