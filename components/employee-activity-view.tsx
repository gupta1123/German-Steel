"use client";

import {
  BatteryMedium,
  Building2,
  CalendarCheck,
  ChevronLeft,
  ChevronRight,
  Crosshair,
  ExternalLink,
  Hash,
  IdCard,
  Mail,
  MapPin,
  MapPinned,
  Navigation,
  Pencil,
  Phone,
  Receipt,
  Target,
  Wallet,
} from "lucide-react";
import { DetailShell, type DetailTabValue } from "@/components/detail-shell";
import { DetailHero, EmptyState, KpiCell, Pill, Section, formatDay, formatPhone, type Tone } from "@/components/detail-ui";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

export type ActivityTab = "visits" | "attendance" | "expenses" | "salary" | "targets" | "tracking";

export type SalaryBreakdownRow = {
  employeeId: number; date: string; attendanceStatus: string; visitCount: number; fullMonthSalary: number; dailySalary: number;
  baseSalary: number; travelAllowance: number; dearnessAllowance: number; approvedExpenses: number; pendingExpenses: number;
  totalSalary: number; carDistance: number; bikeDistance: number; totalVisits: number; completedVisits: number;
};
export type TrackingCurrent = { latitude: number | null; longitude: number | null; capturedAt: string | null; provider: string | null; accuracyMeters: number | null; batteryPercent: number | null };
export type TrackingPoint = TrackingCurrent & { id: string | number };

export interface ActivityVisit {
  id: number; storeName?: string; parentName?: string; scheduledVisitDate?: string; visit_date?: string; purpose?: string; outcome?: string | null;
  checkinDate?: string | null; checkinTime?: string | null; checkoutDate?: string | null; checkoutTime?: string | null;
  actualCheckinAt?: string | null; actualCheckoutAt?: string | null; locationCity?: string | null;
}
export interface ActivityExpense { id: number; type: string; subType?: string; amount: number; approvalStatus: string; description?: string; expenseDate: string }

export const VISIT_FILTER_LABELS: Record<string, string> = {
  today: "Today", yesterday: "Yesterday", "last-2-days": "Last 2 days", "this-week": "This week", "this-month": "This month", "last-month": "Last month",
};

export interface EmployeeActivityViewProps {
  employee: { id: number; name: string; roleLabel: string; code: string; department?: string; city?: string; state?: string; email?: string; phone?: string } | null;
  employeeError?: string | null;
  tab: ActivityTab;
  onTabChange: (tab: ActivityTab) => void;
  onBack: () => void;
  onEdit: () => void;
  onOpenProfile: () => void;
  visits: {
    items: ActivityVisit[]; loading: boolean; error: string | null; filter: string; onFilterChange: (value: string) => void;
    page: number; pageSize: number; total: number; totalPages: number; onPageChange: (page: number) => void; onPageSizeChange: (size: number) => void; onOpen: (id: number) => void;
  };
  month: { year: number; month: number; onChange: (year: number, month: number) => void };
  attendance: { full: number; half: number; absent: number; loading: boolean; error: string | null };
  expenses: { items: ActivityExpense[]; loading: boolean; error: string | null; start?: Date; end?: Date; onStartChange: (d: Date | undefined) => void; onEndChange: (d: Date | undefined) => void; invalid: boolean };
  salary: { rows: SalaryBreakdownRow[]; loading: boolean; error: string | null; permissionDenied: boolean };
  targets: { items: Record<string, unknown>[]; loading: boolean; error: string | null };
  tracking: { current: TrackingCurrent | null; history: TrackingPoint[]; loading: boolean; error: string | null; permissionDenied: boolean };
}

