"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { EmployeeManagedTeams } from "@/components/employee-managed-teams";
import { teamsApi, type TeamEmployee } from "@/lib/teams-api";
import { useAuth } from "@/components/auth-provider";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { getEmployeeRoleLabel } from "@/lib/employee-role";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { visitsApi, resolveVisitClient, type CommonVisitRow } from "@/lib/visits-api";
import { attendanceApi } from "@/lib/attendance-api";
import { expensesApi, type ExpenseRow } from "@/lib/expenses-api";
import { formatDateToUserFriendly, formatTimeTo12Hour } from "@/lib/utils";
import {
  ArrowRight,
  Building2,
  CalendarDays,
  ChevronLeft,
  Mail,
  MapPin,
  Pencil,
  Phone,
  ShieldCheck,
  User,
  Users,
  Wallet,
} from "lucide-react";

type RegionItem = { id: number; name: string };

const getInitials = (name: string) => {
  const parts = name.trim().split(/\s+/).slice(0, 2);
  return parts.map((p) => p[0]?.toUpperCase() ?? "").join("") || "—";
};

const formatMoney = (value: unknown): string => {
  if (typeof value !== "number" || !Number.isFinite(value)) return "—";
  return `₹${value.toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;
};

export default function EmployeeDetail() {
  const params = useParams();
  const { token } = useAuth();
  const [employee, setEmployee] = useState<TeamEmployee | null>(null);
  const [managerName, setManagerName] = useState<string | null>(null);
  const [teamName, setTeamName] = useState<string | null>(null);
  const [regionNames, setRegionNames] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Compact activity (Visits + Attendance + Expenses) — same documented endpoints as full workspace
  const [activityTab, setActivityTab] = useState("visits");
  const [recentVisits, setRecentVisits] = useState<CommonVisitRow[]>([]);
  const [visitsLoading, setVisitsLoading] = useState(false);
  const [attSummary, setAttSummary] = useState({ full: 0, half: 0, absent: 0 });
  const [attLoading, setAttLoading] = useState(false);
  const [recentExpenses, setRecentExpenses] = useState<ExpenseRow[]>([]);
  const [expLoading, setExpLoading] = useState(false);

  useEffect(() => {
    const fetchEmployeeData = async () => {
      if (!token || !params.id) return;

      try {
        setIsLoading(true);
        const employeeId = Number(params.id);
        if (!Number.isFinite(employeeId)) throw new Error("Invalid employee identifier");

        // Documented: GET /api/common/employees/{employeeId}
        const data = await teamsApi.getEmployeeById(token, employeeId);
        setEmployee(data);

        // Resolve manager / team / region names from already-documented endpoints (frontend-only join)
        const regionIds: number[] = Array.isArray(data.updatePayload.regionIds)
          ? (data.updatePayload.regionIds as number[])
          : [];

        try {
          if (data.managerId != null) {
            const m = await teamsApi.getEmployeeById(token, data.managerId);
            setManagerName(`${m.firstName} ${m.lastName}`.trim() || `Employee #${m.id}`);
          } else {
            setManagerName(null);
          }
        } catch {
          setManagerName(null);
        }

        try {
          if (data.teamId != null) {
            const teamsPage = await teamsApi.getTeamsPage(token, { page: 0, size: 100 });
            const found = teamsPage.content.find((t) => t.id === data.teamId);
            setTeamName(found ? found.teamName : `Team #${data.teamId}`);
          } else {
            setTeamName(null);
          }
        } catch {
          setTeamName(data.teamId != null ? `Team #${data.teamId}` : null);
        }

        try {
          if (regionIds.length > 0) {
            const res = await fetch(
              `${process.env.NEXT_PUBLIC_API_BASE_URL || "http://ec2-18-211-58-135.compute-1.amazonaws.com:8081"}/api/common/regions?page=0&size=100`,
              { headers: { Authorization: `Bearer ${token}`, Accept: "application/json" } },
            );
            if (!res.ok) throw new Error(`Regions failed (${res.status})`);
            const body: unknown = await res.json();
            const items: RegionItem[] = Array.isArray(body)
              ? (body as RegionItem[])
              : (((body as { content?: unknown }).content ?? []) as RegionItem[]);
            const byId = new Map(items.map((r) => [r.id, r.name]));
            setRegionNames(regionIds.map((id: number) => byId.get(id) ?? `Region #${id}`));
          } else {
            setRegionNames([]);
          }
        } catch {
          setRegionNames([]);
        }
      } catch (err) {
        console.error("Error fetching employee data:", err);
        setError((err as Error)?.message || "Failed to load employee data");
      } finally {
        setIsLoading(false);
      }
    };

    fetchEmployeeData();
  }, [token, params.id]);

  // Activity fetch — last 30 days visits + current-month attendance/expenses
  useEffect(() => {
    if (!token || !employee) return;
    let cancelled = false;
    const now = new Date();
    const to = now.toISOString().slice(0, 10);
    const from30 = new Date(now);
    from30.setDate(from30.getDate() - 30);
    const from30Str = from30.toISOString().slice(0, 10);
    const monthStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
    const monthEnd = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate()).padStart(2, "0")}`;

    setVisitsLoading(true);
    setAttLoading(true);
    setExpLoading(true);
    visitsApi
      .getCommonVisits(token, { page: 0, size: 5, from: from30Str, to, assignedEmployeeId: employee.id })
      .then((page) => {
        if (!cancelled) setRecentVisits(page.content);
      })
      .catch(() => {
        if (!cancelled) setRecentVisits([]);
      })
      .finally(() => {
        if (!cancelled) setVisitsLoading(false);
      });
    attendanceApi
      .getByEmployee(token, employee.id, monthStart, monthEnd, 0, 100)
      .then((page) => {
        if (cancelled) return;
        let full = 0;
        let half = 0;
        let absent = 0;
        for (const r of page.content) {
          const s = String(r.attendanceStatus ?? "").toLowerCase();
          if (s.includes("half")) half += 1;
          else if (s.includes("full")) full += 1;
          else absent += 1;
        }
        setAttSummary({ full, half, absent });
      })
      .catch(() => {
        if (!cancelled) setAttSummary({ full: 0, half: 0, absent: 0 });
      })
      .finally(() => {
        if (!cancelled) setAttLoading(false);
      });
    expensesApi
      .getByEmployee(token, employee.id, monthStart, monthEnd, 0, 5)
      .then((page) => {
        if (!cancelled) setRecentExpenses(page.content);
      })
      .catch(() => {
        if (!cancelled) setRecentExpenses([]);
      })
      .finally(() => {
        if (!cancelled) setExpLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [token, employee]);

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Card className="shadow-none">
          <CardContent className="flex items-center gap-3 p-4">
            <Skeleton className="h-12 w-12 rounded-full" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-5 w-48" />
              <Skeleton className="h-4 w-32" />
            </div>
            <Skeleton className="h-8 w-24" />
          </CardContent>
        </Card>
        <Card className="shadow-none">
          <CardHeader className="border-b px-4 py-3">
            <Skeleton className="h-5 w-40" />
          </CardHeader>
          <CardContent className="space-y-3 p-4">
            {[...Array(4)].map((_, i) => (
              <Skeleton key={i} className="h-4 w-full" />
            ))}
          </CardContent>
        </Card>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="text-center">
          <p className="mb-2 text-red-500">Error loading employee data</p>
          <p className="text-sm text-muted-foreground">{error}</p>
        </div>
      </div>
    );
  }

  if (!employee) {
    return (
      <div className="flex h-64 items-center justify-center">
        <p className="text-muted-foreground">Employee not found</p>
      </div>
    );
  }

  const fullName = `${employee.firstName} ${employee.lastName}`.trim() || `Employee #${employee.id}`;
  const payload = employee.updatePayload;
  const location = [employee.city, employee.state, employee.country].filter(Boolean).join(", ");
  const statusLabel = employee.status || (employee.active ? "Active" : "Inactive");

  const contactRows = [
    { icon: Mail, label: "Email", value: employee.email || "—" },
    { icon: Phone, label: "Phone", value: employee.mobile ? `+${employee.mobile}` : "—" },
    ...(employee.secondaryMobile
      ? [{ icon: Phone, label: "Secondary phone", value: `+${employee.secondaryMobile}` }]
      : []),
    { icon: MapPin, label: "Location", value: location || "—" },
    { icon: CalendarDays, label: "Date of joining", value: employee.dateOfJoining || "—" },
    { icon: Building2, label: "Department", value: employee.department || "—" },
  ];

  const stats = [
    { label: "Travel allow.", value: formatMoney(payload.travelAllowance) },
    { label: "Dearness allow.", value: formatMoney(payload.dearnessAllowance) },
    { label: "Monthly salary", value: formatMoney(payload.fullMonthSalary) },
  ];

  const hasTime = (v?: string | null): boolean => {
    if (v == null) return false;
    const s = String(v).trim().toLowerCase();
    return s !== "" && s !== "null" && s !== "undefined" && s !== "-";
  };
  const visitStatusOf = (v: CommonVisitRow): "Completed" | "Ongoing" | "Assigned" => {
    const ci = hasTime(v.actualCheckinAt) || hasTime(v.checkinTime);
    const co = hasTime(v.actualCheckoutAt) || hasTime(v.checkoutTime);
    if (ci && co) return "Completed";
    if (ci) return "Ongoing";
    return "Assigned";
  };
  const visitPillClass = (s: string) =>
    s === "Completed"
      ? "bg-emerald-50 text-emerald-700 ring-emerald-600/15"
      : s === "Ongoing"
        ? "bg-amber-50 text-amber-700 ring-amber-600/15"
        : "bg-blue-50 text-blue-700 ring-blue-600/15";
  const expensePillClass = (s: string) => {
    const t = s.toLowerCase();
    if (t === "approved") return "bg-emerald-50 text-emerald-700 ring-emerald-600/15";
    if (t === "rejected") return "bg-rose-50 text-rose-700 ring-rose-600/15";
    return "bg-amber-50 text-amber-700 ring-amber-600/15";
  };
  const currentMonthLabel = new Date().toLocaleDateString("en-IN", { month: "long", year: "numeric" });

  return (
    <div className="space-y-4">
      {/* Breadcrumb + primary actions */}
      <div className="flex flex-wrap items-center gap-2">
        <Button variant="ghost" size="sm" asChild className="h-8 px-2 text-xs text-muted-foreground">
          <Link href="/dashboard/employees">
            <ChevronLeft className="mr-0.5 h-3.5 w-3.5" /> Employees
          </Link>
        </Button>
        <div className="ml-auto flex flex-wrap items-center gap-2">
          <Button variant="outline" size="sm" asChild className="h-8 text-xs shadow-none">
            <Link href={`/dashboard/approvals?employee=${employee.id}`}>Approvals</Link>
          </Button>
          <Button variant="outline" size="sm" asChild className="h-8 text-xs shadow-none">
            <Link href={`/dashboard/employee/${employee.id}`}>
              Full activity <ArrowRight className="ml-1 h-3.5 w-3.5" />
            </Link>
          </Button>
          <Button size="sm" asChild className="h-8 text-xs">
            <Link href={`/dashboard/employees/${employee.id}/edit`}>
              <Pencil className="mr-1 h-3.5 w-3.5" /> Edit
            </Link>
          </Button>
        </div>
      </div>

      {/* Identity banner */}
      <Card className="gap-0 overflow-hidden py-0 shadow-none">
        <div className="h-1.5 bg-gradient-to-r from-primary/70 via-primary/30 to-transparent" />
        <CardContent className="flex min-w-0 items-center gap-4 p-4 sm:p-5">
          <Avatar className="h-14 w-14 shrink-0 border-2 border-background shadow-sm">
            <AvatarFallback className="bg-primary/10 text-base font-bold text-primary">
              {getInitials(fullName)}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
              <h1 className="truncate text-xl font-bold tracking-tight">{fullName}</h1>
              <span className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-medium ring-1 ring-inset ${employee.active ? "bg-emerald-50 text-emerald-700 ring-emerald-600/20" : "bg-gray-100 text-gray-600 ring-gray-500/20"}`}>
                <span className={`h-1.5 w-1.5 rounded-full ${employee.active ? "bg-emerald-500" : "bg-gray-400"}`} />
                {statusLabel}
              </span>
              <Badge variant="secondary" className="font-medium">
                {getEmployeeRoleLabel(employee.role)}
              </Badge>
            </div>
            <p className="mt-1 truncate text-xs text-muted-foreground">
              {employee.employeeCode || `EMP-${employee.id}`}
              {employee.department ? ` · ${employee.department}` : ""}
              {location ? ` · ${location}` : ""}
            </p>
          </div>
        </CardContent>
      </Card>

      <div className="grid min-w-0 gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
        {/* Main column */}
        <div className="min-w-0 space-y-4">
          <Card className="gap-0 py-0 shadow-none">
            <CardHeader className="border-b px-4 py-3">
              <CardTitle className="flex items-center gap-2 text-sm font-semibold">
                <User className="h-4 w-4 text-muted-foreground" /> Contact details
              </CardTitle>
            </CardHeader>
            <CardContent className="divide-y p-0">
              {contactRows.map((row) => (
                <div key={row.label} className="flex items-center gap-3 px-4 py-2.5">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                    <row.icon className="h-4 w-4" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-[11px] font-medium capitalize tracking-wide text-muted-foreground">
                      {row.label}
                    </p>
                    <p className="truncate text-sm font-medium" title={row.value}>
                      {row.value}
                    </p>
                  </div>
                </div>
              ))}
              {employee.assignedCity.length > 0 && (
                <div className="flex items-start gap-3 px-4 py-2.5">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                    <MapPin className="h-4 w-4" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-[11px] font-medium capitalize tracking-wide text-muted-foreground">
                      Assigned cities
                    </p>
                    <div className="mt-1 flex flex-wrap gap-1.5">
                      {employee.assignedCity.map((city) => (
                        <span key={city} className="max-w-full truncate rounded-md bg-muted/70 px-2 py-0.5 text-xs">
                          {city}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="gap-0 py-0 shadow-none">
            <CardHeader className="border-b px-4 py-3">
              <CardTitle className="flex items-center gap-2 text-sm font-semibold">
                <Wallet className="h-4 w-4 text-muted-foreground" /> Compensation
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4">
              <div className="grid grid-cols-3 gap-2">
                {stats.map((s) => (
                  <div key={s.label} className="min-w-0 rounded-lg bg-muted/50 px-2 py-2.5 text-center">
                    <p className="truncate text-sm font-bold tabular-nums" title={s.value}>
                      {s.value}
                    </p>
                    <p className="mt-0.5 truncate text-[10px] font-medium capitalize tracking-wide text-muted-foreground">
                      {s.label}
                    </p>
                  </div>
                ))}
              </div>
              <p className="mt-2.5 text-xs text-muted-foreground">
                Display-only — changes go through Edit.
              </p>
            </CardContent>
          </Card>

          <EmployeeManagedTeams employeeId={employee.id} role={employee.role} />
        </div>

        {/* Sidebar — HubSpot-style property rail */}
        <aside className="min-w-0 space-y-4">
          <Card className="gap-0 py-0 shadow-none">
            <CardHeader className="border-b px-4 py-3">
              <CardTitle className="text-sm font-semibold">At a glance</CardTitle>
            </CardHeader>
            <CardContent className="divide-y p-0">
              <div className="flex items-center gap-3 px-4 py-2.5">
                <Users className="h-4 w-4 shrink-0 text-muted-foreground" />
                <div className="min-w-0 flex-1">
                  <p className="text-[11px] font-medium capitalize tracking-wide text-muted-foreground">Team</p>
                  <p className="truncate text-sm font-medium">
                    {teamName ?? (employee.teamId != null ? `Team #${employee.teamId}` : "—")}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3 px-4 py-2.5">
                <User className="h-4 w-4 shrink-0 text-muted-foreground" />
                <div className="min-w-0 flex-1">
                  <p className="text-[11px] font-medium capitalize tracking-wide text-muted-foreground">Manager</p>
                  {employee.managerId != null ? (
                    <Link
                      href={`/dashboard/employees/${employee.managerId}`}
                      className="truncate text-sm font-medium text-primary hover:underline"
                    >
                      {managerName ?? `Employee #${employee.managerId}`}
                    </Link>
                  ) : (
                    <p className="text-sm font-medium">—</p>
                  )}
                </div>
              </div>
              <div className="px-4 py-2.5">
                <p className="text-[11px] font-medium capitalize tracking-wide text-muted-foreground">Regions</p>
                {regionNames.length > 0 ? (
                  <div className="mt-1.5 flex flex-wrap gap-1.5">
                    {regionNames.map((region) => (
                      <Badge key={region} variant="secondary" className="font-normal">
                        {region}
                      </Badge>
                    ))}
                  </div>
                ) : (
                  <p className="mt-0.5 text-sm font-medium">—</p>
                )}
              </div>
            </CardContent>
          </Card>

          <Card className="gap-0 py-0 shadow-none">
            <CardHeader className="border-b px-4 py-3">
              <CardTitle className="flex items-center gap-2 text-sm font-semibold">
                <ShieldCheck className="h-4 w-4 text-muted-foreground" /> Login & access
              </CardTitle>
            </CardHeader>
            <CardContent className="divide-y p-0">
              <div className="px-4 py-2.5">
                <p className="text-[11px] font-medium capitalize tracking-wide text-muted-foreground">Username</p>
                <p className="truncate text-sm font-medium" title={employee.userName}>
                  {employee.userName || "—"}
                </p>
              </div>
              <div className="flex items-center justify-between gap-2 px-4 py-2.5">
                <p className="text-[11px] font-medium capitalize tracking-wide text-muted-foreground">
                  Office manager
                </p>
                <Badge variant={payload.officeManager ? "default" : "outline"}>
                  {payload.officeManager ? "Yes" : "No"}
                </Badge>
              </div>
            </CardContent>
          </Card>
        </aside>
      </div>

      {/* Recent activity — compact port of the full workspace tabs */}
      <Card className="gap-0 py-0 shadow-none">
        <CardHeader className="flex flex-row items-center justify-between gap-2 border-b px-4 py-3">
          <CardTitle className="text-sm font-semibold">Recent activity</CardTitle>
          <Button variant="ghost" size="sm" asChild className="h-7 text-xs">
            <Link href={`/dashboard/employee/${employee.id}`}>
              Full activity <ArrowRight className="ml-1 h-3.5 w-3.5" />
            </Link>
          </Button>
        </CardHeader>
        <CardContent className="p-4">
          <Tabs value={activityTab} onValueChange={setActivityTab}>
            <TabsList className="grid h-8 w-full grid-cols-3 p-1 sm:w-[360px]">
              <TabsTrigger value="visits" className="text-xs">Visits</TabsTrigger>
              <TabsTrigger value="attendance" className="text-xs">Attendance</TabsTrigger>
              <TabsTrigger value="expenses" className="text-xs">Expenses</TabsTrigger>
            </TabsList>

            <TabsContent value="visits" className="mt-3">
              {visitsLoading ? (
                <div className="space-y-2">
                  {[...Array(3)].map((_, i) => (
                    <Skeleton key={i} className="h-12 w-full" />
                  ))}
                </div>
              ) : recentVisits.length === 0 ? (
                <p className="rounded-lg border bg-muted/30 p-5 text-center text-sm text-muted-foreground">
                  No visits in the last 30 days
                </p>
              ) : (
                <ul className="divide-y rounded-lg border">
                  {recentVisits.map((v) => {
                    const client = resolveVisitClient(v);
                    const st = visitStatusOf(v);
                    return (
                      <li key={v.id} className="flex items-center gap-3 px-3 py-2.5">
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium" title={client.name}>
                            {client.name}
                          </p>
                          <p className="truncate text-xs text-muted-foreground">
                            {v.scheduledVisitDate ? formatDateToUserFriendly(v.scheduledVisitDate) : "—"}
                            {v.purpose ? ` · ${v.purpose}` : ""}
                          </p>
                        </div>
                        <span className={`inline-flex shrink-0 truncate rounded-full px-2 py-0.5 text-[11px] font-medium ring-1 ring-inset ${visitPillClass(st)}`}>
                          {st}
                        </span>
                        <Button variant="ghost" size="sm" asChild className="h-7 shrink-0 px-2 text-xs">
                          <Link href={`/dashboard/visits/${v.id}`}>View</Link>
                        </Button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </TabsContent>

            <TabsContent value="attendance" className="mt-3">
              {attLoading ? (
                <div className="grid grid-cols-3 gap-2">
                  {[...Array(3)].map((_, i) => (
                    <Skeleton key={i} className="h-16 w-full" />
                  ))}
                </div>
              ) : (
                <>
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      { label: "Full days", value: attSummary.full, cls: "text-emerald-700" },
                      { label: "Half days", value: attSummary.half, cls: "text-amber-700" },
                      { label: "Absent", value: attSummary.absent, cls: "text-rose-700" },
                    ].map((s) => (
                      <div key={s.label} className="min-w-0 rounded-lg bg-muted/50 px-2 py-2.5 text-center">
                        <p className={`truncate text-lg font-bold tabular-nums ${s.cls}`}>{s.value}</p>
                        <p className="mt-0.5 truncate text-[10px] font-medium capitalize tracking-wide text-muted-foreground">
                          {s.label}
                        </p>
                      </div>
                    ))}
                  </div>
                  <p className="mt-2 text-xs text-muted-foreground">
                    {currentMonthLabel} · from attendance logs
                  </p>
                </>
              )}
            </TabsContent>

            <TabsContent value="expenses" className="mt-3">
              {expLoading ? (
                <div className="space-y-2">
                  {[...Array(3)].map((_, i) => (
                    <Skeleton key={i} className="h-12 w-full" />
                  ))}
                </div>
              ) : recentExpenses.length === 0 ? (
                <p className="rounded-lg border bg-muted/30 p-5 text-center text-sm text-muted-foreground">
                  No expenses this month
                </p>
              ) : (
                <ul className="divide-y rounded-lg border">
                  {recentExpenses.map((e) => (
                    <li key={e.id} className="flex items-center gap-3 px-3 py-2.5">
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">
                          {e.type}
                          {e.expenseDate ? ` · ${formatDateToUserFriendly(e.expenseDate)}` : ""}
                        </p>
                        <p className="truncate text-xs text-muted-foreground">
                          ₹{(e.amount ?? 0).toLocaleString("en-IN", { maximumFractionDigits: 2 })}
                        </p>
                      </div>
                      <span className={`inline-flex shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium capitalize ring-1 ring-inset ${expensePillClass(e.approvalStatus)}`}>
                        {String(e.approvalStatus).toLowerCase()}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}
