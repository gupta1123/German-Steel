"use client";

import React, { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { ChevronLeft, ChevronRight, Loader2 } from 'lucide-react';
import { resolveVisitCity, resolveVisitClient, type CommonVisitRow, type VisitClientKind } from '@/lib/visits-api';
import { formatTimeTo12Hour, formatDateToUserFriendly } from '@/lib/utils';
import type { AttendanceLog } from '@/lib/attendance-api';
import type { ApprovalRequest } from '@/lib/approvals-api';

interface VisitDetailsModalProps {
    isOpen: boolean;
    onClose: () => void;
    visitData: Record<string, unknown>[];
    selectedDate: string;
    employeeName: string;
    dayLog?: AttendanceLog | null;
    dayRequest?: ApprovalRequest | null;
}

type Row = {
  id: number;
  customerName: string;
  clientKind?: VisitClientKind;
  executive: string;
  date: string;
  status: 'Assigned' | 'Ongoing' | 'Completed';
  purpose?: string;
  visitStart?: string;
  visitEnd?: string;
  city?: string;
};

function Ellipsis({ value }: { value: string | number | null | undefined }) {
  const displayValue = value === null || value === undefined || value === '' ? '—' : String(value);
  return (
    <span className="block min-w-0 truncate" title={displayValue}>
      {displayValue}
    </span>
  );
}

const hasVisitTime = (value?: string | null): boolean => {
  if (value === null || value === undefined) return false;
  const normalized = String(value).trim().toLowerCase();
  return normalized !== '' && normalized !== 'null' && normalized !== 'undefined' && normalized !== '-';
};

const deriveStatus = (row: Record<string, unknown>): Row['status'] => {
  const checkin = (row.actualCheckinAt ?? row.checkinTime ?? row.checkinDate) as string | null | undefined;
  const checkout = (row.actualCheckoutAt ?? row.checkoutTime ?? row.checkoutDate) as string | null | undefined;
  const hasCheckin = hasVisitTime(checkin);
  const hasCheckout = hasVisitTime(checkout);
  if (hasCheckin && hasCheckout) return 'Completed';
  if (hasCheckin) return 'Ongoing';
  return 'Assigned';
};

const statusClassName = (status?: string) => {
  if (status === 'Completed') return 'bg-emerald-50 text-emerald-700 ring-emerald-600/15';
  if (status === 'Ongoing') return 'bg-amber-50 text-amber-700 ring-amber-600/15';
  return 'bg-blue-50 text-blue-700 ring-blue-600/15';
};

const clientKindLabel = (kind?: VisitClientKind) => {
  if (kind === 'RETAIL') return 'Retail';
  if (kind === 'INSTITUTION') return 'Institution';
  if (kind === 'PROJECT') return 'Project';
  return null;
};

const textOf = (value: unknown): string =>
  typeof value === 'string' && value.trim() ? value.trim() : '';

const VisitDetailsModal: React.FC<VisitDetailsModalProps> = ({ isOpen, onClose, visitData, selectedDate, employeeName, dayLog, dayRequest }) => {
    const [currentPage, setCurrentPage] = useState(1);
    const [navigatingVisitId, setNavigatingVisitId] = useState<number | null>(null);
    const visitsPerPage = 7;
    const router = useRouter();

    useEffect(() => {
        if (isOpen) {
            setCurrentPage(1);
            setNavigatingVisitId(null);
        }
    }, [isOpen, visitData, selectedDate]);

    const rows: Row[] = useMemo(() => visitData.map((visit) => {
        const row = visit as unknown as CommonVisitRow & Record<string, unknown>;
        const status = deriveStatus(visit);
        const client = resolveVisitClient(row);
        const cityValue = resolveVisitCity(row);
        const scheduledDate = textOf(row.scheduledVisitDate) || textOf(row.visit_date) || selectedDate;
        const startRaw = textOf(row.actualCheckinAt) || textOf(row.checkinTime) || textOf(row.scheduledStartTime);
        const endRaw = textOf(row.actualCheckoutAt) || textOf(row.checkoutTime) || textOf(row.scheduledEndTime);
        return {
          id: Number(row.id),
          customerName: client.name,
          clientKind: client.kind,
          executive: textOf(row.assignedEmployeeName) || textOf(row.employeeName) || employeeName || '—',
          date: scheduledDate,
          status,
          purpose: textOf(row.purpose) || undefined,
          visitStart: status === 'Assigned' ? undefined : (startRaw || undefined),
          visitEnd: status === 'Completed' ? (endRaw || undefined) : undefined,
          city: cityValue === '—' ? undefined : cityValue,
        };
    }), [visitData, selectedDate, employeeName]);

    const totalPages = Math.max(1, Math.ceil(rows.length / visitsPerPage));
    const safePage = Math.min(currentPage, totalPages);
    const currentVisits = rows.slice((safePage - 1) * visitsPerPage, safePage * visitsPerPage);

    const handleViewDetails = (visitId: number) => {
        if (navigatingVisitId !== null) return;
        setNavigatingVisitId(visitId);
        router.push(`/dashboard/visits/${visitId}`);
        onClose();
    };

    const friendlyDate = (() => {
      try {
        return selectedDate ? formatDateToUserFriendly(selectedDate) : '';
      } catch {
        return selectedDate;
      }
    })();

    return (
        <Dialog open={isOpen} onOpenChange={(open) => { if (!open) onClose(); }}>
            {/* Override ui/dialog's sm:max-w-lg cap — otherwise modal stays 512px and table crunches */}
            <DialogContent className="max-h-[85vh] w-[96vw] max-w-[1400px] overflow-hidden p-0 sm:max-w-[1400px]">
                <DialogHeader className="border-b px-5 py-4">
                    <DialogTitle className="truncate text-base font-semibold">
                        {employeeName || 'Employee'} · {friendlyDate}
                    </DialogTitle>
                    <DialogDescription className="text-xs">{rows.length} {rows.length === 1 ? 'visit' : 'visits'}</DialogDescription>
                </DialogHeader>

                {(() => {
                  const logStatus = String(dayLog?.attendanceStatus ?? '').trim() || '—';
                  const requested = String(dayRequest?.requestedStatus ?? '').trim();
                  const requestStatus = String(dayRequest?.status ?? '').trim().toUpperCase();
                  const requestLabel = requestStatus === 'APPROVED' ? 'Approved' : 'Requested';
                  const reason = String(dayRequest?.reason ?? dayRequest?.description ?? '').trim();
                  return (
                    <div className="flex flex-wrap items-center gap-2 border-b bg-muted/30 px-5 py-3">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="inline-flex max-w-full truncate rounded-full bg-background px-2.5 py-1 text-xs font-semibold ring-1 ring-inset ring-border">
                          {logStatus.replaceAll('_', ' ')}
                        </span>
                        {requested ? (
                          <span className="inline-flex max-w-full truncate rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700 ring-1 ring-inset ring-emerald-600/15">
                            {requestLabel}: {requested.replaceAll('_', ' ')}
                          </span>
                        ) : null}
                      </div>
                      {reason ? (
                        <p className="min-w-0 flex-1 truncate text-xs text-muted-foreground" title={reason}>
                          {reason}
                        </p>
                      ) : null}
                    </div>
                  );
                })()}

                <div className="overflow-x-auto px-5 py-4">
                    <Table className="w-full min-w-[840px] table-fixed text-xs">
                        <colgroup>
                            <col className="w-[22%]" /><col className="w-[10%]" /><col className="w-[14%]" />
                            <col className="w-[10%]" /><col className="w-[14%]" />
                            <col className="w-[10%]" /><col className="w-[10%]" /><col className="w-[10%]" />
                        </colgroup>
                        <TableHeader>
                            <TableRow>
                                {['Customer Name', 'Type', 'City', 'Status', 'Purpose', 'Visit Start', 'Visit End', 'Actions'].map((heading) => (
                                    <TableHead key={heading} className="overflow-hidden text-ellipsis whitespace-nowrap" title={heading}>{heading}</TableHead>
                                ))}
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {currentVisits.length > 0 ? (
                                currentVisits.map((visit) => (
                                    <TableRow key={visit.id}>
                                        <TableCell className="font-medium"><Ellipsis value={visit.customerName} /></TableCell>
                                        <TableCell>
                                            {clientKindLabel(visit.clientKind) ? (
                                                <Badge variant="outline" className="h-5 whitespace-nowrap px-1.5 text-[10px] font-normal">
                                                    {clientKindLabel(visit.clientKind)}
                                                </Badge>
                                            ) : (
                                                <span className="text-muted-foreground">—</span>
                                            )}
                                        </TableCell>
                                        <TableCell><Ellipsis value={visit.city ?? '—'} /></TableCell>
                                        <TableCell>
                                            <span className={`inline-flex max-w-full truncate rounded-full px-2 py-0.5 text-[11px] font-medium ring-1 ring-inset ${statusClassName(visit.status)}`}>
                                                {visit.status}
                                            </span>
                                        </TableCell>
                                        <TableCell><Ellipsis value={visit.purpose} /></TableCell>
                                        <TableCell><Ellipsis value={visit.visitStart ? formatTimeTo12Hour(visit.visitStart) : '—'} /></TableCell>
                                        <TableCell><Ellipsis value={visit.visitEnd ? formatTimeTo12Hour(visit.visitEnd) : '—'} /></TableCell>
                                        <TableCell>
                                            <Button variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={() => handleViewDetails(visit.id)} disabled={navigatingVisitId !== null}>
                                                {navigatingVisitId === visit.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : 'View'}
                                            </Button>
                                        </TableCell>
                                    </TableRow>
                                ))
                            ) : (
                                <TableRow>
                                    <TableCell colSpan={8} className="h-24 text-center text-muted-foreground">
                                        No visits on this day
                                    </TableCell>
                                </TableRow>
                            )}
                        </TableBody>
                    </Table>
                </div>

                <div className="flex items-center justify-between gap-3 border-t px-5 py-3">
                    <span className="text-xs text-muted-foreground">
                        Page {safePage} of {totalPages}
                    </span>
                    <div className="flex items-center gap-2">
                        <Button variant="outline" size="sm" className="h-8" onClick={() => setCurrentPage((p) => Math.max(1, p - 1))} disabled={safePage <= 1}>
                            <ChevronLeft className="h-4 w-4" /><span className="hidden sm:inline">Previous</span>
                        </Button>
                        <Button variant="outline" size="sm" className="h-8" onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))} disabled={safePage >= totalPages}>
                            <span className="hidden sm:inline">Next</span><ChevronRight className="h-4 w-4" />
                        </Button>
                        <Button size="sm" className="h-8" onClick={onClose}>Close</Button>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
};

export default VisitDetailsModal;
