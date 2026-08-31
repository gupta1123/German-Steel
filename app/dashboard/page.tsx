"use client";

import { useState, useMemo, useCallback, useEffect, useRef } from "react";
import {
  format,
  subDays,
  startOfWeek,
  endOfWeek,
  startOfMonth,
  endOfMonth,
} from "date-fns";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { MapPin, Users, Calendar, Building, Loader2, CalendarIcon } from "lucide-react";
import OverviewSection from "@/components/dashboard/OverviewSection";
import StateSection from "@/components/dashboard/StateSection";
import EmployeeDetailSection from "@/components/dashboard/EmployeeDetailSection";
import { useDashboardHeader } from "@/components/dashboard-header-context";
import { API, type EmployeeUserDto, type AttendanceLogItem, type TeamDataDto, type CurrentUserDto } from "@/lib/api";
import { useAuth } from "@/components/auth-provider";
import { Skeleton } from "@/components/ui/skeleton";
import DailyPricingModal from "@/components/DailyPricingModal";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { SpacedCalendar } from "@/components/ui/spaced-calendar";
import { isManagerRoleValue, getCorrectedRoleFlags } from "@/lib/auth";
import { getUniqueFieldOfficersFromTeams } from "@/lib/team-access";
import { DateRangeError, isDateRangeInvalid } from "@/components/date-range-error";
import { isAdminEmployee, isAdminEmployeeRole, getEmployeeRoleLabel } from "@/lib/employee-role";
import { latestLocationMarkers, journeyLocationMarkers, validCoordinates, type LocationMarker } from "@/lib/employee-locations";


const DEFAULT_MAP_CENTER: [number, number] = [20.5937, 78.9629];
const DEFAULT_MAP_ZOOM = 5;
const DATE_FILTER_STATE_KEY = "dashboard.dateFilter.v1";

const normalizeCityName = (city?: string | null): string => {
  if (!city) return "";
  return city
    .trim()
    .toLowerCase()
    .replace(/\b\w/g, (char) => char.toUpperCase());
};

const colorPalette = [
  "bg-blue-500",
  "bg-green-500",
  "bg-yellow-500",
  "bg-red-500",
  "bg-purple-500",
  "bg-pink-500",
  "bg-indigo-500",
  "bg-teal-500",
];

// Data fetched from APIs; no hardcoded mocks

type Employee = {
  id: number;
  name: string;
  position: string;
  avatar: string;
  lastUpdated: string;
  status: string;
  location: string;
};
type ExtendedEmployee = Employee & {
  listId: string;
  visits: number;
  formattedLastUpdated: string;
  locationTimestamp?: number | null;
  hasLocation?: boolean;
};

type MapMarker = LocationMarker;

type StateItem = { id: number; name: string; employeeCount: number; color: string };
type SelectedState = StateItem | null;
type ViewType = "dashboard" | "state" | "employeeDetail";
type ViewHistoryState = {
  view: ViewType;
  selectedState?: SelectedState;
  selectedEmployee?: Employee | null;
};

type DateRangeValue = {
  start: Date;
  end: Date;
};

const dateRanges = [
  { value: "today", label: "Today" },
  { value: "yesterday", label: "Yesterday" },
  { value: "thisWeek", label: "This Week" },
  { value: "thisMonth", label: "This Month" },
  { value: "custom", label: "Custom Range" },
] as const;
type DateRangeOption = typeof dateRanges[number]["value"];

const StateSectionSkeleton = () => (
  <div className="space-y-6">
    <Skeleton className="h-8 w-56" />
    <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: 6 }).map((_, idx) => (
        <Card key={idx} className="border border-border/60 shadow-sm bg-card">
          <CardHeader className="space-y-3 pb-2">
            <Skeleton className="h-4 w-2/3" />
            <Skeleton className="h-3 w-1/2" />
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-3">
              <Skeleton className="h-12 w-12 rounded-full" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-3 w-1/2" />
              </div>
            </div>
            <div className="space-y-2">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-2/3" />
            </div>
            <div className="flex items-center justify-between">
              <Skeleton className="h-4 w-1/3" />
              <Skeleton className="h-4 w-1/4" />
            </div>
            <Skeleton className="h-10 w-full" />
          </CardContent>
        </Card>
      ))}
    </div>
  </div>
);

