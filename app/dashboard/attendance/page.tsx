"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import EmployeeAttendanceCard from "@/components/employee-attendance-card";
import VisitDetailsModal from "@/components/visit-details-modal";
import { SearchableSelect, type SearchableOption } from "@/components/ui/searchable-select2";
import { attendanceApi, type AttendanceLog } from "@/lib/attendance-api";
import { approvalsApi, type ApprovalRequest } from "@/lib/approvals-api";
import { teamsApi } from "@/lib/teams-api";
import { useAuth } from "@/components/auth-provider";
import { getEmployeeRoleCategory, getEmployeeRoleLabel, isAdminEmployeeRole } from "@/lib/employee-role";

interface AttendanceData {
  id: number;
  employeeId: number;
  employeeName: string;
  attendanceStatus: 'full day' | 'half day' | 'Absent';
  checkinDate: string;
  checkoutDate: string;
  // Case discriminators (kept from AttendanceLogDto, backend read-only)
  visitCount?: number | null;
  marked?: boolean | null;
  defaultRuleApplied?: boolean | null;
  vehicleType?: string | null;
}

interface Employee {
  id: number;
  firstName: string;
  lastName: string;
  employeeId: string;
  department: string;
  position: string;
  role: string;
}

const years = Array.from({ length: 27 }, (_, index) => 2024 + index);
const months = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

