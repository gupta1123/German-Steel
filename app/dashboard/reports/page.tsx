'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '@/components/auth-provider';
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { 
  CalendarIcon, 
  DownloadIcon, 
  Building,
  Loader
} from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { SpacedCalendar } from "@/components/ui/spaced-calendar";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import Link from "@/components/guarded-link";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import NewCustomersReport from "@/components/NewCustomersReport";
import SalesPerformanceReport from "@/components/SalesPerformanceReport";
import FieldOfficerPerformanceReport from "@/components/FieldOfficerPerformanceReport";
import dayjs from 'dayjs';
import { API } from '@/lib/api';
import { hasManagerPrivileges } from '@/lib/auth';
import { getUniqueFieldOfficersFromTeams } from '@/lib/team-access';
import { DateRangeError, isDateRangeInvalid } from '@/components/date-range-error';
import { SearchableSelect } from '@/components/ui/searchable-select2';
import { formatCityLabel } from '@/lib/city-options';

interface AttendanceStats {
    absences: number;
    halfDays: number;
    fullDays: number;
}

interface VisitsByCustomerType {
    [key: string]: number; 
}

interface FieldOfficerStatsResponse {
    totalVisits: number;
    attendanceStats: AttendanceStats;
    completedVisits: number;
    visitsByCustomerType: VisitsByCustomerType;
}

const CUSTOMER_CATEGORIES = ["Shop", "Site Visit", "Architect", "Engineer", "Builder", "Others"] as const;

type ReportSummaryData = FieldOfficerStatsResponse & {
    categorizedVisits: Record<(typeof CUSTOMER_CATEGORIES)[number], number>;
};

interface EmployeeUserDto {
    username: string;
    password?: string | null;
    roles?: string[] | null;
    employeeId?: string | null;
    firstName?: string | null;
    lastName?: string | null;
    plainPassword?: string;
}

interface Employee {
    id: number;
    firstName: string;
    lastName: string;
    employeeId: string;
    primaryContact: number;
    secondaryContact?: number;
    departmentName: string;
    email: string;
    role: string; 
    addressLine1: string;
    addressLine2?: string;
    city: string;
    state: string;
    country: string;
    pincode: number;
    dateOfJoining: string;
    createdAt: string;
    updatedAt: string;
    userDto?: EmployeeUserDto;
    teamId?: string | null;
    isOfficeManager?: boolean;
    assignedCity?: string[];
    travelAllowance?: number | null;
    dearnessAllowance?: number | null;
    createdTime?: string;
    updatedTime?: string;
    companyId?: string | null;
    companyName?: string | null;
    fullMonthSalary?: number | null;
    status?: string | null; 
}

type FieldOfficerOption = {
    value: string;
    label: string;
};

interface VisitDetail {
    avgIntentLevel: number;
    avgMonthlySales: number;
    visitCount: number;
    lastVisited: string; 
    city: string;
    taluka: string;
    state: string;
    customerName: string;
    customerType: string; 
    storeId: number; 
}

const formatSalesNumber = (num: number): string => {
    if (num >= 10000000) { // Crores
        const val = num / 10000000;
        return (val % 1 === 0 ? val.toFixed(0) : val.toFixed(1)) + 'Cr';
    }
    if (num >= 100000) { // Lakhs
        const val = num / 100000;
        return (val % 1 === 0 ? val.toFixed(0) : val.toFixed(1)) + 'L';
    }
    if (num >= 1000) { // Thousands
        const val = num / 1000;
        return (val % 1 === 0 ? val.toFixed(0) : val.toFixed(1)) + 'K';
    }
    return num.toString();
};

async function fetchWithRetry(url: string, options: RequestInit, retries = 6, delay = 1000): Promise<Response> {
    for (let i = 0; i < retries; i++) {
        try {
            const response = await fetch(url, options);
            if (!response.ok) throw new Error(await response.text() || response.statusText);
            return response;
        } catch (err) {
            if (i === retries - 1) throw err;
            await new Promise(res => setTimeout(res, delay));
        }
    }
    throw new Error('Failed after retries');
}