export default function DashboardPage() {
  const { userRole, userData, currentUser, token, teamId, correctedRoleFlags } = useAuth();
  const [selectedDateRange, setSelectedDateRange] = useState<DateRangeOption>("today");
  const [customStartDate, setCustomStartDate] = useState<Date | undefined>(undefined);
  const [customEndDate, setCustomEndDate] = useState<Date | undefined>(undefined);
  const customDateRangeInvalid = isDateRangeInvalid(customStartDate, customEndDate);
  const [showCustomDatePicker, setShowCustomDatePicker] = useState(false);
  const [isStartDatePopoverOpen, setIsStartDatePopoverOpen] = useState(false);
  const [isEndDatePopoverOpen, setIsEndDatePopoverOpen] = useState(false);
  const [view, setView] = useState<ViewType>("dashboard");
  const [selectedState, setSelectedState] = useState<SelectedState>(null);
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null);
  const [mapCenter, setMapCenter] = useState<[number, number]>(DEFAULT_MAP_CENTER);
  const [mapZoom, setMapZoom] = useState(DEFAULT_MAP_ZOOM);
  const [highlightedEmployee, setHighlightedEmployee] =
    useState<ExtendedEmployee | null>(null);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [teamMembers, setTeamMembers] = useState<Employee[]>([]);
  const [states, setStates] = useState<StateItem[]>([]);
  const [kpis, setKpis] = useState({ totalVisits: 0, activeEmployees: 0, liveLocations: 0 });
  const [countsByEmployee, setCountsByEmployee] = useState<Map<number, number>>(new Map());
  const [markers, setMarkers] = useState<MapMarker[]>([]);
  const [locationRefresh, setLocationRefresh] = useState(0);
  const [locationsLoading, setLocationsLoading] = useState(true);
  const [locationsError, setLocationsError] = useState<string | null>(null);
  const [locationsSyncedAt, setLocationsSyncedAt] = useState<number | null>(null);
  const [journeyLoading, setJourneyLoading] = useState(false);
  const [journeyError, setJourneyError] = useState<string | null>(null);
  const [journeySummary, setJourneySummary] = useState({ total: 0, unmapped: 0, hasHome: false });
  const [journeyRetry, setJourneyRetry] = useState(0);
  const [mapResetKey, setMapResetKey] = useState(0);
  const journeyRequest = useRef(0);
  const [selectedEmployeeMarkers, setSelectedEmployeeMarkers] = useState<MapMarker[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isManager, setIsManager] = useState(false);
  const [isRoleDetermined, setIsRoleDetermined] = useState(false);
  const [currentUserRole, setCurrentUserRole] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isDateRangeLoading, setIsDateRangeLoading] = useState(false);
  const [showVisitLocations, setShowVisitLocations] = useState(false);
  const [isPricingModalOpen, setIsPricingModalOpen] = useState(false);
  const [hasCheckedPricing, setHasCheckedPricing] = useState(false);
  const [isPricingDismissed, setIsPricingDismissed] = useState(false);
  const [hasHydratedViewState, setHasHydratedViewState] = useState(false);
  const VIEW_STATE_KEY = 'dashboard.view.state.v1';
  const PRICING_MODAL_DISMISS_KEY = 'pricingModalDismissed';
  const [hasHydratedDateFilter, setHasHydratedDateFilter] = useState(false);
  const [isStateSectionLoading, setIsStateSectionLoading] = useState(false);
  const stateSkeletonTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const prevViewRef = useRef<"dashboard" | "state" | "employeeDetail">(view);
  const isHandlingPopRef = useRef(false);
  const pushHistoryState = useCallback((state: ViewHistoryState) => {
    if (typeof window === "undefined" || isHandlingPopRef.current) return;
    try {
      window.history.pushState(state, "");
    } catch {}
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const handlePopState = (event: PopStateEvent) => {
      const historyState = (event.state as ViewHistoryState) ?? { view: "dashboard" };
      isHandlingPopRef.current = true;
      try {
        if (historyState.view === "state") {
          setView("state");
          setSelectedState(historyState.selectedState ?? null);
          setSelectedEmployee(null);
          setIsStateSectionLoading(true);
        } else if (historyState.view === "employeeDetail") {
          setView("employeeDetail");
          if (historyState.selectedState) {
            setSelectedState(historyState.selectedState);
          }
          setSelectedEmployee(historyState.selectedEmployee ?? null);
        } else {
          setView("dashboard");
          setSelectedState(null);
          setSelectedEmployee(null);
          setHighlightedEmployee(null);
          setSelectedEmployeeMarkers([]);
          setShowVisitLocations(false);
          setMapCenter(DEFAULT_MAP_CENTER);
          setMapZoom(DEFAULT_MAP_ZOOM);
        }
      } finally {
        isHandlingPopRef.current = false;
      }
    };

    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);

  // Hydrate date filters if user navigates away (e.g. visit detail) and comes back
  useEffect(() => {
    if (typeof window === "undefined") {
      setHasHydratedDateFilter(true);
      return;
    }
    try {
      const raw = sessionStorage.getItem(DATE_FILTER_STATE_KEY);
      if (raw) {
        const saved = JSON.parse(raw) as {
          selectedDateRange?: string;
          customStartDate?: string | null;
          customEndDate?: string | null;
        };
        const isValidRange = saved?.selectedDateRange && dateRanges.some((range) => range.value === saved.selectedDateRange);
        if (isValidRange && typeof saved.selectedDateRange === "string") {
          const persistedRange = saved.selectedDateRange as DateRangeOption;
          setSelectedDateRange(persistedRange);
          setShowCustomDatePicker(persistedRange === "custom");
        }
        if (saved?.customStartDate) {
          setCustomStartDate(new Date(saved.customStartDate));
        }
        if (saved?.customEndDate) {
          setCustomEndDate(new Date(saved.customEndDate));
        }
      }
    } catch (error) {
      console.error("Failed to hydrate dashboard date filters:", error);
    } finally {
      setHasHydratedDateFilter(true);
    }
  }, []);

  useEffect(() => {
    if (typeof window === "undefined" || !hasHydratedDateFilter) return;
    try {
      sessionStorage.setItem(
        DATE_FILTER_STATE_KEY,
        JSON.stringify({
          selectedDateRange,
          customStartDate: customStartDate?.toISOString() ?? null,
          customEndDate: customEndDate?.toISOString() ?? null,
        })
      );
    } catch (error) {
      console.error("Failed to persist dashboard date filters:", error);
    }
  }, [selectedDateRange, customStartDate, customEndDate, hasHydratedDateFilter]);

  useEffect(() => {
    if (typeof window === 'undefined' || hasHydratedViewState) return;

    let initialHistoryState: ViewHistoryState = {
      view: "dashboard",
      selectedState: null,
      selectedEmployee: null,
    };

    try {
      const raw = sessionStorage.getItem(VIEW_STATE_KEY);
      if (raw) {
        const saved = JSON.parse(raw) as ViewHistoryState;
        if (saved?.selectedState) {
          setSelectedState(saved.selectedState);
        }
        if (saved?.view === "employeeDetail" && saved?.selectedEmployee) {
          setSelectedEmployee(saved.selectedEmployee);
          setView("employeeDetail");
        } else if (saved?.view === "state" && saved?.selectedState) {
          setView("state");
        }
        initialHistoryState = {
          view: saved?.view ?? "dashboard",
          selectedState: saved?.selectedState ?? null,
          selectedEmployee: saved?.selectedEmployee ?? null,
        };
      }
    } catch {}

    try {
      window.history.replaceState(initialHistoryState, "");
    } catch {}

    setHasHydratedViewState(true);
  }, [VIEW_STATE_KEY, hasHydratedViewState]);

  // Determine role using corrected flags from auth context (preferred method)
  useEffect(() => {
    // Use corrected role flags if available (most reliable - based on teamId fetch)
    const roleFlags = getCorrectedRoleFlags(userRole, currentUser, correctedRoleFlags, teamId);
    
    console.log('Dashboard - Role detection - userRole:', userRole);
    console.log('Dashboard - Role detection - teamId:', teamId);
    console.log('Dashboard - Role detection - correctedRoleFlags:', correctedRoleFlags);
    console.log('Dashboard - Role detection - final isManager:', roleFlags.isManager);
    console.log('Dashboard - Role detection - final isFieldOfficer:', roleFlags.isFieldOfficer);
    console.log('Dashboard - Role detection - final isAdmin:', roleFlags.isAdmin);

    setIsManager(roleFlags.isManager);
    setCurrentUserRole(userRole);
    setIsRoleDetermined(true);
  }, [userRole, currentUser, teamId, correctedRoleFlags]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const dismissed = sessionStorage.getItem(PRICING_MODAL_DISMISS_KEY) === 'true';
    setIsPricingDismissed(dismissed);
  }, []);

  const handlePricingModalDismiss = useCallback(() => {
    setIsPricingModalOpen(false);
    if (!isPricingDismissed) {
      setIsPricingDismissed(true);
      if (typeof window !== 'undefined') {
        sessionStorage.setItem(PRICING_MODAL_DISMISS_KEY, 'true');
      }
    }
  }, [isPricingDismissed]);

  useEffect(() => {
    console.log('Pricing check useEffect triggered:', {
      token: token ? 'present' : 'missing',
      isPricingDismissed,
      hasCheckedPricing,
      isRoleDetermined,
      currentUserRole
    });
    
    if (!token || isPricingDismissed || hasCheckedPricing || !isRoleDetermined) return;

    const normalizedRole = (currentUserRole ?? '').toUpperCase();
    const isAdmin = normalizedRole.includes('ADMIN');
    console.log('User role check:', { normalizedRole, isAdmin });
    
    if (!isAdmin) {
      console.log('User is not admin, skipping pricing check');
      setHasCheckedPricing(true);
      return;
    }

    const fetchPricing = async () => {
      try {
        const today = new Date().toISOString().split('T')[0];
        console.log('Checking pricing for today:', today);
        const response = await fetch(`http://ec2-18-211-58-135.compute-1.amazonaws.com:8081/brand/getByDateRange?start=${today}&end=${today}`, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
        });

        if (!response.ok) {
          console.log('Pricing API response not ok:', response.status, response.statusText);
          setHasCheckedPricing(true);
          return;
        }

        const data: Array<Record<string, unknown>> = await response.json();
        console.log('Pricing API response data:', data);
        
        const hasGermanSteels = data.some(
          (item) => typeof item.brandName === 'string' && item.brandName.toLowerCase().replace(/\s+/g, '') === 'germansteels'
        );
        
        console.log('Has German Steels pricing:', hasGermanSteels);

        if (!hasGermanSteels) {
          console.log('No German Steels pricing found, showing modal');
          setIsPricingModalOpen(true);
        } else {
          console.log('German Steels pricing found, not showing modal');
        }

        setHasCheckedPricing(true);
      } catch (err) {
        console.error('Dashboard - Error checking German Steels pricing:', err);
        setHasCheckedPricing(true);
      }
    };

    void fetchPricing();
  }, [token, currentUserRole, isPricingDismissed, hasCheckedPricing, isRoleDetermined]);

  // Persist view chain for back navigation (dashboard -> state -> employeeDetail)
  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      sessionStorage.setItem(
        VIEW_STATE_KEY,
        JSON.stringify({ view, selectedState, selectedEmployee })
      );
    } catch {}
  }, [view, selectedState, selectedEmployee]);

  // Load all scoped team members for managers. Never fall back to all employees for manager access.
  useEffect(() => {
    const loadTeamMembers = async () => {
      if (!isManager) return;

      if (userData?.employeeId) {
        try {
          console.log('Loading team members using employeeId:', userData.employeeId);
          const teamData: TeamDataDto[] = await API.getTeamByEmployee(userData.employeeId);
          const teamMemberIds = new Set(getUniqueFieldOfficersFromTeams(teamData).map((fo) => fo.id));
          const filteredEmployees = employees.filter((emp) => teamMemberIds.has(emp.id));
          setTeamMembers(filteredEmployees);
          console.log('Team members loaded:', filteredEmployees.length);
        } catch (err) {
          console.error('Failed to load team members:', err);
          setError('Failed to load team members');
          setTeamMembers([]);
        }
      } else if (teamId) {
        try {
          console.log('Loading team members using teamId from auth context:', teamId);
          const teamData: TeamDataDto = await API.getTeamById(teamId);
          const teamMemberIds = new Set((teamData.fieldOfficers ?? []).map((fo) => fo.id));
          const filteredEmployees = employees.filter((emp) => teamMemberIds.has(emp.id));
          setTeamMembers(filteredEmployees);
          console.log('Team members loaded:', filteredEmployees.length);
        } catch (err) {
          console.error('Failed to load team members using teamId:', err);
          setError('Failed to load team members');
          setTeamMembers([]);
        }
      } else {
        setTeamMembers([]);
      }
    };
    
    if (isManager && employees.length > 0) {
      loadTeamMembers();
    }
  }, [isManager, userData?.employeeId, employees, teamId]);

  // Load employees based on user role
  useEffect(() => {
    const loadEmployees = async () => {
      if (!isRoleDetermined) return;
      
      try {
        setIsLoading(true);
        const data: EmployeeUserDto[] = await API.getAllEmployees();
        const mapped: Employee[] = (data || []).filter(e => !isAdminEmployee(e)).map((e) => ({
          id: e.id,
          name: [e.firstName, e.lastName].filter(Boolean).join(' ') || String(e.id),
          position: e.role || 'Employee',
          avatar: "/placeholder.svg?height=40&width=40",
          lastUpdated: new Date().toISOString(),
          status: 'active',
          location: [normalizeCityName(e.city), e.state].filter(Boolean).join(', '),
        }));
        setEmployees(mapped);
      } catch (err) {
        setError((err as Error)?.message || 'Failed to load employees');
      } finally {
        setIsLoading(false);
      }
    };
    loadEmployees();
  }, [isRoleDetermined]);

  // Get employees based on user role
  const displayEmployees = useMemo(() => {
    if (isManager) {
      return teamMembers;
    }
    return employees; // Admin sees all employees
  }, [isManager, teamMembers, employees]);

  const handleDateRangeChange = (value: DateRangeOption) => {
    setSelectedDateRange(value);
    if (value === "custom") {
      setShowCustomDatePicker(true);
    } else {
      setShowCustomDatePicker(false);
      setCustomStartDate(undefined);
      setCustomEndDate(undefined);
    }
  };

  const handleCustomDateApply = () => {
    if (customStartDate && customEndDate && !customDateRangeInvalid) {
      setShowCustomDatePicker(false);
      setIsDateRangeLoading(true);
      // The useEffect will automatically trigger due to dateRange dependency change
    }
  };

  const dateRange = useMemo<DateRangeValue>(() => {
    const today = new Date();
    
    if (selectedDateRange === "custom" && customStartDate && customEndDate && !customDateRangeInvalid) {
      return {
        start: customStartDate,
        end: customEndDate,
      };
    }
    
    switch (selectedDateRange) {
      case "today":
        return { start: today, end: today };
      case "yesterday": {
        const yesterday = subDays(today, 1);
        return { start: yesterday, end: yesterday };
      }
      case "thisWeek":
        return { start: startOfWeek(today), end: today };
      case "thisMonth":
        return { start: startOfMonth(today), end: today };
      default:
        return { start: today, end: today };
    }
  }, [selectedDateRange, customStartDate, customEndDate, customDateRangeInvalid]);

  // Load pre-aggregated, role-scoped KPIs from the optimized dashboard endpoint.
  useEffect(() => {
    if (!hasHydratedDateFilter || !isRoleDetermined) return;
    const run = async () => {
      try {
        setIsDateRangeLoading(true);
        const start = format(dateRange.start, 'yyyy-MM-dd');
        const end = format(dateRange.end, 'yyyy-MM-dd');
        
        const summary = await API.getDashboardSummary(start, end);
        const cMap = new Map<number, number>();
        summary.countsByEmployee.forEach((item) => cMap.set(item.employeeId, item.visitCount ?? 0));
        setCountsByEmployee(cMap);
        setKpis(prev => ({
          ...prev,
          totalVisits: summary.totalVisits,
          activeEmployees: summary.activeEmployees,
        }));
      } catch (error) {
        console.error('Error fetching KPIs:', error);
        // leave KPIs as-is if error
      } finally {
        setIsDateRangeLoading(false);
      }
    };
    run();
  }, [dateRange.start, dateRange.end, isRoleDetermined, hasHydratedDateFilter]);

  // Last-known GPS is independent of the date filter, which applies to visits only.
  useEffect(() => {
    if (!isRoleDetermined) return;
    let cancelled = false;
    setLocationsLoading(true);
    const run = async () => {
      try {
        const rows = await API.getAllEmployeeLocations();
        const scoped = isManager ? rows.filter(row => teamMembers.some(emp => emp.id === row.empId)) : rows;
        if (!cancelled) {
          setMarkers(latestLocationMarkers(scoped));
          setLocationsError(null);
          setLocationsSyncedAt(Date.now());
        }
      } catch {
        // Keep the last successful snapshot visible, but explicitly mark sync failure.
        if (!cancelled) setLocationsError('Could not refresh locations. Previously loaded positions may be out of date.');
      } finally {
        if (!cancelled) setLocationsLoading(false);
      }
    };
    void run();
    return () => { cancelled = true; };
  }, [isManager, teamMembers, isRoleDetermined, locationRefresh]);

  useEffect(() => {
    const refresh = () => {
      if (document.visibilityState === 'visible') setLocationRefresh(value => value + 1);
    };
    const timer = window.setInterval(refresh, 60_000);
    document.addEventListener('visibilitychange', refresh);
    return () => { window.clearInterval(timer); document.removeEventListener('visibilitychange', refresh); };
  }, []);

  // Keep KPI liveLocations in sync with markers count
  useEffect(() => {
    setKpis(prev => ({ ...prev, liveLocations: markers.length }));
  }, [markers.length]);

  // Derive states from active employees (same semantics as source: only those with visits/presence)
  // Use displayEmployees to respect role-based filtering (managers see only their team)
  useEffect(() => {
    // Build states once we have employees and countsByEmployee
    const byState = new Map<string, number>();
    displayEmployees.forEach((emp) => {
      const visits = countsByEmployee.get(emp.id) ?? 0;
      const stateName = emp.location.split(', ')[1] || 'Unknown';
      if (visits > 0) {
        byState.set(stateName, (byState.get(stateName) || 0) + 1);
      }
    });
    const stateItems: StateItem[] = Array.from(byState.entries()).map(([name, count], idx) => ({
      id: idx + 1,
      name,
      employeeCount: count,
      color: colorPalette[idx % colorPalette.length],
    }));
    setStates(stateItems);
  }, [displayEmployees, countsByEmployee]);

  const employeeList = useMemo<ExtendedEmployee[]>(() => {
    const byId = new Map(markers.map(marker => [Number(marker.id), marker]));
    return displayEmployees.filter(employee => !isAdminEmployeeRole(employee.position)).map(employee => ({
      ...employee,
      position: getEmployeeRoleLabel(employee.position),
      listId: String(employee.id),
      visits: countsByEmployee.get(employee.id) ?? 0,
      formattedLastUpdated: byId.get(employee.id)?.subtitle || '',
      locationTimestamp: byId.get(employee.id)?.updatedAt,
      hasLocation: byId.has(employee.id),
    })).sort((a, b) => Number(b.hasLocation) - Number(a.hasLocation) || a.name.localeCompare(b.name));
  }, [displayEmployees, countsByEmployee, markers]);

  const stateEmployees = useMemo(() => {
    if (!selectedState) return [];
    // Only employees active in selected range (same as upstream logic)
    return displayEmployees.filter((employee) =>
      employee.location.includes(selectedState.name) && (countsByEmployee.get(employee.id) ?? 0) > 0
    );
  }, [selectedState, displayEmployees, countsByEmployee]);

  const handleBack = useCallback(() => {
    if (view === "employeeDetail") {
      setSelectedEmployee(null);
      if (selectedState) {
        setView("state");
        setIsStateSectionLoading(true);
      } else {
        setView("dashboard");
        setHighlightedEmployee(null);
        setSelectedEmployeeMarkers([]);
        setShowVisitLocations(false);
        setMapCenter(DEFAULT_MAP_CENTER);
        setMapZoom(DEFAULT_MAP_ZOOM);
      }
      return;
    }

    if (view === "state") {
      setView("dashboard");
      setSelectedState(null);
      setHighlightedEmployee(null);
      setSelectedEmployeeMarkers([]);
      setShowVisitLocations(false);
      setMapCenter(DEFAULT_MAP_CENTER);
      setMapZoom(DEFAULT_MAP_ZOOM);
      return;
    }

    if (typeof window !== "undefined" && window.history.length > 1) {
      window.history.back();
    }
  }, [view, selectedState]);

  useDashboardHeader({
    heading:
      view === "dashboard"
        ? "Dashboard"
        : view === "state"
          ? selectedState?.name || "Employees"
          : selectedEmployee?.name || "Employee details",
    subheading:
      view === "dashboard"
        ? isManager
          ? "Team activity and performance overview"
          : "Sales and employee activity overview"
        : view === "state"
          ? `${stateEmployees.length} active ${stateEmployees.length === 1 ? "employee" : "employees"} in ${selectedState?.name || "this state"}`
          : [selectedEmployee?.position, selectedState?.name].filter(Boolean).join(" · "),
    onBack: view === "dashboard" ? undefined : handleBack,
  });

  const handleStateSelect = useCallback((state: { id: number; name: string; employeeCount: number; color?: string }) => {
    if (!state) return;
    const normalizedState: StateItem = {
      id: state.id,
      name: state.name,
      employeeCount: state.employeeCount,
      color: state.color || colorPalette[0],
    };
    pushHistoryState({
      view: "state",
      selectedState: normalizedState,
      selectedEmployee: null,
    });
    setSelectedState(normalizedState);
    setSelectedEmployee(null);
    setView("state");
    setIsStateSectionLoading(true);
  }, [pushHistoryState]);
  const clearStateSkeletonTimeout = useCallback(() => {
    if (stateSkeletonTimeoutRef.current) {
      clearTimeout(stateSkeletonTimeoutRef.current);
      stateSkeletonTimeoutRef.current = null;
    }
  }, []);

  useEffect(() => {
    return () => {
      clearStateSkeletonTimeout();
    };
  }, [clearStateSkeletonTimeout]);

  useEffect(() => {
    if (view === "state" && prevViewRef.current !== "state") {
      setIsStateSectionLoading(true);
    } else if (view !== "state") {
      clearStateSkeletonTimeout();
      setIsStateSectionLoading(false);
    }
    prevViewRef.current = view;
  }, [view, clearStateSkeletonTimeout]);

  useEffect(() => {
    if (view !== "state") {
      clearStateSkeletonTimeout();
      return;
    }

    if (stateEmployees.length > 0) {
      clearStateSkeletonTimeout();
      setIsStateSectionLoading(false);
      return;
    }

    if (isLoading || isDateRangeLoading) {
      clearStateSkeletonTimeout();
      setIsStateSectionLoading(true);
      return;
    }

    if (!stateSkeletonTimeoutRef.current) {
      stateSkeletonTimeoutRef.current = setTimeout(() => {
        setIsStateSectionLoading(false);
        stateSkeletonTimeoutRef.current = null;
      }, 1500);
    }
  }, [
    view,
    stateEmployees.length,
    isLoading,
    isDateRangeLoading,
    clearStateSkeletonTimeout,
  ]);


  const handleEmployeeSelect = useCallback((employee: ExtendedEmployee) => {
    if (highlightedEmployee?.id === employee.id) return;
    journeyRequest.current += 1;
    setSelectedEmployeeMarkers([]);
    setJourneyError(null);
    setHighlightedEmployee(employee);
    setShowVisitLocations(true);
  }, [highlightedEmployee?.id]);

  const resetLocationView = useCallback(() => {
    journeyRequest.current += 1;
    setHighlightedEmployee(null);
    setSelectedEmployeeMarkers([]);
    setJourneyError(null);
    setJourneyLoading(false);
    setShowVisitLocations(false);
    setMapResetKey(value => value + 1);
  }, []);

  const selectedLocationEmployee = highlightedEmployee?.id;
  const selectedLocationName = highlightedEmployee?.name;
  const journeyStart = format(dateRange.start, 'yyyy-MM-dd');
  const journeyEnd = format(dateRange.end, 'yyyy-MM-dd');
  useEffect(() => {
    const request = ++journeyRequest.current;
    let cancelled = false;
    setSelectedEmployeeMarkers([]);
    setJourneySummary({ total: 0, unmapped: 0, hasHome: false });
    setJourneyError(null);
    if (selectedLocationEmployee == null || !hasHydratedDateFilter || customDateRangeInvalid) {
      setJourneyLoading(false);
      return;
    }
    setJourneyLoading(true);
    const run = async () => {
      const [home, journey] = await Promise.allSettled([
        API.getEmployeeById(selectedLocationEmployee),
        API.getEmployeeJourney(selectedLocationEmployee, journeyStart, journeyEnd),
      ]);
      if (cancelled || request !== journeyRequest.current) return;
      const points: MapMarker[] = [];
      const problems: string[] = [];
      let total = 0, unmapped = 0;
      if (home.status === 'fulfilled') {
        const employee = home.value;
        if (employee && validCoordinates(employee.houseLatitude, employee.houseLongitude)) {
          points.push({ id: `house-${employee.id}`, employeeId: employee.id,
            name: `${selectedLocationName || 'Employee'} · Home`, type: 'house',
            lat: Number(employee.houseLatitude), lng: Number(employee.houseLongitude),
            subtitle: 'Saved home location' });
        }
      } else problems.push('Home location could not be loaded.');
      if (journey.status === 'fulfilled') {
        const result = journeyLocationMarkers(journey.value, journeyStart, journeyEnd);
        points.push(...result.markers);
        total = result.total;
        unmapped = result.unmapped;
      } else problems.push('Visits could not be loaded.');
      setSelectedEmployeeMarkers(points);
      setJourneySummary({ total, unmapped, hasHome: points.some(point => point.type === 'house') });
      setJourneyError(problems.length ? problems.join(' ') : null);
      setJourneyLoading(false);
    };
    void run();
    return () => { cancelled = true; };
  }, [selectedLocationEmployee, selectedLocationName, journeyStart, journeyEnd, hasHydratedDateFilter, customDateRangeInvalid, journeyRetry]);

  const handleEmployeeDetailSelect = useCallback((employee: Employee) => {
    pushHistoryState({
      view: "employeeDetail",
      selectedState,
      selectedEmployee: employee,
    });
    setSelectedEmployee(employee);
    setView("employeeDetail");
  }, [pushHistoryState, selectedState]);

  const handleMarkerClick = useCallback(async (marker: MapMarker) => {
    if (marker.type === 'live') {
      const employeeId = Number(marker.id);
      const employee = employeeList.find(emp => emp.id === employeeId);
      if (employee) {
        await handleEmployeeSelect(employee as ExtendedEmployee);
      }
    }
  }, [employeeList, handleEmployeeSelect]);

  // Note: All employee location loading is now handled in handleEmployeeSelect
  // This effect is no longer needed since we load all locations immediately

  return (
    <div className="space-y-4">
      <div className="flex min-h-9 flex-wrap items-center justify-end gap-2">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <Select value={selectedDateRange} onValueChange={handleDateRangeChange}>
              <SelectTrigger className="h-9 w-[170px] text-xs">
                <SelectValue placeholder="Select date range" />
              </SelectTrigger>
              <SelectContent>
                {dateRanges.map((range) => (
                  <SelectItem key={range.value} value={range.value}>
                    {range.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            
            {showCustomDatePicker && (
              <div className="flex flex-wrap items-center gap-2">
                <Popover open={isStartDatePopoverOpen} onOpenChange={setIsStartDatePopoverOpen}>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className="h-9 w-[140px] justify-start text-left text-xs font-normal">
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {customStartDate ? format(customStartDate, 'MMM dd, yyyy') : 'Start date'}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <SpacedCalendar
                      mode="single"
                      selected={customStartDate}
                      onSelect={(date) => {
                        setCustomStartDate(date);
                        setIsStartDatePopoverOpen(false);
                      }}
                      disabled={(date) => date > new Date() || date < new Date('1900-01-01') || (customEndDate ? date > customEndDate : false)}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
                
                <Popover open={isEndDatePopoverOpen} onOpenChange={setIsEndDatePopoverOpen}>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className="h-9 w-[140px] justify-start text-left text-xs font-normal">
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {customEndDate ? format(customEndDate, 'MMM dd, yyyy') : 'End date'}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <SpacedCalendar
                      mode="single"
                      selected={customEndDate}
                      onSelect={(date) => {
                        setCustomEndDate(date);
                        setIsEndDatePopoverOpen(false);
                      }}
                      disabled={(date) => date > new Date() || date < new Date('1900-01-01') || (customStartDate ? date < customStartDate : false)}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
                
                <DateRangeError fromDate={customStartDate} toDate={customEndDate} className="basis-full" />
                <Button 
                  onClick={handleCustomDateApply}
                  disabled={!customStartDate || !customEndDate || customDateRangeInvalid}
                  size="sm"
                >
                  Apply
                </Button>
              </div>
            )}
            {isDateRangeLoading && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>Loading...</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Show skeleton loader while role is being determined or data is loading */}
      {!isRoleDetermined || isLoading ? (
        <div className="space-y-8">
          <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle>Total Visits</CardTitle>
                <Calendar className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-8 w-16" />
                <Skeleton className="h-4 w-24 mt-2" />
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle>Active Employees</CardTitle>
                <Users className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-8 w-16" />
                <Skeleton className="h-4 w-24 mt-2" />
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle>Live Locations</CardTitle>
                <MapPin className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-8 w-16" />
                <Skeleton className="h-4 w-24 mt-2" />
              </CardContent>
            </Card>
          </div>
          
          <div className="space-y-4">
            <Skeleton className="h-8 w-64" />
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
              {[...Array(4)].map((_, i) => (
                <Card key={i}>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <Skeleton className="h-6 w-20" />
                    <Building className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <Skeleton className="h-8 w-12" />
                    <Skeleton className="h-4 w-32 mt-2" />
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
          
          <div className="space-y-4">
            <Skeleton className="h-8 w-64" />
            <div className="flex flex-col gap-6 lg:flex-row">
              <div className="flex-1">
                <Card className="h-[600px] overflow-hidden rounded-xl">
                  <Skeleton className="h-full w-full" />
                </Card>
              </div>
              <div className="w-full lg:w-96">
                <Card className="flex h-[600px] flex-col overflow-hidden rounded-xl">
                  <CardHeader className="border-b">
                    <CardTitle className="flex items-center gap-2 text-lg">
                      <Users className="h-5 w-5" />
                      <span>Active Employees</span>
                      <Skeleton className="h-6 w-12 ml-auto" />
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="flex-1 overflow-y-auto p-0">
                    <div className="divide-y">
                      {[...Array(5)].map((_, i) => (
                        <div key={i} className="w-full p-4">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <Skeleton className="h-10 w-10 rounded-xl" />
                              <div>
                                <Skeleton className="h-4 w-24" />
                                <Skeleton className="h-3 w-16 mt-1" />
                              </div>
                            </div>
                            <div className="text-right">
                              <Skeleton className="h-3 w-16" />
                              <Skeleton className="h-3 w-20 mt-1" />
                            </div>
                          </div>
                          <div className="mt-3 flex items-center gap-2">
                            <Skeleton className="h-5 w-16" />
                            <Skeleton className="h-5 w-20" />
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <>
          {view === "dashboard" && (
            <OverviewSection
              kpis={kpis}
              states={states}
              onStateSelect={handleStateSelect}
              markers={markers}
              highlightedEmployee={highlightedEmployee}
              selectedEmployeeMarkers={selectedEmployeeMarkers}
              onResetView={resetLocationView}
              mapCenter={mapCenter}
              mapZoom={mapZoom}
              onMarkerClick={handleMarkerClick}
              onEmployeeSelect={(employee) => {
                const scopedEmployee = employeeList.find(item => item.id === employee.id);
                if (scopedEmployee) handleEmployeeSelect(scopedEmployee);
              }}
              employeeList={employeeList}
              locationsLoading={locationsLoading}
              locationsError={locationsError}
              locationsSyncedAt={locationsSyncedAt}
              onRefreshLocations={() => setLocationRefresh(value => value + 1)}
              journeyLoading={journeyLoading}
              journeyError={journeyError}
              journeySummary={journeySummary}
              onRetryJourney={() => setJourneyRetry(value => value + 1)}
              periodLabel={`${format(dateRange.start, 'd MMM')} – ${format(dateRange.end, 'd MMM yyyy')}`}
              mapResetKey={mapResetKey}
            />
          )}

          {view === "state" && selectedState && (
            isStateSectionLoading ? (
              <StateSectionSkeleton />
            ) : (
              <StateSection
                selectedState={selectedState}
                stateEmployees={stateEmployees}
                onEmployeeDetailSelect={handleEmployeeDetailSelect as (employee: unknown) => void}
              />
            )
          )}

          {view === "employeeDetail" && selectedEmployee && (
            <EmployeeDetailSection employee={selectedEmployee} dateRange={dateRange} />
          )}
        </>
      )}

      <DailyPricingModal
        open={isPricingModalOpen}
        onOpenChange={(open) => {
          if (open) {
            setIsPricingModalOpen(true);
          } else {
            handlePricingModalDismiss();
          }
        }}
        onCreateSuccess={handlePricingModalDismiss}
      />
    </div>
  );
}
