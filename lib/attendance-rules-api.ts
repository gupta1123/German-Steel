import { getApiErrorMessage } from '@/lib/api-error';

const ATTENDANCE_API_BASE_URL = 'http://ec2-18-211-58-135.compute-1.amazonaws.com:8081';
const PAGE_SIZE = 500;

export interface AttendanceRule {
  id: number;
  ruleName: string;
  employeeRole: string;
  halfDayVisitCount: number;
  fullDayVisitCount: number;
  active: boolean;
}

export class AttendanceRulesApiError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = 'AttendanceRulesApiError';
    this.status = status;
  }
}

const recordOf = (value: unknown): Record<string, unknown> | null => (
  value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null
);

const sourceRecord = (value: unknown): Record<string, unknown> | null => {
  const outer = recordOf(value);
  const data = recordOf(outer?.data);
  return data ?? outer;
};

const stringOf = (...values: unknown[]): string => {
  for (const value of values) {
    if (typeof value === 'string' && value.trim()) return value.trim();
  }
  return '';
};

const numberOf = (...values: unknown[]): number | null => {
  for (const value of values) {
    if (typeof value === 'number' && Number.isFinite(value)) return value;
    if (typeof value === 'string' && value.trim() && Number.isFinite(Number(value))) {
      return Number(value);
    }
  }
  return null;
};

const booleanOf = (fallback: boolean, ...values: unknown[]): boolean => {
  for (const value of values) {
    if (typeof value === 'boolean') return value;
    if (value === 'true' || value === 1) return true;
    if (value === 'false' || value === 0) return false;
  }
  return fallback;
};

const pageItems = (value: unknown): unknown[] => {
  if (Array.isArray(value)) return value;
  const source = sourceRecord(value);
  if (!source) return [];
  if (Array.isArray(source.content)) return source.content;
  if (Array.isArray(source.data)) return source.data;
  if (Array.isArray(source.items)) return source.items;
  if (Array.isArray(source.results)) return source.results;
  return [];
};

const pageCount = (value: unknown): number => {
  const source = sourceRecord(value);
  return Math.max(1, numberOf(source?.totalPages, source?.pageCount) ?? 1);
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

const request = async (
  path: string,
  token: string,
  init: RequestInit = {},
): Promise<unknown> => {
  const response = await fetch(`${ATTENDANCE_API_BASE_URL}${path}`, {
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
    throw new AttendanceRulesApiError(
      await getApiErrorMessage(response, `Request failed (${response.status})`),
      response.status,
    );
  }

  return readResponseBody(response);
};

const normalizeRule = (value: unknown): AttendanceRule | null => {
  const item = sourceRecord(value);
  if (!item) return null;
  const id = numberOf(item.id, item.ruleId, item.attendanceRuleId);
  if (id == null) return null;

  return {
    id,
    ruleName: stringOf(item.ruleName, item.name) || `Attendance rule ${id}`,
    employeeRole: stringOf(item.employeeRole, item.role),
    halfDayVisitCount: numberOf(item.halfDayVisitCount, item.halfDayCount) ?? 0,
    fullDayVisitCount: numberOf(item.fullDayVisitCount, item.fullDayCount) ?? 0,
    active: booleanOf(true, item.active, item.isActive),
  };
};

const fetchAllPages = async (token: string): Promise<unknown[]> => {
  const first = await request(`/api/hr/attendance/rules?page=0&size=${PAGE_SIZE}`, token);
  const totalPages = pageCount(first);
  if (totalPages === 1) return pageItems(first);

  const remaining = await Promise.all(
    Array.from(
      { length: totalPages - 1 },
      (_, index) => request(`/api/hr/attendance/rules?page=${index + 1}&size=${PAGE_SIZE}`, token),
    ),
  );
  return [first, ...remaining].flatMap(pageItems);
};

export const attendanceRulesApi = {
  async getRules(token: string): Promise<AttendanceRule[]> {
    return (await fetchAllPages(token))
      .flatMap((value) => {
        const rule = normalizeRule(value);
        return rule ? [rule] : [];
      })
      .sort((a, b) => a.employeeRole.localeCompare(b.employeeRole) || a.ruleName.localeCompare(b.ruleName));
  },

  async updateRule(token: string, rule: AttendanceRule): Promise<AttendanceRule> {
    const response = await request(`/api/hr/attendance/rules/${rule.id}`, token, {
      method: 'PUT',
      body: JSON.stringify({
        ruleName: rule.ruleName,
        employeeRole: rule.employeeRole,
        halfDayVisitCount: rule.halfDayVisitCount,
        fullDayVisitCount: rule.fullDayVisitCount,
        active: rule.active,
      }),
    });
    return normalizeRule(response) ?? rule;
  },
};
