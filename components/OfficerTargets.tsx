"use client";

import { useEffect, useMemo, useState } from "react";
import { ChevronRight, RefreshCw } from "lucide-react";
import { useAuth } from "@/components/auth-provider";
import { hasManagerPrivileges } from "@/lib/auth";
import { targetsApi, type EmployeeUserDto } from "@/lib/targets-api";
import { teamsApi, type CrmTeam } from "@/lib/teams-api";
import {
  getTargetRecipientType,
  targetRecipientTypeLabel,
  type TargetRecipientType,
} from "@/lib/officer-targets";
import { useOfficerQuarterKpis, type OfficerQuarterKpi } from "@/lib/use-officer-quarter-kpis";
import EmployeeKpiSheet from "@/components/EmployeeKpiSheet";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { SearchableSelect } from "@/components/ui/searchable-select2";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

// Financial year runs April to March: Q1 Apr-Jun, Q2 Jul-Sep, Q3 Oct-Dec, Q4 Jan-Mar.
const QUARTERS = [
  { value: 1, label: "Q1", months: "Apr–Jun", firstMonth: 4 },
  { value: 2, label: "Q2", months: "Jul–Sep", firstMonth: 7 },
  { value: 3, label: "Q3", months: "Oct–Dec", firstMonth: 10 },
  { value: 4, label: "Q4", months: "Jan–Mar", firstMonth: 1 },
] as const;

const fyStartOf = (date: Date) => (date.getMonth() + 1 >= 4 ? date.getFullYear() : date.getFullYear() - 1);
const quarterOfDate = (date: Date) => {
  const month = date.getMonth() + 1;
  return month >= 4 ? Math.floor((month - 4) / 3) + 1 : 4;
};
const fyLabel = (fyStart: number) => `FY ${fyStart}–${String((fyStart + 1) % 100).padStart(2, "0")}`;

const kpiNumber = new Intl.NumberFormat("en-IN", { maximumFractionDigits: 1 });

const hasKpiTarget = (kpi?: OfficerQuarterKpi) => Boolean(kpi && (kpi.salesTarget > 0 || kpi.approvalsTarget > 0));
const employeeName = (employee: EmployeeUserDto) => [employee.firstName, employee.lastName].filter(Boolean).join(" ").trim() || "Unnamed employee";

function QuarterKpiCell({ kpi }: { kpi?: OfficerQuarterKpi }) {
  if (!kpi || !hasKpiTarget(kpi)) return <span className="text-muted-foreground">—</span>;
  const line = (label: string, achieved: number, target: number, unit: string) => target > 0 ? (
    <div className="flex items-baseline justify-between gap-3 whitespace-nowrap">
      <span className="text-muted-foreground">{label}</span>
      <span className="tabular-nums"><span className="font-medium">{kpiNumber.format(achieved)}</span> / {kpiNumber.format(target)}{unit} <span className="text-muted-foreground">· {Math.round(achieved / target * 100)}%</span></span>
    </div>
  ) : null;
  return <div className="max-w-[300px] space-y-1 text-xs">{line("Sales", kpi.salesAchieved, kpi.salesTarget, " MT")}{line("Approvals", kpi.approvalsAchieved, kpi.approvalsTarget, "")}</div>;
}

function NumberCell({ value, unit = "" }: { value: number; unit?: string }) {
  return <TableCell className="text-right tabular-nums">{value > 0 ? kpiNumber.format(value) + unit : <span className="text-muted-foreground">—</span>}</TableCell>;
}

function AchievedCell({ achieved, target, unit = "" }: { achieved: number; target: number; unit?: string }) {
  return <TableCell className="text-right font-medium tabular-nums">{target > 0 ? kpiNumber.format(achieved) + unit : <span className="font-normal text-muted-foreground">—</span>}</TableCell>;
}

