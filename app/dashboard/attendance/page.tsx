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
import { API } from "@/lib/api";
import { getEmployeeRoleCategory, getEmployeeRoleLabel, isAdminEmployeeRole } from "@/lib/employee-role";

interface AttendanceData {
  id: number;
  employeeId: number;
  employeeName: string;
  attendanceStatus: 'full day' | 'half day' | 'Absent';
  checkinDate: string;
  checkoutDate: string;
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

  // Get token from localStorage (you may need to adjust this based on your auth setup)
  const token = typeof window !== 'undefined' ? localStorage.getItem('authToken') : null;

  const fetchEmployees = useCallback(async () => {
    if (!token) {
      console.error("Auth token is missing");
      return;
    }

    try {
      const data = await API.getAllEmployees<Employee>();
      setEmployees(data.filter((employee) => !isAdminEmployeeRole(employee.role)));
    } catch (error) {
      console.error("Error fetching employees:", error);
    }
  }, [token]);

  const fetchAttendanceData = useCallback(async () => {
    setIsLoading(true);

    if (!token) {
      console.error("Auth token is missing");
      setIsLoading(false);
      return;
    }

    const monthPrefix = `${selectedYear}-${String(selectedMonth + 1).padStart(2, '0')}`;
    const startDate = `${monthPrefix}-01`;
    const endDate = `${monthPrefix}-${new Date(selectedYear, selectedMonth + 1, 0).getDate()}`;

    try {
      const response = await fetch(
        `http://ec2-18-211-58-135.compute-1.amazonaws.com:8081/attendance-log/getForRange1?start=${startDate}&end=${endDate}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (!response.ok) {
        throw new Error("Failed to fetch attendance data");
      }

      const data = await response.json();

      const modifiedData = data.map((item: Record<string, unknown>) => {
        // Preserve original status for breakdowns
        const originalStatus = typeof item.attendanceStatus === "string" ? item.attendanceStatus : "";
        const normalizedOriginal = originalStatus.trim().toLowerCase();

        // Normalize the attendance status values used by calendar/summary
        // Note: "present" is treated as "absent" per business requirements
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

        return { ...item, attendanceStatus: normalizedStatus, rawStatus: originalStatus };
      });

      setAttendanceData(modifiedData);
      setNoDataMessage("");

      if (data.length === 0) {
        setNoDataMessage("No data available for the selected month and year. Please choose a different month or year.");
      }
    } catch (error) {
      console.error("Error fetching attendance data:", error);
      setAttendanceData([]);
      setNoDataMessage("No data available for the selected month and year. Please choose a different month or year.");
    }

    setIsLoading(false);
  }, [token, selectedYear, selectedMonth]);

  const fetchVisitData = useCallback(
    async (date: string, employeeName: string) => {
      if (!token) {
        console.error("Auth token is missing");
        return;
      }

      try {
        const url = `http://ec2-18-211-58-135.compute-1.amazonaws.com:8081/visit/getByDateSorted?startDate=${date}&endDate=${date}&employeeName=${employeeName}&page=0&size=100&sort=id,desc`;
        
        console.log('Making API request to:', url);
        console.log('Request params:', { date, employeeName, token: token ? 'Present' : 'Missing' });
        
        const response = await fetch(url, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        if (!response.ok) {
          throw new Error("Failed to fetch visit data");
        }

        const data = await response.json();
        
        console.log('Visit API Response:', {
          date,
          employeeName,
          totalElements: data.totalElements,
          contentLength: data.content?.length,
          content: data.content
        });

        // The API already filters by employeeName, so we can use all the content directly
        setVisitData(data.content || []);
        setSelectedDate(date);
        setSelectedEmployeeName(employeeName);
        setIsModalOpen(true);

        if (data.content.length === 0) {
          setVisitData([]);
        }
      } catch (error) {
        console.error("Error fetching visit data:", error);
        setVisitData([]);
      }
    },
    [token]
  );

  useEffect(() => {
    if (!isFiltersHydrated) return;
    fetchAttendanceData();
    fetchEmployees();
  }, [isFiltersHydrated, selectedYear, selectedMonth, token, fetchAttendanceData, fetchEmployees]);

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
                <SelectItem value="regional-manager">Regional Manager</SelectItem>
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

      {noDataMessage && <p className="mb-4 text-red-500">{noDataMessage}</p>}

      <div className="space-y-4">
        {isLoading ? (
          Array.from({ length: 5 }).map((_, index) => (
            <div key={index} className="h-48 bg-gray-200 animate-pulse rounded-lg"></div>
          ))
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
        onClose={() => setIsModalOpen(false)}
        visitData={visitData as Record<string, unknown>[]}
        selectedDate={selectedDate}
        employeeName={selectedEmployeeName}
      />
    </div>
  );
}
