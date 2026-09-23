"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { EmployeeDetailView } from "@/components/employee-detail-view";
import { teamsApi, type TeamEmployee } from "@/lib/teams-api";
import { useAuth } from "@/components/auth-provider";
import { DetailSkeleton } from "@/components/detail-ui";
import { visitsApi, type CommonVisitRow } from "@/lib/visits-api";
import { attendanceApi } from "@/lib/attendance-api";
import { expensesApi, type ExpenseRow } from "@/lib/expenses-api";

type RegionItem = { id: number; name: string };

export default function EmployeeDetail() {
  const params = useParams();
  const router = useRouter();
  const { token } = useAuth();
  const [employee, setEmployee] = useState<TeamEmployee | null>(null);
  const [managerName, setManagerName] = useState<string | null>(null);
  const [teamName, setTeamName] = useState<string | null>(null);
  const [regionNames, setRegionNames] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Compact activity (Visits + Attendance + Expenses) — same documented endpoints as full workspace
  const [recentVisits, setRecentVisits] = useState<CommonVisitRow[]>([]);
  const [visitsLoading, setVisitsLoading] = useState(false);
  const [attSummary, setAttSummary] = useState({ full: 0, half: 0, absent: 0 });
  const [attLoading, setAttLoading] = useState(false);
  const [monthExpenses, setMonthExpenses] = useState<ExpenseRow[]>([]);
  const [visitsTotal, setVisitsTotal] = useState(0);
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
        if (!cancelled) { setRecentVisits(page.content); setVisitsTotal(page.totalElements || page.content.length); }
      })
      .catch(() => {
        if (!cancelled) { setRecentVisits([]); setVisitsTotal(0); }
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
      .getByEmployee(token, employee.id, monthStart, monthEnd, 0, 50)
      .then((page) => {
        if (!cancelled) setMonthExpenses([...page.content].sort((a, b) => String(b.expenseDate).localeCompare(String(a.expenseDate))));
      })
      .catch(() => {
        if (!cancelled) setMonthExpenses([]);
      })
      .finally(() => {
        if (!cancelled) setExpLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [token, employee]);

  if (isLoading) return <DetailSkeleton />;

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

  return (
    <EmployeeDetailView
      employee={employee}
      managerName={managerName}
      teamName={teamName}
      regionNames={regionNames}
      recentVisits={recentVisits}
      visitsTotal={visitsTotal}
      visitsLoading={visitsLoading}
      attSummary={attSummary}
      attLoading={attLoading}
      monthExpenses={monthExpenses}
      expLoading={expLoading}
      onBack={() => router.push("/dashboard/employees")}
    />
  );
}
