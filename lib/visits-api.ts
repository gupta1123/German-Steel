import { getApiErrorMessage } from './api-error.ts';
import { toTitleCase } from './utils.ts';

const VISITS_API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://ec2-18-211-58-135.compute-1.amazonaws.com:8081';

// Phase 2: Visits are independent parallel activities for Retail, Institution, and Project.
// Visit outcome/nextAction do NOT advance, infer, or mutate institution/project/retail business status or pipeline.
// Backend contract preserves existing field names/endpoints; this typing only surfaces already-supported values.

export type VisitType = 'DEALER_VISIT' | 'INSTITUTIONAL_VISIT' | 'PROJECT_SITE_VISIT';

// Backend already supports these outcome strings; keep string passthrough for forward compatibility.
export type VisitOutcome = 'SUCCESS' | 'INTERESTED' | 'NO_PROGRESS' | 'FOLLOW_UP_REQUIRED' | string;

export type CommonVisitRow = {
  id: number;
  visitType: VisitType;
  clientAccountId: number | null;
  institutionId: number | null;
  projectId: number | null;
  parentName?: string;
  // Canonical names from backend VisitActivityDto (CommonDtos.java:166)
  retailAccountName?: string | null;
  institutionName?: string | null;
  projectName?: string | null;
  // Location/region fields now returned by GET /api/common/visits
  locationCity?: string | null;
  locationDistrict?: string | null;
  locationState?: string | null;
  locationText?: string | null;
  locationRegionName?: string | null;
  assignedEmployeeId: number;
  assignedEmployeeName?: string;
  scheduledVisitDate: string;
  scheduledStartTime: string | null;
  scheduledEndTime: string | null;
  actualCheckinAt: string | null;
  actualCheckoutAt: string | null;
  purpose: string;
  outcome: VisitOutcome | null;
  discussionSummary: string | null;
  nextActionText: string | null;
  nextActionDate: string | null;
  // Legacy compatibility fields may also be present
  storeName?: string;
  employeeName?: string;
  visit_date?: string;
  checkinTime?: string | null;
  checkoutTime?: string | null;
  intent?: number;
  updatedAt?: string;
  updatedTime?: string;
  city?: string;
  state?: string;
};

export interface CommonVisitsParams {
  page: number;
  size: number;
  visitType?: VisitType;
  from: string; // yyyy-MM-dd
  to: string; // yyyy-MM-dd
  assignedEmployeeId?: number;
}

export interface CommonVisitsPage {
  content: CommonVisitRow[];
  totalElements: number;
  totalPages: number;
  number: number;
  size: number;
  first: boolean;
  last: boolean;
  empty: boolean;
}

export type VisitClientKind = 'RETAIL' | 'INSTITUTION' | 'PROJECT' | 'UNKNOWN';

const textOf = (value: unknown): string => (
  typeof value === 'string' && value.trim() ? value.trim() : ''
);

/**
 * Resolve display client name + kind from a visit row.
 * Backend sends retailAccountName / institutionName / projectName (VisitActivityDto);
 * prefer the name matching visitType, fall back to any available name, then parentName/storeName,
 * finally ID-based fallback so UI never shows blank.
 */
export const resolveVisitClient = (row: Pick<CommonVisitRow, 'visitType' | 'clientAccountId' | 'institutionId' | 'projectId' | 'parentName' | 'retailAccountName' | 'institutionName' | 'projectName'> & Record<string, unknown>): { name: string; kind: VisitClientKind } => {
  const retail = textOf(row.retailAccountName);
  const institution = textOf(row.institutionName);
  const project = textOf(row.projectName);
  const parent = textOf(row.parentName);
  const store = textOf(row.storeName);

  if (row.visitType === 'DEALER_VISIT' && retail) return { name: toTitleCase(retail), kind: 'RETAIL' };
  if (row.visitType === 'INSTITUTIONAL_VISIT' && institution) return { name: toTitleCase(institution), kind: 'INSTITUTION' };
  if (row.visitType === 'PROJECT_SITE_VISIT' && project) return { name: toTitleCase(project), kind: 'PROJECT' };

  if (retail) return { name: toTitleCase(retail), kind: 'RETAIL' };
  if (institution) return { name: toTitleCase(institution), kind: 'INSTITUTION' };
  if (project) return { name: toTitleCase(project), kind: 'PROJECT' };
  if (parent) return { name: toTitleCase(parent), kind: 'UNKNOWN' };
  if (store) return { name: toTitleCase(store), kind: 'UNKNOWN' };
  if (row.clientAccountId != null) return { name: `Account #${row.clientAccountId}`, kind: 'RETAIL' };
  if (row.institutionId != null) return { name: `Institution #${row.institutionId}`, kind: 'INSTITUTION' };
  if (row.projectId != null) return { name: `Project #${row.projectId}`, kind: 'PROJECT' };
  const id = textOf((row as Record<string, unknown>).id);
  return { name: id ? `Visit #${id}` : '—', kind: 'UNKNOWN' };
};

/** Sentence case: "MUMBAI" → "Mumbai", "NAVI MUMBAI" → "Navi Mumbai". */
const toSentenceCase = (value: string): string => (
  value.toLowerCase().replace(/(^|\s|-|')([a-z])/g, (m) => m.toUpperCase())
);

/** Resolve display city: locationCity → locationText → region name, else '—'. */
export const resolveVisitCity = (row: Pick<CommonVisitRow, 'locationCity' | 'locationText' | 'locationRegionName'> & Record<string, unknown>): string => {
  const city = textOf(row.locationCity);
  if (city) return toSentenceCase(city);
  const text = textOf(row.locationText);
  if (text) return toSentenceCase(text);
  const region = textOf(row.locationRegionName);
  if (region) return toSentenceCase(region);
  const legacy = textOf(row.city);
  return legacy ? toSentenceCase(legacy) : '—';
};

export class VisitsApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = 'VisitsApiError';
    this.status = status;
  }
}

