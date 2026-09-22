import type { ApprovalRequest } from './approvals-api';
import type { AttendanceLog } from './attendance-api';

export type DayCaseKind =
  | 'auto-default-absent'
  | 'auto-calculated'
  | 'manual'
  | 'requested-pending'
  | 'requested-approved'
  | 'requested-rejected'
  | 'no-log';

export interface DayCase {
  kind: DayCaseKind;
  sourceLabel: string;
  badgeClass: string;
  explainer: string;
}

const upper = (value: unknown): string => String(value ?? '').trim().toUpperCase();

export function describeDayCase(
  log: Pick<AttendanceLog, 'attendanceStatus' | 'visitCount' | 'vehicleType' | 'marked' | 'defaultRuleApplied'> | null | undefined,
  request: Pick<ApprovalRequest, 'requestedStatus' | 'status' | 'actionByEmployeeName'> | null | undefined,
): DayCase {
  if (request) {
    const reqStatus = upper(request.status);
    const requested = String(request.requestedStatus ?? '').trim() || '—';
    const actionBy = String(request.actionByEmployeeName ?? '').trim();
    if (reqStatus === 'PENDING') {
      return {
        kind: 'requested-pending',
        sourceLabel: 'Requested · Pending',
        badgeClass: 'bg-amber-50 text-amber-700 ring-amber-600/15',
        explainer: `Employee requested ${requested}; awaiting admin approval.`,
      };
    }
    if (reqStatus === 'APPROVED') {
      return {
        kind: 'requested-approved',
        sourceLabel: 'Approved request',
        badgeClass: 'bg-emerald-50 text-emerald-700 ring-emerald-600/15',
        explainer: `Admin${actionBy ? ` (${actionBy})` : ''} approved ${requested}. Note: approval does not auto-rewrite the log — log still shows ${String(log?.attendanceStatus ?? '—')}.`,
      };
    }
    if (reqStatus === 'REJECTED') {
      return {
        kind: 'requested-rejected',
        sourceLabel: 'Request rejected',
        badgeClass: 'bg-rose-50 text-rose-700 ring-rose-600/15',
        explainer: `Admin${actionBy ? ` (${actionBy})` : ''} rejected ${requested}; log stands as ${String(log?.attendanceStatus ?? '—')}.`,
      };
    }
  }

  if (!log) {
    return {
      kind: 'no-log',
      sourceLabel: 'No log',
      badgeClass: 'bg-gray-100 text-gray-600 ring-gray-500/15',
      explainer: 'No attendance log exists for this date yet.',
    };
  }

  const visits = typeof log.visitCount === 'number' ? log.visitCount : null;
  const vehicle = String(log.vehicleType ?? '').trim() || '—';
  const visitText = visits == null ? 'visits n/a' : `${visits} completed ${visits === 1 ? 'visit' : 'visits'}`;

  if (log.marked === false && log.defaultRuleApplied === true) {
    return {
      kind: 'auto-default-absent',
      sourceLabel: 'Auto · Default absent',
      badgeClass: 'bg-gray-100 text-gray-600 ring-gray-500/15',
      explainer: `System default (no vehicle/visits recorded · ${visitText}).`,
    };
  }
  if (log.marked === true && log.defaultRuleApplied === true) {
    return {
      kind: 'auto-calculated',
      sourceLabel: 'Auto calculated',
      badgeClass: 'bg-blue-50 text-blue-700 ring-blue-600/15',
      explainer: `System rule from ${visitText} · vehicle ${vehicle}.`,
    };
  }
  if (log.marked === true && log.defaultRuleApplied === false) {
    return {
      kind: 'manual',
      sourceLabel: 'Manual set',
      badgeClass: 'bg-purple-50 text-purple-700 ring-purple-600/15',
      explainer: `Set directly (admin/self entry · ${visitText} · vehicle ${vehicle}).`,
    };
  }
  return {
    kind: 'auto-calculated',
    sourceLabel: 'System',
    badgeClass: 'bg-blue-50 text-blue-700 ring-blue-600/15',
    explainer: `Status from system (${visitText} · vehicle ${vehicle}). Flags missing on this record.`,
  };
}
