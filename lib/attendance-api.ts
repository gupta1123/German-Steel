import { getApiErrorMessage } from './api-error.ts';
import { toTitleCase } from './utils.ts';

const BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://ec2-18-211-58-135.compute-1.amazonaws.com:8081';

export interface AttendanceLog {
  id: number | string;
  employeeId: number;
  employeeName: string;
  attendanceDate: string;
  date: string;
  attendanceStatus: string;
  vehicleType?: string | null;
  checkinTime?: string | null;
  checkoutTime?: string | null;
  // Compatibility aliases for calendar UI — mirrors attendanceDate
  checkinDate: string;
  checkoutDate: string | null;
  // Case discriminators from AttendanceLogDto (HrDtos.java:47) — kept for day-case display
  visitCount?: number | null;
  workedHours?: number | null;
  marked?: boolean | null;
  defaultRuleApplied?: boolean | null;
}

export interface VehicleType {
  id: number | string;
  name: string;
  code: string;
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

const booleanOf = (...values: unknown[]): boolean | null => {
  for (const value of values) {
    if (typeof value === 'boolean') return value;
    if (value === 'true' || value === 1) return true;
    if (value === 'false' || value === 0) return false;
  }
  return null;
};

const normalizeLog = (value: unknown): AttendanceLog | null => {
  const item = recordOf(value); if (!item) return null;
  const id = numberOf(item.id, item.attendanceId) ?? stringOf(item.id) ?? `${numberOf(item.employeeId) ?? 'unknown'}-${stringOf(item.attendanceDate, item.date, item.checkinDate, item.workDate) ?? Math.random()}`;
  const employeeId = numberOf(item.employeeId, item.employee_id);
  if (employeeId == null) return null;
  // Backend may return attendanceDate/date/checkinDate interchangeably; normalize to ISO date for calendar
  const rawAttendanceDate = stringOf(item.attendanceDate, item.date, item.workDate, item.checkinDate) || '';
  const rawCheckoutDate = stringOf(item.checkoutDate, item.checkinDate) || null;
  // Ensure checkinDate is never undefined — fallback to attendanceDate
  const checkinDate = stringOf(item.checkinDate, item.attendanceDate, item.date, item.workDate) || rawAttendanceDate;
  const checkoutDate = stringOf(item.checkoutDate) || rawCheckoutDate;
  return {
    id,
    employeeId,
    employeeName: toTitleCase(stringOf(item.employeeName, item.employee_name, item.name)) || `Employee ${employeeId}`,
    attendanceDate: rawAttendanceDate,
    date: stringOf(item.date, item.attendanceDate) || rawAttendanceDate,
    attendanceStatus: stringOf(item.attendanceStatus, item.status, item.dayStatus) || 'Absent',
    vehicleType: stringOf(item.vehicleType) || null,
    checkinTime: stringOf(item.checkinTime) || null,
    checkoutTime: stringOf(item.checkoutTime) || null,
    checkinDate: checkinDate || '',
    checkoutDate,
    visitCount: numberOf(item.visitCount, item.visit_count),
    workedHours: numberOf(item.workedHours, item.worked_hours),
    marked: booleanOf(item.marked),
    defaultRuleApplied: booleanOf(item.defaultRuleApplied, item.default_rule_applied),
  };
};

export const attendanceApi = {
  async getByDate(token: string, date: string, page = 0, size = 50): Promise<{ content: AttendanceLog[]; totalElements: number; totalPages: number; number: number; size: number }> {
    const data = await request(`/api/hr/attendance/logs/by-date?date=${encodeURIComponent(date)}&page=${page}&size=${size}`, token);
    const items = pageItems(data).flatMap((v) => { const n = normalizeLog(v); return n ? [n] : []; });
    const meta = pageMeta(data, size);
    return { content: items, ...meta };
  },
  async getByEmployee(token: string, employeeId: number, from: string, to: string, page = 0, size = 50): Promise<{ content: AttendanceLog[]; totalElements: number; totalPages: number; number: number; size: number }> {
    const data = await request(`/api/hr/attendance/logs/by-employee/${employeeId}?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}&page=${page}&size=${size}`, token);
    const items = pageItems(data).flatMap((v) => { const n = normalizeLog(v); return n ? [n] : []; });
    const meta = pageMeta(data, size);
    return { content: items, ...meta };
  },
  async getVisits(token: string, from: string, to: string, assignedEmployeeId: number, page = 0, size = 50): Promise<unknown> {
    const qs = new URLSearchParams({ from, to, assignedEmployeeId: String(assignedEmployeeId), page: String(page), size: String(size) });
    return request(`/api/common/visits?${qs.toString()}`, token);
  },
  async getVehicleTypes(token: string): Promise<VehicleType[]> {
    const data = await request(`/api/hr/vehicle-types`, token);
    const items = pageItems(data);
    return items.flatMap((v) => {
      const item = recordOf(v); if (!item) return [];
      const id = numberOf(item.id) ?? stringOf(item.id) ?? stringOf(item.code);
      const code = stringOf(item.code, item.vehicleType, item.name);
      const name = stringOf(item.name, item.displayName, code);
      if (!code && !name) return [];
      return [{ id: id as number | string, code: code || name, name: name || code }];
    });
  },
  async updateVehicle(token: string, employeeId: number, date: string, vehicleType: string, pricePerKmBike?: number): Promise<void> {
    const body: Record<string, unknown> = { vehicleType };
    if (pricePerKmBike !== undefined) body.pricePerKmBike = pricePerKmBike;
    await request(`/api/hr/attendance/logs/vehicle?employeeId=${employeeId}&date=${encodeURIComponent(date)}`, token, { method: 'PUT', body: JSON.stringify(body) });
  },
  async recalculate(token: string, employeeId: number, date: string): Promise<void> {
    await request(`/api/hr/attendance/logs/recalculate?employeeId=${employeeId}&date=${encodeURIComponent(date)}`, token, { method: 'POST' });
  },
  async createLogsForDate(token: string, date: string): Promise<{ date: string; created: number }> {
    const data = await request(`/api/hr/attendance/logs?date=${encodeURIComponent(date)}`, token, { method: 'POST' });
    const src = sourceRecord(data) ?? {};
    return { date: stringOf(src.date, date) || date, created: numberOf(src.created, src.count) ?? 0 };
  },
};
