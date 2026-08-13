'use client';

import React, { useState, useEffect, useMemo } from 'react';
import ReactSelect, { type SingleValue, type StylesConfig } from 'react-select';
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
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { 
  CalendarIcon, 
  DownloadIcon, 
  Building,
  MapPin,
  User,
  Target,
  TrendingUp,
  Loader
} from "lucide-react";
import { format, subDays, startOfMonth, endOfMonth } from "date-fns";
import { DateRange } from "react-day-picker";
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
import Link from "next/link";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import NewCustomersReport from "@/components/NewCustomersReport";
import SalesPerformanceReport from "@/components/SalesPerformanceReport";
import MonthlyTargetPage from "@/app/dashboard/reports/monthly-target/page";
import dayjs from 'dayjs';
import { API } from '@/lib/api';
import { hasManagerPrivileges } from '@/lib/auth';
import { getUniqueFieldOfficersFromTeams } from '@/lib/team-access';

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

    const [isStartDatePopoverOpen, setIsStartDatePopoverOpen] = useState(false);
    const [isEndDatePopoverOpen, setIsEndDatePopoverOpen] = useState(false);

    const [reportLoading, setReportLoading] = useState<boolean>(false);
    const [reportError, setReportError] = useState<string | null>(null);

    const [showReport, setShowReport] = useState<boolean>(false);
    const [summaryHeader, setSummaryHeader] = useState<React.ReactNode>(null);
    const [summaryRow, setSummaryRow] = useState<React.ReactNode>(null);

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
                if (activeFieldOfficers.length > 0 && (!selectedEmployeeId || !activeFieldOfficers.some(emp => emp.id.toString() === selectedEmployeeId))) {
                    setSelectedEmployeeId(activeFieldOfficers[0].id.toString());
                } else if (activeFieldOfficers.length === 0) {
                    setSelectedEmployeeId('');
                }
            } catch (err) {
                setEmployeesError((err as Error).message || 'Could not fetch employee data.');
                setFieldOfficers([]);
            } finally {
                setEmployeesLoading(false);
            }
        };
        if (token) fetchAllEmployeeData();
    }, [token, userRole, currentUser, userData?.employeeId, selectedEmployeeId]);

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
        if (!selectedEmployeeId || !startDate || !endDate) {
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

            const displayCategories = ["Shop", "Site Visit", "Architect", "Engineer", "Builder", "Others"];
            const apiTypeToDisplayCategoryMap: { [apiTypeLowercase: string]: string } = {
                "shop": "Shop",
                "site visit": "Site Visit",
                "architect": "Architect", 
                "engineer": "Engineer",
                "builder": "Builder"
            };

            const categorizedVisits: { [key: string]: number } = {};
            displayCategories.forEach(cat => categorizedVisits[cat] = 0); 

            for (const apiType in data.visitsByCustomerType) {
                const count = data.visitsByCustomerType[apiType];
                const targetDisplayCategory = apiTypeToDisplayCategoryMap[apiType.toLowerCase()];

                if (targetDisplayCategory) {
                    categorizedVisits[targetDisplayCategory] += count;
                } else {
                    categorizedVisits["Others"] += count;
                }
            }

            setSummaryHeader(
                <>
                    <tr>
                        <th rowSpan={2}>Total Visits</th><th rowSpan={2}>Completed Visits</th>
                        <th colSpan={3}>Attendance</th><th colSpan={displayCategories.length}>Visits by Customer Type</th>
                    </tr>
                    <tr>
                        <th>Full Days</th><th>Half Days</th><th>Absences</th>
                        {displayCategories.map(displayCat => (
                            <th key={displayCat}>
                                <button
                                    onClick={() => fetchCustomerTypeDetails(displayCat)}
                                    className="text-blue-600 underline hover:text-blue-800 bg-transparent border-none p-0 m-0 cursor-pointer disabled:text-gray-400"
                                    disabled={reportLoading || detailsLoading}
                                    type="button"
                                >
                                    {displayCat}
                                </button>
                            </th>
                        ))}
                    </tr>
                </>
            );
            setSummaryRow(
                <>
                    <td className="text-center">{data.totalVisits}</td><td className="text-center">{data.completedVisits}</td>
                    <td className="text-center">{data.attendanceStats.fullDays}</td><td className="text-center">{data.attendanceStats.halfDays}</td><td className="text-center">{data.attendanceStats.absences}</td>
                    {displayCategories.map(type => (<td key={type} className="text-center">{categorizedVisits[type]}</td>))}
                </>
            );
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

    const fieldOfficerSelectStyles: StylesConfig<FieldOfficerOption, false> = {
        control: (base, state) => ({
            ...base,
            minHeight: 40,
            borderRadius: 6,
            backgroundColor: 'hsl(var(--background))',
            borderColor: state.isFocused ? 'hsl(var(--ring))' : 'hsl(var(--input))',
            boxShadow: state.isFocused ? '0 0 0 1px hsl(var(--ring))' : 'none',
            '&:hover': {
                borderColor: state.isFocused ? 'hsl(var(--ring))' : 'hsl(var(--input))',
            },
        }),
        valueContainer: (base) => ({ ...base, paddingLeft: 12, paddingRight: 8 }),
        singleValue: (base) => ({ ...base, color: 'hsl(var(--foreground))' }),
        placeholder: (base) => ({ ...base, color: 'hsl(var(--muted-foreground))' }),
        input: (base) => ({ ...base, color: 'hsl(var(--foreground))' }),
        indicatorSeparator: (base) => ({ ...base, backgroundColor: 'hsl(var(--border))' }),
        dropdownIndicator: (base) => ({
            ...base,
            color: 'hsl(var(--muted-foreground))',
            '&:hover': { color: 'hsl(var(--foreground))' },
        }),
        clearIndicator: (base) => ({
            ...base,
            color: 'hsl(var(--muted-foreground))',
            '&:hover': { color: 'hsl(var(--foreground))' },
        }),
        menu: (base) => ({
            ...base,
            backgroundColor: 'hsl(var(--popover))',
            border: '1px solid hsl(var(--border))',
            borderRadius: 6,
            boxShadow: '0 10px 30px rgba(0,0,0,0.2)',
            overflow: 'hidden',
            zIndex: 60,
        }),
        menuList: (base) => ({ ...base, paddingTop: 4, paddingBottom: 4, maxHeight: 240 }),
        option: (base, state) => ({
            ...base,
            backgroundColor: state.isSelected
                ? 'hsl(var(--accent))'
                : state.isFocused
                    ? 'hsl(var(--muted))'
                    : 'transparent',
            color: 'hsl(var(--foreground))',
            cursor: 'pointer',
            fontSize: 14,
        }),
        noOptionsMessage: (base) => ({ ...base, color: 'hsl(var(--muted-foreground))' }),
        loadingMessage: (base) => ({ ...base, color: 'hsl(var(--muted-foreground))' }),
    };

  const formatDateRange = () => {
        if (!startDate) return "Select date range";
        if (!endDate) return dayjs(startDate).format('MMM D, YYYY');
        return `${dayjs(startDate).format('MMM D, YYYY')} - ${dayjs(endDate).format('MMM D, YYYY')}`;
  };

  return (
    <div className="min-w-0 space-y-6 overflow-hidden">
      <Tabs defaultValue="fieldOfficerReport" className="w-full min-w-0">
        <div className="mb-6 overflow-x-auto">
          <TabsList className="flex h-auto w-max min-w-full justify-start gap-2 p-1">
            <TabsTrigger value="fieldOfficerReport">Field Officer Visit Report</TabsTrigger>
            <TabsTrigger value="newCustomers">New Customers Report</TabsTrigger>
            <TabsTrigger value="salesPerformance">Sales Performance Report</TabsTrigger>
            <TabsTrigger value="monthlyTarget">Monthly Target Report</TabsTrigger>
          </TabsList>
        </div>
        
        <TabsContent value="fieldOfficerReport" className="space-y-6">
          <Card className="border-0 shadow-sm">
            <CardHeader className="pb-4">
              <CardTitle className="text-xl font-semibold text-foreground">Field Officer Visit Report</CardTitle>
              <p className="text-sm text-muted-foreground">Select a field officer and date range to generate detailed visit reports</p>
            </CardHeader>
                <CardContent className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 p-4 bg-muted/30 rounded-lg">
                        <div className="space-y-2">
                            <Label htmlFor="employeeSelectTrigger" className="text-sm font-medium text-foreground">Field Officer</Label>
                            {employeesLoading ? (
                                <div className="flex items-center justify-center h-10 w-full">
                                    <Loader className="w-4 h-4 animate-spin text-muted-foreground"/>
                                </div>
                            ) : employeesError ? (
                                <div className="text-destructive text-sm">Error loading officers</div>
                            ) : (
                                <ReactSelect
                                    inputId="employeeSelectTrigger"
                                    className="w-full"
                                    classNamePrefix="field-officer-select"
                                    placeholder="Select Field Officer"
                                    options={fieldOfficerOptions}
                                    value={selectedFieldOfficerOption}
                                    onChange={(option: SingleValue<FieldOfficerOption>) => {
                                        setSelectedEmployeeId(option?.value ?? '');
                                    }}
                                    styles={fieldOfficerSelectStyles}
                                    isSearchable
                                    isClearable
                                    isDisabled={fieldOfficerOptions.length === 0}
                                    noOptionsMessage={() => "No matching officers"}
                                    menuPlacement="auto"
                                />
                            )}
            </div>
            
            <div className="space-y-2">
                            <Label htmlFor="rangeSelectTrigger" className="text-sm font-medium text-foreground">Date Range</Label>
                            <Select value={rangeSelect} onValueChange={(value) => { 
                                setRangeSelect(value); 
                                setDateRangeError(null);
                                if (value === 'custom') {
                                    setStartDate('');
                                    setEndDate('');
                                }
                            }}>
                                <SelectTrigger id="rangeSelectTrigger" className="w-full">
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
            
            <div className="space-y-2">
                            <Label htmlFor="startDateTrigger" className="text-sm font-medium text-foreground">From Date</Label>
                            <Popover open={isStartDatePopoverOpen} onOpenChange={setIsStartDatePopoverOpen}>
                <PopoverTrigger asChild>
                  <Button
                                        id="startDateTrigger"
                    variant="outline"
                                        className={cn("w-full justify-start text-left font-normal", !startDate && "text-muted-foreground", rangeSelect !== 'custom' && rangeSelect !== '' && "opacity-50 cursor-not-allowed")}
                                        disabled={rangeSelect !== 'custom' && rangeSelect !== ''}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                                        {startDate ? dayjs(startDate).format('MMM D, YYYY') : <span>Pick a date</span>}
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
            
                        <div className="space-y-2">
                            <Label htmlFor="endDateTrigger" className="text-sm font-medium text-foreground">To Date</Label>
                            <Popover open={isEndDatePopoverOpen} onOpenChange={setIsEndDatePopoverOpen}>
                                <PopoverTrigger asChild>
                                    <Button
                                        id="endDateTrigger"
                                        variant="outline"
                                        className={cn("w-full justify-start text-left font-normal", !endDate && "text-muted-foreground", rangeSelect !== 'custom' && rangeSelect !== '' && "opacity-50 cursor-not-allowed")}
                                        disabled={rangeSelect !== 'custom' && rangeSelect !== ''}
                                    >
                                        <CalendarIcon className="mr-2 h-4 w-4" />
                                        {endDate ? dayjs(endDate).format('MMM D, YYYY') : <span>Pick a date</span>}
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
            
            <div className="flex items-end">
                            <Button
                                onClick={handleGenerateReport}
                                className="w-full sm:w-auto min-w-[180px] whitespace-nowrap"
                                disabled={reportLoading || fieldOfficers.length === 0 || !selectedEmployeeId || !startDate || !endDate}
                            >
                                {reportLoading ? (
                                    <>
                                        <Loader className="mr-2 h-4 w-4 animate-spin" />
                                        Generating...
                                    </>
                                ) : (
                                    <>
                <DownloadIcon className="mr-2 h-4 w-4" />
                Generate Report
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
                    {showReport && !reportLoading && !reportError && (
                        <div className="space-y-6">
                            <div className="rounded-lg border bg-card">
                                <div className="p-4 border-b">
                                    <h3 className="text-lg font-semibold text-foreground">Report Summary</h3>
                                    <p className="text-sm text-muted-foreground">Overview of visits, attendance, and customer types</p>
                                </div>
                                <div className="overflow-x-auto">
                <Table>
                                        <TableHeader>{summaryHeader}</TableHeader>
                                        <TableBody><TableRow>{summaryRow}</TableRow></TableBody>
                </Table>
                                </div>
                            </div>
                        </div>
                    )}

                    {selectedCustomerTypeForDetails && (
                        <div className="rounded-lg border bg-card">
                            <div className="p-4 border-b">
                                <h3 className="text-lg font-semibold text-foreground">
                                    Visit Details for {selectedCustomerTypeForDetails}
                                </h3>
                                <p className="text-sm text-muted-foreground">
                                    {selectedEmployeeName !== "Select Field Officer" && `Officer: ${selectedEmployeeName} • ${dayjs(startDate).format('MMM D, YYYY')} - ${dayjs(endDate).format('MMM D, YYYY')}`}
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
                    <TableHeader>
                      <TableRow>
                        <TableHead>Customer Name</TableHead>
                        <TableHead>City</TableHead>
                        <TableHead>Taluka</TableHead>
                        <TableHead>State</TableHead>
                        <TableHead>Last Visited</TableHead>
                        <TableHead>Visit Count</TableHead>
                        <TableHead>Avg Monthly Sales</TableHead>
                        <TableHead>Avg Intent Level</TableHead>
                        <TableHead>Customer Type</TableHead>
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
                                                            <TableCell>{detail.city}</TableCell>
                                                            <TableCell>{detail.taluka}</TableCell>
                                                            <TableCell>{detail.state}</TableCell>
                                                            <TableCell>{dayjs(detail.lastVisited).format('MMM D, YYYY')}</TableCell>
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
                            <TableCell>
                                                                <Badge variant="outline">
                                                                    {detail.customerType}
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
                        </div>
                    )}
              </CardContent>
            </Card>
        </TabsContent>
        
        <TabsContent value="newCustomers" className="space-y-6">
          <NewCustomersReport />
        </TabsContent>

        <TabsContent value="salesPerformance" className="space-y-6">
          <SalesPerformanceReport />
        </TabsContent>

        <TabsContent value="monthlyTarget" className="space-y-6">
          <MonthlyTargetPage />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default ReportsPage;