export default function AttendancePage() {
  const [attendanceData, setAttendanceData] = useState<AttendanceData[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());
  const [selectedMonth, setSelectedMonth] = useState<number>(new Date().getMonth());
  const [noDataMessage, setNoDataMessage] = useState<string>("");
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string>("");
  const [selectedRoleFilter, setSelectedRoleFilter] = useState<'all' | 'regional-manager' | 'field-officer'>('all');
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [visitData, setVisitData] = useState<unknown[]>([]);
  const [selectedDate, setSelectedDate] = useState<string>('');
  const [selectedEmployeeName, setSelectedEmployeeName] = useState<string>('');
  const [selectedDayLog, setSelectedDayLog] = useState<AttendanceLog | null>(null);
  const [selectedDayRequest, setSelectedDayRequest] = useState<ApprovalRequest | null>(null);

  // Searchable year options
  const yearOptions = useMemo<SearchableOption[]>(() =>
    years.map((y) => ({ value: String(y), label: String(y) })),
  []);

  const roleFilteredEmployees = useMemo(() => employees.filter((employee) =>
    selectedRoleFilter === 'all' || getEmployeeRoleCategory(employee.role) === selectedRoleFilter
  ), [employees, selectedRoleFilter]);

  const employeeOptions = useMemo<SearchableOption[]>(() =>
    roleFilteredEmployees
      .map((employee) => ({
        value: String(employee.id),
        label: `${employee.firstName} ${employee.lastName}`,
      }))
      .sort((a, b) => a.label.localeCompare(b.label)),
  [roleFilteredEmployees]);

  // Persist page filters (year/month/name) across navigation
  const ATTENDANCE_STATE_KEY = 'attendance.page.state.v1';
  const hasHydratedRef = useRef(false);
  const [isFiltersHydrated, setIsFiltersHydrated] = useState(false);

  // Hydrate from session storage on first mount
  useEffect(() => {
    if (typeof window === 'undefined' || hasHydratedRef.current) return;
    try {
      const raw = sessionStorage.getItem(ATTENDANCE_STATE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as { selectedYear?: number; selectedMonth?: number; selectedEmployeeId?: string; selectedRoleFilter?: string };
        if (typeof parsed.selectedYear === 'number') setSelectedYear(parsed.selectedYear);
        if (typeof parsed.selectedMonth === 'number') setSelectedMonth(parsed.selectedMonth);
        if (typeof parsed.selectedEmployeeId === 'string') setSelectedEmployeeId(parsed.selectedEmployeeId);
        if (parsed.selectedRoleFilter === 'regional-manager' || parsed.selectedRoleFilter === 'field-officer') {
          setSelectedRoleFilter(parsed.selectedRoleFilter);
        }
      }
    } catch {}
    hasHydratedRef.current = true;
    setIsFiltersHydrated(true);
  }, []);

  // Persist on changes
  useEffect(() => {
    if (typeof window === 'undefined' || !hasHydratedRef.current) return;
    try {
      sessionStorage.setItem(
        ATTENDANCE_STATE_KEY,
        JSON.stringify({ selectedYear, selectedMonth, selectedEmployeeId, selectedRoleFilter })
      );
    } catch {}
  }, [selectedYear, selectedMonth, selectedEmployeeId, selectedRoleFilter]);

  const { token: authToken } = useAuth();
  const token = authToken ?? (typeof window !== 'undefined' ? localStorage.getItem('authToken') : null);

  const fetchEmployees = useCallback(async () => {
    if (!token) {
      return;
    }

    try {
      // Use paginated employees endpoint per guide: GET /api/common/employees?active=true&page=0&size=50
      const page = await teamsApi.getEmployeesPage(token, { active: true, page: 0, size: 50 });
      const data = page.content as unknown as Employee[];
      setEmployees(data.filter((employee) => !isAdminEmployeeRole(employee.role)));
    } catch (error) {
      console.error("Error fetching employees:", error);
    }
  }, [token]);

  // Keep employees in a ref to avoid making attendance fetch callback unstable
  const employeesRef = useRef<Employee[]>([]);
  useEffect(() => { employeesRef.current = employees; }, [employees]);

  // Day-case lookup: logs in ref (no extra fetch), requests cached per employee (lazy, frontend-only)
  const attendanceDataRef = useRef<AttendanceData[]>([]);
  useEffect(() => { attendanceDataRef.current = attendanceData; }, [attendanceData]);
  const requestsCacheRef = useRef(new Map<number, ApprovalRequest[]>());
  const dateKeyOf = (value: unknown): string => String(value ?? '').slice(0, 10);

  const attendanceRequestIdRef = useRef(0);
  const isFetchingAttendanceRef = useRef(false);

  const fetchAttendanceData = useCallback(async () => {
    if (!token) {
      setIsLoading(false);
      return;
    }
    if (isFetchingAttendanceRef.current) return;
    isFetchingAttendanceRef.current = true;
    const requestId = ++attendanceRequestIdRef.current;
    setIsLoading(true);
    setNoDataMessage("");

    const monthPrefix = `${selectedYear}-${String(selectedMonth + 1).padStart(2, '0')}`;
    const startDate = `${monthPrefix}-01`;
    const endDate = `${monthPrefix}-${new Date(selectedYear, selectedMonth + 1, 0).getDate()}`;

    try {
      // Use paginated by-employee endpoint per guide; respect employee/role filters via ref to keep callback stable
      const allEmployees = employeesRef.current;
      const byRole = selectedRoleFilter === 'all' ? allEmployees : allEmployees.filter((e) => getEmployeeRoleCategory(e.role) === selectedRoleFilter);
      const targetEmployees = selectedEmployeeId ? byRole.filter((e) => String(e.id) === selectedEmployeeId) : byRole;
      let allLogs: AttendanceData[] = [];
      if (targetEmployees.length > 0) {
        const results = await Promise.all(
          targetEmployees.map(async (emp) => {
            try {
              const page = await attendanceApi.getByEmployee(token, emp.id, startDate, endDate, 0, 50);
              return page.content as unknown as AttendanceData[];
            } catch {
              return [];
            }
          })
        );
        // Ignore stale response if a newer request started
        if (requestId !== attendanceRequestIdRef.current) return;
        allLogs = results.flat();
        if (allLogs.length === 0 && employeesRef.current.length === 0) {
          const firstDay = await attendanceApi.getByDate(token, startDate, 0, 50);
          if (requestId !== attendanceRequestIdRef.current) return;
          allLogs = firstDay.content as unknown as AttendanceData[];
        }
      } else {
        // Distinguish initial load (employees not yet loaded) vs filtered empty (no matching employee)
        if (employeesRef.current.length === 0) {
          const page = await attendanceApi.getByDate(token, startDate, 0, 50);
          if (requestId !== attendanceRequestIdRef.current) return;
          allLogs = page.content as unknown as AttendanceData[];
        } else {
          allLogs = [];
        }
      }

      if (requestId !== attendanceRequestIdRef.current) return;

      const modifiedData = allLogs.map((item: unknown) => {
        const rec = item as Record<string, unknown>;
        const originalStatus = typeof rec.attendanceStatus === "string" ? rec.attendanceStatus as string : "";
        const normalizedOriginal = originalStatus.trim().toLowerCase();
        let normalizedStatus = originalStatus;
        if (normalizedOriginal === "present") {
          normalizedStatus = "absent";
        } else if (normalizedOriginal === "full day") {
          normalizedStatus = "full day";
        } else if (normalizedOriginal === "absent") {
          normalizedStatus = "absent";
        } else if (normalizedOriginal === "half day") {
          normalizedStatus = "half day";
        } else if (normalizedOriginal === "paid leave") {
          normalizedStatus = "paid";
        } else if (normalizedOriginal === "activity") {
          normalizedStatus = "activity";
        }
        const safeCheckinDate =
          (typeof rec.checkinDate === "string" && rec.checkinDate.trim() ? (rec.checkinDate as string) : null) ??
          (typeof rec.attendanceDate === "string" && (rec.attendanceDate as string).trim() ? (rec.attendanceDate as string) : null) ??
          (typeof rec.date === "string" && (rec.date as string).trim() ? (rec.date as string) : null) ??
          "";
        const safeCheckoutDate =
          (typeof rec.checkoutDate === "string" && (rec.checkoutDate as string).trim() ? (rec.checkoutDate as string) : null) ??
          null;
        return {
          ...(item as object),
          attendanceStatus: normalizedStatus,
          rawStatus: originalStatus,
          checkinDate: safeCheckinDate,
          checkoutDate: safeCheckoutDate,
          visitCount: typeof rec.visitCount === 'number' ? (rec.visitCount as number) : null,
          marked: typeof rec.marked === 'boolean' ? (rec.marked as boolean) : null,
          defaultRuleApplied: typeof rec.defaultRuleApplied === 'boolean' ? (rec.defaultRuleApplied as boolean) : null,
          vehicleType: typeof rec.vehicleType === 'string' ? (rec.vehicleType as string) : null,
        } as unknown as AttendanceData;
      });

      setAttendanceData(modifiedData);
      setNoDataMessage("");

      if (modifiedData.length === 0) {
        setNoDataMessage("No data available for the selected month and year. Please choose a different month or year.");
      }
    } catch (error) {
      if (requestId !== attendanceRequestIdRef.current) return;
      console.error("Error fetching attendance data:", error);
      setAttendanceData([]);
      setNoDataMessage("No data available for the selected month and year. Please choose a different month or year.");
    } finally {
      if (requestId === attendanceRequestIdRef.current) {
        setIsLoading(false);
        isFetchingAttendanceRef.current = false;
      }
    }
  }, [token, selectedYear, selectedMonth, selectedEmployeeId, selectedRoleFilter]);

  const fetchVisitData = useCallback(
    async (date: string, employeeName: string) => {
      if (!token) {
        console.error("Auth token is missing");
        return;
      }

      try {
        // Use GET /api/common/visits?from={date}&to={date}&assignedEmployeeId={employeeId}&page=0&size=50 per guide
        const matchedEmployee = employeesRef.current.find((e) => `${e.firstName} ${e.lastName}`.trim() === employeeName.trim());
        const assignedEmployeeId = matchedEmployee?.id;
        // Day-case lookup from already-loaded logs (no extra fetch)
        const dayLog = assignedEmployeeId != null
          ? (attendanceDataRef.current.find((a) => a.employeeId === assignedEmployeeId && (dateKeyOf(a.checkinDate) === date || dateKeyOf((a as unknown as Record<string, unknown>).attendanceDate) === date || dateKeyOf((a as unknown as Record<string, unknown>).date) === date)) ?? null)
          : null;
        setSelectedDayLog(dayLog as unknown as AttendanceLog | null);
        setSelectedDayRequest(null);
        if (!assignedEmployeeId) {
          setVisitData([]);
          setSelectedDate(date);
          setSelectedEmployeeName(employeeName);
          setIsModalOpen(true);
          return;
        }
        // Lazy day-case request lookup (cached per employee, frontend-only join)
        try {
          let cached = requestsCacheRef.current.get(assignedEmployeeId);
          if (!cached) {
            const page = await approvalsApi.getRequestsByEmployee(token, assignedEmployeeId, 0, 100);
            cached = page.content;
            requestsCacheRef.current.set(assignedEmployeeId, cached);
          }
          const dayRequest = cached.find((r) => dateKeyOf(r.logDate) === date) ?? null;
          setSelectedDayRequest(dayRequest);
        } catch {
          // 403 for scoped roles or missing contract — visits modal still opens with log case only
          setSelectedDayRequest(null);
        }
        const data = await attendanceApi.getVisits(token, date, date, assignedEmployeeId, 0, 50) as { content?: unknown[] };
        const content = Array.isArray((data as { content?: unknown[] }).content) ? (data as { content: unknown[] }).content : Array.isArray(data) ? data as unknown[] : [];
        setVisitData(content);
        setSelectedDate(date);
        setSelectedEmployeeName(employeeName);
        setIsModalOpen(true);

        if (content.length === 0) {
          setVisitData([]);
        }
      } catch (error) {
        console.error("Error fetching visit data:", error);
        setVisitData([]);
      }
    },
    [token]
  );

  // Fetch employees once when hydrated/token available — stable, no loop
  useEffect(() => {
    if (!isFiltersHydrated || !token) return;
    void fetchEmployees();
  }, [isFiltersHydrated, token, fetchEmployees]);

  // Fetch attendance when filters/hydration/employees change; stale requests ignored via requestId
  useEffect(() => {
    if (!isFiltersHydrated) return;
    void fetchAttendanceData();
  }, [isFiltersHydrated, selectedYear, selectedMonth, selectedEmployeeId, selectedRoleFilter, fetchAttendanceData, employees.length]);

  const attendanceByEmployee = useMemo(() => {
    const index = new Map<number, AttendanceData[]>();
    for (const attendance of attendanceData) {
      const employeeAttendance = index.get(attendance.employeeId);
      if (employeeAttendance) {
        employeeAttendance.push(attendance);
      } else {
        index.set(attendance.employeeId, [attendance]);
      }
    }
    return index;
  }, [attendanceData]);

  // Filter by the selected employee, then sort without mutating the cached directory.
  const filteredEmployees = useMemo(() => employees
    .filter((employee) => selectedRoleFilter === 'all' || getEmployeeRoleCategory(employee.role) === selectedRoleFilter)
    .filter((employee) => !selectedEmployeeId || String(employee.id) === selectedEmployeeId)
    .sort((a, b) => {
      const nameA = `${a.firstName} ${a.lastName}`.toLowerCase();
      const nameB = `${b.firstName} ${b.lastName}`.toLowerCase();
      return nameA.localeCompare(nameB);
    }), [employees, selectedEmployeeId, selectedRoleFilter]);

  return (
    <div className="container mx-auto px-4 py-4 sm:px-6">
      <section aria-label="Attendance filters and legend" className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center">
        <div className="grid w-full grid-cols-2 gap-2 sm:w-auto sm:grid-cols-[120px_150px_170px_minmax(180px,240px)]">
          <div>
            <SearchableSelect
              options={yearOptions}
              value={String(selectedYear)}
              onSelect={(opt) => {
                if (!opt) return;
                const yr = parseInt(opt.value);
                if (!Number.isNaN(yr)) setSelectedYear(yr);
              }}
              placeholder="Select a year"
              triggerClassName="h-9 w-full"
              contentClassName="w-[var(--radix-popover-trigger-width)]"
              searchPlaceholder="Search year..."
            />
          </div>
          <div>
            <Select value={selectedMonth.toString()} onValueChange={(value) => setSelectedMonth(parseInt(value))}>
              <SelectTrigger className="h-9 w-full">
                <SelectValue placeholder="Select a month" />
              </SelectTrigger>
              <SelectContent>
                {months.map((month, index) => (
                  <SelectItem key={month} value={index.toString()}>
                    {month}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Select
              value={selectedRoleFilter}
              onValueChange={(value: 'all' | 'regional-manager' | 'field-officer') => {
                setSelectedRoleFilter(value);
                setSelectedEmployeeId('');
              }}
            >
              <SelectTrigger className="h-9 w-full" aria-label="Filter by role">
                <SelectValue placeholder="All roles" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All roles</SelectItem>
                <SelectItem value="regional-manager">Supervisor</SelectItem>
                <SelectItem value="field-officer">Field Officer</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <SearchableSelect
              options={employeeOptions}
              value={selectedEmployeeId}
              onSelect={(option) => setSelectedEmployeeId(option?.value ?? '')}
              placeholder="All employees"
              searchPlaceholder="Search employees..."
              emptyMessage="No employees available"
              noResultsMessage="No matching employees"
              allowClear
              triggerClassName="h-9 w-full"
              contentClassName="w-[var(--radix-popover-trigger-width)]"
            />
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 lg:ml-auto lg:justify-end">
          <p className="mr-1 text-xs font-semibold text-foreground">Legend</p>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <div className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-[3px] bg-green-500 dark:bg-green-400" />
              <p className="whitespace-nowrap text-xs text-muted-foreground">Full Day</p>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-[3px] bg-yellow-500 dark:bg-yellow-400" />
              <p className="whitespace-nowrap text-xs text-muted-foreground">Half Day</p>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-[3px] border border-purple-400 bg-purple-200 dark:border-purple-500 dark:bg-purple-900/40" />
              <p className="whitespace-nowrap text-xs text-muted-foreground">Paid Leave</p>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-[3px] bg-red-500 dark:bg-red-400" />
              <p className="whitespace-nowrap text-xs text-muted-foreground">Absent</p>
            </div>
          </div>
        </div>
      </section>

      {noDataMessage && !isLoading && filteredEmployees.length > 0 && attendanceData.length === 0 && <p className="mb-4 text-red-500">{noDataMessage}</p>}

      <div className="space-y-4">
        {isLoading ? (
          Array.from({ length: 5 }).map((_, index) => (
            <div key={index} className="h-48 bg-gray-200 animate-pulse rounded-lg"></div>
          ))
        ) : filteredEmployees.length === 0 ? (
          <div className="rounded-lg border border-dashed py-10 text-center text-sm text-muted-foreground">
            No employees match the selected filters. Try adjusting the role or employee filter.
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {filteredEmployees.map((employee) => {
              const employeeAttendance = attendanceByEmployee.get(employee.id) ?? [];
              
              return (
                <EmployeeAttendanceCard
                  key={employee.id}
                  employee={{
                    id: employee.id,
                    name: `${employee.firstName} ${employee.lastName}`,
                    position: getEmployeeRoleLabel(employee.role),
                    avatar: "",
                    fullDays: 0,
                    halfDays: 0,
                    absent: 0,
                  attendance: employeeAttendance.map(att => ({
                    date: att.checkinDate,
                    status:
                      att.attendanceStatus === 'full day'
                        ? 'present'
                        : att.attendanceStatus === 'half day'
                          ? 'half'
                          : 'absent',
                    visits: []
                  }))
                  }}
                  selectedMonth={selectedMonth}
                  selectedYear={selectedYear}
                  attendanceData={employeeAttendance.map(a => ({
                    id: a.id,
                    employeeId: a.employeeId,
                    employeeName: a.employeeName,
                    attendanceStatus: a.attendanceStatus === 'Absent' ? 'absent' : a.attendanceStatus,
                    checkinDate: a.checkinDate,
                    checkoutDate: a.checkoutDate,
                    rawStatus: String((a as unknown as Record<string, unknown>).rawStatus || '')
                  }))}
                  onDateClick={(date, employeeName) => fetchVisitData(date, employeeName)}
                />
              );
            })}
          </div>
        )}
      </div>

      <VisitDetailsModal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setSelectedDayLog(null);
          setSelectedDayRequest(null);
        }}
        visitData={visitData as Record<string, unknown>[]}
        selectedDate={selectedDate}
        employeeName={selectedEmployeeName}
        dayLog={selectedDayLog}
        dayRequest={selectedDayRequest}
      />
    </div>
  );
}