const recordOf = (value: unknown): Record<string, unknown> | null =>
  value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : null;

const numberOf = (...values: unknown[]): number | null => {
  for (const v of values) {
    if (typeof v === 'number' && Number.isFinite(v)) return v;
    if (typeof v === 'string' && v.trim() && Number.isFinite(Number(v))) return Number(v);
  }
  return null;
};

const sourceRecord = (value: unknown): Record<string, unknown> | null => {
  const outer = recordOf(value);
  const data = recordOf(outer?.data);
  return data ?? outer;
};

const normalizeVisitDisplay = (row: CommonVisitRow): CommonVisitRow => ({
  ...row,
  parentName: toTitleCase(row.parentName),
  retailAccountName: toTitleCase(row.retailAccountName),
  institutionName: toTitleCase(row.institutionName),
  projectName: toTitleCase(row.projectName),
  assignedEmployeeName: toTitleCase(row.assignedEmployeeName),
  employeeName: toTitleCase(row.employeeName),
});

const readBody = async (res: Response): Promise<unknown> => {
  if (res.status === 204) return undefined;
  const text = (await res.text()).trim();
  if (!text) return undefined;
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return text;
  }
};

const request = async (path: string, token: string, init: RequestInit = {}): Promise<unknown> => {
  const res = await fetch(`${VISITS_API_BASE_URL}${path}`, {
    cache: 'no-store',
    ...init,
    headers: {
      Accept: 'application/json',
      Authorization: `Bearer ${token}`,
      ...(init.headers || {}),
    },
  });
  if (!res.ok) {
    throw new VisitsApiError(await getApiErrorMessage(res, `Request failed (${res.status})`), res.status);
  }
  return readBody(res);
};

export const visitsApi = {
  async getVisitById(token: string, visitId: number): Promise<CommonVisitRow> {
    const data = await request(`/api/common/visits/${visitId}`, token);
    const src = sourceRecord(data) ?? recordOf(data);
    // Backend may return direct object or { data: {...} } or ApiPage with single content
    if (src && typeof src.id === 'number' && typeof src.purpose === 'string') {
      return normalizeVisitDisplay(src as unknown as CommonVisitRow);
    }
    if (src && Array.isArray((src as Record<string, unknown>).content) && ((src as Record<string, unknown>).content as unknown[]).length > 0) {
      return normalizeVisitDisplay(((src as Record<string, unknown>).content as CommonVisitRow[])[0]);
    }
    if (Array.isArray(data) && data.length > 0) {
      return normalizeVisitDisplay(data[0] as CommonVisitRow);
    }
    return normalizeVisitDisplay((src ?? data) as CommonVisitRow);
  },

  async updateVisit(token: string, visitId: number, payload: Record<string, unknown>): Promise<unknown> {
    return request(`/api/common/visits/${visitId}`, token, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
  },

  async checkIn(token: string, visitId: number, payload: { checkInLatitude: number; checkInLongitude: number }): Promise<unknown> {
    return request(`/api/common/visits/${visitId}/check-in`, token, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
  },

  async checkOut(
    token: string,
    visitId: number,
    payload: {
      checkOutLatitude: number;
      checkOutLongitude: number;
      outcome: VisitOutcome;
      discussionSummary?: string | null;
      nextActionText?: string | null;
      nextActionDate?: string | null;
      expenseAmount?: number | null;
    },
  ): Promise<unknown> {
    return request(`/api/common/visits/${visitId}/check-out`, token, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
  },

  async getCommonVisits(token: string, params: CommonVisitsParams): Promise<CommonVisitsPage> {
    const search = new URLSearchParams({
      page: String(params.page),
      size: String(params.size),
      from: params.from,
      to: params.to,
    });
    if (params.visitType) search.set('visitType', params.visitType);
    if (params.assignedEmployeeId != null) search.set('assignedEmployeeId', String(params.assignedEmployeeId));

    const data = await request(`/api/common/visits?${search.toString()}`, token);

    // Handle Spring Data Page envelope (content, totalElements, etc.) and fallback array
    if (Array.isArray(data)) {
      return {
        content: (data as CommonVisitRow[]).map(normalizeVisitDisplay),
        totalElements: data.length,
        totalPages: 1,
        number: params.page,
        size: params.size,
        first: params.page === 0,
        last: true,
        empty: data.length === 0,
      };
    }

    const src = sourceRecord(data) ?? {};
    const content = (Array.isArray(src.content)
      ? (src.content as CommonVisitRow[])
      : Array.isArray((data as Record<string, unknown>).content)
        ? ((data as Record<string, unknown>).content as CommonVisitRow[])
        : []).map(normalizeVisitDisplay);

    const totalElements = numberOf(src.totalElements, (src as Record<string, unknown>).total) ?? content.length;
    const totalPages = numberOf(src.totalPages) ?? Math.max(1, Math.ceil(totalElements / Math.max(1, params.size)));
    const number = numberOf(src.number, src.page, params.page) ?? params.page;
    const size = numberOf(src.size, params.size) ?? params.size;
    const first = typeof src.first === 'boolean' ? src.first : number === 0;
    const last = typeof src.last === 'boolean' ? src.last : number >= totalPages - 1;
    const empty = typeof src.empty === 'boolean' ? src.empty : content.length === 0;

    return { content, totalElements, totalPages, number, size, first, last, empty };
  },
};