const inr = (n: number | null | undefined, digits = 0) => (n == null || !Number.isFinite(n) ? "—" : `₹${n.toLocaleString("en-IN", { maximumFractionDigits: digits })}`);
const toInputDate = (d?: Date) => (d ? `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}` : "");
const fromInputDate = (v: string) => (v ? new Date(`${v}T00:00:00`) : undefined);
const shortDay = (v?: string | null) => (v ? formatDay(v).replace(/ \d{4}$/, "") : "—");
const timeOf = (v?: string | null) => {
  if (!v) return null;
  const d = new Date(v);
  if (!Number.isNaN(d.getTime()) && v.includes("T")) return d.toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit" });
  const m = /^(\d{1,2}):(\d{2})/.exec(v);
  if (!m) return null;
  const h = Number(m[1]);
  return `${((h + 11) % 12) + 1}:${m[2]} ${h >= 12 ? "PM" : "AM"}`;
};
const stamp = (v?: string | null) => {
  if (!v) return "—";
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? v : d.toLocaleString("en-IN", { day: "2-digit", month: "short", hour: "numeric", minute: "2-digit" });
};
const visitState = (v: ActivityVisit): { label: string; tone: Tone } => {
  const inAt = v.actualCheckinAt || (v.checkinDate && v.checkinTime);
  const outAt = v.actualCheckoutAt || (v.checkoutDate && v.checkoutTime);
  if (inAt && outAt) return { label: "Completed", tone: "success" };
  if (inAt) return { label: "In progress", tone: "info" };
  return { label: "Scheduled", tone: "neutral" };
};
const providerLabel = (p?: string | null) => (!p ? "GPS" : p.toLowerCase() === "gps" ? "GPS" : p.charAt(0).toUpperCase() + p.slice(1).toLowerCase());
const expenseTone = (s: string): Tone => (s.toLowerCase() === "approved" ? "success" : s.toLowerCase() === "rejected" ? "danger" : "warning");

function MonthStepper({ year, month, onChange }: EmployeeActivityViewProps["month"]) {
  const now = new Date();
  const isCurrent = year === now.getFullYear() && month === now.getMonth() + 1;
  const label = new Date(year, month - 1, 1).toLocaleDateString("en-IN", { month: "long", year: "numeric" });
  return (
    <div className="inline-flex h-7 items-center rounded-md border bg-background">
      <Button variant="ghost" size="icon" className="h-7 w-7 rounded-r-none" aria-label="Previous month" onClick={() => (month === 1 ? onChange(year - 1, 12) : onChange(year, month - 1))}><ChevronLeft className="h-3.5 w-3.5" /></Button>
      <span className="min-w-[116px] px-1 text-center text-xs font-medium tabular-nums">{label}</span>
      <Button variant="ghost" size="icon" className="h-7 w-7 rounded-l-none" aria-label="Next month" disabled={isCurrent} onClick={() => (month === 12 ? onChange(year + 1, 1) : onChange(year, month + 1))}><ChevronRight className="h-3.5 w-3.5" /></Button>
    </div>
  );
}

function StateLine({ loading, error, permissionDenied, what }: { loading: boolean; error: string | null; permissionDenied?: boolean; what: string }) {
  if (loading) return <div className="space-y-2 p-4">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-8 w-full" />)}</div>;
  if (permissionDenied) return <p className="px-4 py-4 text-center text-xs text-amber-700 dark:text-amber-400">You don’t have permission to view {what} for this employee.</p>;
  if (error) return <p role="alert" className="px-4 py-4 text-center text-xs text-destructive">{error}</p>;
  return null;
}

/** Pulls a readable title / target / achieved value out of a loosely-shaped target record. */
const readTarget = (t: Record<string, unknown>, index: number) => {
  const num = (...keys: string[]) => { for (const k of keys) { const v = t[k]; const n = typeof v === "number" ? v : typeof v === "string" && v.trim() && Number.isFinite(Number(v)) ? Number(v) : null; if (n != null) return n; } return null; };
  const str = (...keys: string[]) => { for (const k of keys) { const v = t[k]; if (typeof v === "string" && v.trim()) return v.trim(); } return null; };
  const title = str("targetName", "name", "title", "targetType", "metric", "category") ?? `Target #${(t.id as number) ?? index + 1}`;
  const target = num("targetValue", "target", "targetAmount", "targetMt", "targetQuantity", "value");
  const achieved = num("achievedValue", "achieved", "actual", "actualValue", "achievedAmount", "achievedMt");
  const unit = str("unit", "uom") ?? "";
  const skip = new Set(["id", "employeeId", "targetName", "name", "title", "targetType", "metric", "category", "targetValue", "target", "targetAmount", "targetMt", "targetQuantity", "value", "achievedValue", "achieved", "actual", "actualValue", "achievedAmount", "achievedMt", "unit", "uom"]);
  const extras = Object.entries(t).filter(([k, v]) => !skip.has(k) && (typeof v === "string" || typeof v === "number" || typeof v === "boolean") && String(v).trim() !== "").slice(0, 6);
  return { title, target, achieved, unit, extras };
};

