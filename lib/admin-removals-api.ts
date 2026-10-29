import type { CurrentUserDto } from './auth.ts';
import { getApiErrorMessage } from './api-error.ts';

const API_BASE_URL = 'http://ec2-18-211-58-135.compute-1.amazonaws.com:8081';

export const REMOVAL_TYPES = ['VISIT', 'PRICING', 'NOTE', 'PROJECT_SALE', 'FILE', 'RETAIL_BRAND_USAGE', 'MEETING_ATTENDEE', 'MEETING_EXPENSE', 'MEETING_GIFT'] as const;
export type RemovalType = typeof REMOVAL_TYPES[number];
export interface RemovalEvent {
  id: number;
  recordType: RemovalType;
  recordId: number;
  removedByEmployeeId: number;
  removedAt: string;
  reason: string;
  snapshotJson: string;
}
export interface MeetingHistoryItem {
  id: number;
  active: boolean;
  attendeeName?: string;
  name?: string;
  expenseHead?: string;
  giftItem?: string;
  amount?: number;
  quantity?: number;
  present?: boolean;
  attendeeId?: number | null;
}
export interface MeetingItemsHistory {
  meetingId: number;
  attendees: MeetingHistoryItem[];
  expenses: MeetingHistoryItem[];
  gifts: MeetingHistoryItem[];
}

// These new endpoints require ROLE_ADMIN, rather than the broader setup roles
// accepted by some older endpoints (owner/developer/manager).
export function hasAdminRemovalRole(role: string | null, user?: CurrentUserDto | null): boolean {
  return [role, ...(user?.authorities ?? []).map(item => item.authority)]
    .some(value => ['ADMIN', 'ROLE_ADMIN'].includes(String(value ?? '').trim().toUpperCase()));
}

export const adminRemovalPaths = {
  visit: (id: number) => `/api/admin/visits/${id}/cancel`,
  pricing: (id: number) => `/api/admin/pricing/${id}/remove`,
  note: (id: number) => `/api/admin/notes/${id}/remove`,
  projectSale: (id: number) => `/api/admin/project-sales/${id}/void`,
  file: (id: number) => `/api/admin/files/${id}/remove`,
  retailBrand: (id: number) => `/api/admin/retail-brands/${id}/remove`,
  meetingAttendee: (meetingId: number, id: number) => `/api/admin/meetings/${meetingId}/attendees/${id}/remove`,
  meetingExpense: (meetingId: number, id: number) => `/api/admin/meetings/${meetingId}/expenses/${id}/remove`,
  meetingGift: (meetingId: number, id: number) => `/api/admin/meetings/${meetingId}/gifts/${id}/remove`,
};

async function read<T>(token: string, path: string, signal?: AbortSignal): Promise<T> {
  if (!token) throw new Error('Please sign in again.');
  const response = await fetch(`${API_BASE_URL}${path}`, { cache: 'no-store', signal, headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' } });
  if (!response.ok) throw new Error(await getApiErrorMessage(response, response.status === 404 ? 'Removal history is unavailable. These new backend APIs may not be deployed yet.' : 'Unable to load removal history.'));
  return response.json() as Promise<T>;
}

export const adminRemovalsApi = {
  history: (token: string, type: RemovalType, id: number, signal?: AbortSignal) => read<RemovalEvent[]>(token, `/api/admin/removals/${type}/${id}`, signal),
  meetingItems: (token: string, meetingId: number, signal?: AbortSignal) => read<MeetingItemsHistory>(token, `/api/admin/meetings/${meetingId}/items/history`, signal),
};

export function removalReference(endpoint: string): { type: RemovalType; id: number } | null {
  const paths: [RegExp, RemovalType][] = [
    [/\/admin\/visits\/(\d+)\/cancel$/, 'VISIT'], [/\/admin\/pricing\/(\d+)\/remove$/, 'PRICING'],
    [/\/admin\/notes\/(\d+)\/remove$/, 'NOTE'], [/\/admin\/project-sales\/(\d+)\/void$/, 'PROJECT_SALE'],
    [/\/admin\/files\/(\d+)\/remove$/, 'FILE'], [/\/admin\/retail-brands\/(\d+)\/remove$/, 'RETAIL_BRAND_USAGE'],
    [/\/admin\/meetings\/\d+\/attendees\/(\d+)\/remove$/, 'MEETING_ATTENDEE'],
    [/\/admin\/meetings\/\d+\/expenses\/(\d+)\/remove$/, 'MEETING_EXPENSE'],
    [/\/admin\/meetings\/\d+\/gifts\/(\d+)\/remove$/, 'MEETING_GIFT'],
  ];
  for (const [pattern, type] of paths) {
    const match = endpoint.match(pattern);
    if (match) return { type, id: Number(match[1]) };
  }
  return null;
}
