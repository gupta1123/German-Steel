"use client";

import type { ReactNode } from "react";
import { CalendarClock, CheckCircle2, FileText, UserRound } from "lucide-react";

type Evidence = { id: number; fileName: string; fileAttached?: boolean };

const statusStyle: Record<string, string> = {
  OPEN: "border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-900/60 dark:bg-rose-950/40 dark:text-rose-300",
  SUBMITTED: "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-300",
  CLOSED: "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/60 dark:bg-emerald-950/40 dark:text-emerald-300",
};

const railStyle: Record<string, string> = {
  OPEN: "border-l-rose-500",
  SUBMITTED: "border-l-amber-500",
  CLOSED: "border-l-emerald-500",
};

export function NcSummaryCard({ id, status, description, raisedDate, raisedBy, targetDate, responsible, closureSummary, evidence = [], overdue, actions }: {
  id: number; status: string; description: string; raisedDate: string; raisedBy: string; targetDate: string;
  responsible?: string | null; closureSummary?: string | null; evidence?: Evidence[]; overdue?: boolean; actions?: ReactNode;
}) {
  const normalizedStatus = status.toUpperCase();
  return (
    <article className={`overflow-hidden rounded-lg border border-l-[3px] bg-background ${railStyle[normalizedStatus] || "border-l-muted-foreground"}`}>
      <div className="p-4 sm:p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">NC #{id}</span>
              <span className={`inline-flex h-5 items-center rounded-full border px-2 text-[10px] font-semibold uppercase tracking-wide ${statusStyle[normalizedStatus] || "border-border bg-muted text-muted-foreground"}`}>{normalizedStatus}</span>
              {overdue && <span className="inline-flex h-5 items-center rounded-full border border-orange-200 bg-orange-50 px-2 text-[10px] font-semibold uppercase tracking-wide text-orange-700">Overdue</span>}
            </div>
            <h3 className="mt-2 text-sm font-semibold leading-5 text-foreground">{description}</h3>
          </div>
        </div>

        <dl className="mt-4 grid gap-3 border-t pt-4 sm:grid-cols-3">
          <div className="min-w-0"><dt className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wide text-muted-foreground"><CalendarClock className="h-3.5 w-3.5" />Raised</dt><dd className="mt-1 truncate text-xs font-medium" title={`${raisedDate} by ${raisedBy}`}>{raisedDate} · {raisedBy}</dd></div>
          <div className="min-w-0"><dt className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wide text-muted-foreground"><CalendarClock className="h-3.5 w-3.5" />Target closure</dt><dd className={`mt-1 text-xs font-medium ${overdue ? "text-orange-700" : ""}`}>{targetDate}</dd></div>
          <div className="min-w-0"><dt className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wide text-muted-foreground"><UserRound className="h-3.5 w-3.5" />Responsible</dt><dd className="mt-1 truncate text-xs font-medium" title={responsible || undefined}>{responsible || "Not assigned"}</dd></div>
        </dl>

        {closureSummary && <div className="mt-3 flex items-start gap-2 rounded-md bg-emerald-50/70 px-3 py-2 text-xs text-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-300"><CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0" /><span><strong className="font-semibold">Closure:</strong> {closureSummary}</span></div>}

        {evidence.length > 0 && <div className="mt-3 flex flex-wrap items-center gap-2 text-xs"><span className="inline-flex items-center gap-1.5 font-medium text-muted-foreground"><FileText className="h-3.5 w-3.5" />Evidence ({evidence.length})</span>{evidence.slice(0, 2).map((file) => <span key={file.id} className="max-w-[220px] truncate rounded-md bg-muted px-2 py-1" title={file.fileName}>{file.fileName}{file.fileAttached === false ? " · missing file" : ""}</span>)}{evidence.length > 2 && <span className="text-muted-foreground">+{evidence.length - 2} more</span>}</div>}
      </div>
      {actions && <div className="flex flex-wrap items-center justify-end gap-2 border-t bg-muted/20 px-4 py-2.5 sm:px-5">{actions}</div>}
    </article>
  );
}
