"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Card, CardContent } from "@/components/ui/card";
import { CalendarIcon, DownloadIcon, ChevronLeft, ChevronRight, Loader2, User, ChevronDown, ChevronUp, Filter } from "lucide-react";
import { format } from "date-fns";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { SpacedCalendar } from "@/components/ui/spaced-calendar";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useRouter } from "next/navigation";
// Removed dropdown menu imports as Actions now uses direct navigation
import { type VisitDto, type EmployeeUserDto } from "@/lib/api";
import { teamsApi, type TeamEmployee } from "@/lib/teams-api";
import { resolveVisitCity, resolveVisitClient, visitsApi, type VisitClientKind, type VisitType } from "@/lib/visits-api";
import { format as formatDate } from "date-fns";
import { useAuth } from "@/components/auth-provider";
import { getCorrectedRoleFlags } from "@/lib/auth";
import { formatTimeTo12Hour, formatDateToUserFriendly } from "@/lib/utils";
import { SearchableSelect, type SearchableOption } from "@/components/ui/searchable-select2";
import { DateRangeError, isDateRangeInvalid } from "@/components/date-range-error";
import { isAdminEmployeeRole } from "@/lib/employee-role";

const VISITS_TABLE_STORAGE_KEY = "visits.table.state.v2";

type Row = {
  id: number;
  customerName: string;
  clientKind?: VisitClientKind;
  executive: string;
  employeeId?: number;
  date: string; // yyyy-MM-dd
  status?: string;
  purpose?: string;
  visitStart?: string;
  visitEnd?: string;
  intent?: number;
  lastUpdated?: string;
  priority?: string;
  outcome?: string;
  feedback?: string;
  city?: string;
  state?: string;
  checkinTime?: string;
  checkoutTime?: string;
};

function Ellipsis({ value }: { value: string | number | null | undefined }) {
  const displayValue = value === null || value === undefined || value === "" ? "—" : String(value);
  return (
    <span className="block min-w-0 truncate" title={displayValue}>
      {displayValue}
    </span>
  );
}

const teamEmployeeToUserDto = (employee: TeamEmployee): EmployeeUserDto => ({
  id: employee.id,
  firstName: employee.firstName,
  lastName: employee.lastName,
  email: employee.email,
  role: employee.role,
  departmentName: employee.department,
  userName: employee.userName,
  password: '',
  primaryContact: employee.mobile,
  dateOfJoining: employee.dateOfJoining,
  city: employee.city,
  state: employee.state,
  country: employee.country,
  addressLine1: employee.addressLine1,
  addressLine2: employee.addressLine2,
  pincode: employee.pincode,
  assignedCity: employee.assignedCity,
  userDto: {
    username: employee.userName,
    password: null,
    roles: null,
    employeeId: employee.id,
    firstName: employee.firstName,
    lastName: employee.lastName,
  },
});

const buildEmployeeFilterName = (employee: EmployeeUserDto): string => {
  const primary = [employee.firstName, employee.lastName].filter(Boolean).join(" ").trim();
  const secondary = employee.userDto
    ? [employee.userDto.firstName, employee.userDto.lastName].filter(Boolean).join(" ").trim()
    : "";
  const fallback = employee.userName || employee.userDto?.username || employee.email || `Employee ${employee.id}`;
  return (primary || secondary || fallback).trim();
};

type VisitListStatus = "Assigned" | "Ongoing" | "Completed";

const hasVisitTime = (value?: string | null): boolean => {
  if (value === null || value === undefined) {
    return false;
  }

  const normalized = String(value).trim().toLowerCase();
  return normalized !== "" && normalized !== "null" && normalized !== "undefined" && normalized !== "-";
};

const deriveVisitStatus = (visit: Pick<VisitDto, "checkinTime" | "checkoutTime">): VisitListStatus => {
  const hasCheckin = hasVisitTime(visit.checkinTime);
  const hasCheckout = hasVisitTime(visit.checkoutTime);

  if (hasCheckin && hasCheckout) {
    return "Completed";
  }

  if (hasCheckin) {
    return "Ongoing";
  }

  return "Assigned";
};

