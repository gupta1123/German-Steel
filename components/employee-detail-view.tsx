"use client";

import Link from "next/link";
import {
  ArrowRight,
  Briefcase,
  Building2,
  CalendarCheck,
  CalendarDays,
  ChevronRight,
  Hash,
  Mail,
  MapPin,
  MapPinned,
  MoreHorizontal,
  Pencil,
  Phone,
  Receipt,
  ShieldCheck,
  User,
  Wallet,
} from "lucide-react";
import { EmployeeManagedTeams } from "@/components/employee-managed-teams";
import { DetailHero, EmptyState, KpiCell, Pill, Section, formatDay, formatPhone, type Tone } from "@/components/detail-ui";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { getEmployeeRoleLabel } from "@/lib/employee-role";
import { resolveVisitClient, type CommonVisitRow } from "@/lib/visits-api";
import type { ExpenseRow } from "@/lib/expenses-api";
import type { TeamEmployee } from "@/lib/teams-api";
import { cn, formatDateToUserFriendly, formatTimeTo12Hour } from "@/lib/utils";

export interface EmployeeDetailViewProps {
  employee: TeamEmployee;
  managerName: string | null;
  teamName: string | null;
  regionNames: string[];
  recentVisits: CommonVisitRow[];
  visitsTotal: number;
  visitsLoading: boolean;
  attSummary: { full: number; half: number; absent: number };
  attLoading: boolean;
  monthExpenses: ExpenseRow[];
  expLoading: boolean;
  onBack: () => void;
  /** Override for the managed-teams panel (defaults to the live, self-loading panel). */
  teamsPanel?: React.ReactNode;
}

