import type { ApprovalRequest } from './approvals-api.ts';
import type { AttendanceLog } from './attendance-api.ts';

export const approvalOrder = (left: ApprovalRequest, right: ApprovalRequest) =>
  String(left.actionDate || left.requestDate || '').localeCompare(String(right.actionDate || right.requestDate || '')) || left.id - right.id;

export function applyApprovedAttendanceRequests(logs: AttendanceLog[], requests: ApprovalRequest[]): AttendanceLog[] {
  const key = (employeeId: number, date: string) => `${employeeId}:${date.slice(0, 10)}`;
  const byDay = new Map(logs.map((log) => [key(log.employeeId, log.attendanceDate || log.date || log.checkinDate), { ...log }]));
  const approved = requests.filter((request) => request.status.toUpperCase() === 'APPROVED' &&
    ['FULL_DAY', 'HALF_DAY'].includes(request.requestedStatus.toUpperCase())).sort(approvalOrder);
  for (const request of approved) {
    const date = request.logDate.slice(0, 10);
    if (!date) continue;
    const dateKey = key(request.employeeId, date);
    const existing = byDay.get(dateKey);
    byDay.set(dateKey, {
      ...existing,
      id: existing?.id ?? `approved-${request.id}`,
      employeeId: request.employeeId,
      employeeName: existing?.employeeName || request.employeeName,
      attendanceDate: date,
      date,
      checkinDate: date,
      checkoutDate: existing?.checkoutDate ?? null,
      attendanceStatus: request.requestedStatus.toUpperCase(),
    });
  }
  return [...byDay.values()];
}