export default function VisitsTable() {
  const { userRole, userData, currentUser, teamId, correctedRoleFlags, token } = useAuth();
  const router = useRouter();
  const [navigatingVisitId, setNavigatingVisitId] = useState<number | null>(null);
  const [isNavigating, startTransition] = useTransition();
  const filterInitialisedRef = useRef(false);
  const hasHydratedRef = useRef(false);
  const [isStateHydrated, setIsStateHydrated] = useState(false);
  
  // Set default date range to last 7 days
  const defaultEndDate = new Date();
  const defaultStartDate = new Date();
  defaultStartDate.setDate(defaultEndDate.getDate() - 7);
  
  const [startDate, setStartDate] = useState<Date | undefined>(defaultStartDate);
  const [endDate, setEndDate] = useState<Date | undefined>(defaultEndDate);
  const dateRangeInvalid = isDateRangeInvalid(startDate, endDate);
  const [selectedPurpose, setSelectedPurpose] = useState<string>("all");
  const [selectedVisitType, setSelectedVisitType] = useState<string>("all");
  const [selectedExecutive, setSelectedExecutive] = useState<string>("all");
  const [customerName, setCustomerName] = useState<string>("");
  const [rows, setRows] = useState<Row[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(0);
  const [pageSize, setPageSize] = useState(10);
  const [totalPages, setTotalPages] = useState(0);
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [totalElements, setTotalElements] = useState(0);
  const [isExporting, setIsExporting] = useState(false);
  const [expandedCards, setExpandedCards] = useState<number[]>([]);
  const [areFiltersVisible, setAreFiltersVisible] = useState(true);

  const [employees, setEmployees] = useState<EmployeeUserDto[]>([]);
  const [isLoadingEmployees, setIsLoadingEmployees] = useState(false);
  
  useEffect(() => {
    let isMounted = true;

    const loadEmployees = async () => {
      if (!token) return;
      try {
        setIsLoadingEmployees(true);
        // Correct backend contract: GET /api/common/employees?active=true&page=0&size=500
        const page = await teamsApi.getEmployeesPage(token, { active: true, page: 0, size: 500 });
        if (!isMounted) {
          return;
        }
        setEmployees(page.content.map(teamEmployeeToUserDto).filter((employee) => !isAdminEmployeeRole(employee.role)));
      } catch (err) {
        console.error("Failed to load employees list:", err);
      } finally {
        if (isMounted) {
          setIsLoadingEmployees(false);
        }
      }
    };

    loadEmployees();

    return () => {
      isMounted = false;
    };
  }, [token]);

  // Role-based state
  const [isManager, setIsManager] = useState(false);
  const [teamMembers, setTeamMembers] = useState<EmployeeUserDto[]>([]);
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [managerTeamIds, setManagerTeamIds] = useState<number[]>([]);
  // Use teamId from auth context as primary source, with local state as fallback
  const authTeamId = teamId; // from useAuth hook
  const [localTeamId, setLocalTeamId] = useState<number | null>(null);
  const effectiveTeamId = authTeamId || localTeamId;

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    if (hasHydratedRef.current) {
      setIsStateHydrated(true);
      return;
    }

    hasHydratedRef.current = true;

    try {
      const storedState = sessionStorage.getItem(VISITS_TABLE_STORAGE_KEY);
      if (storedState) {
        const parsed = JSON.parse(storedState) as {
          startDate?: string;
          endDate?: string;
          selectedPurpose?: string;
          selectedVisitType?: string;
          selectedExecutive?: string;
          customerName?: string;
          currentPage?: number;
          pageSize?: number;
          expandedCards?: number[];
        };

        if (parsed.startDate) {
          const parsedStart = new Date(parsed.startDate);
          if (!Number.isNaN(parsedStart.getTime())) {
            setStartDate(parsedStart);
          }
        }

        if (parsed.endDate) {
          const parsedEnd = new Date(parsed.endDate);
          if (!Number.isNaN(parsedEnd.getTime())) {
            setEndDate(parsedEnd);
          }
        }

        if (parsed.selectedPurpose) {
          setSelectedPurpose(parsed.selectedPurpose);
        }

        if (parsed.selectedVisitType) {
          setSelectedVisitType(parsed.selectedVisitType);
        }

        if (parsed.selectedExecutive) {
          setSelectedExecutive(parsed.selectedExecutive);
        }

        if (typeof parsed.customerName === "string") {
          setCustomerName(parsed.customerName);
        }

        if (typeof parsed.currentPage === "number") {
          setCurrentPage(parsed.currentPage);
        }

        if (typeof parsed.pageSize === "number" && parsed.pageSize > 0) {
          setPageSize(parsed.pageSize);
        }

        if (Array.isArray(parsed.expandedCards)) {
          setExpandedCards(parsed.expandedCards);
        }
      }
    } catch (error) {
      console.error("Failed to restore visit table state:", error);
    } finally {
      setIsStateHydrated(true);
    }
  }, []);

  useEffect(() => {
    if (!isStateHydrated || typeof window === 'undefined') {
      return;
    }

    const payload = {
      startDate: startDate ? startDate.toISOString() : undefined,
      endDate: endDate ? endDate.toISOString() : undefined,
      selectedPurpose,
      selectedVisitType,
      selectedExecutive,
      customerName,
      currentPage,
      pageSize,
      expandedCards,
    };

    try {
      sessionStorage.setItem(VISITS_TABLE_STORAGE_KEY, JSON.stringify(payload));
    } catch (error) {
      console.error("Failed to persist visit table state:", error);
    }
  }, [
    isStateHydrated,
    startDate,
    endDate,
    selectedPurpose,
    selectedVisitType,
    selectedExecutive,
    customerName,
    currentPage,
    pageSize,
    expandedCards,
  ]);

  const VISIT_TYPE_OPTIONS: { value: string; label: string }[] = [
    { value: 'all', label: 'All Visit Types' },
    { value: 'DEALER_VISIT', label: 'Dealer Visit' },
    { value: 'INSTITUTIONAL_VISIT', label: 'Institutional Visit' },
    { value: 'PROJECT_SITE_VISIT', label: 'Project Site Visit' },
  ];

  // purposes derived from rows kept for potential module-specific filtering; not used for server visitType filter
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const purposes = useMemo(() => {
    const set = new Set<string>();
    rows.forEach(r => { if (r.purpose) set.add(r.purpose); });
    return Array.from(set);
  }, [rows]);

  const employeeOptions = useMemo<SearchableOption[]>(() => {
    // Managers see their team; administrators can filter the non-admin directory.
    const employeesToUse = (isManager ? teamMembers : employees).filter(
      (employee) => !isAdminEmployeeRole(employee.role)
    );
    
    const base = employeesToUse.map((employee) => {
      const displayName = buildEmployeeFilterName(employee);
      return {
        value: String(employee.id),
        label: displayName,
      };
    });

    base.sort((a, b) => a.label.localeCompare(b.label));

    return [{ value: "all", label: "All employees" }, ...base];
  }, [employees, teamMembers, isManager]);

  useEffect(() => {
    if (selectedExecutive === "all" || employees.length === 0) {
      return;
    }

    const hasExactMatch = employeeOptions.some((option) => option.value === selectedExecutive);
    if (hasExactMatch) {
      return;
    }

    const legacyMatch = employees.find((employee) => {
      const fullName = [employee.firstName, employee.lastName].filter(Boolean).join(" ").trim();
      const displayName = fullName || employee.userName || employee.email || `Employee ${employee.id}`;
      return fullName === selectedExecutive || displayName === selectedExecutive;
    });

    if (legacyMatch) {
      setSelectedExecutive(String(legacyMatch.id));
    } else {
      setSelectedExecutive("all");
    }
  }, [selectedExecutive, employeeOptions, employees]);

  const toggleCardExpansion = (visitId: number) => {
    setExpandedCards(prev => 
      prev.includes(visitId) 
        ? prev.filter(id => id !== visitId)
        : [...prev, visitId]
    );
  };

  const handleViewDetails = (visitId: number) => {
    if (navigatingVisitId !== null || isNavigating) {
      return;
    }
    setNavigatingVisitId(visitId);
    startTransition(() => {
      router.push(`/dashboard/visits/${visitId}`);
    });
  };

  useEffect(() => {
    if (!isNavigating && navigatingVisitId !== null) {
      setNavigatingVisitId(null);
    }
  }, [isNavigating, navigatingVisitId]);

  // Determine user role using corrected flags from teamId fetch
  useEffect(() => {
    const checkUserRole = () => {
      // Use corrected role flags if available (most reliable - based on teamId fetch)
      const roleFlags = getCorrectedRoleFlags(userRole, currentUser, correctedRoleFlags, teamId);

      console.log('Role detection - userRole:', userRole);
      console.log('Role detection - currentUser authorities:', currentUser?.authorities);
      console.log('Role detection - teamId:', teamId);
      console.log('Role detection - correctedRoleFlags:', correctedRoleFlags);
      console.log('Role detection - final isManager:', roleFlags.isManager);
      console.log('Role detection - final isFieldOfficer:', roleFlags.isFieldOfficer);

      setIsManager(roleFlags.isManager);
    };
    checkUserRole();
  }, [userRole, currentUser, teamId, correctedRoleFlags]);

  // Use all team data for managers. Do not widen manager filters to all employees.
  useEffect(() => {
    const loadTeamMembers = async () => {
      if (!isManager || !userData?.employeeId || !token) return;

      try {
        // Correct backend contract (1 call, server-scoped):
        // GET /api/common/employees?active=true&managerId={myId}&page=0&size=500
        const page = await teamsApi.getEmployeesPage(token, {
          active: true,
          managerId: userData.employeeId,
          page: 0,
          size: 500,
        });
        const members = page.content.map(teamEmployeeToUserDto);
        if (members.length > 0) {
          setLocalTeamId(members[0] ? (page.content[0]?.teamId ?? null) : null);
          setManagerTeamIds(page.content[0]?.teamId != null ? [page.content[0].teamId as number] : []);
          setTeamMembers(members);
        } else {
          // Fallback: teams managed by me → per-team members (correct /api/common/teams contract)
          const teams = await teamsApi.getTeamsPage(token, { officeManagerId: userData.employeeId, page: 0, size: 50 });
          const teamIds = teams.content.map((t) => t.id);
          setManagerTeamIds(teamIds);
          setLocalTeamId(teamIds[0] ?? null);
          if (teamIds.length === 0) {
            setTeamMembers([]);
            return;
          }
          const membersPages = await Promise.all(
            teamIds.map((id) => teamsApi.getTeamEmployeesPage(token, id, { page: 0, size: 500 })),
          );
          const seen = new Set<number>();
          const unique = membersPages
            .flatMap((p) => p.content)
            .filter((e) => (seen.has(e.id) ? false : (seen.add(e.id), true)))
            .map(teamEmployeeToUserDto);
          setTeamMembers(unique);
        }
      } catch (err) {
        console.error('Failed to load team members:', err);
        setError('Failed to load team members');
        setLocalTeamId(null);
        setManagerTeamIds([]);
        setTeamMembers([]);
      }
    };

    if (isManager && userData?.employeeId && token) {
      loadTeamMembers();
    } else if (isManager && authTeamId) {
      setLocalTeamId(authTeamId);
      setManagerTeamIds([authTeamId]);
    }
  }, [isManager, userData?.employeeId, authTeamId, token]);

  // Fallback field-officer load only when employeeId-based team data is unavailable.
  useEffect(() => {
    const loadFieldOfficers = async () => {
      if (!isManager || !effectiveTeamId || userData?.employeeId || !token) return;

      try {
        // Correct backend contract: GET /api/common/teams/{id}/employees?active=true&page=0&size=500
        const page = await teamsApi.getTeamEmployeesPage(token, effectiveTeamId, { page: 0, size: 500 });
        setTeamMembers(page.content.map(teamEmployeeToUserDto));
      } catch (err) {
        console.error('Failed to load field officers:', err);
        setError('Failed to load field officers');
        setTeamMembers([]);
      }
    };

    if (isManager && effectiveTeamId && !userData?.employeeId && token) {
      loadFieldOfficers();
    }
  }, [isManager, effectiveTeamId, userData?.employeeId, token]);

  useEffect(() => {
    if (!isStateHydrated) return;
    if (!token) return;
    if (!startDate || !endDate || dateRangeInvalid) return;

    const startStr = formatDate(startDate, 'yyyy-MM-dd');
    const endStr = formatDate(endDate, 'yyyy-MM-dd');

    const run = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const visitType = selectedVisitType !== 'all' ? (selectedVisitType as VisitType) : undefined;
        const assignedEmployeeId = selectedExecutive !== 'all' ? Number(selectedExecutive) : undefined;

        const response = await visitsApi.getCommonVisits(token, {
          page: currentPage,
          size: pageSize,
          visitType,
          from: startStr,
          to: endStr,
          assignedEmployeeId,
        });

        const mapped: Row[] = response.content.map((v: unknown) => {
          const anyV = v as Record<string, unknown>;
          const isNewShape = 'scheduledVisitDate' in anyV || 'visitType' in anyV;
          if (isNewShape) {
            const newV = v as import('@/lib/visits-api').CommonVisitRow;
            const hasCheckin = hasVisitTime(newV.actualCheckinAt);
            const hasCheckout = hasVisitTime(newV.actualCheckoutAt);
            const status: VisitListStatus = hasCheckin && hasCheckout ? 'Completed' : hasCheckin ? 'Ongoing' : 'Assigned';
            const client = resolveVisitClient(newV);
            const cityValue = resolveVisitCity(newV);
            return {
              id: newV.id,
              customerName: client.name,
              clientKind: client.kind,
              executive: newV.assignedEmployeeName || (newV as unknown as { employeeName?: string }).employeeName || '—',
              employeeId: newV.assignedEmployeeId,
              date: newV.scheduledVisitDate || (newV as unknown as { visit_date?: string }).visit_date || '',
              status,
              purpose: newV.purpose ?? undefined,
              // Assigned → no times; Ongoing → start only; Completed → both
              visitStart: status === 'Assigned' ? undefined : (newV.actualCheckinAt ?? newV.scheduledStartTime ?? undefined),
              visitEnd: status === 'Completed' ? (newV.actualCheckoutAt ?? newV.scheduledEndTime ?? undefined) : undefined,
              intent: (newV as unknown as { intent?: number }).intent ?? undefined,
              lastUpdated: (newV as unknown as { updatedAt?: string; updatedTime?: string }).updatedAt ? `${(newV as unknown as { updatedAt?: string }).updatedAt} ${(newV as unknown as { updatedTime?: string }).updatedTime || ''}`.trim() : undefined,
              priority: (newV as unknown as { priority?: string }).priority ?? undefined,
              outcome: newV.outcome ?? undefined,
              feedback: (newV as unknown as { feedback?: string }).feedback ?? undefined,
              city: cityValue === '—' ? undefined : cityValue,
              state: newV.locationState ?? (newV as unknown as { state?: string }).state ?? undefined,
              checkinTime: newV.actualCheckinAt ?? (newV as unknown as { checkinTime?: string }).checkinTime ?? undefined,
              checkoutTime: newV.actualCheckoutAt ?? (newV as unknown as { checkoutTime?: string }).checkoutTime ?? undefined,
            };
          }
          const legacy = v as unknown as { id: number; storeName: string; employeeName: string; employeeId: number; visit_date: string; checkinTime?: string | null; checkoutTime?: string | null; intent?: number; updatedAt?: string; updatedTime?: string; priority?: string; outcome?: string; feedback?: string; city?: string; state?: string; purpose?: string };
          return {
            id: legacy.id,
            customerName: legacy.storeName,
            executive: legacy.employeeName,
            employeeId: legacy.employeeId,
            date: legacy.visit_date,
            status: deriveVisitStatus(legacy as unknown as Pick<import('@/lib/api').VisitDto, 'checkinTime' | 'checkoutTime'>),
            purpose: legacy.purpose ?? undefined,
            visitStart: legacy.checkinTime ?? undefined,
            visitEnd: legacy.checkoutTime ?? undefined,
            intent: legacy.intent ?? undefined,
            lastUpdated: legacy.updatedAt ? `${legacy.updatedAt} ${legacy.updatedTime || ''}` : undefined,
            priority: legacy.priority ?? undefined,
            outcome: legacy.outcome ?? undefined,
            feedback: legacy.feedback ?? undefined,
            city: legacy.city ?? undefined,
            state: legacy.state ?? undefined,
            checkinTime: legacy.checkinTime ?? undefined,
            checkoutTime: legacy.checkoutTime ?? undefined,
          };
        });

        setRows(mapped);
        const resolvedTotalPages = response.totalPages && response.totalPages > 0 ? response.totalPages : 1;
        setTotalPages(resolvedTotalPages);
        setTotalElements(response.totalElements || 0);

        if (currentPage >= resolvedTotalPages) {
          const nextPage = Math.max(resolvedTotalPages - 1, 0);
          if (nextPage !== currentPage) {
            setCurrentPage(nextPage);
          }
        }
      } catch (err) {
        setError((err as Error)?.message || 'Failed to load visits');
      } finally {
        setIsLoading(false);
      }
    };
    run();
  }, [isStateHydrated, token, startDate, endDate, dateRangeInvalid, selectedVisitType, selectedExecutive, currentPage, pageSize]);

  // Reset to first page when filters change — server-side filters use new endpoint
  useEffect(() => {
    if (!isStateHydrated) return;
    if (!filterInitialisedRef.current) {
      filterInitialisedRef.current = true;
      return;
    }
    setCurrentPage(0);
  }, [isStateHydrated, startDate, endDate, selectedVisitType, selectedExecutive, customerName]);

  const filteredVisits = rows.filter(visit => {
    if (customerName.trim() !== '' && !visit.customerName.toLowerCase().includes(customerName.trim().toLowerCase())) {
      return false;
    }
    return true;
  });


  const csvEscape = (val: string | number | null | undefined): string => {
    if (val === null || val === undefined) return '';
    let s = String(val);
    if (s.includes('"')) s = s.replace(/"/g, '""');
    if (/[",\n]/.test(s)) s = `"${s}"`;
    return s;
  };

  const buildCsvAndDownload = (rowsForCsv: Row[]) => {
    const headers = [
      'Customer Name',
      'Client Type',
      'City',
      'Executive',
      'Date',
      'Status',
      'Purpose',
      'Visit Start',
      'Visit End',
      'State',
    ];

    const lines = [headers.map(csvEscape).join(',')];

    for (const r of rowsForCsv) {
      const status = r.status ?? 'Assigned';
      const line = [
        r.customerName,
        clientKindLabel(r.clientKind) ?? '',
        r.city ?? '',
        resolveExecutiveName(r.executive, r.employeeId),
        r.date,
        status,
        r.purpose ?? '',
        r.visitStart ?? '',
        r.visitEnd ?? '',
        r.state ?? '',
      ].map(csvEscape).join(',');
      lines.push(line);
    }

    const csv = lines.join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'visits.csv';
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleExport = async () => {
    if (!startDate || !endDate || dateRangeInvalid || !token) return;
    try {
      setIsExporting(true);
      const startStr = formatDate(startDate, 'yyyy-MM-dd');
      const endStr = formatDate(endDate, 'yyyy-MM-dd');
      const visitType = selectedVisitType !== 'all' ? (selectedVisitType as VisitType) : undefined;
      const assignedEmployeeId = selectedExecutive !== 'all' ? Number(selectedExecutive) : undefined;

      // Use new combined endpoint for export — paginated, not fetching every page for table render
      const size = 200;
      const first = await visitsApi.getCommonVisits(token, { page: 0, size, visitType, from: startStr, to: endStr, assignedEmployeeId });
      let allRows: Row[] = first.content.map((v: unknown) => {
        const anyV = v as Record<string, unknown>;
        const isNew = 'scheduledVisitDate' in anyV;
        if (isNew) {
          const nv = v as import('@/lib/visits-api').CommonVisitRow;
          const hasCheckin = hasVisitTime(nv.actualCheckinAt);
          const hasCheckout = hasVisitTime(nv.actualCheckoutAt);
          const status: VisitListStatus = hasCheckin && hasCheckout ? 'Completed' : hasCheckin ? 'Ongoing' : 'Assigned';
          const client = resolveVisitClient(nv);
          const exportCity = resolveVisitCity(nv);
          return {
            id: nv.id,
            customerName: client.name,
            clientKind: client.kind,
            executive: nv.assignedEmployeeName || '—',
            employeeId: nv.assignedEmployeeId,
            date: nv.scheduledVisitDate,
            status,
            purpose: nv.purpose ?? undefined,
            visitStart: status === 'Assigned' ? undefined : (nv.actualCheckinAt ?? nv.scheduledStartTime ?? undefined),
            visitEnd: status === 'Completed' ? (nv.actualCheckoutAt ?? nv.scheduledEndTime ?? undefined) : undefined,
            intent: (nv as unknown as { intent?: number }).intent,
            lastUpdated: undefined,
            priority: undefined,
            outcome: nv.outcome ?? undefined,
            feedback: undefined,
            city: exportCity === '—' ? undefined : exportCity,
            state: nv.locationState ?? undefined,
            checkinTime: nv.actualCheckinAt ?? undefined,
            checkoutTime: nv.actualCheckoutAt ?? undefined,
          };
        }
        const legacy = v as unknown as { id: number; storeName: string; employeeName: string; employeeId: number; visit_date: string; checkinTime?: string | null; checkoutTime?: string | null; intent?: number; updatedAt?: string; updatedTime?: string; purpose?: string; priority?: string; outcome?: string; feedback?: string; city?: string; state?: string };
        return {
          id: legacy.id,
          customerName: legacy.storeName,
          executive: legacy.employeeName,
          employeeId: legacy.employeeId,
          date: legacy.visit_date,
          status: deriveVisitStatus(legacy as unknown as Pick<import('@/lib/api').VisitDto, 'checkinTime' | 'checkoutTime'>),
          purpose: legacy.purpose ?? undefined,
          visitStart: legacy.checkinTime ?? undefined,
          visitEnd: legacy.checkoutTime ?? undefined,
          intent: legacy.intent ?? undefined,
          lastUpdated: legacy.updatedAt ? `${legacy.updatedAt} ${legacy.updatedTime || ''}` : undefined,
          priority: legacy.priority ?? undefined,
          outcome: legacy.outcome ?? undefined,
          feedback: legacy.feedback ?? undefined,
          city: legacy.city ?? undefined,
          state: legacy.state ?? undefined,
          checkinTime: legacy.checkinTime ?? undefined,
          checkoutTime: legacy.checkoutTime ?? undefined,
        };
      });

      for (let page = 1; page < first.totalPages; page++) {
        const res = await visitsApi.getCommonVisits(token, { page, size, visitType, from: startStr, to: endStr, assignedEmployeeId });
        const mapped = res.content.map((v: unknown) => {
          const anyV = v as Record<string, unknown>;
          const isNew = 'scheduledVisitDate' in anyV;
          if (isNew) {
            const nv = v as import('@/lib/visits-api').CommonVisitRow;
            const hasCheckin = hasVisitTime(nv.actualCheckinAt);
            const hasCheckout = hasVisitTime(nv.actualCheckoutAt);
            const status: VisitListStatus = hasCheckin && hasCheckout ? 'Completed' : hasCheckin ? 'Ongoing' : 'Assigned';
            const client = resolveVisitClient(nv);
            const exportCity2 = resolveVisitCity(nv);
            return {
              id: nv.id,
              customerName: client.name,
              clientKind: client.kind,
              executive: nv.assignedEmployeeName || '—',
              employeeId: nv.assignedEmployeeId,
              date: nv.scheduledVisitDate,
              status,
              purpose: nv.purpose ?? undefined,
              visitStart: nv.actualCheckinAt ?? undefined,
              visitEnd: nv.actualCheckoutAt ?? undefined,
              intent: undefined,
              lastUpdated: undefined,
              priority: undefined,
              outcome: nv.outcome ?? undefined,
              feedback: undefined,
              city: exportCity2 === '—' ? undefined : exportCity2,
              state: nv.locationState ?? undefined,
              checkinTime: nv.actualCheckinAt ?? undefined,
              checkoutTime: nv.actualCheckoutAt ?? undefined,
            };
          }
          const legacy = v as unknown as { id: number; storeName: string; employeeName: string; employeeId: number; visit_date: string; checkinTime?: string | null; checkoutTime?: string | null; intent?: number; updatedAt?: string; updatedTime?: string; purpose?: string };
          return {
            id: legacy.id,
            customerName: legacy.storeName,
            executive: legacy.employeeName,
            employeeId: legacy.employeeId,
            date: legacy.visit_date,
            status: deriveVisitStatus(legacy as unknown as Pick<import('@/lib/api').VisitDto, 'checkinTime' | 'checkoutTime'>),
            purpose: legacy.purpose ?? undefined,
            visitStart: legacy.checkinTime ?? undefined,
            visitEnd: legacy.checkoutTime ?? undefined,
            intent: legacy.intent,
            lastUpdated: undefined,
            priority: undefined,
            outcome: undefined,
            feedback: undefined,
            city: undefined,
            state: undefined,
            checkinTime: legacy.checkinTime ?? undefined,
            checkoutTime: legacy.checkoutTime ?? undefined,
          };
        });
        allRows = allRows.concat(mapped);
      }

      // Client-side search filter for customer name (server does not support storeName)
      const rowsForCsv = allRows.filter((visit) => {
        if (customerName.trim() !== '' && !visit.customerName.toLowerCase().includes(customerName.trim().toLowerCase())) return false;
        return true;
      });

      buildCsvAndDownload(rowsForCsv);
    } catch {
      alert('Failed to export CSV');
    } finally {
      setIsExporting(false);
    }
  };

  const employeeNameById = useMemo(() => {
    const map = new Map<number, string>();
    for (const employee of [...employees, ...teamMembers]) {
      if (!map.has(employee.id)) {
        map.set(employee.id, buildEmployeeFilterName(employee));
      }
    }
    return map;
  }, [employees, teamMembers]);

  const resolveExecutiveName = (executive: string, employeeId?: number) => {
    if (executive && executive !== '—') return executive;
    if (employeeId != null && employeeNameById.has(employeeId)) {
      return employeeNameById.get(employeeId) as string;
    }
    return executive;
  };

  const executiveLabel = (visit: Pick<Row, 'executive' | 'employeeId'>) =>
    resolveExecutiveName(visit.executive, visit.employeeId);

  const clientKindLabel = (kind?: VisitClientKind) => {
    if (kind === 'RETAIL') return 'Retail';
    if (kind === 'INSTITUTION') return 'Institution';
    if (kind === 'PROJECT') return 'Project';
    return null;
  };

  const statusClassName = (status?: string) => {
    if (status === "Completed") return "bg-emerald-50 text-emerald-700 ring-emerald-600/15";
    if (status === "Ongoing") return "bg-amber-50 text-amber-700 ring-amber-600/15";
    return "bg-blue-50 text-blue-700 ring-blue-600/15";
  };

  return (
    <div className="mx-auto w-full max-w-none py-4">
      {areFiltersVisible ? (
        <>
          <div className="mb-3 flex flex-col gap-2 lg:flex-row lg:items-center">
            <div className="min-w-0 flex-1">
              <Label className="sr-only">Start Date</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="h-8 w-full justify-start bg-background px-2.5 text-xs font-normal shadow-none">
                    <CalendarIcon className="mr-2 h-3.5 w-3.5 text-muted-foreground" />
                    {startDate ? format(startDate, "MMM dd, yyyy") : "Start date"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <SpacedCalendar initialFocus mode="single" defaultMonth={startDate} selected={startDate} onSelect={setStartDate} />
                </PopoverContent>
              </Popover>
            </div>

            <div className="min-w-0 flex-1">
              <Label className="sr-only">End Date</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="h-8 w-full justify-start bg-background px-2.5 text-xs font-normal shadow-none">
                    <CalendarIcon className="mr-2 h-3.5 w-3.5 text-muted-foreground" />
                    {endDate ? format(endDate, "MMM dd, yyyy") : "End date"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <SpacedCalendar initialFocus mode="single" defaultMonth={endDate} selected={endDate} onSelect={setEndDate} />
                </PopoverContent>
              </Popover>
            </div>

            <div className="min-w-0 flex-1">
              <Label className="sr-only">Visit Type</Label>
              <Select value={selectedVisitType} onValueChange={setSelectedVisitType}>
                <SelectTrigger className="h-8 w-full bg-background text-xs shadow-none"><SelectValue placeholder="Visit Type" /></SelectTrigger>
                <SelectContent>
                  {VISIT_TYPE_OPTIONS.map((opt) => <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            <div className="min-w-0 flex-1">
              <Label htmlFor="visit-customer-filter" className="sr-only">Customer Name</Label>
              <Input
                id="visit-customer-filter"
                type="search"
                autoComplete="off"
                placeholder="Customer name"
                value={customerName}
                onChange={(event) => setCustomerName(event.target.value)}
                className="h-8 bg-background text-xs shadow-none"
              />
            </div>

            <div className="min-w-0 flex-1">
              <Label className="sr-only">Employee</Label>
              <SearchableSelect
                options={employeeOptions}
                value={selectedExecutive}
                onSelect={(option) => setSelectedExecutive(!option || option.value === "all" ? "all" : option.value)}
                placeholder="All employees"
                loading={isLoadingEmployees}
                triggerClassName="h-8 w-full justify-between bg-background text-xs shadow-none"
                contentClassName="w-[var(--radix-popover-trigger-width)]"
                searchPlaceholder="Search employees..."
              />
            </div>

            <div className="flex shrink-0 items-center gap-2">
              <Button
                variant="outline"
                size="icon"
                className="h-8 w-8 shadow-none"
                onClick={() => setAreFiltersVisible((visible) => !visible)}
                aria-label="Hide filters"
                title="Hide filters"
              >
                <Filter className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                size="icon"
                className="h-8 w-8 shadow-none"
                onClick={handleExport}
                disabled={isExporting || dateRangeInvalid || !startDate || !endDate}
                aria-label="Export visits"
                title="Export visits"
              >
                {isExporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <DownloadIcon className="h-4 w-4" />}
              </Button>
            </div>
          </div>
          <hr className="mb-4 border-border" />
        </>
      ) : (
        <div className="mb-4 flex items-center justify-end gap-2">
          <Button
            variant="outline"
            size="icon"
            className="h-8 w-8 shadow-none"
            onClick={() => setAreFiltersVisible(true)}
            aria-label="Show filters"
            title="Show filters"
          >
            <Filter className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            size="icon"
            className="h-8 w-8 shadow-none"
            onClick={handleExport}
            disabled={isExporting || dateRangeInvalid || !startDate || !endDate}
            aria-label="Export visits"
            title="Export visits"
          >
            {isExporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <DownloadIcon className="h-4 w-4" />}
          </Button>
        </div>
      )}

      {error && <div className="mb-3 rounded-md border border-red-200 bg-red-50 p-2.5 text-sm text-red-700">{error}</div>}
      <DateRangeError fromDate={startDate} toDate={endDate} className="mb-3" />

      <div className="hidden min-w-0 md:block">
        <Table className="table-fixed text-xs font-poppins">
          <colgroup>
            <col className="w-[15%]" /><col className="w-[9%]" /><col className="w-[12%]" />
            <col className="w-[12%]" /><col className="w-[9%]" /><col className="w-[8%]" />
            <col className="w-[11%]" /><col className="w-[7%]" /><col className="w-[7%]" /><col className="w-[10%]" />
          </colgroup>
          <TableHeader>
            <TableRow>
              {['Customer Name', 'Type', 'City', 'Executive', 'Date', 'Status', 'Purpose', 'Visit Start', 'Visit End', 'Actions'].map((heading) => (
                <TableHead key={heading} className="overflow-hidden text-ellipsis whitespace-nowrap" title={heading}>{heading}</TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {!startDate || !endDate ? (
              <TableRow><TableCell colSpan={10} className="h-24 text-center text-muted-foreground">Select both dates to view visits</TableCell></TableRow>
            ) : isLoading ? (
              Array.from({ length: 3 }, (_, index) => (
                <TableRow key={`visit-skeleton-${index}`}>{Array.from({ length: 10 }, (_, cell) => <TableCell key={cell}><Skeleton className="h-4 w-full max-w-24" /></TableCell>)}</TableRow>
              ))
            ) : filteredVisits.length > 0 ? (
              filteredVisits.map((visit) => (
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
                  <TableCell><Ellipsis value={executiveLabel(visit)} /></TableCell>
                  <TableCell><Ellipsis value={formatDateToUserFriendly(visit.date)} /></TableCell>
                  <TableCell>
                    <span className={`inline-flex max-w-full truncate rounded-full px-2 py-0.5 text-[11px] font-medium ring-1 ring-inset ${statusClassName(visit.status)}`}>
                      {visit.status ?? '—'}
                    </span>
                  </TableCell>
                  <TableCell><Ellipsis value={visit.purpose} /></TableCell>
                  <TableCell><Ellipsis value={visit.visitStart ? formatTimeTo12Hour(visit.visitStart) : '—'} /></TableCell>
                  <TableCell><Ellipsis value={visit.visitEnd ? formatTimeTo12Hour(visit.visitEnd) : '—'} /></TableCell>
                  <TableCell>
                    <Button variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={() => handleViewDetails(visit.id)} disabled={navigatingVisitId !== null}>
                      {navigatingVisitId === visit.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "View"}
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow><TableCell colSpan={10} className="h-24 text-center text-muted-foreground">No visits match the selected filters</TableCell></TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      <div className="space-y-3 md:hidden">
        {!startDate || !endDate ? (
          <div className="py-10 text-center text-sm text-muted-foreground">Select both dates to view visits</div>
        ) : isLoading ? (
          Array.from({ length: 3 }, (_, index) => <Skeleton key={index} className="h-36 w-full rounded-xl" />)
        ) : filteredVisits.length > 0 ? (
          filteredVisits.map((visit) => (
            <Card key={visit.id} className="overflow-hidden shadow-none">
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold" title={visit.customerName}>{visit.customerName}</p>
                    {clientKindLabel(visit.clientKind) && (
                      <p className="mt-0.5 text-[11px] text-muted-foreground">{clientKindLabel(visit.clientKind)}</p>
                    )}
                    <p className="mt-0.5 text-xs text-muted-foreground">{formatDateToUserFriendly(visit.date)}</p>
                  </div>
                  <span className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium ring-1 ring-inset ${statusClassName(visit.status)}`}>{visit.status ?? '—'}</span>
                </div>
                <div className="mt-3 flex items-center justify-between gap-2 text-xs">
                  <div className="flex min-w-0 items-center gap-1.5"><User className="h-3.5 w-3.5 shrink-0 text-muted-foreground" /><Ellipsis value={executiveLabel(visit)} /></div>
                  <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0" onClick={() => toggleCardExpansion(visit.id)} aria-label="Toggle visit details">
                    {expandedCards.includes(visit.id) ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                  </Button>
                </div>
                {expandedCards.includes(visit.id) && (
                  <div className="mt-3 grid grid-cols-2 gap-2 border-t pt-3 text-xs">
                    <div><span className="text-muted-foreground">Purpose</span><p className="truncate font-medium">{visit.purpose ?? '—'}</p></div>
                    <div><span className="text-muted-foreground">City</span><p className="truncate font-medium">{visit.city ?? '—'}</p></div>
                    <div><span className="text-muted-foreground">Start</span><p className="font-medium">{visit.visitStart ? formatTimeTo12Hour(visit.visitStart) : '—'}</p></div>
                    <div><span className="text-muted-foreground">End</span><p className="font-medium">{visit.visitEnd ? formatTimeTo12Hour(visit.visitEnd) : '—'}</p></div>
                  </div>
                )}
                <div className="mt-3 flex justify-end">
                  <Button variant="outline" size="sm" className="h-7 px-3 text-xs" onClick={() => handleViewDetails(visit.id)} disabled={navigatingVisitId !== null}>
                    {navigatingVisitId === visit.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "View details"}
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))
        ) : (
          <div className="py-10 text-center text-sm text-muted-foreground">No visits match the selected filters</div>
        )}
      </div>

      {startDate && endDate && (
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-xs">
            <Label htmlFor="pageSize" className="text-xs">Rows per page:</Label>
            <Select value={pageSize.toString()} onValueChange={(value) => setPageSize(parseInt(value))}>
              <SelectTrigger id="pageSize" className="h-8 w-20 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>{[10, 25, 50, 100].map((size) => <SelectItem key={size} value={String(size)}>{size}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" className="h-8" onClick={() => setCurrentPage(Math.max(0, currentPage - 1))} disabled={currentPage === 0}>
              <ChevronLeft className="h-4 w-4" /><span className="hidden sm:inline">Previous</span>
            </Button>
            <span className="text-xs text-muted-foreground">Page {currentPage + 1} of {Math.max(totalPages, 1)}</span>
            <Button variant="outline" size="sm" className="h-8" onClick={() => setCurrentPage(Math.min(totalPages - 1, currentPage + 1))} disabled={currentPage >= totalPages - 1}>
              <span className="hidden sm:inline">Next</span><ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