function ProgressCell({ achieved, target }: { achieved: number; target: number }) {
  if (target <= 0) return <TableCell className="pl-4 text-muted-foreground">—</TableCell>;
  const percent = achieved / target * 100;
  return (
    <TableCell className="pl-4">
      <div className="flex items-center gap-2">
        <div role="progressbar" aria-valuenow={Math.round(Math.min(100, percent))} aria-valuemin={0} aria-valuemax={100} className="h-1.5 min-w-8 flex-1 overflow-hidden rounded-full bg-muted">
          <div className="h-full rounded-full bg-primary" style={{ width: `${Math.min(100, Math.max(0, percent))}%` }} />
        </div>
        <span className="w-9 text-right text-[11px] font-medium tabular-nums">{Math.round(percent)}%</span>
      </div>
    </TableCell>
  );
}

/**
 * Team view of quarterly KPI targets for managers and field officers. Managers see themselves plus their
 * direct reports; administrators see all eligible recipients. Clicking an employee opens their KPI panel.
 */
export default function OfficerTargets() {
  const { token, userRole, userData, currentUser, correctedRoleFlags } = useAuth();
  const now = useMemo(() => new Date(), []);
  const currentFy = fyStartOf(now);
  const [quarter, setQuarter] = useState(quarterOfDate(now));
  const [fyStart, setFyStart] = useState(currentFy);
  const [officerFilter, setOfficerFilter] = useState("");
  const [roleFilter, setRoleFilter] = useState<"all" | TargetRecipientType>("all");
  const [teamFilter, setTeamFilter] = useState("all");
  const [teams, setTeams] = useState<CrmTeam[]>([]);
  const [employees, setEmployees] = useState<EmployeeUserDto[]>([]);
  const [isLoadingDirectory, setIsLoadingDirectory] = useState(true);
  const [directoryError, setDirectoryError] = useState<string | null>(null);
  const [selectedOfficerId, setSelectedOfficerId] = useState<number | null>(null);
  const [panelOpen, setPanelOpen] = useState(false);

  const viewerEmployeeId = Number(userData?.employeeId) || null;
  const viewerIsManager = correctedRoleFlags?.isManager === true || hasManagerPrivileges(userRole, currentUser);
  const scopedKpiEmployeeIds = useMemo(
    () => viewerIsManager ? employees.map((employee) => Number(employee.id)) : undefined,
    [employees, viewerIsManager],
  );

  const quarterDefinition = QUARTERS.find((option) => option.value === quarter) ?? QUARTERS[0];
  // The hook takes any month inside the quarter; use its first month.
  const anchorMonth = quarterDefinition.firstMonth;
  const anchorYear = anchorMonth >= 4 ? fyStart : fyStart + 1;
  const { kpis, loading: isLoadingKpis, quarter: kpiQuarter, refresh } = useOfficerQuarterKpis(
    token,
    anchorMonth,
    anchorYear,
    scopedKpiEmployeeIds,
  );

  const loadDirectory = async () => {
    setIsLoadingDirectory(true);
    setDirectoryError(null);
    if (!token) {
      setEmployees([]);
      setDirectoryError("Authentication token not found. Please log in.");
      setIsLoadingDirectory(false);
      return;
    }
    try {
      if (viewerIsManager && viewerEmployeeId != null) {
        const [selfResult, reportsResult] = await Promise.allSettled([
          targetsApi.getEmployee(token, viewerEmployeeId),
          targetsApi.getEmployees(token, { managerId: viewerEmployeeId }),
        ]);
        if (selfResult.status === "rejected" && reportsResult.status === "rejected") throw reportsResult.reason;
        const scopedEmployees = [
          ...(selfResult.status === "fulfilled" ? [selfResult.value] : []),
          ...(reportsResult.status === "fulfilled" ? reportsResult.value : []),
        ];
        setEmployees(Array.from(new Map(scopedEmployees.map((employee) => [Number(employee.id), employee])).values()));
      } else {
        const result = await targetsApi.getEmployees(token);
        setEmployees(Array.isArray(result) ? result : []);
      }
    } catch {
      setDirectoryError("Could not load target recipients.");
    } finally {
      setIsLoadingDirectory(false);
    }
  };

  useEffect(() => { void loadDirectory(); }, [token, viewerEmployeeId, viewerIsManager]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!token || viewerIsManager) return;
    let cancelled = false;
    teamsApi.getTeams(token)
      .then((list) => { if (!cancelled) setTeams(list.filter((team) => team.active)); })
      .catch(() => { if (!cancelled) setTeams([]); });
    return () => { cancelled = true; };
  }, [token, viewerIsManager]);

  const selectedTeam = useMemo(() => viewerIsManager ? null : teams.find((team) => String(team.id) === teamFilter) ?? null, [teams, teamFilter, viewerIsManager]);
  const teamMemberIds = useMemo(() => new Set([
    ...(selectedTeam?.employees ?? []).map((employee) => Number(employee.id)),
    ...(selectedTeam?.officeManagerId != null ? [Number(selectedTeam.officeManagerId)] : []),
  ]), [selectedTeam]);

  const officers = useMemo(() => employees
    .flatMap((employee) => {
      const recipientType = getTargetRecipientType(employee);
      if (!recipientType || (roleFilter !== "all" && recipientType !== roleFilter)) return [];
      return [{
        id: Number(employee.id),
        name: employeeName(employee),
        code: String(employee.employeeId || ""),
        recipientType,
        roleLabel: targetRecipientTypeLabel(recipientType),
      }];
    })
    .filter((employee) => !selectedTeam || teamMemberIds.has(employee.id))
    .sort((a, b) => a.name.localeCompare(b.name, "en", { sensitivity: "base" })), [employees, roleFilter, selectedTeam, teamMemberIds]);

  const officerOptions = useMemo(() => officers.map((officer) => ({ value: String(officer.id), label: officer.name })), [officers]);
  const visibleOfficers = useMemo(() => officers.filter((officer) => !officerFilter || String(officer.id) === officerFilter), [officers, officerFilter]);
  const selectedOfficer = officers.find((officer) => officer.id === selectedOfficerId) ?? null;

  const summary = useMemo(() => visibleOfficers.reduce((total, officer) => {
    const kpi = kpis.get(officer.id);
    if (!kpi) return total;
    return {
      salesTarget: total.salesTarget + kpi.salesTarget,
      salesAchieved: total.salesAchieved + kpi.salesAchieved,
      approvalsTarget: total.approvalsTarget + kpi.approvalsTarget,
      approvalsAchieved: total.approvalsAchieved + kpi.approvalsAchieved,
    };
  }, { salesTarget: 0, salesAchieved: 0, approvalsTarget: 0, approvalsAchieved: 0 }), [visibleOfficers, kpis]);

  const assignedCount = visibleOfficers.filter((officer) => hasKpiTarget(kpis.get(officer.id))).length;
  const isLoading = isLoadingDirectory || isLoadingKpis;
  const periodText = `${kpiQuarter.label} ${kpiQuarter.fyLabel}`;
  const scopeLabel = selectedTeam
    ? selectedTeam.teamName
    : roleFilter === "manager"
      ? "Managers"
      : roleFilter === "field_officer"
        ? "Field officers"
        : viewerIsManager
          ? "My targets and direct reports"
          : "All managers and field officers";

  const openOfficer = (id: number) => {
    setSelectedOfficerId(id);
    setPanelOpen(true);
  };

  return (
    <div className="min-w-0 space-y-4 text-sm">
      <div className="flex flex-wrap items-end gap-3">
        <div className="space-y-1.5">
          <Label className="text-xs">Quarter</Label>
          <Select value={String(quarter)} onValueChange={(value) => setQuarter(Number(value))}>
            <SelectTrigger className="h-9 w-[150px] text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>{QUARTERS.map((option) => <SelectItem key={option.value} value={String(option.value)}>{option.label} · {option.months}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">Financial year</Label>
          <Select value={String(fyStart)} onValueChange={(value) => setFyStart(Number(value))}>
            <SelectTrigger className="h-9 w-[140px] text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>{[currentFy, currentFy + 1].map((year) => <SelectItem key={year} value={String(year)}>{fyLabel(year)}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">Role</Label>
          <Select value={roleFilter} onValueChange={(value) => { setRoleFilter(value as "all" | TargetRecipientType); setOfficerFilter(""); }}>
            <SelectTrigger className="h-9 w-[155px] text-xs" aria-label="Recipient role"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All roles</SelectItem>
              <SelectItem value="manager">Managers</SelectItem>
              <SelectItem value="field_officer">Field officers</SelectItem>
            </SelectContent>
          </Select>
        </div>
        {!viewerIsManager && (
          <div className="space-y-1.5">
            <Label className="text-xs">Team</Label>
            <Select value={teamFilter} onValueChange={(value) => { setTeamFilter(value); setOfficerFilter(""); }}>
              <SelectTrigger className="h-9 w-[200px] text-xs" aria-label="Team"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All teams</SelectItem>
                {teams.map((team) => <SelectItem key={team.id} value={String(team.id)}>{team.teamName}{team.officeManagerName ? ` · ${team.officeManagerName}` : ""}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        )}
        <div className="min-w-[220px] flex-1 space-y-1.5 sm:max-w-sm">
          <Label htmlFor="targets-officer" className="text-xs">Employee</Label>
          <SearchableSelect
            triggerId="targets-officer"
            options={officerOptions}
            value={officerFilter || undefined}
            onSelect={(option) => setOfficerFilter(option?.value || "")}
            placeholder="All employees"
            searchPlaceholder="Search employees…"
            emptyMessage="No employees found"
            allowClear
            triggerClassName="h-9 w-full text-xs"
          />
        </div>
        <Button variant="outline" size="icon" className="ml-auto h-9 w-9" aria-label="Refresh targets" disabled={isLoading} onClick={() => { void loadDirectory(); refresh(); }}>
          <RefreshCw className={"h-3.5 w-3.5" + (isLoading ? " animate-spin" : "")} />
        </Button>
      </div>

      {directoryError && (
        <div role="alert" className="flex items-center justify-between gap-3 rounded-lg border border-destructive/40 p-3 text-xs text-destructive">
          <span>{directoryError}</span>
          <Button size="sm" variant="outline" onClick={() => void loadDirectory()}>Retry</Button>
        </div>
      )}

      {!isLoading && !directoryError && visibleOfficers.length > 0 && (
        <div className="space-y-2 border-y py-3">
          <p className="text-xs font-medium text-muted-foreground">{scopeLabel} · quarter KPIs · {periodText}</p>
          <dl className="grid gap-3 sm:grid-cols-2">
            {[
              { title: "Sales", unit: " MT", target: summary.salesTarget, achieved: summary.salesAchieved },
              { title: "New approvals", unit: "", target: summary.approvalsTarget, achieved: summary.approvalsAchieved },
            ].map((item) => (
              <div key={item.title} className="min-w-0 rounded-md border p-3">
                <dt className="text-xs font-medium">{item.title}</dt>
                <dd className="mt-2 grid grid-cols-3 gap-2">
                  {[["Target", item.target], ["Achieved", item.achieved], ["Remaining", Math.max(0, item.target - item.achieved)]].map(([label, value]) => (
                    <div key={String(label)}>
                      <p className="text-[11px] text-muted-foreground">{label}</p>
                      <p className="text-base font-semibold tabular-nums">{kpiNumber.format(Number(value))}{item.unit}</p>
                    </div>
                  ))}
                </dd>
              </div>
            ))}
          </dl>
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-1 text-xs text-muted-foreground" aria-live="polite">
        <span>{isLoading ? "Loading employees…" : `${visibleOfficers.length} employees · ${assignedCount} assigned · ${visibleOfficers.length - assignedCount} not assigned`}</span>
        <span>{periodText}</span>
      </div>

      <Card className="gap-0 overflow-hidden py-0 shadow-none">
        <CardContent className="p-0">
          {isLoading ? (
            <div className="space-y-3 p-4">{[0, 1, 2, 3].map((index) => <Skeleton key={index} className="h-8 w-full" />)}</div>
          ) : visibleOfficers.length === 0 ? (
            <div className="space-y-2 p-10 text-center">
              <p className="font-medium">No target recipients found</p>
              <p className="text-xs text-muted-foreground">{officerFilter || selectedTeam || roleFilter !== "all" ? "Clear the filters to see eligible employees." : "Add a manager or field officer to start assigning targets."}</p>
            </div>
          ) : (
            <>
              <div className="hidden md:block">
                <Table className="w-full table-fixed text-xs">
                  <TableHeader>
                    <TableRow className="bg-muted/30 hover:bg-muted/30">
                      <TableHead rowSpan={2} className="w-[22%] px-4 align-bottom">Employee</TableHead>
                      <TableHead rowSpan={2} className="w-[12%] pl-4 align-bottom">Status</TableHead>
                      <TableHead colSpan={3} className="border-l text-center">Sales (MT)</TableHead>
                      <TableHead colSpan={3} className="border-l text-center">New approvals</TableHead>
                      <TableHead rowSpan={2} className="w-[4%]"><span className="sr-only">Open officer</span></TableHead>
                    </TableRow>
                    <TableRow className="bg-muted/30 hover:bg-muted/30">
                      <TableHead className="w-[9%] border-l text-right">Target</TableHead>
                      <TableHead className="w-[9%] text-right">Achieved</TableHead>
                      <TableHead className="w-[12%] pl-4">Progress</TableHead>
                      <TableHead className="w-[9%] border-l text-right">Target</TableHead>
                      <TableHead className="w-[9%] text-right">Achieved</TableHead>
                      <TableHead className="w-[12%] pl-4">Progress</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {visibleOfficers.map((officer) => {
                      const kpi = kpis.get(officer.id);
                      return (
                        <TableRow key={officer.id} className="cursor-pointer" onClick={() => openOfficer(officer.id)}>
                          <TableCell className="px-4 py-3">
                            <button type="button" onClick={() => openOfficer(officer.id)} className="block w-full truncate text-left text-[13px] font-medium underline-offset-4 hover:underline focus-visible:rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" title={officer.name}>{officer.name}</button>
                            <p className="mt-0.5 text-[11px] text-muted-foreground">{officer.roleLabel}</p>
                          </TableCell>
                          <TableCell className="pl-4">
                            {hasKpiTarget(kpi)
                              ? <Badge className="whitespace-nowrap text-[11px] font-normal">Assigned</Badge>
                              : <Badge variant="secondary" className="whitespace-nowrap text-[11px] font-normal text-muted-foreground">Not assigned</Badge>}
                          </TableCell>
                          <NumberCell value={kpi?.salesTarget ?? 0} />
                          <AchievedCell achieved={kpi?.salesAchieved ?? 0} target={kpi?.salesTarget ?? 0} />
                          <ProgressCell achieved={kpi?.salesAchieved ?? 0} target={kpi?.salesTarget ?? 0} />
                          <NumberCell value={kpi?.approvalsTarget ?? 0} />
                          <AchievedCell achieved={kpi?.approvalsAchieved ?? 0} target={kpi?.approvalsTarget ?? 0} />
                          <ProgressCell achieved={kpi?.approvalsAchieved ?? 0} target={kpi?.approvalsTarget ?? 0} />
                          <TableCell className="text-right"><ChevronRight className="ml-auto h-4 w-4 text-muted-foreground" aria-hidden /></TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>

              <div className="divide-y md:hidden">
                {visibleOfficers.map((officer) => {
                  const kpi = kpis.get(officer.id);
                  return (
                    <article key={officer.id} className="space-y-3 p-4">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <button type="button" onClick={() => openOfficer(officer.id)} className="text-left text-sm font-medium hover:underline">{officer.name}</button>
                          <p className="mt-1 text-xs text-muted-foreground">{officer.roleLabel} · {hasKpiTarget(kpi) ? "Assigned" : "Not assigned"}</p>
                        </div>
                        <Button size="icon" variant="ghost" className="h-7 w-7 shrink-0" aria-label={`Open targets for ${officer.name}`} onClick={() => openOfficer(officer.id)}><ChevronRight className="h-4 w-4" /></Button>
                      </div>
                      {hasKpiTarget(kpi) && <div className="rounded-md bg-muted/30 p-2"><QuarterKpiCell kpi={kpi} /></div>}
                    </article>
                  );
                })}
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {selectedOfficer && (
        <EmployeeKpiSheet
          key={selectedOfficer.id}
          open={panelOpen}
          onOpenChange={setPanelOpen}
          employeeId={selectedOfficer.id}
          employeeName={selectedOfficer.name}
          employeeRoleLabel={selectedOfficer.roleLabel}
          readOnly={viewerIsManager && selectedOfficer.id === viewerEmployeeId}
          onChanged={refresh}
        />
      )}
    </div>
  );
}
