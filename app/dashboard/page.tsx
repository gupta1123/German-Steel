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
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { MapPin, Users, Calendar, ArrowLeft, Building, Loader2, CalendarIcon } from "lucide-react";
import OverviewSection from "@/components/dashboard/OverviewSection";
import StateSection from "@/components/dashboard/StateSection";
import EmployeeDetailSection from "@/components/dashboard/EmployeeDetailSection";
import { Heading, Text } from "@/components/ui/typography";
import { API, type EmployeeUserDto, type AttendanceLogItem, type LiveLocationDto, type TeamDataDto, type CurrentUserDto } from "@/lib/api";
import { useAuth } from "@/components/auth-provider";
import { Skeleton } from "@/components/ui/skeleton";
import DailyPricingModal from "@/components/DailyPricingModal";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { SpacedCalendar } from "@/components/ui/spaced-calendar";
import { isManagerRoleValue, getCorrectedRoleFlags } from "@/lib/auth";
import { getUniqueFieldOfficersFromTeams } from "@/lib/team-access";
import { DateRangeError, isDateRangeInvalid } from "@/components/date-range-error";


const DEFAULT_MAP_CENTER: [number, number] = [22.5726, 88.3639];
const DEFAULT_MAP_ZOOM = 5;
const DATE_FILTER_STATE_KEY = "dashboard.dateFilter.v1";

const CITY_COORDINATES: Record<string, [number, number]> = {
  Mumbai: [19.076, 72.8777],
  Bangalore: [12.9716, 77.5946],
  Chennai: [13.0827, 80.2707],
  Hyderabad: [17.385, 78.4867],
  Kolkata: [22.5726, 88.3639],
  Delhi: [28.6139, 77.209],
};

const resolveCoordinates = (location: string): [number, number] => {
  const match = Object.entries(CITY_COORDINATES).find(([city]) =>
    location.includes(city)
  );
  return match ? match[1] : DEFAULT_MAP_CENTER;
};

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
};

