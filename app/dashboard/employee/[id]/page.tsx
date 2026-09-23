"use client";

import { useState, useEffect, useCallback, use } from 'react';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import { useAuth } from '@/components/auth-provider';
import { isDateRangeInvalid } from "@/components/date-range-error";
import { useDashboardHeader } from '@/components/dashboard-header-context';
import { getEmployeeRoleLabel } from '@/lib/employee-role';
import { formatCityLabel } from '@/lib/city-options';
import { EmployeeActivityView, type ActivityTab, type SalaryBreakdownRow, type TrackingCurrent, type TrackingPoint } from '@/components/employee-activity-view';
import { visitsApi } from '@/lib/visits-api';
import { attendanceApi } from '@/lib/attendance-api';
import { expensesApi } from '@/lib/expenses-api';
import { teamsApi } from '@/lib/teams-api';

const ACTIVITY_TABS = [
  { value: 'visits', label: 'Visits', icon: 'fas fa-map-marked-alt' },
  { value: 'attendance', label: 'Attendance', icon: 'fas fa-calendar-check' },
  { value: 'expenses', label: 'Expenses', icon: 'fas fa-receipt' },
  { value: 'salary', label: 'Salary', icon: 'fas fa-money-bill' },
  { value: 'targets', label: 'Targets', icon: 'fas fa-bullseye' },
  { value: 'tracking', label: 'Tracking', icon: 'fas fa-location-dot' },
];

const VISIT_FILTER_OPTIONS = ['today', 'yesterday', 'last-2-days', 'this-week', 'this-month', 'last-month'] as const;
type VisitFilterOption = typeof VISIT_FILTER_OPTIONS[number];
const VISIT_FILTER_SET = new Set<string>(VISIT_FILTER_OPTIONS);



// Salary & tracking normalizers (documented fields only, safe for null/missing)
const asRecord = (v: unknown): Record<string, unknown> | null => (v && typeof v === 'object' && !Array.isArray(v) ? v as Record<string, unknown> : null);
const asNumber = (v: unknown): number | null => {
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  if (typeof v === 'string' && v.trim() && Number.isFinite(Number(v))) return Number(v);
  return null;
};
const asString = (v: unknown): string | null => (typeof v === 'string' && v.trim() ? v.trim() : null);
const normalizeSalaryRows = (data: unknown): SalaryBreakdownRow[] => {
  const src = asRecord(data);
  const raw: unknown[] = Array.isArray(data) ? data : Array.isArray(src?.content) ? src!.content as unknown[] : Array.isArray(src?.data) ? src!.data as unknown[] : [];
  return raw.map((entry, idx) => {
    const r = asRecord(entry) ?? {};
    return {
      employeeId: asNumber(r.employeeId) ?? 0,
      date: asString(r.date) ?? `row-${idx}`,
      attendanceStatus: asString(r.attendanceStatus) ?? '—',
      visitCount: asNumber(r.visitCount) ?? 0,
      fullMonthSalary: asNumber(r.fullMonthSalary) ?? 0,
      dailySalary: asNumber(r.dailySalary) ?? 0,
      baseSalary: asNumber(r.baseSalary) ?? 0,
      travelAllowance: asNumber(r.travelAllowance) ?? 0,
      dearnessAllowance: asNumber(r.dearnessAllowance) ?? 0,
      approvedExpenses: asNumber(r.approvedExpenses) ?? 0,
      pendingExpenses: asNumber(r.pendingExpenses) ?? 0,
      totalSalary: asNumber(r.totalSalary) ?? 0,
      carDistance: asNumber(r.carDistance) ?? 0,
      bikeDistance: asNumber(r.bikeDistance) ?? 0,
      totalVisits: asNumber(r.totalVisits) ?? 0,
      completedVisits: asNumber(r.completedVisits) ?? 0,
    };
  });
};
const normalizeTrackingCurrent = (data: unknown): TrackingCurrent | null => {
  if (!data || typeof data !== 'object') return null;
  const r = asRecord(data) ?? {};
  const loc = asRecord(r.location) ?? asRecord(r.currentLocation) ?? r;
  const lat = asNumber(loc.latitude ?? loc.lat);
  const lng = asNumber(loc.longitude ?? loc.lng ?? loc.lon);
  if (lat == null || lng == null) return null;
  return {
    latitude: lat,
    longitude: lng,
    capturedAt: asString(loc.capturedAt ?? loc.recordedAt ?? loc.updatedAt ?? r.capturedAt),
    provider: asString(loc.provider ?? loc.source),
    accuracyMeters: asNumber(loc.accuracyMeters ?? loc.accuracy),
    batteryPercent: asNumber(loc.batteryPercent ?? loc.battery),
  };
};
const normalizeTrackingHistory = (data: unknown): TrackingPoint[] => {
  const src = asRecord(data);
  const raw: unknown[] = Array.isArray(data) ? data : Array.isArray(src?.content) ? src!.content as unknown[] : Array.isArray(src?.data) ? src!.data as unknown[] : [];
  return raw.map((entry, idx) => {
    const r = asRecord(entry) ?? {};
    const loc = asRecord(r.location) ?? r;
    return {
      id: (asNumber(r.id) ?? asString(r.id) ?? `${idx}`) as string | number,
      latitude: asNumber(loc.latitude ?? loc.lat),
      longitude: asNumber(loc.longitude ?? loc.lng ?? loc.lon),
      capturedAt: asString(loc.capturedAt ?? loc.recordedAt ?? r.capturedAt),
      provider: asString(loc.provider ?? r.provider),
      accuracyMeters: asNumber(loc.accuracyMeters ?? loc.accuracy),
      batteryPercent: asNumber(loc.batteryPercent),
    };
  }).filter((p) => p.latitude != null && p.longitude != null);
};
const isPermissionError = (msg: string | null): boolean => !!msg && /403|forbidden|permission/i.test(msg);