const ReportsPage: React.FC = () => {
    const { token, userRole, currentUser, userData } = useAuth();

    const [fieldOfficers, setFieldOfficers] = useState<Employee[]>([]);
    const [employeesLoading, setEmployeesLoading] = useState<boolean>(true);
    const [employeesError, setEmployeesError] = useState<string | null>(null);

    const [selectedEmployeeId, setSelectedEmployeeId] = useState<string>('');
    const [rangeSelect, setRangeSelect] = useState<string>('');
    
    const [startDate, setStartDate] = useState<string>('');
    const [endDate, setEndDate] = useState<string>('');
    const dateRangeInvalid = isDateRangeInvalid(startDate, endDate);

    const [isStartDatePopoverOpen, setIsStartDatePopoverOpen] = useState(false);
    const [isEndDatePopoverOpen, setIsEndDatePopoverOpen] = useState(false);

    const [reportLoading, setReportLoading] = useState<boolean>(false);
    const [reportError, setReportError] = useState<string | null>(null);

    const [showReport, setShowReport] = useState<boolean>(false);
    const [reportSummary, setReportSummary] = useState<ReportSummaryData | null>(null);

    const [visitDetails, setVisitDetails] = useState<VisitDetail[] | null>(null);
    const [detailsLoading, setDetailsLoading] = useState<boolean>(false);
    const [detailsError, setDetailsError] = useState<string | null>(null);
    const [selectedCustomerTypeForDetails, setSelectedCustomerTypeForDetails] = useState<string | null>(null);
    const [dateRangeError, setDateRangeError] = useState<string | null>(null);

    useEffect(() => {
        const fetchAllEmployeeData = async () => {
            if (!token) return;
            
            setEmployeesLoading(true);
            setEmployeesError(null);
            try {
                const [allEmployees, inactiveEmployeesResponse] = await Promise.all([
                    API.getAllEmployees<Employee>(),
                    fetch('http://ec2-18-211-58-135.compute-1.amazonaws.com:8081/employee/getAllInactive', {
                        headers: { Authorization: `Bearer ${token}` },
                    }),
                ]);
                if (!inactiveEmployeesResponse.ok) throw new Error(`Failed to fetch inactive employees: ${inactiveEmployeesResponse.statusText}`);
                const inactiveEmployees: Employee[] = await inactiveEmployeesResponse.json();
                const inactiveEmployeeIds = new Set(inactiveEmployees.map(emp => emp.id));
                const isManager = hasManagerPrivileges(userRole, currentUser);
                let scopedFieldOfficerIds: Set<number> | null = null;

                if (isManager) {
                    if (!userData?.employeeId) {
                        scopedFieldOfficerIds = new Set();
                    } else {
                        const teamData = await API.getTeamByEmployee(userData.employeeId);
                        scopedFieldOfficerIds = new Set(getUniqueFieldOfficersFromTeams(teamData).map((officer) => officer.id));
                    }
                }

                const activeFieldOfficers = allEmployees
                    .filter(emp => emp.role === 'Field Officer' && !inactiveEmployeeIds.has(emp.id))
                    .filter(emp => scopedFieldOfficerIds === null || scopedFieldOfficerIds.has(emp.id))
                    .sort((a, b) => {
                        const nameA = `${a.firstName} ${a.lastName}`.toLowerCase();
                        const nameB = `${b.firstName} ${b.lastName}`.toLowerCase();
                        if (nameA < nameB) return -1;
                        if (nameA > nameB) return 1;
                        return 0;
                    });
                setFieldOfficers(activeFieldOfficers);
                setSelectedEmployeeId((currentEmployeeId) =>
                    activeFieldOfficers.some((employee) => employee.id.toString() === currentEmployeeId)
                        ? currentEmployeeId
                        : ''
                );
            } catch (err) {
                setEmployeesError((err as Error).message || 'Could not fetch employee data.');
                setFieldOfficers([]);
                setSelectedEmployeeId('');
            } finally {
                setEmployeesLoading(false);
            }
        };
        if (token) fetchAllEmployeeData();
    }, [token, userRole, currentUser, userData?.employeeId]);

    useEffect(() => {
        const now = new Date();
        let startDt: Date | undefined, endDt: Date | undefined;
        switch (rangeSelect) {
            case 'last-7-days': endDt = new Date(now); startDt = new Date(now); startDt.setDate(now.getDate() - 6); break;
            case 'last-15-days': endDt = new Date(now); startDt = new Date(now); startDt.setDate(now.getDate() - 14); break;
            case 'last-30-days': endDt = new Date(now); startDt = new Date(now); startDt.setDate(now.getDate() - 29); break;
            case 'this-week': { const day = now.getDay(); startDt = new Date(now); startDt.setDate(now.getDate() - day); endDt = new Date(now); break; } // Cap at today
            case 'this-month': { const y = now.getFullYear(), m = now.getMonth(); startDt = new Date(y, m, 1); endDt = new Date(now); break; } // Cap at today
            case 'last-week': { const day = now.getDay(); startDt = new Date(now); startDt.setDate(now.getDate() - (day + 6)); endDt = new Date(startDt); endDt.setDate(startDt.getDate() + 6); break; }
            case 'last-month': { const y = now.getFullYear(), m = now.getMonth(); startDt = new Date(y, m - 1, 1); endDt = new Date(y, m, 0); break; }
            default: return;
        }
        setStartDate(dayjs(startDt).format('YYYY-MM-DD'));
        setEndDate(dayjs(endDt).format('YYYY-MM-DD'));
    }, [rangeSelect]);

    const displayCategoryToApiTypeMap: { [displayCategory: string]: string } = {
        "Shop": "shop",
        "Site Visit": "site visit",
        "Architect": "architect",
        "Engineer": "engineer",
        "Builder": "builder",
        "Others": "others"
    };

    const fetchCustomerTypeDetails = async (displayCategory: string) => {
        if (!selectedEmployeeId || !startDate || !endDate || dateRangeInvalid) {
            setDetailsError("Please generate the main report first.");
            return;
        }
        setDetailsLoading(true);
        setDetailsError(null);
        setVisitDetails(null); 
        setSelectedCustomerTypeForDetails(displayCategory);

        const apiCustomerType = displayCategoryToApiTypeMap[displayCategory] || displayCategory.toLowerCase();

        try {
            const url = `http://ec2-18-211-58-135.compute-1.amazonaws.com:8081/visit/customer-visit-details?employeeId=${selectedEmployeeId}&startDate=${startDate}&endDate=${endDate}&customerType=${apiCustomerType}`;
            const response = await fetchWithRetry(url, { headers: { Authorization: `Bearer ${token}` } }, 6, 1000);
            const data: VisitDetail[] = await response.json();
            setVisitDetails(data);
        } catch (err) {
            setDetailsError((err as Error).message || `Failed to fetch details for ${displayCategory}.`);
            setVisitDetails(null);
        } finally {
            setDetailsLoading(false);
        }
    };

    const handleGenerateReport = async () => {
        if (!rangeSelect) {
            setDateRangeError('Please select a Date Range.');
            return;
        }
        if (dateRangeInvalid) {
            return;
        }
        if (!selectedEmployeeId || !startDate || !endDate) {
            setDateRangeError(null);
            alert('Select an officer and both dates.');
        return;
    }
        setDateRangeError(null);
        setReportLoading(true); setReportError(null); setShowReport(false);
        try {
            const url = `http://ec2-18-211-58-135.compute-1.amazonaws.com:8081/visit/field-officer-stats?employeeId=${selectedEmployeeId}&startDate=${startDate}&endDate=${endDate}`;
            const response = await fetchWithRetry(url, { headers: { Authorization: `Bearer ${token}` } }, 6, 1000);
            const data: FieldOfficerStatsResponse = await response.json();

            const apiTypeToDisplayCategoryMap: Record<string, (typeof CUSTOMER_CATEGORIES)[number]> = {
                "shop": "Shop",
                "site visit": "Site Visit",
                "architect": "Architect", 
                "engineer": "Engineer",
                "builder": "Builder"
            };

            const categorizedVisits = Object.fromEntries(
                CUSTOMER_CATEGORIES.map((category) => [category, 0])
            ) as ReportSummaryData["categorizedVisits"];

            for (const apiType in data.visitsByCustomerType) {
                const count = data.visitsByCustomerType[apiType];
                const targetDisplayCategory = apiTypeToDisplayCategoryMap[apiType.toLowerCase()];

                if (targetDisplayCategory) {
                    categorizedVisits[targetDisplayCategory] += count;
                } else {
                    categorizedVisits["Others"] += count;
                }
            }

            setReportSummary({ ...data, categorizedVisits });
            setShowReport(true);
            setVisitDetails(null);
            setDetailsError(null);
            setSelectedCustomerTypeForDetails(null);
        } catch (err) {
            setReportError((err as Error).message || 'Failed to fetch report data.');
            setShowReport(false);
        } finally {
            setReportLoading(false);
        }
    };

    const handleStartDateSelect = (date: Date | undefined) => {
        if (date) {
            setStartDate(dayjs(date).format('YYYY-MM-DD'));
            if (endDate && dayjs(date).isAfter(dayjs(endDate))) {
                setEndDate('');
            }
        }
        setIsStartDatePopoverOpen(false);
    };

    const handleEndDateSelect = (date: Date | undefined) => {
        if (date) {
            setEndDate(dayjs(date).format('YYYY-MM-DD'));
        }
        setIsEndDatePopoverOpen(false);
    };
    
    const fieldOfficerOptions = useMemo<FieldOfficerOption[]>(() => {
        return fieldOfficers.map((employee) => ({
            value: employee.id.toString(),
            label: `${employee.firstName} ${employee.lastName}`,
        }));
    }, [fieldOfficers]);

    const selectedFieldOfficerOption = useMemo(() => {
        return fieldOfficerOptions.find((option) => option.value === selectedEmployeeId) ?? null;
    }, [fieldOfficerOptions, selectedEmployeeId]);

    const selectedEmployeeName = selectedFieldOfficerOption?.label || "Select Field Officer";

  return (
    <div className="min-w-0 space-y-5 overflow-visible">
      <Tabs defaultValue="fieldOfficerReport" className="w-full min-w-0">
        <div className="mb-4 overflow-x-auto rounded-lg border bg-card p-1 shadow-sm">
          <TabsList className="flex h-9 w-max min-w-full justify-start gap-1 bg-transparent p-0">
            <TabsTrigger value="fieldOfficerReport">Field Officer Visit Report</TabsTrigger>
            <TabsTrigger value="fieldOfficerPerformance">Field Officer Performance</TabsTrigger>
            <TabsTrigger value="newCustomers">New Customers Report</TabsTrigger>
            <TabsTrigger value="salesPerformance">Sales Performance Report</TabsTrigger>
          </TabsList>
        </div>
        
        <TabsContent value="fieldOfficerReport" className="space-y-5">
                <div className="space-y-5">
                    <div className="grid grid-cols-1 gap-x-4 gap-y-3 border-b pb-4 sm:grid-cols-2 xl:grid-cols-[minmax(220px,1.3fr)_minmax(145px,.8fr)_minmax(155px,.9fr)_minmax(155px,.9fr)_minmax(180px,auto)] xl:items-end">
                        <div className="min-w-0 space-y-1.5">
                            <Label htmlFor="employeeSelectTrigger" className="text-xs font-medium text-foreground">Field officer</Label>
                            {employeesLoading ? (
                                <div className="flex items-center justify-center h-10 w-full">
                                    <Loader className="w-4 h-4 animate-spin text-muted-foreground"/>
                                </div>
                            ) : employeesError ? (
                                <div className="text-destructive text-sm">Error loading officers</div>
                            ) : (
                                <SearchableSelect
                                    triggerId="employeeSelectTrigger"
                                    placeholder="Select Field Officer"
                                    options={fieldOfficerOptions}
                                    value={selectedEmployeeId || undefined}
                                    onSelect={(option) => setSelectedEmployeeId(option?.value ?? '')}
                                    searchPlaceholder="Search officers..."
                                    emptyMessage="No matching officers"
                                    allowClear
                                    loading={employeesLoading}
                                    disabled={fieldOfficerOptions.length === 0}
                                    triggerClassName="h-9 w-full"
                                    contentClassName="w-[min(360px,calc(100vw-2rem))]"
                                />
                            )}
            </div>
            
            <div className="min-w-0 space-y-1.5">
                            <Label htmlFor="rangeSelectTrigger" className="text-xs font-medium text-foreground">Date range</Label>
                            <Select value={rangeSelect} onValueChange={(value) => { 
                                setRangeSelect(value); 
                                setDateRangeError(null);
                                if (value === 'custom') {
                                    setStartDate('');
                                    setEndDate('');
                                }
                            }}>
                                <SelectTrigger id="rangeSelectTrigger" className="h-9 w-full">
                                    <SelectValue placeholder="Select Range" />
                </SelectTrigger>
                <SelectContent>
                                    <SelectItem value="custom">Custom</SelectItem>
                                    <SelectItem value="last-7-days">Last 7 Days</SelectItem>
                                    <SelectItem value="last-15-days">Last 15 Days</SelectItem>
                                    <SelectItem value="last-30-days">Last 30 Days</SelectItem>
                                    <SelectItem value="this-week">This Week</SelectItem>
                                    <SelectItem value="this-month">This Month</SelectItem>
                                    <SelectItem value="last-week">Last Week</SelectItem>
                                    <SelectItem value="last-month">Last Month</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div className="min-w-0 space-y-1.5">
                            <Label htmlFor="startDateTrigger" className="text-xs font-medium text-foreground">From date</Label>
                            <Popover open={isStartDatePopoverOpen} onOpenChange={setIsStartDatePopoverOpen}>
                <PopoverTrigger asChild>
                  <Button
                                        id="startDateTrigger"
                    variant="outline"
                                        className={cn("h-9 w-full justify-start text-left font-normal", !startDate && "text-muted-foreground", rangeSelect !== 'custom' && rangeSelect !== '' && "opacity-50 cursor-not-allowed")}
                                        disabled={rangeSelect !== 'custom' && rangeSelect !== ''}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                                        {startDate ? dayjs(startDate).format('MMM DD, YYYY') : <span>Pick a date</span>}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <SpacedCalendar
                                        mode="single"
                                        selected={startDate ? dayjs(startDate).toDate() : undefined}
                                        onSelect={handleStartDateSelect}
                    initialFocus
                                    />
                                </PopoverContent>
                            </Popover>
                        </div>
            
                        <div className="min-w-0 space-y-1.5">
                            <Label htmlFor="endDateTrigger" className="text-xs font-medium text-foreground">To date</Label>
                            <Popover open={isEndDatePopoverOpen} onOpenChange={setIsEndDatePopoverOpen}>
                                <PopoverTrigger asChild>
                                    <Button
                                        id="endDateTrigger"
                                        variant="outline"
                                        className={cn("h-9 w-full justify-start text-left font-normal", !endDate && "text-muted-foreground", rangeSelect !== 'custom' && rangeSelect !== '' && "opacity-50 cursor-not-allowed")}
                                        disabled={rangeSelect !== 'custom' && rangeSelect !== ''}
                                    >
                                        <CalendarIcon className="mr-2 h-4 w-4" />
                                        {endDate ? dayjs(endDate).format('MMM DD, YYYY') : <span>Pick a date</span>}
                                    </Button>
                                </PopoverTrigger>
                                <PopoverContent className="w-auto p-0" align="start">
                                    <SpacedCalendar
                                        mode="single"
                                        selected={endDate ? dayjs(endDate).toDate() : undefined}
                                        onSelect={handleEndDateSelect}
                                        disabled={startDate ? { before: dayjs(startDate).toDate() } : undefined}
                                        initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>
            
            <div className="flex flex-col justify-end gap-2 sm:col-span-2 xl:col-span-1">
                            <DateRangeError fromDate={startDate} toDate={endDate} />
                            <Button
                                onClick={handleGenerateReport}
                                className="h-9 w-full min-w-[160px] whitespace-nowrap"
                                disabled={reportLoading || fieldOfficers.length === 0 || !selectedEmployeeId || !startDate || !endDate || dateRangeInvalid}
                            >
                                {reportLoading ? (
                                    <>
                                        <Loader className="mr-2 h-4 w-4 animate-spin" />
                                        Generating...
                                    </>
                                ) : (
                                    <>
                <DownloadIcon className="mr-2 h-4 w-4" />
                Generate report
                                    </>
                                )}
              </Button>
            </div>
          </div>

                    {dateRangeError && (
                        <div className="p-3 text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded-md">
                            {dateRangeError}
                        </div>
                    )}

                    {reportLoading && (
                        <div className="flex justify-center items-center py-12">
                            <div className="flex flex-col items-center gap-3">
                                <Loader className="w-8 h-8 animate-spin text-primary" />
                                <p className="text-sm text-muted-foreground">Generating report...</p>
                            </div>
                        </div>
                    )}
                    
                    {reportError && (
                        <div className="p-4 text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded-md">
                            <div className="flex items-center justify-between">
                                <p><strong>Error:</strong> {reportError}</p>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={handleGenerateReport}
                                    disabled={reportLoading}
                                >
                                    Try Again
                                </Button>
                            </div>
                        </div>
                    )}
                    {showReport && reportSummary && !reportLoading && !reportError && (
                        <section className="border-y bg-card/30">
                            <div className="border-b px-1 py-3">
                                <h3 className="text-sm font-semibold text-foreground">Report summary</h3>
                                <p className="mt-0.5 text-xs text-muted-foreground">Visits and attendance for the selected period. Choose a customer type to inspect its visits.</p>
                            </div>
                            <div className="grid lg:grid-cols-[.8fr_1.15fr_2.1fr]">
                                <div className="py-4 pr-5 lg:border-r">
                                    <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Visits</p>
                                    <div className="mt-2 grid grid-cols-2 gap-2">
                                        <div className="flex min-h-16 flex-col items-center justify-center rounded-md bg-muted/35 px-2 py-2 text-center"><p className="text-xl font-semibold leading-none tabular-nums">{reportSummary.totalVisits}</p><p className="mt-1.5 text-xs leading-none text-muted-foreground">Total</p></div>
                                        <div className="flex min-h-16 flex-col items-center justify-center rounded-md bg-muted/35 px-2 py-2 text-center"><p className="text-xl font-semibold leading-none tabular-nums">{reportSummary.completedVisits}</p><p className="mt-1.5 text-xs leading-none text-muted-foreground">Completed</p></div>
                                    </div>
                                </div>
                                <div className="border-t py-4 lg:border-r lg:border-t-0 lg:px-5">
                                    <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Attendance</p>
                                    <div className="mt-2 grid grid-cols-3 gap-2">
                                        <div className="flex min-h-16 flex-col items-center justify-center rounded-md bg-muted/35 px-2 py-2 text-center"><p className="text-xl font-semibold leading-none tabular-nums">{reportSummary.attendanceStats.fullDays}</p><p className="mt-1.5 text-xs leading-none text-muted-foreground">Full days</p></div>
                                        <div className="flex min-h-16 flex-col items-center justify-center rounded-md bg-muted/35 px-2 py-2 text-center"><p className="text-xl font-semibold leading-none tabular-nums">{reportSummary.attendanceStats.halfDays}</p><p className="mt-1.5 text-xs leading-none text-muted-foreground">Half days</p></div>
                                        <div className="flex min-h-16 flex-col items-center justify-center rounded-md bg-muted/35 px-2 py-2 text-center"><p className="text-xl font-semibold leading-none tabular-nums">{reportSummary.attendanceStats.absences}</p><p className="mt-1.5 text-xs leading-none text-muted-foreground">Absent</p></div>
                                    </div>
                                </div>
                                <div className="border-t py-4 lg:border-t-0 lg:pl-5">
                                    <div className="flex items-center justify-between gap-3">
                                        <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Customer types</p>
                                        <p className="text-[11px] text-muted-foreground">Select to view visits</p>
                                    </div>
                                    <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-6">
                                        {CUSTOMER_CATEGORIES.map((category) => (
                                            <button
                                                key={category}
                                                type="button"
                                                disabled={reportLoading || detailsLoading}
                                                onClick={() => fetchCustomerTypeDetails(category)}
                                                className={cn(
                                                    "group flex min-h-16 cursor-pointer flex-col items-center justify-center rounded-md border bg-background px-2 py-2 text-center transition-[border-color,background-color,box-shadow,transform] hover:-translate-y-0.5 hover:border-primary/50 hover:bg-primary/[0.04] hover:shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-wait disabled:opacity-60",
                                                    selectedCustomerTypeForDetails === category && "border-primary bg-primary/10 text-primary shadow-sm"
                                                )}
                                            >
                                                <span className="block text-xl font-semibold leading-none tabular-nums">{reportSummary.categorizedVisits[category]}</span>
                                                <span className={cn("mt-1.5 block max-w-full truncate text-xs leading-none text-muted-foreground group-hover:text-foreground", selectedCustomerTypeForDetails === category && "text-primary")}>{category}</span>
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        </section>
                    )}

                    {selectedCustomerTypeForDetails && (
                        <section className="border-t bg-card/20">
                            <div className="border-b px-1 py-3">
                                <h3 className="text-sm font-semibold text-foreground">
                                    {selectedCustomerTypeForDetails} visits
                                </h3>
                                <p className="mt-0.5 text-xs text-muted-foreground">
                                    {selectedEmployeeName !== "Select Field Officer" && `${selectedEmployeeName} · ${dayjs(startDate).format('MMM DD, YYYY')} – ${dayjs(endDate).format('MMM DD, YYYY')}`}
                                </p>
                            </div>
                            
                            {detailsLoading && (
                                <div className="flex justify-center items-center py-12">
                                    <div className="flex flex-col items-center gap-3">
                                        <Loader className="w-8 h-8 animate-spin text-primary" />
                                        <p className="text-sm text-muted-foreground">Loading visit details...</p>
                                    </div>
                                </div>
                            )}
                            
                            {detailsError && (
                                <div className="p-4 text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded-md m-4">
                                    <p><strong>Error:</strong> {detailsError}</p>
                                </div>
                            )}
                            
                            {!detailsLoading && !detailsError && visitDetails && (
                                visitDetails.length > 0 ? (
                                    <div className="overflow-x-auto">
                  <Table>
                    <TableHeader className="bg-muted/30">
                      <TableRow>
                        <TableHead>Customer</TableHead>
                        <TableHead>City</TableHead>
                        <TableHead>Taluka</TableHead>
                        <TableHead>State</TableHead>
                        <TableHead>Last visited</TableHead>
                        <TableHead>Visits</TableHead>
                        <TableHead>Monthly sales</TableHead>
                        <TableHead>Intent</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                                                {visitDetails
                                                    .slice()
                                                    .sort((a, b) => {
                                                        const dateA = new Date(a.lastVisited).getTime();
                                                        const dateB = new Date(b.lastVisited).getTime();
                                                        return dateB - dateA;
                                                    })
                                                    .map((detail, index) => (
                                                        <TableRow key={index}>
                                                            <TableCell className="font-medium">
                                                                <Link href={`/CustomerDetailPage/${detail.storeId}`} className="text-primary hover:text-primary/80 hover:underline">
                                                                    {detail.customerName}
                                                                </Link>
                                                            </TableCell>
                                                            <TableCell>{formatCityLabel(detail.city)}</TableCell>
                                                            <TableCell>{detail.taluka}</TableCell>
                                                            <TableCell>{detail.state}</TableCell>
                                                            <TableCell>{dayjs(detail.lastVisited).format('MMM DD, YYYY')}</TableCell>
                                                            <TableCell>{detail.visitCount}</TableCell>
                                                            <TableCell>
                                                                {(() => {
                                                                    const val = detail.avgMonthlySales;
                                                                    if (val % 1 === 0) return formatSalesNumber(val);
                                                                    const rounded = Math.round(val * 10) / 10;
                                                                    return formatSalesNumber(rounded);
                                                                })()}
                                                            </TableCell>
                                                            <TableCell>
                                                                <Badge variant="secondary">
                                                                    {Number.isInteger(detail.avgIntentLevel) ? detail.avgIntentLevel : detail.avgIntentLevel.toFixed(1)}
                                                                </Badge>
                                                            </TableCell>
                          </TableRow>
                        ))}
                    </TableBody>
                  </Table>
                </div>
                                ) : (
                                    <div className="p-8 text-center">
                                        <Building className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                                        <p className="text-muted-foreground">No visit details found for {selectedCustomerTypeForDetails}</p>
                                    </div>
                                )
                            )}
                        </section>
                    )}
                </div>
        </TabsContent>

        <TabsContent value="fieldOfficerPerformance" className="space-y-6">
          <FieldOfficerPerformanceReport
            officers={fieldOfficers}
            officersLoading={employeesLoading}
            officersError={employeesError}
          />
        </TabsContent>
        
        <TabsContent value="newCustomers" className="space-y-6">
          <NewCustomersReport />
        </TabsContent>

        <TabsContent value="salesPerformance" className="space-y-6">
          <SalesPerformanceReport />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default ReportsPage;
