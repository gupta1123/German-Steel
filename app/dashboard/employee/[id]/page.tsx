"use client";

import { useState, useEffect, useRef, useCallback, useMemo, use } from 'react';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import Head from 'next/head';
import { useAuth } from '@/components/auth-provider';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { format } from "date-fns";
import { Badge } from '@/components/ui/badge';
import { Building2, Calendar as CalendarIcon, CalendarDays, Mail, MapPin, Pencil, Phone } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectTrigger,
  SelectContent,
  SelectValue,
  SelectItem
} from "@/components/ui/select";
import { SpacedCalendar } from "@/components/ui/spaced-calendar";
import { DateRangeError, isDateRangeInvalid } from "@/components/date-range-error";
import { useDashboardHeader } from '@/components/dashboard-header-context';
import { getEmployeeRoleLabel } from '@/lib/employee-role';
import { formatCityLabel } from '@/lib/city-options';
import { EmployeeManagedTeams } from '@/components/employee-managed-teams';
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

// --- Salary & Tracking normalizers (documented fields only, safe for null/missing) ---
type SalaryBreakdownRow = {
  employeeId: number;
  date: string;
  attendanceStatus: string;
  visitCount: number;
  fullMonthSalary: number;
  dailySalary: number;
  baseSalary: number;
  travelAllowance: number;
  dearnessAllowance: number;
  approvedExpenses: number;
  pendingExpenses: number;
  totalSalary: number;
  carDistance: number;
  bikeDistance: number;
  totalVisits: number;
  completedVisits: number;
};

type TrackingCurrent = {
  latitude: number | null;
  longitude: number | null;
  capturedAt: string | null;
  provider: string | null;
  accuracyMeters: number | null;
  batteryPercent: number | null;
};

type TrackingPoint = {
  id: string | number;
  latitude: number | null;
  longitude: number | null;
  capturedAt: string | null;
  provider: string | null;
  accuracyMeters: number | null;
  batteryPercent: number | null;
};