const formatMoney = (value: unknown): string => {
  if (typeof value !== "number" || !Number.isFinite(value)) return "—";
  return `₹${value.toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;
};

const hasTime = (v?: string | null): boolean => {
  if (v == null) return false;
  const s = String(v).trim().toLowerCase();
  return s !== "" && s !== "null" && s !== "undefined" && s !== "-";
};

const visitStatusOf = (v: CommonVisitRow): { label: string; tone: Tone } => {
  const ci = hasTime(v.actualCheckinAt) || hasTime(v.checkinTime);
  const co = hasTime(v.actualCheckoutAt) || hasTime(v.checkoutTime);
  if (ci && co) return { label: "Completed", tone: "success" };
  if (ci) return { label: "In progress", tone: "info" };
  return { label: "Scheduled", tone: "neutral" };
};

const expenseTone = (status: string): Tone => {
  const s = status.toLowerCase();
  return s === "approved" ? "success" : s === "rejected" ? "danger" : "warning";
};

/** Label/value row used in the profile rail: label left, value right, aligned on one baseline. */
function PropertyRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[104px_minmax(0,1fr)] items-baseline gap-3 py-1.5">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="min-w-0 break-words text-sm font-medium">{children || <span className="font-normal text-muted-foreground">—</span>}</dd>
    </div>
  );
}

function PropertyGroup({ icon: Icon, title, children }: { icon: typeof User; title: string; children: React.ReactNode }) {
  return (
    <section className="px-4 py-3">
      <h4 className="mb-1 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground"><Icon className="h-3.5 w-3.5" />{title}</h4>
      <dl>{children}</dl>
    </section>
  );
}

export function EmployeeDetailView({ employee, managerName, teamName, regionNames, recentVisits, visitsTotal, visitsLoading, attSummary, attLoading, monthExpenses, expLoading, onBack, teamsPanel }: EmployeeDetailViewProps) {
  const fullName = `${employee.firstName} ${employee.lastName}`.trim() || `Employee #${employee.id}`;
  const payload = employee.updatePayload;
  const statusLabel = employee.status || (employee.active ? "Active" : "Inactive");
  const month = new Date().toLocaleDateString("en-IN", { month: "long" });
  const attendanceDays = attSummary.full + attSummary.half + attSummary.absent;
  const expenseAmount = monthExpenses.reduce((sum, e) => sum + (e.amount ?? 0), 0);
  const pendingExpenses = monthExpenses.filter((e) => !["approved", "rejected"].includes(String(e.approvalStatus).toLowerCase())).length;
  const joined = employee.dateOfJoining ? formatDateToUserFriendly(employee.dateOfJoining) : null;
  const address = [employee.addressLine1, employee.addressLine2, employee.city, employee.state, employee.pincode].filter(Boolean).join(", ");
  const supervisor = employee.managerId != null
    ? <Link href={`/dashboard/employees/${employee.managerId}`} className="hover:underline">{managerName ?? `Employee #${employee.managerId}`}</Link>
    : null;

  return (
    <div className="detail-page space-y-4 font-poppins text-xs">
      <DetailHero
        name={fullName}
        onBack={onBack}
        backLabel="Back to employees"
        badges={<>
          <Pill tone={employee.active ? "success" : "neutral"}>{statusLabel}</Pill>
          <Pill tone="info">{getEmployeeRoleLabel(employee.role)}</Pill>
          {payload.officeManager && <Pill>Office manager</Pill>}
        </>}
        meta={[
          { icon: Hash, label: employee.employeeCode || `EMP-${employee.id}`, mono: true },
          ...(employee.department ? [{ icon: Building2, label: employee.department, title: "Department" }] : []),
          ...(employee.city ? [{ icon: MapPin, label: [employee.city, employee.state].filter(Boolean).join(", ") }] : []),
          ...(joined ? [{ icon: CalendarDays, label: `Joined ${joined}` }] : []),
        ]}
        actions={<>
          <Button variant="outline" size="sm" className="h-8" asChild><Link href={`/dashboard/employee/${employee.id}`}>Full activity<ArrowRight className="ml-1.5 h-3.5 w-3.5" /></Link></Button>
          <Button size="sm" className="h-8" asChild><Link href={`/dashboard/employees/${employee.id}/edit`}><Pencil className="mr-1.5 h-3.5 w-3.5" />Edit</Link></Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild><Button variant="outline" size="icon" className="h-8 w-8" aria-label="More actions"><MoreHorizontal className="h-4 w-4" /></Button></DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-52">
              <DropdownMenuItem asChild><Link href={`/dashboard/approvals?employee=${employee.id}`}><ShieldCheck />Attendance correction</Link></DropdownMenuItem>
              {employee.email && <DropdownMenuItem asChild><a href={`mailto:${employee.email}`}><Mail />Send email</a></DropdownMenuItem>}
              {employee.mobile && <DropdownMenuItem asChild><a href={`tel:+${employee.mobile}`}><Phone />Call</a></DropdownMenuItem>}
            </DropdownMenuContent>
          </DropdownMenu>
        </>}
        kpis={<>
          <KpiCell icon={MapPinned} label="Visits" value={visitsLoading ? "…" : visitsTotal} hint="last 30 days" />
          <KpiCell icon={CalendarCheck} label="Attendance" value={attLoading ? "…" : `${attSummary.full} days`} hint={attLoading ? undefined : `${month} · ${attSummary.half} half, ${attSummary.absent} absent`} />
          <KpiCell icon={Receipt} label="Expenses" value={expLoading ? "…" : formatMoney(expenseAmount)} hint={expLoading ? undefined : `${month} · ${monthExpenses.length} claims${pendingExpenses ? `, ${pendingExpenses} pending` : ""}`} />
          <KpiCell icon={Wallet} label="Monthly salary" value={formatMoney(payload.fullMonthSalary)} hint="gross" />
        </>}
        nextStep={!employee.active ? { done: false, text: "This employee is inactive and can't sign in. Reactivate them from Edit." } : null}
      />

      {/* Main column carries activity; the right rail carries this month's attendance and the profile.
          Columns keep their natural heights (items-start) so no panel is stretched into empty space. */}
      <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="min-w-0 space-y-4">
          <Section
            icon={MapPinned}
            title="Recent visits"
            bodyClassName="p-0"
            action={<Button variant="ghost" size="sm" className="h-7 px-2 text-xs" asChild><Link href={`/dashboard/employee/${employee.id}`}>View all<ChevronRight className="ml-0.5 h-3.5 w-3.5" /></Link></Button>}
          >
            {visitsLoading ? <div className="space-y-2 p-4">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-9 w-full" />)}</div> : recentVisits.length === 0 ? <EmptyState compact title="No visits in the last 30 days." /> : (
              <>
                <div className="hidden grid-cols-[72px_minmax(0,1fr)_104px_16px] gap-x-3 border-b bg-muted/40 px-4 py-1.5 text-[11px] font-medium text-muted-foreground sm:grid">
                  <span>Date</span><span>Client · purpose</span><span>Status</span><span />
                </div>
                <ul className="divide-y">
                  {recentVisits.map((v) => {
                    const client = resolveVisitClient(v);
                    const st = visitStatusOf(v);
                    return (
                      <li key={v.id}>
                        <Link href={`/dashboard/visits/${v.id}`} className="group grid grid-cols-[72px_minmax(0,1fr)_auto] items-center gap-x-3 px-4 py-2 transition-colors hover:bg-muted/40 sm:grid-cols-[72px_minmax(0,1fr)_104px_16px]">
                          <div className="leading-tight">
                            <p className="text-sm font-medium tabular-nums">{v.scheduledVisitDate ? formatDay(v.scheduledVisitDate).replace(/ \d{4}$/, "") : "—"}</p>
                            <p className="text-[11px] text-muted-foreground">{hasTime(v.checkinTime) ? formatTimeTo12Hour(String(v.checkinTime)) : "—"}</p>
                          </div>
                          <div className="min-w-0 leading-tight">
                            <p className="truncate text-sm font-medium" title={client.name}>{client.name}</p>
                            <p className="truncate text-[11px] text-muted-foreground">{v.purpose || "No purpose"}{v.locationCity ? ` · ${v.locationCity}` : ""}</p>
                          </div>
                          <span><Pill tone={st.tone}>{st.label}</Pill></span>
                          <ChevronRight className="hidden h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-0.5 sm:block" />
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              </>
            )}
          </Section>

          <Section icon={Receipt} title={`Expenses · ${month}`} bodyClassName="p-0" action={monthExpenses.length ? <span className="text-xs font-semibold tabular-nums">{formatMoney(expenseAmount)}</span> : undefined}>
              {expLoading ? <div className="space-y-2 p-4">{[0, 1].map((i) => <Skeleton key={i} className="h-8 w-full" />)}</div> : monthExpenses.length === 0 ? <EmptyState compact title="No expenses claimed this month." /> : (
                <ul className="divide-y">
                  {monthExpenses.slice(0, 5).map((e) => (
                    <li key={e.id} className="grid grid-cols-[minmax(0,1fr)_96px_88px] items-center gap-x-3 px-4 py-2">
                      <div className="min-w-0 leading-tight">
                        <p className="truncate text-sm font-medium">{e.type}</p>
                        <p className="text-[11px] text-muted-foreground">{e.expenseDate ? formatDateToUserFriendly(e.expenseDate) : "—"}</p>
                      </div>
                      <span className="text-right text-sm font-semibold tabular-nums">{formatMoney(e.amount ?? 0)}</span>
                      <span className="flex justify-end"><Pill tone={expenseTone(String(e.approvalStatus))} className="capitalize">{String(e.approvalStatus).toLowerCase()}</Pill></span>
                    </li>
                  ))}
                  {monthExpenses.length > 5 && <li className="px-4 py-1.5 text-center text-[11px] text-muted-foreground">+{monthExpenses.length - 5} more in Full activity</li>}
                </ul>
              )}
            </Section>
          {teamsPanel ?? <EmployeeManagedTeams employeeId={employee.id} role={employee.role} />}
        </div>

        <div className="min-w-0 space-y-4">
          <Section icon={CalendarCheck} title={`Attendance · ${month}`} bodyClassName="p-4">
              {attLoading ? <Skeleton className="h-14 w-full" /> : attendanceDays === 0 ? <p className="text-xs text-muted-foreground">No attendance logged this month.</p> : (
                <>
                  <div className="flex h-2 overflow-hidden rounded-full bg-muted">
                    <span className="bg-emerald-500" style={{ width: `${(attSummary.full / attendanceDays) * 100}%` }} />
                    <span className="bg-amber-400" style={{ width: `${(attSummary.half / attendanceDays) * 100}%` }} />
                    <span className="bg-red-400" style={{ width: `${(attSummary.absent / attendanceDays) * 100}%` }} />
                  </div>
                  <dl className="mt-3 grid grid-cols-3 divide-x text-center">
                    {[{ label: "Full days", value: attSummary.full, dot: "bg-emerald-500" }, { label: "Half days", value: attSummary.half, dot: "bg-amber-400" }, { label: "Absent", value: attSummary.absent, dot: "bg-red-400" }].map((s) => (
                      <div key={s.label} className="flex flex-col items-center">
                        <dd className="text-lg font-semibold tabular-nums leading-7">{s.value}</dd>
                        <dt className="flex items-center gap-1 text-[11px] text-muted-foreground"><span className={cn("h-1.5 w-1.5 rounded-full", s.dot)} />{s.label}</dt>
                      </div>
                    ))}
                  </dl>
                </>
              )}
            </Section>
        {/* Profile rail: one panel, grouped properties, consistent label/value columns. */}
          <section className="min-w-0 overflow-hidden rounded-xl border bg-card" aria-label="Profile">
          <div className="divide-y">
            <PropertyGroup icon={User} title="Contact">
              <PropertyRow label="Email">{employee.email ? <a href={`mailto:${employee.email}`} className="block truncate hover:underline" title={employee.email}>{employee.email}</a> : null}</PropertyRow>
              <PropertyRow label="Phone">{employee.mobile ? <a href={`tel:+${employee.mobile}`} className="tabular-nums hover:underline">{formatPhone(employee.mobile)}</a> : null}</PropertyRow>
              {employee.secondaryMobile && <PropertyRow label="Alt. phone"><a href={`tel:+${employee.secondaryMobile}`} className="tabular-nums hover:underline">{formatPhone(employee.secondaryMobile)}</a></PropertyRow>}
              <PropertyRow label="Address">{address ? <span className="font-normal">{address}</span> : null}</PropertyRow>
            </PropertyGroup>
            <PropertyGroup icon={Briefcase} title="Work">
              <PropertyRow label="Team">{teamName ?? (employee.teamId != null ? `Team #${employee.teamId}` : null)}</PropertyRow>
              <PropertyRow label="Reports to">{supervisor}</PropertyRow>
              <PropertyRow label="Regions">{regionNames.length ? <span className="flex flex-wrap gap-1">{regionNames.map((r) => <Pill key={r}>{r}</Pill>)}</span> : null}</PropertyRow>
              <PropertyRow label="Cities">{employee.assignedCity.length ? <span className="flex flex-wrap gap-1">{employee.assignedCity.map((c) => <Pill key={c}>{c}</Pill>)}</span> : null}</PropertyRow>
            </PropertyGroup>
            <PropertyGroup icon={Wallet} title="Compensation">
              <PropertyRow label="Salary"><span className="tabular-nums">{formatMoney(payload.fullMonthSalary)}</span></PropertyRow>
              <PropertyRow label="Travel allow."><span className="tabular-nums">{formatMoney(payload.travelAllowance)}</span></PropertyRow>
              <PropertyRow label="Dearness allow."><span className="tabular-nums">{formatMoney(payload.dearnessAllowance)}</span></PropertyRow>
            </PropertyGroup>
            <PropertyGroup icon={ShieldCheck} title="Access">
              <PropertyRow label="Username">{employee.userName ? <span className="font-mono text-xs" data-preserve-case="true">{employee.userName}</span> : null}</PropertyRow>
              <PropertyRow label="Office manager">{payload.officeManager ? "Yes" : "No"}</PropertyRow>
            </PropertyGroup>
          </div>
          </section>
        </div>
      </div>
    </div>
  );
}