interface Visit {
  id: number;
  storeId?: number;
  storeName?: string;
  parentName?: string;
  employeeName?: string;
  assignedEmployeeName?: string;
  visit_date?: string;
  scheduledVisitDate?: string;
  purpose?: string;
  outcome?: string | null;
  scheduledStartTime?: string | null;
  scheduledEndTime?: string | null;
  checkinDate?: string | null;
  checkoutDate?: string | null;
  checkinTime?: string | null;
  checkoutTime?: string | null;
  actualCheckinAt?: string | null;
  actualCheckoutAt?: string | null;
}

interface Expense {
  id: number;
  type: string;
  subType: string;
  amount: number;
  approvalStatus: string;
  description: string;
  approvalDate: string;
  expenseDate: string;
  employeeName: string;
}

interface EmployeeData {
  id: number;
  firstName: string;
  lastName: string;
  employeeId: string;
  primaryContact: string | number;
  email: string;
  role: string;
  city: string;
  state: string;
  country: string;
  dateOfJoining: string;
  departmentName: string;
}

export default function SalesExecutivePage({ params }: { params: Promise<{ id: string }> }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const searchParamsString = searchParams.toString();

  const resolvedParams = use(params);
  const id = resolvedParams.id;
  const employeeIdNum = Number(id);
  const { token } = useAuth();

  const [activeTab, setActiveTab] = useState('visits');
  const [employeeData, setEmployeeData] = useState<EmployeeData | null>(null);
  const [employeeError, setEmployeeError] = useState<string | null>(null);
  const [employeeGap, setEmployeeGap] = useState<string | null>(null);
  const [visits, setVisits] = useState<Visit[]>([]);
  const [visitsLoading, setVisitsLoading] = useState(false);
  const [visitsError, setVisitsError] = useState<string | null>(null);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [expensesLoading, setExpensesLoading] = useState(false);
  const [expensesError, setExpensesError] = useState<string | null>(null);
  const [attendanceStats, setAttendanceStats] = useState<Record<string, unknown> | null>(null);
  const [attendanceLoading, setAttendanceLoading] = useState(false);
  const [attendanceError, setAttendanceError] = useState<string | null>(null);
  const [salaryData, setSalaryData] = useState<Record<string, unknown> | null>(null);
  const [salaryLoading, setSalaryLoading] = useState(false);
  const [salaryError, setSalaryError] = useState<string | null>(null);
  const [targets, setTargets] = useState<Record<string, unknown>[]>([]);
  const [targetsLoading, setTargetsLoading] = useState(false);
  const [targetsError, setTargetsError] = useState<string | null>(null);
  const [trackingCurrent, setTrackingCurrent] = useState<Record<string, unknown> | null>(null);
  const [trackingHistory, setTrackingHistory] = useState<Record<string, unknown>[]>([]);
  const [trackingLoading, setTrackingLoading] = useState(false);
  const [trackingError, setTrackingError] = useState<string | null>(null);

  const [visitFilter, setVisitFilter] = useState<VisitFilterOption>('today');
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());
  const [selectedMonth, setSelectedMonth] = useState<number>(new Date().getMonth() + 1);
  const [expenseStartDate, setExpenseStartDate] = useState<Date | undefined>(new Date());
  const [expenseEndDate, setExpenseEndDate] = useState<Date | undefined>(new Date());
  const expenseDateRangeInvalid = isDateRangeInvalid(expenseStartDate, expenseEndDate);
  const [visitPage, setVisitPage] = useState(1);
  const [visitPageSize, setVisitPageSize] = useState(5);
  const [visitTotalElements, setVisitTotalElements] = useState(0);
  const [visitTotalPages, setVisitTotalPages] = useState(1);

  const [filtersHydrated, setFiltersHydrated] = useState(false);

  const handleVisitFilterChange = useCallback((value: string) => {
    if (VISIT_FILTER_SET.has(value)) {
      setVisitFilter(value as VisitFilterOption);
    }
  }, []);


  
  const handleBack = useCallback(() => {
    try {
      const raw = sessionStorage.getItem('employees.last.view');
      if (raw) {
        router.back();
        return;
      }
    } catch {}
    router.back();
  }, [router]);

  useDashboardHeader({
    heading: 'Employee Details',
    subheading: employeeData
      ? `${employeeData.firstName} ${employeeData.lastName} · ${getEmployeeRoleLabel(employeeData.role)}`
      : `Employee #${id}`,
    onBack: handleBack,
  });

  const handleViewVisit = useCallback((visitId: number) => {
    try {
      sessionStorage.setItem('employee.visit.last', JSON.stringify({ tab: activeTab, visitFilter }));
    } catch {}
    router.push(`/dashboard/visits/${visitId}`);
  }, [router, activeTab, visitFilter]);

  useEffect(() => {
    if (filtersHydrated) return;

    const params = new URLSearchParams(searchParamsString);
    const fallbackRaw = (() => {
      try {
        return sessionStorage.getItem('employee.visit.last');
      } catch {
        return null;
      }
    })();

    const saved = fallbackRaw ? (() => {
      try {
        return JSON.parse(fallbackRaw) ?? {};
      } catch {
        return {};
      }
    })() : {};

    const tabParam = params.get('tab') ?? saved.tab;
    if (tabParam && ACTIVITY_TABS.some((tab) => tab.value === tabParam)) {
      setActiveTab(tabParam);
    }

    const visitFilterParam = params.get('visitFilter') ?? saved.visitFilter;
    if (visitFilterParam && VISIT_FILTER_SET.has(visitFilterParam)) {
      setVisitFilter(visitFilterParam as VisitFilterOption);
    }

    setFiltersHydrated(true);
  }, [filtersHydrated, searchParamsString]);

  useEffect(() => {
    if (!filtersHydrated) return;

    const params = new URLSearchParams(searchParamsString);

    if (activeTab && activeTab !== 'visits') {
      params.set('tab', activeTab);
    } else {
      params.delete('tab');
    }

    if (visitFilter && visitFilter !== 'today') {
      params.set('visitFilter', visitFilter);
    } else {
      params.delete('visitFilter');
    }

    const nextQuery = params.toString();
    const nextUrl = nextQuery ? `${pathname}?${nextQuery}` : pathname;
    const currentUrl = searchParamsString ? `${pathname}?${searchParamsString}` : pathname;

    if (nextUrl !== currentUrl) {
      router.replace(nextUrl, { scroll: false });
    }
  }, [activeTab, visitFilter, filtersHydrated, pathname, router, searchParamsString]);

  // Employee fetch — documented GET /api/common/employees/{employeeId} via authenticated teamsApi client
  useEffect(() => {
    if (!token || !id || Number.isNaN(employeeIdNum)) return;
    let cancelled = false;
    const fetchEmployee = async () => {
      setEmployeeError(null);
      setEmployeeGap(null);
      try {
        const employee = await teamsApi.getEmployeeById(token, employeeIdNum);
        if (cancelled) return;
        const normalized: EmployeeData = {
          id: employee.id,
          firstName: employee.firstName,
          lastName: employee.lastName,
          employeeId: employee.employeeCode || String(employee.id),
          primaryContact: employee.mobile,
          email: employee.email,
          role: employee.role,
          city: employee.city,
          state: employee.state,
          country: employee.country,
          dateOfJoining: employee.dateOfJoining,
          departmentName: employee.department,
        };
        setEmployeeData(normalized);
      } catch (err) {
        if (cancelled) return;
        const msg = err instanceof Error ? err.message : 'Failed to load employee';
        setEmployeeError(msg);
      }
    };
    void fetchEmployee();
    return () => { cancelled = true; };
  }, [token, id, employeeIdNum]);

  // Visits — documented GET /api/common/visits with pagination/date filters
  useEffect(() => {
    if (!filtersHydrated || !token || Number.isNaN(employeeIdNum)) return;
    let cancelled = false;
    const fetchVisits = async () => {
      setVisitsLoading(true);
      setVisitsError(null);
      const now = new Date();
      let startDate = now.toISOString().split('T')[0];
      let endDate = startDate;
      if (visitFilter === 'today') {
        startDate = now.toISOString().split('T')[0];
        endDate = startDate;
      } else if (visitFilter === 'yesterday') {
        const d = new Date(now); d.setDate(d.getDate() - 1);
        startDate = d.toISOString().split('T')[0]; endDate = startDate;
      } else if (visitFilter === 'last-2-days') {
        const d = new Date(now); d.setDate(d.getDate() - 2);
        startDate = d.toISOString().split('T')[0]; endDate = now.toISOString().split('T')[0];
      } else if (visitFilter === 'this-week') {
        const s = new Date(now); s.setDate(now.getDate() - now.getDay());
        startDate = s.toISOString().split('T')[0]; endDate = now.toISOString().split('T')[0];
      } else if (visitFilter === 'this-month') {
        startDate = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
        endDate = now.toISOString().split('T')[0];
      } else if (visitFilter === 'last-month') {
        startDate = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString().split('T')[0];
        endDate = new Date(now.getFullYear(), now.getMonth(), 0).toISOString().split('T')[0];
      }
      try {
        const page = await visitsApi.getCommonVisits(token, {
          page: visitPage - 1,
          size: visitPageSize,
          from: startDate,
          to: endDate,
          assignedEmployeeId: employeeIdNum,
        });
        if (cancelled) return;
        setVisits(page.content as unknown as Visit[]);
        setVisitTotalElements(page.totalElements);
        setVisitTotalPages(Math.max(page.totalPages || 1, 1));
      } catch (e) {
        if (cancelled) return;
        setVisitsError(e instanceof Error ? e.message : 'Failed to load visits');
        setVisits([]);
      } finally {
        if (!cancelled) setVisitsLoading(false);
      }
    };
    void fetchVisits();
    return () => { cancelled = true; };
  }, [token, employeeIdNum, visitFilter, filtersHydrated, visitPage, visitPageSize]);

  // Expenses — documented GET /api/hr/expenses/by-employee
  useEffect(() => {
    if (expenseDateRangeInvalid || !token || Number.isNaN(employeeIdNum)) return;
    let cancelled = false;
    const fetchExpenses = async () => {
      setExpensesLoading(true);
      setExpensesError(null);
      const start = expenseStartDate ? expenseStartDate.toISOString().split('T')[0] : `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}-01`;
      const end = expenseEndDate ? expenseEndDate.toISOString().split('T')[0] : `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}-30`;
      try {
        const page = await expensesApi.getByEmployee(token, employeeIdNum, start, end, 0, 50);
        if (cancelled) return;
        setExpenses(page.content as unknown as Expense[]);
      } catch (e) {
        if (cancelled) return;
        setExpensesError(e instanceof Error ? e.message : 'Failed to load expenses');
        setExpenses([]);
      } finally {
        if (!cancelled) setExpensesLoading(false);
      }
    };
    void fetchExpenses();
    return () => { cancelled = true; };
  }, [token, employeeIdNum, expenseStartDate, expenseEndDate, expenseDateRangeInvalid]);

  // Attendance — documented GET /api/hr/attendance/logs/by-employee
  // Attendance, salary, targets and tracking all follow the selected month (selectedYear/selectedMonth).

  useEffect(() => {
    if (!token || Number.isNaN(employeeIdNum)) return;
    let cancelled = false;
    const fetchAttendance = async () => {
      setAttendanceLoading(true);
      setAttendanceError(null);
      try {
        const start = `${selectedYear}-${String(selectedMonth).padStart(2, '0')}-01`;
        const endDateObj = new Date(selectedYear, selectedMonth, 0);
        const end = `${selectedYear}-${String(selectedMonth).padStart(2, '0')}-${String(endDateObj.getDate()).padStart(2, '0')}`;
        const page = await attendanceApi.getByEmployee(token, employeeIdNum, start, end, 0, 50);
        if (cancelled) return;
        // Summarize small display from bounded page per guide
        const fullDays = page.content.filter((r: unknown) => {
          const s = (r as Record<string, unknown>).attendanceStatus as string;
          return typeof s === 'string' && s.toLowerCase().includes('full');
        }).length;
        const halfDays = page.content.filter((r: unknown) => {
          const s = (r as Record<string, unknown>).attendanceStatus as string;
          return typeof s === 'string' && s.toLowerCase().includes('half');
        }).length;
        const absences = page.content.length - fullDays - halfDays;
        setAttendanceStats({ statsDto: { fullDays, halfDays, absences }, pageMeta: { totalElements: page.totalElements } });
      } catch (e) {
        if (cancelled) return;
        setAttendanceError(e instanceof Error ? e.message : 'Failed to load attendance');
        setAttendanceStats(null);
      } finally {
        if (!cancelled) setAttendanceLoading(false);
      }
    };
    void fetchAttendance();
    return () => { cancelled = true; };
  }, [token, employeeIdNum, selectedYear, selectedMonth]);

  // Salary — documented GET /api/hr/salary/date-range-breakdown
  useEffect(() => {
    if (!token || Number.isNaN(employeeIdNum)) return;
    let cancelled = false;
    const fetchSalary = async () => {
      setSalaryLoading(true);
      setSalaryError(null);
      try {
        const start = `${selectedYear}-${String(selectedMonth).padStart(2, '0')}-01`;
        const endDateObj = new Date(selectedYear, selectedMonth, 0);
        const end = `${selectedYear}-${String(selectedMonth).padStart(2, '0')}-${String(endDateObj.getDate()).padStart(2, '0')}`;
        const res = await fetch(`${process.env.NEXT_PUBLIC_API_BASE_URL || 'http://ec2-18-211-58-135.compute-1.amazonaws.com:8081'}/api/hr/salary/date-range-breakdown?employeeId=${employeeIdNum}&from=${start}&to=${end}`, {
          headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
        });
        if (!res.ok) throw new Error(`Salary breakdown failed (${res.status})`);
        const data = await res.json();
        if (cancelled) return;
        setSalaryData(Array.isArray(data) ? { content: data } : data);
      } catch (e) {
        if (cancelled) return;
        setSalaryError(e instanceof Error ? e.message : 'Failed to load salary');
        setSalaryData(null);
      } finally {
        if (!cancelled) setSalaryLoading(false);
      }
    };
    void fetchSalary();
    return () => { cancelled = true; };
  }, [token, employeeIdNum, selectedYear, selectedMonth]);

  // Targets — documented GET /api/hr/targets
  useEffect(() => {
    if (!token || Number.isNaN(employeeIdNum)) return;
    let cancelled = false;
    const fetchTargets = async () => {
      setTargetsLoading(true);
      setTargetsError(null);
      try {
        const res = await fetch(`${process.env.NEXT_PUBLIC_API_BASE_URL || 'http://ec2-18-211-58-135.compute-1.amazonaws.com:8081'}/api/hr/targets?employeeId=${employeeIdNum}&year=${selectedYear}&month=${selectedMonth}&page=0&size=20`, {
          headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
        });
        if (!res.ok) throw new Error(`Targets failed (${res.status})`);
        const data = await res.json();
        if (cancelled) return;
        const content = Array.isArray(data) ? data : Array.isArray((data as Record<string, unknown>).content) ? (data as Record<string, unknown>).content as Record<string, unknown>[] : [];
        setTargets(content);
      } catch (e) {
        if (cancelled) return;
        setTargetsError(e instanceof Error ? e.message : 'Failed to load targets');
        setTargets([]);
      } finally {
        if (!cancelled) setTargetsLoading(false);
      }
    };
    void fetchTargets();
    return () => { cancelled = true; };
  }, [token, employeeIdNum, selectedYear, selectedMonth]);

  // Tracking — documented GET /api/hr/tracking/*
  useEffect(() => {
    if (!token || Number.isNaN(employeeIdNum)) return;
    let cancelled = false;
    const fetchTracking = async () => {
      setTrackingLoading(true);
      setTrackingError(null);
      try {
        const [currentRes, historyRes] = await Promise.all([
          fetch(`${process.env.NEXT_PUBLIC_API_BASE_URL || 'http://ec2-18-211-58-135.compute-1.amazonaws.com:8081'}/api/hr/tracking/current-location/${employeeIdNum}`, { headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' } }),
          fetch(`${process.env.NEXT_PUBLIC_API_BASE_URL || 'http://ec2-18-211-58-135.compute-1.amazonaws.com:8081'}/api/hr/tracking/location-history/${employeeIdNum}?from=${selectedYear}-${String(selectedMonth).padStart(2, '0')}-01T00:00:00&to=${selectedYear}-${String(selectedMonth).padStart(2, '0')}-${String(new Date(selectedYear, selectedMonth, 0).getDate()).padStart(2, '0')}T23:59:59&page=0&size=20`, { headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' } }),
        ]);
        if (cancelled) return;
        let current: Record<string, unknown> | null = null;
        let history: Record<string, unknown>[] = [];
        if (currentRes.ok) {
          const d = await currentRes.json();
          current = (d && typeof d === 'object' ? d : { data: d }) as Record<string, unknown>;
        } else if (currentRes.status !== 404) {
          throw new Error(`Current location failed (${currentRes.status})`);
        }
        if (historyRes.ok) {
          const d = await historyRes.json();
          const content = Array.isArray(d) ? d : Array.isArray((d as Record<string, unknown>).content) ? (d as Record<string, unknown>).content as Record<string, unknown>[] : [];
          history = content;
        } else if (historyRes.status !== 404) {
          throw new Error(`History failed (${historyRes.status})`);
        }
        setTrackingCurrent(current);
        setTrackingHistory(history);
      } catch (e) {
        if (cancelled) return;
        setTrackingError(e instanceof Error ? e.message : 'Failed to load tracking');
        setTrackingCurrent(null);
        setTrackingHistory([]);
      } finally {
        if (!cancelled) setTrackingLoading(false);
      }
    };
    void fetchTracking();
    return () => { cancelled = true; };
  }, [token, employeeIdNum, selectedYear, selectedMonth]);

  const paginatedVisits = visits;
  const totalVisitPages = visitTotalPages;

  useEffect(() => {
    setVisitPage(1);
  }, [visitFilter, visitPageSize]);

  const salaryRows = normalizeSalaryRows(salaryData);
  const trackingCurrentPoint = normalizeTrackingCurrent(trackingCurrent);
  const trackingPoints = normalizeTrackingHistory(trackingHistory);
  const statsDto = (attendanceStats as { statsDto?: { fullDays?: number; halfDays?: number; absences?: number } } | null)?.statsDto;

  return (
    <EmployeeActivityView
      employee={employeeData ? {
        id: employeeData.id,
        name: `${employeeData.firstName} ${employeeData.lastName}`.trim() || `Employee #${employeeData.id}`,
        roleLabel: getEmployeeRoleLabel(employeeData.role),
        code: employeeData.employeeId,
        department: employeeData.departmentName,
        city: employeeData.city ? formatCityLabel(employeeData.city) : undefined,
        state: employeeData.state,
        email: employeeData.email,
        phone: employeeData.primaryContact ? String(employeeData.primaryContact) : undefined,
      } : null}
      employeeError={employeeError || (employeeGap ? `Backend gap: ${employeeGap}` : null)}
      tab={activeTab as ActivityTab}
      onTabChange={setActiveTab}
      onBack={handleBack}
      onEdit={() => router.push(`/dashboard/employees/${id}/edit`)}
      onOpenProfile={() => router.push(`/dashboard/employees/${id}`)}
      visits={{
        items: paginatedVisits, loading: visitsLoading, error: visitsError, filter: visitFilter, onFilterChange: handleVisitFilterChange,
        page: visitPage, pageSize: visitPageSize, total: visitTotalElements, totalPages: totalVisitPages,
        onPageChange: (page) => setVisitPage(Math.min(Math.max(1, page), totalVisitPages)), onPageSizeChange: setVisitPageSize, onOpen: handleViewVisit,
      }}
      month={{ year: selectedYear, month: selectedMonth, onChange: (year, month) => { setSelectedYear(year); setSelectedMonth(month); } }}
      attendance={{ full: statsDto?.fullDays ?? 0, half: statsDto?.halfDays ?? 0, absent: statsDto?.absences ?? 0, loading: attendanceLoading, error: attendanceError }}
      expenses={{ items: expenses, loading: expensesLoading, error: expensesError, start: expenseStartDate, end: expenseEndDate, onStartChange: setExpenseStartDate, onEndChange: setExpenseEndDate, invalid: expenseDateRangeInvalid }}
      salary={{ rows: salaryRows, loading: salaryLoading, error: salaryError, permissionDenied: isPermissionError(salaryError) }}
      targets={{ items: targets, loading: targetsLoading, error: targetsError }}
      tracking={{ current: trackingCurrentPoint, history: trackingPoints, loading: trackingLoading, error: trackingError, permissionDenied: isPermissionError(trackingError) }}
    />
  );
}