const asRecord = (v: unknown): Record<string, unknown> | null => (v && typeof v === 'object' && !Array.isArray(v) ? v as Record<string, unknown> : null);
const asNumber = (v: unknown): number | null => {
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  if (typeof v === 'string' && v.trim() && Number.isFinite(Number(v))) return Number(v);
  return null;
};
const asString = (v: unknown): string | null => (typeof v === 'string' && v.trim() ? v.trim() : null);
const formatCurrency = (v: unknown): string => {
  const n = asNumber(v);
  if (n == null) return '—';
  return `₹${n.toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;
};
const formatDateLabel = (v: unknown): string => {
  const s = asString(v);
  if (!s) return '—';
  try { return format(new Date(s), 'MMM dd, yyyy'); } catch { return s; }
};
const formatTimestampLabel = (v: unknown): string => {
  const s = asString(v);
  if (!s) return '—';
  try {
    const d = new Date(s);
    if (Number.isNaN(d.getTime())) return s;
    return format(d, 'MMM dd, yyyy hh:mm a');
  } catch { return s; }
};
const formatDistance = (v: unknown): string => {
  const n = asNumber(v);
  if (n == null) return '—';
  return `${n.toFixed(2)} km`;
};
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

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(word => word[0])
      .join('')
      .toUpperCase();
  };

  const getStatusInfo = (status: string) => {
    switch (status) {
      case 'Completed':
        return { emoji: '✅', color: 'bg-green-100 text-green-800' };
      case 'In Progress':
        return { emoji: '🟡', color: 'bg-blue-100 text-blue-800' };
      default:
        return { emoji: '⏳', color: 'bg-gray-100 text-gray-800' };
    }
  };
  
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
  const [attendanceYear] = useState(new Date().getFullYear());
  const [attendanceMonth] = useState(new Date().getMonth() + 1);
  // Keep selectedYear/selectedMonth for attendance to reuse existing state, but map correctly
  // attendance tab uses selectedYear/selectedMonth already defined as visit filter? Actually we have selectedYear/selectedMonth for visits? No, we have selectedYear/selectedMonth for attendance
  // The page already has selectedYear/selectedMonth state for attendance

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

  const profileProperties = [
    { label: 'Email', value: employeeData?.email, icon: Mail },
    { label: 'Phone', value: employeeData?.primaryContact ? String(employeeData.primaryContact) : '', icon: Phone },
    {
      label: 'Location',
      value: [employeeData?.city, employeeData?.state, employeeData?.country].filter(Boolean).join(', '),
      icon: MapPin,
    },
    { label: 'Department', value: employeeData?.departmentName, icon: Building2 },
    {
      label: 'Joined',
      value: employeeData?.dateOfJoining
        ? format(new Date(employeeData.dateOfJoining), 'MMM dd, yyyy')
        : '',
      icon: CalendarDays,
    },
  ].filter((property) => property.value);

  return (
    <div className="space-y-4 py-4">
      <Head>
        <title>{employeeData ? `${employeeData.firstName} ${employeeData.lastName}` : 'Employee Details'}</title>
      </Head>

      {employeeGap && (
        <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
          <strong>Backend gap:</strong> {employeeGap}
        </div>
      )}
      {employeeError && (
        <div className="rounded-md border border-red-200 bg-red-50 p-3 text-xs text-red-700">{employeeError}</div>
      )}

      <Card className="gap-0 py-0 shadow-none">
        <CardContent className="p-4">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex min-w-0 items-center gap-3">
              <Avatar className="h-12 w-12 shrink-0 border">
                <AvatarFallback className="bg-muted text-sm font-semibold text-muted-foreground">
                  {employeeData ? getInitials(`${employeeData.firstName} ${employeeData.lastName}`) : '—'}
                </AvatarFallback>
              </Avatar>
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="truncate text-lg font-semibold tracking-tight">
                    {employeeData ? `${employeeData.firstName} ${employeeData.lastName}` : 'Loading employee…'}
                  </h2>
                  {employeeData?.role && <Badge variant="secondary" className="font-medium">{getEmployeeRoleLabel(employeeData.role)}</Badge>}
                </div>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {employeeData?.employeeId ? `Employee ID ${employeeData.employeeId}` : 'Employee record'}
                </p>
              </div>
            </div>
            <Button variant="outline" size="sm" onClick={() => router.push(`/dashboard/employees/${id}/edit`)}>
              <Pencil className="mr-2 h-3.5 w-3.5" /> Edit employee
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="grid min-w-0 gap-4 lg:grid-cols-[280px_minmax(0,1fr)]">
        <aside>
          <Card className="gap-0 py-0 shadow-none">
            <CardHeader className="border-b px-4 py-3">
              <CardTitle className="text-sm font-semibold">About</CardTitle>
            </CardHeader>
            <CardContent className="p-4">
              <dl className="space-y-4">
                {profileProperties.map((property) => (
                  <div key={property.label} className="flex items-start gap-3">
                    <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground">
                      <property.icon className="h-3.5 w-3.5" />
                    </div>
                    <div className="min-w-0">
                      <dt className="text-[11px] font-medium capitalize tracking-wide text-muted-foreground">{property.label}</dt>
                      <dd className="break-words text-sm text-foreground">{property.value}</dd>
                    </div>
                  </div>
                ))}
              </dl>
            </CardContent>
          </Card>
        </aside>

        <section className="min-w-0 space-y-4">
          {employeeData?.id === Number(id) && (
            <EmployeeManagedTeams employeeId={employeeData.id} role={employeeData.role} />
          )}
          <Card className="gap-0 py-0 shadow-none">
            <CardContent className="p-0">
              <div className="space-y-4 p-4">
                <div className="md:hidden">
                  <Select value={activeTab} onValueChange={setActiveTab}>
                    <SelectTrigger className="h-9 w-full">
                      <SelectValue placeholder="Select section" />
                    </SelectTrigger>
                    <SelectContent>
                      {ACTIVITY_TABS.map((tab) => (
                        <SelectItem key={tab.value} value={tab.value}>
                          <div className="flex items-center gap-2">
                            <i className={tab.icon}></i>
                            <span>{tab.label}</span>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="hidden border-b md:flex">
                  {ACTIVITY_TABS.map((tab) => (
                    <button
                      key={tab.value}
                      className={`flex items-center gap-2 border-b-2 px-3 py-2 text-xs font-medium transition-colors ${
                        activeTab === tab.value
                          ? 'border-primary text-primary'
                          : 'border-transparent text-muted-foreground hover:text-foreground'
                      }`}
                      onClick={() => setActiveTab(tab.value)}
                    >
                      <i className={tab.icon}></i> {tab.label}
                    </button>
                  ))}
                </div>

                {activeTab === 'visits' && (
                  <div className="space-y-4">
                    <div className="flex flex-wrap items-center gap-2">
                      <Select value={visitFilter} onValueChange={handleVisitFilterChange}>
                        <SelectTrigger className="h-9 min-w-[150px] flex-1 sm:flex-none">
                          <SelectValue placeholder="Select Filter" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="today">Today</SelectItem>
                          <SelectItem value="yesterday">Yesterday</SelectItem>
                          <SelectItem value="last-2-days">Last 2 Days</SelectItem>
                          <SelectItem value="this-week">This Week</SelectItem>
                          <SelectItem value="this-month">This Month</SelectItem>
                          <SelectItem value="last-month">Last Month</SelectItem>
                        </SelectContent>
                      </Select>
                      <Select
                        value={visitPageSize.toString()}
                        onValueChange={(value) => setVisitPageSize(parseInt(value, 10))}
                      >
                        <SelectTrigger className="h-9 min-w-[140px] flex-1 sm:flex-none">
                          <SelectValue placeholder="Page size" />
                        </SelectTrigger>
                        <SelectContent>
                          {[5, 10, 20].map((size) => (
                            <SelectItem key={size} value={size.toString()}>
                              {size} per page
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <p className="text-xs text-muted-foreground sm:ml-auto">
                        Showing {visits.length === 0 ? 0 : (visitPage - 1) * visitPageSize + 1}-
                        {Math.min(visitPage * visitPageSize, visitTotalElements)} of {visitTotalElements}
                      </p>
                    </div>
                    {visitsLoading && <div className="rounded-md border p-4 text-center text-sm text-muted-foreground">Loading visits…</div>}
                    {visitsError && <div className="rounded-md border border-red-200 bg-red-50 p-3 text-xs text-red-700">{visitsError}</div>}
                    {!visitsLoading && !visitsError && (
                    <div className="space-y-3">
                      {paginatedVisits.length === 0 ? (
                        <div className="rounded-lg border bg-muted/30 p-5 text-center text-sm text-muted-foreground">
                          No visits found for this filter
                        </div>
                      ) : (
                        paginatedVisits.map((visit) => {
                          let status = 'Scheduled';
                          if (visit.checkinDate && visit.checkinTime && visit.checkoutDate && visit.checkoutTime) {
                            status = 'Completed';
                          } else if (visit.checkinDate && visit.checkinTime) {
                            status = 'In Progress';
                          }
                          const { emoji, color } = getStatusInfo(status);
                          return (
                            <div
                              key={visit.id}
                              className="rounded-lg border bg-card p-3 transition-shadow hover:shadow-sm"
                            >
                              <div className="flex items-center justify-between mb-2">
                                <div className="flex items-center gap-2">
                                  <div>
                                    <h4 className="font-semibold text-sm">{visit.storeName || (visit as unknown as { parentName?: string }).parentName || `Visit #${visit.id}`}</h4>
                                    <p className="text-xs text-muted-foreground">
                                      Visit on {visit.visit_date ? format(new Date(visit.visit_date), 'MMM dd, yyyy') : visit.scheduledVisitDate ? format(new Date(visit.scheduledVisitDate), 'MMM dd, yyyy') : '—'}
                                    </p>
                                  </div>
                                </div>
                                <span
                                  className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${color}`}
                                >
                                  {emoji} {status}
                                </span>
                              </div>
                              <div className="text-sm text-muted-foreground mb-2">
                                <span className="font-medium">Purpose:</span> {visit.purpose || '—'}
                              </div>
                              <div className="flex justify-end mt-4">
                                <Button variant="outline" size="sm" onClick={() => handleViewVisit(visit.id)}>
                                  View Visit
                                </Button>
                              </div>
                            </div>
                          );
                        })
                      )}
                    </div>
                    )}
                    {paginatedVisits.length > 0 && totalVisitPages > 1 && (
                      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2 border-t">
                        <p className="text-sm text-muted-foreground">
                          Page {visitPage} of {totalVisitPages}
                        </p>
                        <div className="flex items-center gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setVisitPage((prev) => Math.max(1, prev - 1))}
                            disabled={visitPage === 1}
                          >
                            Previous
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setVisitPage((prev) => Math.min(totalVisitPages, prev + 1))}
                            disabled={visitPage === totalVisitPages}
                          >
                            Next
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {activeTab === 'attendance' && (
                  <div className="space-y-4">
                    <div className="flex items-center gap-4">
                      <Select value={selectedYear.toString()} onValueChange={(value) => setSelectedYear(parseInt(value))}>
                        <SelectTrigger className="w-[150px]">
                          <SelectValue placeholder="Select Year" />
                        </SelectTrigger>
                        <SelectContent>
                          {Array.from({ length: 27 }, (_, index) => (
                            <SelectItem key={index} value={(2023 + index).toString()}>
                              {2023 + index}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Select value={selectedMonth.toString()} onValueChange={(value) => setSelectedMonth(parseInt(value))}>
                        <SelectTrigger className="w-[150px]">
                          <SelectValue placeholder="Select Month" />
                        </SelectTrigger>
                        <SelectContent>
                          {["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"].map((month, index) => (
                            <SelectItem key={index} value={(index + 1).toString()}>
                              {month}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    {attendanceLoading && <div className="rounded-md border p-4 text-center text-sm text-muted-foreground">Loading attendance…</div>}
                    {attendanceError && <div className="rounded-md border border-red-200 bg-red-50 p-3 text-xs text-red-700">{attendanceError}</div>}
                    {!attendanceLoading && !attendanceError && (
                    <div className="rounded-lg border bg-card p-6">
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <div className="text-center">
                          <div className="text-3xl font-bold text-blue-600 mb-2">
                            {(attendanceStats as { statsDto?: { fullDays?: number } })?.statsDto?.fullDays || 0}
                          </div>
                          <div className="text-sm font-medium text-muted-foreground">Full Days</div>
                        </div>
                        <div className="text-center">
                          <div className="text-3xl font-bold text-yellow-600 mb-2">
                            {(attendanceStats as { statsDto?: { halfDays?: number } })?.statsDto?.halfDays || 0}
                          </div>
                          <div className="text-sm font-medium text-muted-foreground">Half Days</div>
                        </div>
                        <div className="text-center">
                          <div className="text-3xl font-bold text-red-600 mb-2">
                            {(attendanceStats as { statsDto?: { absences?: number } })?.statsDto?.absences || 0}
                          </div>
                          <div className="text-sm font-medium text-muted-foreground">Absences</div>
                        </div>
                      </div>
                    </div>
                    )}
                  </div>
                )}

                {activeTab === 'expenses' && (
                  <div className="space-y-4">
                    <div className="flex items-center gap-4">
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button variant="outline" className="w-[200px] justify-start">
                            <CalendarIcon className="mr-2 h-4 w-4" />
                            {expenseStartDate ? format(expenseStartDate, 'MMM dd, yyyy') : 'Select Start Date'}
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0">
                          <SpacedCalendar
                            mode="single"
                            selected={expenseStartDate}
                            onSelect={setExpenseStartDate}
                            initialFocus
                          />
                        </PopoverContent>
                      </Popover>
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button variant="outline" className="w-[200px] justify-start">
                            <CalendarIcon className="mr-2 h-4 w-4" />
                            {expenseEndDate ? format(expenseEndDate, 'MMM dd, yyyy') : 'Select End Date'}
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0">
                          <SpacedCalendar
                            mode="single"
                            selected={expenseEndDate}
                            onSelect={setExpenseEndDate}
                            initialFocus
                          />
                        </PopoverContent>
                      </Popover>
                    </div>

                    <DateRangeError fromDate={expenseStartDate} toDate={expenseEndDate} />
                    {expensesLoading && <div className="rounded-md border p-4 text-center text-sm text-muted-foreground">Loading expenses…</div>}
                    {expensesError && <div className="rounded-md border border-red-200 bg-red-50 p-3 text-xs text-red-700">{expensesError}</div>}

                    {!expensesLoading && !expensesError && (
                    <div className="space-y-3">
                      {expenses.length === 0 ? (
                        <div className="rounded-lg border bg-muted/30 p-5 text-center text-sm text-muted-foreground">No expenses for this period</div>
                      ) : (
                      expenses.map((expense) => (
                        <div key={expense.id} className="rounded-lg border bg-card p-4">
                          <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-2">
                              <span className="text-lg">💰</span>
                              <div>
                                <h4 className="font-semibold text-sm capitalize">{expense.type}</h4>
                                <p className="text-xs text-muted-foreground">
                                  {expense.expenseDate ? format(new Date(expense.expenseDate), 'MMM dd, yyyy') : '—'}
                                </p>
                              </div>
                            </div>
                            <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                              expense.approvalStatus.toLowerCase() === 'approved' ? 'bg-green-100 text-green-800' :
                              expense.approvalStatus.toLowerCase() === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                              'bg-red-100 text-red-800'
                            }`}>
                              {expense.approvalStatus}
                            </span>
                          </div>
                          <div className="text-sm text-muted-foreground">
                            <span className="font-medium">Amount:</span> ₹{expense.amount.toFixed(2)}
                          </div>
                        </div>
                      )))}
                    </div>
                    )}
                  </div>
                )}

                {activeTab === 'salary' && (
                  <div className="space-y-4">
                    {salaryLoading && <div className="rounded-md border p-4 text-center text-sm text-muted-foreground">Loading salary breakdown…</div>}
                    {salaryError && isPermissionError(salaryError) && (
                      <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">You do not have permission to view salary data for this employee.</div>
                    )}
                    {salaryError && !isPermissionError(salaryError) && (
                      <div className="rounded-md border border-red-200 bg-red-50 p-3 text-xs text-red-700">{salaryError}</div>
                    )}
                    {!salaryLoading && !salaryError && (() => {
                      const rows = normalizeSalaryRows(salaryData);
                      if (rows.length === 0) {
                        return <div className="rounded-lg border bg-muted/30 p-5 text-center text-sm text-muted-foreground">No salary data for this period</div>;
                      }
                      return (
                        <div className="space-y-4">
                          <div className="rounded-lg border bg-card overflow-hidden">
                            <div className="overflow-x-auto">
                              <table className="w-full text-xs">
                                <thead className="bg-muted/50">
                                  <tr className="text-left">
                                    <th className="px-3 py-2 font-medium">Date</th>
                                    <th className="px-3 py-2 font-medium">Attendance</th>
                                    <th className="px-3 py-2 font-medium text-right">Visits</th>
                                    <th className="px-3 py-2 font-medium text-right">Base Salary</th>
                                    <th className="px-3 py-2 font-medium text-right">Travel Allowance</th>
                                    <th className="px-3 py-2 font-medium text-right">Dearness Allowance</th>
                                    <th className="px-3 py-2 font-medium text-right">Approved Expenses</th>
                                    <th className="px-3 py-2 font-medium text-right">Total Salary</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {rows.map((row) => (
                                    <tr key={row.date} className="border-t">
                                      <td className="px-3 py-2 whitespace-nowrap">{formatDateLabel(row.date)}</td>
                                      <td className="px-3 py-2"><span className="rounded bg-muted px-1.5 py-0.5 text-[11px]">{row.attendanceStatus}</span></td>
                                      <td className="px-3 py-2 text-right">{row.visitCount} <span className="text-muted-foreground">({row.completedVisits}/{row.totalVisits})</span></td>
                                      <td className="px-3 py-2 text-right">{formatCurrency(row.baseSalary)}</td>
                                      <td className="px-3 py-2 text-right">{formatCurrency(row.travelAllowance)}</td>
                                      <td className="px-3 py-2 text-right">{formatCurrency(row.dearnessAllowance)}</td>
                                      <td className="px-3 py-2 text-right">{formatCurrency(row.approvedExpenses)}</td>
                                      <td className="px-3 py-2 text-right font-medium">{formatCurrency(row.totalSalary)}</td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          </div>
                          <div className="rounded-md border bg-muted/20 p-3 text-xs text-muted-foreground">
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                              {rows.slice(0, 1).map((r) => (
                                <span key="meta" className="contents">
                                  <span>Full month salary: <strong className="text-foreground">{formatCurrency(r.fullMonthSalary)}</strong></span>
                                  <span>Daily salary: <strong className="text-foreground">{formatCurrency(r.dailySalary)}</strong></span>
                                  <span>Car distance: <strong className="text-foreground">{formatDistance(r.carDistance)}</strong></span>
                                  <span>Bike distance: <strong className="text-foreground">{formatDistance(r.bikeDistance)}</strong></span>
                                </span>
                              ))}
                            </div>
                          </div>
                        </div>
                      );
                    })()}
                  </div>
                )}

                {activeTab === 'targets' && (
                  <div className="space-y-4">
                    {targetsLoading && <div className="rounded-md border p-4 text-center text-sm text-muted-foreground">Loading targets…</div>}
                    {targetsError && <div className="rounded-md border border-red-200 bg-red-50 p-3 text-xs text-red-700">{targetsError}</div>}
                    {!targetsLoading && !targetsError && targets.length === 0 && (
                      <div className="rounded-lg border bg-muted/30 p-5 text-center text-sm text-muted-foreground">No targets for this period</div>
                    )}
                    {!targetsLoading && !targetsError && targets.length > 0 && (
                      <div className="space-y-3">
                        {targets.map((t, idx) => (
                          <div key={idx} className="rounded-lg border bg-card p-4 text-sm">
                            <div className="font-medium">Target #{(t as Record<string, unknown>).id as number ?? idx + 1}</div>
                            <div className="text-xs text-muted-foreground">{JSON.stringify(t)}</div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {activeTab === 'tracking' && (
                  <div className="space-y-4">
                    {trackingLoading && <div className="rounded-md border p-4 text-center text-sm text-muted-foreground">Loading tracking…</div>}
                    {trackingError && isPermissionError(trackingError) && (
                      <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">You do not have permission to view tracking data for this employee.</div>
                    )}
                    {trackingError && !isPermissionError(trackingError) && (
                      <div className="rounded-md border border-red-200 bg-red-50 p-3 text-xs text-red-700">{trackingError}</div>
                    )}
                    {!trackingLoading && !trackingError && (() => {
                      const current = normalizeTrackingCurrent(trackingCurrent);
                      const history = normalizeTrackingHistory(trackingHistory);
                      return (
                        <>
                          <div className="rounded-lg border bg-card p-4">
                            <h4 className="font-medium text-sm">Current location</h4>
                            {current ? (
                              <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                                <div><span className="text-muted-foreground">Latitude</span><div className="font-medium text-sm">{current.latitude?.toFixed(6) ?? '—'}</div></div>
                                <div><span className="text-muted-foreground">Longitude</span><div className="font-medium text-sm">{current.longitude?.toFixed(6) ?? '—'}</div></div>
                                <div><span className="text-muted-foreground">Captured at</span><div className="font-medium">{formatTimestampLabel(current.capturedAt)}</div></div>
                                <div><span className="text-muted-foreground">Provider</span><div className="font-medium">{current.provider ?? '—'}</div></div>
                                <div><span className="text-muted-foreground">Accuracy</span><div className="font-medium">{current.accuracyMeters != null ? `${current.accuracyMeters} m` : '—'}</div></div>
                                <div><span className="text-muted-foreground">Battery</span><div className="font-medium">{current.batteryPercent != null ? `${current.batteryPercent}%` : '—'}</div></div>
                              </div>
                            ) : (
                              <p className="mt-2 text-sm text-muted-foreground">No current location for this period</p>
                            )}
                          </div>
                          <div className="rounded-lg border bg-card p-4">
                            <h4 className="font-medium text-sm">Location history ({history.length})</h4>
                            {history.length === 0 ? (
                              <p className="mt-2 text-sm text-muted-foreground">No history for this period</p>
                            ) : (
                              <div className="mt-3 space-y-2 max-h-72 overflow-auto pr-1">
                                {history.slice(0, 20).map((pt) => (
                                  <div key={String(pt.id)} className="flex flex-wrap items-center justify-between gap-2 rounded-md border bg-muted/30 px-3 py-2 text-xs">
                                    <span className="font-medium">{formatTimestampLabel(pt.capturedAt)}</span>
                                    <span className="font-mono">{pt.latitude?.toFixed(6)}, {pt.longitude?.toFixed(6)}</span>
                                    <span className="text-muted-foreground">{pt.provider ?? 'GPS'} {pt.accuracyMeters != null ? `· ${pt.accuracyMeters} m` : ''} {pt.batteryPercent != null ? `· ${pt.batteryPercent}%` : ''}</span>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        </>
                      );
                    })()}
                  </div>
                )}
              </div>
          </CardContent>
        </Card>
      </section>
      </div>
    </div>
  );
}