export function EmployeeActivityView(props: EmployeeActivityViewProps) {
  const { employee, employeeError, tab, onTabChange, onBack, onEdit, onOpenProfile, visits, month, attendance, expenses, salary, targets, tracking } = props;
  const monthLabel = new Date(month.year, month.month - 1, 1).toLocaleDateString("en-IN", { month: "long" });
  const attendanceDays = attendance.full + attendance.half + attendance.absent;
  const attendanceRate = attendanceDays ? Math.round(((attendance.full + attendance.half * 0.5) / attendanceDays) * 100) : null;
  const expenseTotal = expenses.items.reduce((sum, e) => sum + (e.amount || 0), 0);
  const expensePending = expenses.items.filter((e) => !["approved", "rejected"].includes(String(e.approvalStatus).toLowerCase())).length;
  const salaryTotals = salary.rows.reduce((acc, r) => ({
    earned: acc.earned + r.totalSalary, base: acc.base + r.baseSalary, ta: acc.ta + r.travelAllowance, da: acc.da + r.dearnessAllowance,
    expenses: acc.expenses + r.approvedExpenses, visits: acc.visits + r.visitCount, km: acc.km + r.carDistance + r.bikeDistance,
  }), { earned: 0, base: 0, ta: 0, da: 0, expenses: 0, visits: 0, km: 0 });
  const monthlySalary = salary.rows[0]?.fullMonthSalary ?? null;
  const dailyRate = salary.rows[0]?.dailySalary ?? null;
  const rangeLabel = expenses.start && expenses.end ? `${formatDay(toInputDate(expenses.start))} – ${formatDay(toInputDate(expenses.end))}` : "selected range";
  const monthNote = (
    <span>Month-based: <span className="font-medium text-foreground">{new Date(month.year, month.month - 1, 1).toLocaleDateString("en-IN", { month: "long", year: "numeric" })}</span></span>
  );

  return (
    <div className="detail-page space-y-4 font-poppins text-xs">
      <DetailHero
        name={employee?.name ?? "Loading employee…"}
        onBack={onBack}
        backLabel="Back"
        badges={employee ? <><Pill tone="info">{employee.roleLabel}</Pill><Pill>Full activity</Pill></> : undefined}
        meta={employee ? [
          { icon: Hash, label: employee.code, mono: true },
          ...(employee.department ? [{ icon: Building2, label: employee.department }] : []),
          ...(employee.city ? [{ icon: MapPin, label: [employee.city, employee.state].filter(Boolean).join(", ") }] : []),
          ...(employee.phone ? [{ icon: Phone, label: <a href={`tel:+${employee.phone}`} className="tabular-nums hover:text-foreground hover:underline">{formatPhone(employee.phone)}</a> }] : []),
          ...(employee.email ? [{ icon: Mail, label: <a href={`mailto:${employee.email}`} className="hover:text-foreground hover:underline">{employee.email}</a> }] : []),
        ] : []}
        actions={<>
          <Button variant="outline" size="sm" className="h-8" onClick={onOpenProfile}><IdCard className="mr-1.5 h-3.5 w-3.5" />Profile</Button>
          <Button size="sm" className="h-8" onClick={onEdit}><Pencil className="mr-1.5 h-3.5 w-3.5" />Edit</Button>
        </>}
        kpis={<>
          <KpiCell icon={MapPinned} label="Visits" value={visits.loading ? "…" : visits.total} hint={VISIT_FILTER_LABELS[visits.filter]?.toLowerCase()} />
          <KpiCell icon={CalendarCheck} label={`Attendance · ${monthLabel}`} value={attendance.loading ? "…" : attendanceRate != null ? `${attendanceRate}%` : "—"} hint={attendance.loading ? undefined : `${attendance.full} full · ${attendance.half} half · ${attendance.absent} absent`} />
          <KpiCell icon={Receipt} label="Expenses" value={expenses.loading ? "…" : inr(expenseTotal)} hint={expenses.loading ? undefined : `${expenses.items.length} claims${expensePending ? ` · ${expensePending} pending` : ""}`} />
          <KpiCell icon={Wallet} label={`Earned · ${monthLabel}`} value={salary.loading ? "…" : salary.permissionDenied ? "—" : inr(salaryTotals.earned)} hint={salary.permissionDenied ? "no access" : monthlySalary ? `of ${inr(monthlySalary)} monthly` : undefined} />
        </>}
      />

      {employeeError && <p role="alert" className="rounded-xl border border-destructive/30 bg-destructive/5 px-3 py-2 text-xs text-destructive">{employeeError}</p>}

      <DetailShell
        value={tab}
        onValueChange={(next: DetailTabValue) => onTabChange(next as ActivityTab)}
        tabs={[
          {
            value: "visits",
            label: "Visits",
            count: visits.loading ? undefined : visits.total,
            content: (
              <Section
                description={visits.total ? `Showing ${(visits.page - 1) * visits.pageSize + 1}–${Math.min(visits.page * visits.pageSize, visits.total)} of ${visits.total}` : "No visits in this period"}
                bodyClassName="p-0"
                action={
                  <Select value={visits.filter} onValueChange={visits.onFilterChange}>
                    <SelectTrigger className="h-7 w-[132px] bg-background text-xs" aria-label="Visit period"><SelectValue /></SelectTrigger>
                    <SelectContent>{Object.entries(VISIT_FILTER_LABELS).map(([value, label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}</SelectContent>
                  </Select>
                }
              >
                <StateLine loading={visits.loading} error={visits.error} what="visits" />
                {!visits.loading && !visits.error && (visits.items.length === 0 ? <EmptyState compact title={`No visits ${VISIT_FILTER_LABELS[visits.filter]?.toLowerCase() ?? "in this period"}. Try a longer period.`} /> : (
                  <>
                    <div className="hidden grid-cols-[88px_minmax(0,1fr)_minmax(0,0.8fr)_104px_16px] gap-x-4 border-b bg-muted/40 px-4 py-1.5 text-[11px] font-medium text-muted-foreground md:grid">
                      <span>Date</span><span>Client</span><span>Purpose</span><span>Status</span><span />
                    </div>
                    <ul className="divide-y">
                      {visits.items.map((v) => {
                        const st = visitState(v);
                        const client = v.storeName || v.parentName || `Visit #${v.id}`;
                        const checkin = timeOf(v.actualCheckinAt || v.checkinTime);
                        const checkout = timeOf(v.actualCheckoutAt || v.checkoutTime);
                        return (
                          <li key={v.id}>
                            <button type="button" onClick={() => visits.onOpen(v.id)} className="group grid w-full grid-cols-[72px_minmax(0,1fr)_auto] items-center gap-x-3 px-4 py-2 text-left transition-colors hover:bg-muted/40 focus-visible:bg-muted/40 focus-visible:outline-none md:grid-cols-[88px_minmax(0,1fr)_minmax(0,0.8fr)_104px_16px] md:gap-x-4">
                              <div className="leading-tight">
                                <p className="text-sm font-medium tabular-nums">{shortDay(v.scheduledVisitDate || v.visit_date)}</p>
                                <p className="whitespace-nowrap text-[11px] text-muted-foreground tabular-nums">{checkin ?? "—"}</p>
                              </div>
                              <div className="min-w-0 leading-tight">
                                <p className="truncate text-sm font-medium" title={client}>{client}</p>
                                <p className="truncate text-[11px] text-muted-foreground md:hidden">{v.purpose || "No purpose"}</p>
                                {v.locationCity && <p className="hidden truncate text-[11px] text-muted-foreground md:block">{v.locationCity}</p>}
                              </div>
                              <span className="hidden truncate text-xs text-muted-foreground md:block" title={v.purpose}>{v.purpose || "—"}</span>
                              <span className="flex flex-col items-start gap-0.5"><Pill tone={st.tone}>{st.label}</Pill>{checkin && checkout && <span className="hidden whitespace-nowrap text-[10px] tabular-nums text-muted-foreground md:block">out {checkout}</span>}</span>
                              <ChevronRight className="hidden h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-0.5 md:block" />
                            </button>
                          </li>
                        );
                      })}
                    </ul>
                    <div className="flex flex-wrap items-center justify-between gap-2 border-t px-4 py-2 text-xs text-muted-foreground">
                      <div className="flex items-center gap-2">
                        <span>Rows</span>
                        <Select value={String(visits.pageSize)} onValueChange={(v) => visits.onPageSizeChange(Number(v))}>
                          <SelectTrigger className="h-7 w-[64px] text-xs" aria-label="Rows per page"><SelectValue /></SelectTrigger>
                          <SelectContent>{[5, 10, 20].map((n) => <SelectItem key={n} value={String(n)}>{n}</SelectItem>)}</SelectContent>
                        </Select>
                      </div>
                      <div className="flex items-center gap-1">
                        <span className="mr-2 tabular-nums">Page {visits.page} of {visits.totalPages}</span>
                        <Button variant="ghost" size="sm" className="h-7 px-2 text-xs" disabled={visits.page <= 1} onClick={() => visits.onPageChange(visits.page - 1)}><ChevronLeft className="mr-0.5 h-3.5 w-3.5" />Prev</Button>
                        <Button variant="ghost" size="sm" className="h-7 px-2 text-xs" disabled={visits.page >= visits.totalPages} onClick={() => visits.onPageChange(visits.page + 1)}>Next<ChevronRight className="ml-0.5 h-3.5 w-3.5" /></Button>
                      </div>
                    </div>
                  </>
                ))}
              </Section>
            ),
          },
          {
            value: "attendance",
            label: "Attendance",
            content: (
              <Section description={monthNote} bodyClassName="p-0" action={<MonthStepper {...month} />}>
                <StateLine loading={attendance.loading} error={attendance.error} what="attendance" />
                {!attendance.loading && !attendance.error && (attendanceDays === 0 ? <EmptyState compact title="No attendance logged for this month." /> : (
                  <div className="grid gap-6 p-4 md:grid-cols-[220px_minmax(0,1fr)] md:items-center">
                    <div>
                      <p className="text-3xl font-semibold tabular-nums leading-none">{attendanceRate}%</p>
                      <p className="mt-1 text-xs text-muted-foreground">attendance rate · {attendanceDays} days logged</p>
                    </div>
                    <div>
                      <div className="flex h-2.5 overflow-hidden rounded-full bg-muted">
                        <span className="bg-emerald-500" style={{ width: `${(attendance.full / attendanceDays) * 100}%` }} />
                        <span className="bg-amber-400" style={{ width: `${(attendance.half / attendanceDays) * 100}%` }} />
                        <span className="bg-red-400" style={{ width: `${(attendance.absent / attendanceDays) * 100}%` }} />
                      </div>
                      <dl className="mt-3 grid grid-cols-3 divide-x">
                        {[{ label: "Full days", value: attendance.full, dot: "bg-emerald-500" }, { label: "Half days", value: attendance.half, dot: "bg-amber-400" }, { label: "Absent", value: attendance.absent, dot: "bg-red-400" }].map((s) => (
                          <div key={s.label} className="flex flex-col items-center">
                            <dd className="text-lg font-semibold tabular-nums leading-7">{s.value}</dd>
                            <dt className="flex items-center gap-1 text-[11px] text-muted-foreground"><span className={cn("h-1.5 w-1.5 rounded-full", s.dot)} />{s.label}</dt>
                          </div>
                        ))}
                      </dl>
                    </div>
                  </div>
                ))}
              </Section>
            ),
          },
          {
            value: "expenses",
            label: "Expenses",
            count: expenses.loading ? undefined : expenses.items.length,
            content: (
              <Section
                description={expenses.items.length ? <><span className="font-medium text-foreground">{inr(expenseTotal)}</span> · {expenses.items.length} claims{expensePending ? ` · ${expensePending} pending` : ""}</> : rangeLabel}
                bodyClassName="p-0"
                action={
                  <div className="flex items-center gap-1.5">
                    <Input type="date" aria-label="From date" value={toInputDate(expenses.start)} max={toInputDate(expenses.end)} onChange={(e) => expenses.onStartChange(fromInputDate(e.target.value))} className="h-7 w-[140px] text-xs" />
                    <span className="text-muted-foreground">–</span>
                    <Input type="date" aria-label="To date" value={toInputDate(expenses.end)} min={toInputDate(expenses.start)} onChange={(e) => expenses.onEndChange(fromInputDate(e.target.value))} className="h-7 w-[140px] text-xs" />
                  </div>
                }
              >
                {expenses.invalid ? <p className="px-4 py-4 text-center text-xs text-destructive">The start date must be on or before the end date.</p> : <>
                  <StateLine loading={expenses.loading} error={expenses.error} what="expenses" />
                  {!expenses.loading && !expenses.error && (expenses.items.length === 0 ? <EmptyState compact title="No expenses claimed in this range." /> : (
                    <ul className="divide-y">
                      {expenses.items.map((e) => (
                        <li key={e.id} className="grid grid-cols-[64px_minmax(0,1fr)_96px_92px] items-center gap-x-3 px-4 py-2">
                          <span className="text-sm font-medium tabular-nums">{shortDay(e.expenseDate)}</span>
                          <div className="min-w-0 leading-tight">
                            <p className="truncate text-sm font-medium capitalize">{e.type}{e.subType ? <span className="font-normal text-muted-foreground"> · {e.subType}</span> : null}</p>
                            {e.description && <p className="truncate text-[11px] text-muted-foreground" title={e.description}>{e.description}</p>}
                          </div>
                          <span className="text-right text-sm font-semibold tabular-nums">{inr(e.amount, 2)}</span>
                          <span className="flex justify-end"><Pill tone={expenseTone(e.approvalStatus)} className="capitalize">{e.approvalStatus.toLowerCase()}</Pill></span>
                        </li>
                      ))}
                    </ul>
                  ))}
                </>}
              </Section>
            ),
          },
          {
            value: "salary",
            label: "Salary",
            content: (
              <Section description={monthNote} bodyClassName="p-0" action={<MonthStepper {...month} />}>
                <StateLine loading={salary.loading} error={salary.permissionDenied ? null : salary.error} permissionDenied={salary.permissionDenied} what="salary data" />
                {!salary.loading && !salary.error && (salary.rows.length === 0 ? <EmptyState compact title="No salary breakdown for this month." /> : (
                  <>
                    <dl className="grid grid-cols-2 gap-px border-b bg-border md:grid-cols-5">
                      {[
                        { label: "Earned", value: inr(salaryTotals.earned), strong: true },
                        { label: "Monthly salary", value: inr(monthlySalary) },
                        { label: "Daily rate", value: inr(dailyRate) },
                        { label: "Approved expenses", value: inr(salaryTotals.expenses) },
                        { label: "Distance", value: `${salaryTotals.km.toLocaleString("en-IN", { maximumFractionDigits: 1 })} km` },
                      ].map((s, index, all) => (
                        <div key={s.label} className={cn("bg-card px-4 py-2.5", index === all.length - 1 && "col-span-2 md:col-span-1")}>
                          <dt className="text-[11px] text-muted-foreground">{s.label}</dt>
                          <dd className={cn("mt-0.5 text-sm font-semibold tabular-nums", s.strong && "text-base")}>{s.value}</dd>
                        </div>
                      ))}
                    </dl>
                    <div className="max-h-[480px] overflow-auto">
                      <table className="w-full min-w-[720px] text-xs">
                        <thead className="sticky top-0 z-10 bg-muted/80 text-[11px] text-muted-foreground backdrop-blur">
                          <tr>
                            <th className="px-4 py-2 text-left font-medium">Date</th>
                            <th className="px-3 py-2 text-left font-medium">Attendance</th>
                            <th className="px-3 py-2 text-right font-medium">Visits</th>
                            <th className="px-3 py-2 text-right font-medium">Base</th>
                            <th className="px-3 py-2 text-right font-medium">Travel</th>
                            <th className="px-3 py-2 text-right font-medium">Dearness</th>
                            <th className="px-3 py-2 text-right font-medium">Expenses</th>
                            <th className="px-4 py-2 text-right font-medium">Total</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y">
                          {salary.rows.map((r) => {
                            const s = r.attendanceStatus.toLowerCase();
                            return (
                              <tr key={r.date} className="hover:bg-muted/30">
                                <td className="whitespace-nowrap px-4 py-1.5 font-medium">{shortDay(r.date)}</td>
                                <td className="px-3 py-1.5"><Pill tone={s.includes("full") ? "success" : s.includes("half") ? "warning" : s.includes("absent") ? "danger" : "neutral"}>{r.attendanceStatus.replace(/[_-]+/g, " ").toLowerCase().replace(/^./, (c) => c.toUpperCase())}</Pill></td>
                                <td className="px-3 py-1.5 text-right tabular-nums">{r.completedVisits}/{r.totalVisits}</td>
                                <td className="px-3 py-1.5 text-right tabular-nums">{inr(r.baseSalary)}</td>
                                <td className="px-3 py-1.5 text-right tabular-nums">{inr(r.travelAllowance)}</td>
                                <td className="px-3 py-1.5 text-right tabular-nums">{inr(r.dearnessAllowance)}</td>
                                <td className="px-3 py-1.5 text-right tabular-nums">{inr(r.approvedExpenses)}</td>
                                <td className="px-4 py-1.5 text-right font-semibold tabular-nums">{inr(r.totalSalary)}</td>
                              </tr>
                            );
                          })}
                        </tbody>
                        <tfoot className="sticky bottom-0 border-t bg-card text-xs font-semibold">
                          <tr>
                            <td className="px-4 py-2" colSpan={2}>{salary.rows.length} days</td>
                            <td className="px-3 py-2 text-right tabular-nums">{salaryTotals.visits}</td>
                            <td className="px-3 py-2 text-right tabular-nums">{inr(salaryTotals.base)}</td>
                            <td className="px-3 py-2 text-right tabular-nums">{inr(salaryTotals.ta)}</td>
                            <td className="px-3 py-2 text-right tabular-nums">{inr(salaryTotals.da)}</td>
                            <td className="px-3 py-2 text-right tabular-nums">{inr(salaryTotals.expenses)}</td>
                            <td className="px-4 py-2 text-right tabular-nums">{inr(salaryTotals.earned)}</td>
                          </tr>
                        </tfoot>
                      </table>
                    </div>
                  </>
                ))}
              </Section>
            ),
          },
          {
            value: "targets",
            label: "Targets",
            count: targets.loading ? undefined : targets.items.length,
            content: (
              <Section description={monthNote} bodyClassName="p-0" action={<MonthStepper {...month} />}>
                <StateLine loading={targets.loading} error={targets.error} what="targets" />
                {!targets.loading && !targets.error && (targets.items.length === 0 ? <EmptyState compact title="No targets set for this month." /> : (
                  <ul className="divide-y">
                    {targets.items.map((t, index) => {
                      const r = readTarget(t, index);
                      const pct = r.target && r.achieved != null ? Math.min(100, (r.achieved / r.target) * 100) : null;
                      return (
                        <li key={String(t.id ?? index)} className="px-4 py-3">
                          <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                            <p className="flex items-center gap-2 text-sm font-medium"><Target className="h-4 w-4 text-muted-foreground" />{r.title}</p>
                            {r.target != null && <p className="text-xs tabular-nums text-muted-foreground"><span className="font-semibold text-foreground">{r.achieved != null ? r.achieved.toLocaleString("en-IN") : "—"}</span> / {r.target.toLocaleString("en-IN")} {r.unit}{pct != null ? ` · ${Math.round(pct)}%` : ""}</p>}
                          </div>
                          {pct != null && <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted"><div className={cn("h-full rounded-full", pct >= 100 ? "bg-emerald-500" : pct >= 60 ? "bg-primary" : "bg-amber-500")} style={{ width: `${pct}%` }} /></div>}
                          {r.extras.length > 0 && <p className="mt-1.5 flex flex-wrap gap-x-3 gap-y-0.5 text-[11px] text-muted-foreground">{r.extras.map(([k, v]) => <span key={k}>{k.replace(/([A-Z])/g, " $1").toLowerCase()}: <span className="text-foreground">{String(v)}</span></span>)}</p>}
                        </li>
                      );
                    })}
                  </ul>
                ))}
              </Section>
            ),
          },
          {
            value: "tracking",
            label: "Tracking",
            content: (
              <div className="space-y-4">
                <Section icon={Crosshair} title="Last known location" bodyClassName="p-0">
                  <StateLine loading={tracking.loading} error={tracking.permissionDenied ? null : tracking.error} permissionDenied={tracking.permissionDenied} what="tracking data" />
                  {!tracking.loading && !tracking.error && (tracking.current ? (
                    <dl className="grid grid-cols-2 gap-px bg-border md:grid-cols-4">
                      <div className="col-span-2 bg-card px-4 py-2.5 md:col-span-1">
                        <dt className="text-[11px] text-muted-foreground">Coordinates</dt>
                        <dd className="mt-0.5"><a href={`https://www.google.com/maps?q=${tracking.current.latitude},${tracking.current.longitude}`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 font-mono text-xs font-medium hover:underline">{tracking.current.latitude?.toFixed(5)}, {tracking.current.longitude?.toFixed(5)}<ExternalLink className="h-3 w-3 text-muted-foreground" /></a></dd>
                      </div>
                      <div className="bg-card px-4 py-2.5"><dt className="text-[11px] text-muted-foreground">Captured</dt><dd className="mt-0.5 text-sm font-medium">{stamp(tracking.current.capturedAt)}</dd></div>
                      <div className="bg-card px-4 py-2.5"><dt className="text-[11px] text-muted-foreground">Accuracy · source</dt><dd className="mt-0.5 text-sm font-medium">{tracking.current.accuracyMeters != null ? `±${tracking.current.accuracyMeters} m` : "—"}<span className="font-normal text-muted-foreground"> · {providerLabel(tracking.current.provider)}</span></dd></div>
                      <div className="bg-card px-4 py-2.5"><dt className="text-[11px] text-muted-foreground">Battery</dt><dd className="mt-0.5 flex items-center gap-1.5 text-sm font-medium"><BatteryMedium className={cn("h-4 w-4", (tracking.current.batteryPercent ?? 100) < 20 ? "text-red-500" : "text-muted-foreground")} />{tracking.current.batteryPercent != null ? `${tracking.current.batteryPercent}%` : "—"}</dd></div>
                    </dl>
                  ) : <EmptyState compact title="No location reported yet." />)}
                </Section>
                <Section icon={Navigation} title={`Location history${tracking.history.length ? ` · ${tracking.history.length}` : ""}`} description={monthNote} bodyClassName="p-0" action={<MonthStepper {...month} />}>
                  {!tracking.loading && !tracking.error && (tracking.history.length === 0 ? <EmptyState compact title="No location history for this month." /> : (
                    <div className="max-h-[420px] overflow-auto">
                      <table className="w-full min-w-[560px] text-xs">
                        <thead className="sticky top-0 bg-muted/80 text-[11px] text-muted-foreground backdrop-blur">
                          <tr><th className="px-4 py-2 text-left font-medium">Time</th><th className="px-3 py-2 text-left font-medium">Coordinates</th><th className="px-3 py-2 text-left font-medium">Source</th><th className="px-3 py-2 text-right font-medium">Accuracy</th><th className="px-4 py-2 text-right font-medium">Battery</th></tr>
                        </thead>
                        <tbody className="divide-y">
                          {tracking.history.slice(0, 20).map((pt) => (
                            <tr key={String(pt.id)} className="hover:bg-muted/30">
                              <td className="whitespace-nowrap px-4 py-1.5 font-medium">{stamp(pt.capturedAt)}</td>
                              <td className="px-3 py-1.5"><a href={`https://www.google.com/maps?q=${pt.latitude},${pt.longitude}`} target="_blank" rel="noopener noreferrer" className="font-mono hover:underline">{pt.latitude?.toFixed(5)}, {pt.longitude?.toFixed(5)}</a></td>
                              <td className="px-3 py-1.5 text-muted-foreground">{providerLabel(pt.provider)}</td>
                              <td className="px-3 py-1.5 text-right tabular-nums">{pt.accuracyMeters != null ? `±${pt.accuracyMeters} m` : "—"}</td>
                              <td className="px-4 py-1.5 text-right tabular-nums">{pt.batteryPercent != null ? `${pt.batteryPercent}%` : "—"}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ))}
                </Section>
              </div>
            ),
          },
        ]}
      />
    </div>
  );
}