type MapMarker = {
  id: number | string;
  name?: string;
  lat: number;
  lng: number;
  subtitle?: string;
  type?: "live" | "house" | "visit";
  tooltipLines?: string[];
  employeeId?: number;
  order?: number;
};

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
        const mapped: Employee[] = (data || []).map((e) => ({
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

  // Fetch live locations for employees based on role
  useEffect(() => {
    if (!hasHydratedDateFilter) return;
    let cancelled = false;
    const run = async () => {
      if (!isRoleDetermined) return;
      
      try {
        // Use API service to get live locations
        const liveLocations = await API.getAllEmployeeLocations();
        const now = new Date();
        
        const results: MapMarker[] = [];
        
        liveLocations.forEach((loc: LiveLocationDto) => {
          if (loc.latitude != null && loc.longitude != null && 
              loc.latitude !== 0 && loc.longitude !== 0 && 
              loc.latitude !== 0.0 && loc.longitude !== 0.0) {
          
            let shouldShow = true;
            
            if (isManager) {
              // Check if this employee is under the manager's team
              shouldShow = teamMembers.some(emp => emp.id === loc.empId);
            }
            
            if (!shouldShow) {
              console.log(`Skipping employee ${loc.empName} (ID: ${loc.empId}) - not in team`);
              return;
            }
            
            // Check if location falls within the selected date range
            const timePart = String(loc.updatedTime).split('.')[0];
            const ts = new Date(`${loc.updatedAt}T${timePart}`);
            const locationDate = ts.toISOString().split('T')[0]; // Get YYYY-MM-DD format
            
            // Check if location date is within the selected date range
            const startDateStr = dateRange.start.toISOString().split('T')[0];
            const endDateStr = dateRange.end.toISOString().split('T')[0];
            
            console.log(`Location date check for ${loc.empName}:`, {
              locationDate,
              startDateStr,
              endDateStr,
              inRange: locationDate >= startDateStr && locationDate <= endDateStr
            });
            
            if (locationDate >= startDateStr && locationDate <= endDateStr) {
              results.push({
                id: loc.empId,
                name: loc.empName,
                lat: loc.latitude,
                lng: loc.longitude,
                // Display date like 11 Aug '25 plus time
                subtitle: `${format(ts, "MMM dd, yyyy")} ${timePart}`.trim(),
                type: "live",
                employeeId: loc.empId,
                tooltipLines: [
                  `Employee: ${loc.empName}`,
                  `Last updated: ${format(ts, "MMM dd, yyyy, hh:mm a")}`,
                ],
              });
            }
          }
        });

        if (!cancelled) {
          // Sort by name
          results.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
          setMarkers(results);
        }
      } catch (e) {
        if (!cancelled) setMarkers([]);
      }
    };
    run();
    return () => { cancelled = true; };
  }, [isManager, teamMembers, isRoleDetermined, dateRange.start, dateRange.end, hasHydratedDateFilter]);

  // Keep KPI liveLocations in sync with markers count
  useEffect(() => {
    setKpis(prev => ({ ...prev, liveLocations: markers.length }));
  }, [markers.length]);

  // Derive states from active employees (same semantics as source: only those with visits/presence)
  // Use displayEmployees to respect role-based filtering (managers see only their team)
  useEffect(() => {
    // Build states once we have employees and countsByEmployee
    if (!displayEmployees.length) return;
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
    // Build list only for employees with live markers (current location data)
    const byId = new Map<number, { lat: number; lng: number; subtitle?: string }>();
    markers.forEach(m => {
      byId.set(Number(m.id), { lat: m.lat, lng: m.lng, subtitle: m.subtitle });
    });
    const list = displayEmployees
      .filter(e => byId.has(e.id)) // Only show employees with live location data
      .map((employee) => ({
        ...employee,
        listId: String(employee.id),
        visits: countsByEmployee.get(employee.id) ?? 0,
        formattedLastUpdated: byId.get(employee.id)?.subtitle || '',
      }));
    // Sorted by employee name similar to example list
    list.sort((a, b) => a.name.localeCompare(b.name));
    return list;
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


  const handleEmployeeSelect = useCallback(async (employee: ExtendedEmployee) => {
    if (!hasHydratedDateFilter) return;
    console.log('=== EMPLOYEE SELECTION (AUTO-JOURNEY) ===');
    console.log('Selected employee:', employee);

    const liveMarker = markers.find(m => Number(m.id) === employee.id);

    // reset state and set highlight; mark journey as visible immediately to avoid intermediate UI
    setSelectedEmployeeMarkers([]);
    setHighlightedEmployee(employee);
    setShowVisitLocations(true);

    try {
      // 1) Load house marker if available
      const employeeDetail = await API.getEmployeeById(employee.id);
      const allMarkers: MapMarker[] = [];

      if (employeeDetail && employeeDetail.houseLatitude != null && employeeDetail.houseLongitude != null &&
          !isNaN(Number(employeeDetail.houseLatitude)) && !isNaN(Number(employeeDetail.houseLongitude))) {
        const houseLat = Number(employeeDetail.houseLatitude);
        const houseLng = Number(employeeDetail.houseLongitude);
        if (houseLat !== 0 && houseLng !== 0 && houseLat !== 0.0 && houseLng !== 0.0) {
          const placeParts = [employeeDetail.city, employeeDetail.state, employeeDetail.country]
            .filter(Boolean)
            .join(", ");
          allMarkers.push({
            id: `house-${employeeDetail.id}`,
            name: `${employee.name}'s Home`,
            lat: houseLat,
            lng: houseLng,
            subtitle: placeParts,
            type: "house",
            employeeId: employeeDetail.id,
            tooltipLines: [],
          });
        }
      }

      // 2) Load visit markers for selected range (auto journey)
      const start = format(dateRange.start, "yyyy-MM-dd");
      const end = format(dateRange.end, "yyyy-MM-dd");
      const visits = await API.getEmployeeJourney(employee.id, start, end);

      const formatDateTime = (dateStr?: string | null, timeStr?: string | null) => {
        if (!dateStr) return "Not available";
        const time = timeStr ? timeStr.split(".")[0] : null;
        const normalizedTime = time && time.length === 8 ? time : time ? `${time}` : "00:00:00";
        const dateTime = new Date(`${dateStr}T${normalizedTime ?? "00:00:00"}`);
        if (Number.isNaN(dateTime.getTime())) return dateStr;
        return format(dateTime, "MMM dd, yyyy, hh:mm a");
      };

      const visitMarkers: MapMarker[] = [];
      // Sort visits by time to determine order
      const sortedVisits = [...visits].sort((a, b) => {
        const aDate = a.checkinDate || a.visitDate || '';
        const aTime = (a.checkinTime || '00:00:00').split('.')[0];
        const bDate = b.checkinDate || b.visitDate || '';
        const bTime = (b.checkinTime || '00:00:00').split('.')[0];
        const aDT = new Date(`${aDate}T${aTime || '00:00:00'}`);
        const bDT = new Date(`${bDate}T${bTime || '00:00:00'}`);
        return aDT.getTime() - bDT.getTime();
      });

      sortedVisits.forEach((visit, idx) => {
        const lat = visit.lat;
        const lng = visit.lng;
        if (lat == null || lng == null || lat === 0 || lng === 0 || lat === 0.0 || lng === 0.0) return;

        const checkIn = formatDateTime(visit.checkinDate, visit.checkinTime);
        const checkOut = visit.checkoutDate || visit.checkoutTime ? formatDateTime(visit.checkoutDate, visit.checkoutTime) : "Not recorded";
        const place = [visit.city, visit.state, visit.country].filter(Boolean).join(", ");

        visitMarkers.push({
          id: `visit-${visit.id}`,
          name: visit.storeName || "Visit",
          lat: Number(lat),
          lng: Number(lng),
          subtitle: `${visit.storeName || "Visit"} - ${visit.purpose || "Visit"}`,
          type: "visit",
          employeeId: visit.employeeId,
          order: idx + 1,
          tooltipLines: [
            `Store: ${visit.storeName || "N/A"}`,
            `Employee: ${visit.employeeName || employee.name}`,
            `Check-in: ${checkIn}`,
            `Check-out: ${checkOut}`,
            ...(place ? [`Address: ${place}`] : []),
          ],
        });
      });

      const updatedMarkers = [...allMarkers, ...visitMarkers];
      setSelectedEmployeeMarkers(updatedMarkers);

      // 3) Fit map to show all current locations (house + visits + live)
      const allLocations: Array<{ lat: number; lng: number }> = [...updatedMarkers];
      if (liveMarker) allLocations.push(liveMarker);

      if (allLocations.length > 0) {
        const lats = allLocations.map((loc) => loc.lat);
        const lngs = allLocations.map((loc) => loc.lng);
        const minLat = Math.min(...lats);
        const maxLat = Math.max(...lats);
        const minLng = Math.min(...lngs);
        const maxLng = Math.max(...lngs);
        const centerLat = (minLat + maxLat) / 2;
        const centerLng = (minLng + maxLng) / 2;

        const latDiff = maxLat - minLat;
        const lngDiff = maxLng - minLng;
        const maxDiff = Math.max(latDiff, lngDiff);

        let zoomLevel = 11;
        if (maxDiff > 1) zoomLevel = 8;
        else if (maxDiff > 0.5) zoomLevel = 9;
        else if (maxDiff > 0.1) zoomLevel = 10;
        else zoomLevel = 12;

        setMapCenter([centerLat, centerLng]);
        setMapZoom(zoomLevel);
      } else if (liveMarker) {
        setMapCenter([liveMarker.lat, liveMarker.lng]);
        setMapZoom(13);
      } else {
        const cityCoords = resolveCoordinates(employee.location);
        setMapCenter(cityCoords);
        setMapZoom(10);
      }
    } catch (error) {
      console.error('Failed to load employee journey:', error);
    }
  }, [markers, dateRange.start, dateRange.end, hasHydratedDateFilter]);

  const handleEmployeeDetailSelect = useCallback((employee: Employee) => {
    pushHistoryState({
      view: "employeeDetail",
      selectedState,
      selectedEmployee: employee,
    });
    setSelectedEmployee(employee);
    setView("employeeDetail");
  }, [pushHistoryState, selectedState]);

  const handleShowVisitLocations = useCallback(async () => {
    if (!highlightedEmployee || !hasHydratedDateFilter) return;

    try {
      const start = format(dateRange.start, "yyyy-MM-dd");
      const end = format(dateRange.end, "yyyy-MM-dd");
      
      console.log('=== VISIT LOCATIONS DEBUG ===');
      console.log('Fetching optimized journey for employee:', highlightedEmployee.id);
      console.log('Date range:', { start, end });

      const visits = await API.getEmployeeJourney(highlightedEmployee.id, start, end);
      console.log('Journey response:', visits);

      const visitMarkers: MapMarker[] = [];

      // Add visit locations
      const formatDateTime = (dateStr?: string | null, timeStr?: string | null) => {
        if (!dateStr) return "Not available";
        const time = timeStr ? timeStr.split(".")[0] : null;
        const normalizedTime = time && time.length === 8 ? time : time ? `${time}` : "00:00:00";
        const dateTime = new Date(`${dateStr}T${normalizedTime ?? "00:00:00"}`);
        if (Number.isNaN(dateTime.getTime())) {
          return dateStr;
        }
        return format(dateTime, "MMM dd, yyyy, hh:mm a");
      };

      console.log('Processing visits:', visits.length, 'visits found');
      
      visits.forEach((visit, index) => {
        const lat = visit.lat;
        const lng = visit.lng;

        console.log(`Visit ${index + 1}:`, {
          visitId: visit.id,
          storeName: visit.storeName,
          coordinateSource: visit.coordinateSource,
          finalLat: lat,
          finalLng: lng
        });

        if (lat == null || lng == null || lat === 0 || lng === 0 || lat === 0.0 || lng === 0.0) {
          console.log(`Visit ${index + 1} skipped: No valid coordinates`, {
            lat,
            lng,
            storeName: visit.storeName
          });
          return;
        }

        const checkIn = formatDateTime(visit.checkinDate, visit.checkinTime);
        const checkOut =
          visit.checkoutDate || visit.checkoutTime
            ? formatDateTime(visit.checkoutDate, visit.checkoutTime)
            : "Not recorded";
        const place = [visit.city, visit.state, visit.country].filter(Boolean).join(", ");

        const tooltipLines = [
          `Store: ${visit.storeName || "N/A"}`,
          `Employee: ${visit.employeeName || highlightedEmployee.name}`,
          `Check-in: ${checkIn}`,
          `Check-out: ${checkOut}`,
          visit.purpose ? `Purpose: ${visit.purpose}` : null,
          place ? `Address: ${place}` : null,
        ].filter(Boolean) as string[];

        const visitMarker: MapMarker = {
          id: `visit-${visit.id}`,
          name: visit.storeName || "Visit",
          lat: Number(lat),
          lng: Number(lng),
          subtitle: `${visit.storeName || "Visit"} - ${visit.purpose || "Visit"}`,
          type: "visit" as const,
          employeeId: visit.employeeId,
          tooltipLines,
        };
        
        visitMarkers.push(visitMarker);
        console.log(`Added visit marker ${index + 1}:`, visitMarker);
      });

      console.log('Total visit markers created:', visitMarkers.length);

      // Add visit markers to existing markers
      const updatedMarkers = [...selectedEmployeeMarkers, ...visitMarkers];
      console.log('Updated markers (existing + visits):', updatedMarkers);
      setSelectedEmployeeMarkers(updatedMarkers);
      setShowVisitLocations(true);

      // Recalculate map bounds to include visit locations
      const liveMarker = markers.find(m => Number(m.id) === highlightedEmployee.id);
      const allLocations = [...updatedMarkers];
      if (liveMarker) {
        allLocations.push(liveMarker);
      }

      if (allLocations.length > 0) {
        const lats = allLocations.map(loc => loc.lat);
        const lngs = allLocations.map(loc => loc.lng);
        
        const minLat = Math.min(...lats);
        const maxLat = Math.max(...lats);
        const minLng = Math.min(...lngs);
        const maxLng = Math.max(...lngs);
        
        const centerLat = (minLat + maxLat) / 2;
        const centerLng = (minLng + maxLng) / 2;
        
        // Calculate zoom level based on the spread of locations
        const latDiff = maxLat - minLat;
        const lngDiff = maxLng - minLng;
        const maxDiff = Math.max(latDiff, lngDiff);
        
        // Adjust zoom level based on the spread of locations
        let zoomLevel = 11;
        if (maxDiff > 1) zoomLevel = 8; // Very spread out
        else if (maxDiff > 0.5) zoomLevel = 9; // Moderately spread out
        else if (maxDiff > 0.1) zoomLevel = 10; // Close together
        else zoomLevel = 12; // Very close together
        
        setMapCenter([centerLat, centerLng]);
        setMapZoom(zoomLevel);
      }
    } catch (error) {
      console.error("Failed to load visit locations:", error);
    }
  }, [highlightedEmployee, dateRange.start, dateRange.end, markers, selectedEmployeeMarkers, hasHydratedDateFilter]);

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
    <div className="space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-3">
            <Heading as="h1" size="3xl" weight="bold">
              {view === "dashboard"
                ? "Dashboard"
                : view === "state" && selectedState
                ? selectedState.name
                : "Employee Details"}
            </Heading>
            {isRoleDetermined && (
              <Badge variant={isManager ? "secondary" : "default"} className="text-xs">
                {isManager ? "Manager View" : "Admin View"}
              </Badge>
            )}
          </div>
          <Text tone="muted">
            {view === "dashboard"
              ? isManager 
                ? "Overview of your team's activities and performance."
                : "Overview of sales and employee activities."
              : selectedState
              ? `Details for ${selectedState.name}`
              : "Deep dive into employee performance."}
          </Text>
        </div>
        <div className="flex items-center gap-4">
          {view !== "dashboard" && (
            <Button
              variant="outline"
              onClick={handleBack}
              className="flex items-center gap-2"
            >
              <ArrowLeft className="h-4 w-4" />
              Back
            </Button>
          )}
          <div className="flex items-center gap-2">
            <Select value={selectedDateRange} onValueChange={handleDateRangeChange}>
              <SelectTrigger className="w-[180px]">
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
                    <Button variant="outline" className="w-[140px] justify-start text-left font-normal">
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
                    <Button variant="outline" className="w-[140px] justify-start text-left font-normal">
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
              onResetView={() => {
                setMapCenter(DEFAULT_MAP_CENTER);
                setMapZoom(DEFAULT_MAP_ZOOM);
                setHighlightedEmployee(null);
                setSelectedEmployeeMarkers([]);
                setShowVisitLocations(false);
              }}
              mapCenter={mapCenter}
              mapZoom={mapZoom}
              onMarkerClick={handleMarkerClick as unknown as (marker: Record<string, unknown>) => void}
              onEmployeeSelect={handleEmployeeSelect as unknown as (employee: Record<string, unknown>) => void}
              employeeList={employeeList}
              showVisitLocations={showVisitLocations}
              onShowVisitLocations={handleShowVisitLocations}
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
