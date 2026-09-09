"use client";

import React, { useEffect, useMemo, useState } from "react";
import { CheckedState } from "@radix-ui/react-checkbox";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Loader2, CalendarIcon, Search, Users, ChevronDown, Download, RotateCcw } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { motion } from 'framer-motion';
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { SpacedCalendar } from "@/components/ui/spaced-calendar";
import { format } from "date-fns";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { useAuth } from "@/components/auth-provider";
import { getDateRangeError } from "@/components/date-range-error";
import { toast } from "sonner";
import { getEmployeeRoleCategory } from "@/lib/employee-role";
import { salaryApi, SalaryEmployee, SalarySummary } from "@/lib/salary-api";

interface EmployeeOption {
    value: string;
    label: string;
}

const getDefaultSummaryDateRange = () => ({
    start: '',
    end: '',
});

const getFullCalendarMonthRange = (dateValue: string) => {
    const match = dateValue.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (!match) return null;

    const year = Number(match[1]);
    const month = Number(match[2]);
    if (!Number.isInteger(year) || !Number.isInteger(month) || month < 1 || month > 12) {
        return null;
    }

    const lastDay = new Date(year, month, 0).getDate();
    const monthValue = String(month).padStart(2, "0");
    return {
        start: `${year}-${monthValue}-01`,
        end: `${year}-${monthValue}-${String(lastDay).padStart(2, "0")}`,
    };
};

const getFullMonthError = (startDate: string, endDate: string) => {
    if (!startDate || !endDate) {
        return "Select both From and To dates for one complete calendar month.";
    }

    const dateRangeError = getDateRangeError(startDate, endDate);
    if (dateRangeError) return dateRangeError;
    const monthRange = getFullCalendarMonthRange(startDate);
    if (!monthRange) {
        return "Please select a valid month.";
    }

    if (monthRange.start !== startDate || monthRange.end !== endDate) {
        const expectedStart = new Date(`${monthRange.start}T00:00:00`);
        const expectedEnd = new Date(`${monthRange.end}T00:00:00`);
        return `Select the complete month of ${format(expectedStart, "MMMM yyyy")}: ${format(expectedStart, "MMM d")} to ${format(expectedEnd, "MMM d, yyyy")}.`;
    }

    return null;
};

const EmployeeSummary: React.FC = () => {
    const { token } = useAuth();
    const defaultDateRange = useMemo(getDefaultSummaryDateRange, []);
    const [summaryData, setSummaryData] = useState<SalarySummary[]>([]);
    const [error, setError] = useState<string | null>(null);
    const [summaryLoading, setSummaryLoading] = useState(false);
    const [startDate, setStartDate] = useState(defaultDateRange.start);
    const [endDate, setEndDate] = useState(defaultDateRange.end);
    const [isStartDatePopoverOpen, setIsStartDatePopoverOpen] = useState(false);
    const [isEndDatePopoverOpen, setIsEndDatePopoverOpen] = useState(false);
    const [selectedEmployeeIds, setSelectedEmployeeIds] = useState<string[]>([]);
    const [isEmployeePopoverOpen, setIsEmployeePopoverOpen] = useState(false);
    const [employeeSearchTerm, setEmployeeSearchTerm] = useState("");
    const [allEmployees, setAllEmployees] = useState<SalaryEmployee[]>([]);
    const [employeesLoading, setEmployeesLoading] = useState(false);

    const handleClearEmployeeSelection = () => {
        setSelectedEmployeeIds([]);
        setEmployeeSearchTerm("");
        setIsEmployeePopoverOpen(false);
    };

    // Fetch employees on mount
    useEffect(() => {
        if (!token) return;
        let cancelled = false;

        const loadEmployees = async () => {
            try {
                setEmployeesLoading(true);
                const employees = await salaryApi.getEmployees(token);
                if (!cancelled) setAllEmployees(employees);
            } catch (error) {
                console.error('Error fetching employees:', error);
                if (!cancelled) toast.error('Could not load employees for salary calculation.');
            } finally {
                if (!cancelled) setEmployeesLoading(false);
            }
        };

        void loadEmployees();
        return () => {
            cancelled = true;
        };
    }, [token]);

    // Helper function to format date for filter
    const formatDateForFilter = (date: Date | undefined) => {
        if (!date) return '';
        return format(date, 'yyyy-MM-dd');
    };

    const fetchSummaryData = async (
        requestedStartDate = startDate,
        requestedEndDate = endDate,
    ) => {
        setError(null);
        try {
            const fullMonthError = getFullMonthError(requestedStartDate, requestedEndDate);
            if (fullMonthError) {
                toast.error(fullMonthError, { duration: 3000 });
                return;
            }
            setSummaryLoading(true);

            if (!token) {
                throw new Error('Authentication token not found. Please log in.');
            }

            const selectedIdSet = new Set(selectedEmployeeIds.map(Number));
            const employeesToCalculate = allEmployees.filter((employee) => {
                const category = getEmployeeRoleCategory(employee.role);
                const hasSalaryRole = category === "regional-manager" || category === "field-officer";
                return hasSalaryRole && (selectedIdSet.size === 0 || selectedIdSet.has(employee.id));
            });

            if (employeesToCalculate.length === 0) {
                throw new Error('No eligible employees are available for salary calculation.');
            }

            const [year, month] = requestedStartDate.split('-').map(Number);
            const { summaries, failures } = await salaryApi.runCalculations(
                token,
                employeesToCalculate,
                year,
                month,
                requestedStartDate,
                requestedEndDate,
            );

            if (summaries.length === 0) {
                throw new Error(failures[0]?.message || 'Salary calculation returned no results.');
            }

            setSummaryData(summaries);
            if (failures.length > 0) {
                toast.warning(
                    `${failures.length} employee${failures.length === 1 ? '' : 's'} could not be calculated.`,
                    { description: failures.map((failure) => failure.employeeName).join(', '), duration: 5000 },
                );
            }
        } catch (error) {
            const message = error instanceof Error ? error.message : 'An unknown error occurred';
            setError(message);
            toast.error(message, { duration: 3000 });
        } finally {
            setSummaryLoading(false);
        }
    };

    const filtersAreAtDefaults =
        selectedEmployeeIds.length === 0 &&
        employeeSearchTerm === "" &&
        startDate === defaultDateRange.start &&
        endDate === defaultDateRange.end;

    const handleResetFilters = () => {
        setSelectedEmployeeIds([]);
        setEmployeeSearchTerm("");
        setStartDate(defaultDateRange.start);
        setEndDate(defaultDateRange.end);
        setIsEmployeePopoverOpen(false);
        setIsStartDatePopoverOpen(false);
        setIsEndDatePopoverOpen(false);
        setError(null);
        setSummaryData([]);
    };

    // Remove automatic data fetching - only fetch on Apply Filter

    const formatCurrency = (amount: number) => {
        return new Intl.NumberFormat('en-IN', {
            style: 'currency',
            currency: 'INR'
        }).format(amount);
    };

    const employeeOptions = useMemo<EmployeeOption[]>(() => {
        // Use allEmployees instead of summaryData to populate dropdown
        return allEmployees
            .filter((employee) => {
                const category = getEmployeeRoleCategory(employee.role);
                return category === "regional-manager" || category === "field-officer";
            })
            .map((emp) => ({
                value: String(emp.id),
                label: `${emp.firstName} ${emp.lastName}`.trim(),
            }))
            .sort((a, b) => a.label.toLowerCase().localeCompare(b.label.toLowerCase()));
    }, [allEmployees]);

    const filteredEmployeeOptionsList = useMemo(() => {
        if (!employeeSearchTerm.trim()) return employeeOptions;
        const query = employeeSearchTerm.toLowerCase();
        return employeeOptions.filter((option) => option.label.toLowerCase().includes(query));
    }, [employeeOptions, employeeSearchTerm]);

    const visibleEmployeeIds = useMemo(
        () => filteredEmployeeOptionsList.map((option) => option.value),
        [filteredEmployeeOptionsList]
    );
    const visibleEmployeeIdSet = useMemo(() => new Set(visibleEmployeeIds), [visibleEmployeeIds]);
    const selectedEmployeeIdSet = useMemo(() => new Set(selectedEmployeeIds), [selectedEmployeeIds]);
    const areAllVisibleEmployeesSelected =
        visibleEmployeeIds.length > 0 && visibleEmployeeIds.every((id) => selectedEmployeeIdSet.has(id));
    const hasSomeVisibleSelection = visibleEmployeeIds.some((id) => selectedEmployeeIdSet.has(id));
    const selectAllCheckedState: CheckedState = areAllVisibleEmployeesSelected
        ? true
        : hasSomeVisibleSelection
            ? "indeterminate"
            : false;

    const handleSelectAllVisibleEmployees = (checked: CheckedState) => {
        if (visibleEmployeeIds.length === 0) {
            return;
        }

        if (checked === false) {
            setSelectedEmployeeIds((prev) => prev.filter((id) => !visibleEmployeeIdSet.has(id)));
            return;
        }

        setSelectedEmployeeIds((prev) => {
            const nextSet = new Set(prev);
            visibleEmployeeIds.forEach((id) => nextSet.add(id));
            return Array.from(nextSet);
        });
    };

    // Filter summary data based on selected employees and sort alphabetically by employee name
    const filteredSummaryData = summaryData
        .filter((employee) =>
            selectedEmployeeIds.length === 0 ||
            selectedEmployeeIds.includes(String(employee.employeeId))
        )
        .sort((a, b) =>
            a.employeeName.toLowerCase().localeCompare(b.employeeName.toLowerCase())
        );

    const handleExportCsv = () => {
        if (filteredSummaryData.length === 0) {
            window.alert("No summary data available to export.");
            return;
        }

        const escapeCsvValue = (value: string | number) => {
            const stringValue = String(value ?? "").replace(/"/g, '""');
            return `"${stringValue}"`;
        };

        const downloadCsvFile = (headers: string[], rows: (string | number)[][], suffix: string) => {
            const csvContent = [headers, ...rows]
                .map((row) => row.map(escapeCsvValue).join(","))
                .join("\n");

            const fileName = `employee-summary${suffix}-${startDate || "start"}-${endDate || "end"}.csv`;
            const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
            const url = URL.createObjectURL(blob);
            const link = document.createElement("a");
            link.href = url;
            link.setAttribute("download", fileName);
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(url);
        };

        const exportConfigs = [
            {
                suffix: "",
                headers: [
                    "Employee Name",
                    "Full Days",
                    "Half Days",
                    "Absent Days",
                    "Base Salary",
                    "Travel Allowance",
                    "Dearness Allowance",
                    "Approved Expenses",
                    "Total Salary",
                    "Start Date",
                    "End Date",
                ],
                rowBuilder: (employee: SalarySummary) => [
                    employee.employeeName,
                    employee.fullDays,
                    employee.halfDays,
                    employee.absentDays,
                    formatCurrency(employee.baseSalary),
                    formatCurrency(employee.travelAllowance),
                    formatCurrency(employee.dearnessAllowance),
                    formatCurrency(employee.approvedExpenses),
                    formatCurrency(employee.totalSalary),
                    employee.startDate,
                    employee.endDate,
                ],
            },
            {
                suffix: "-attendance",
                headers: [
                    "Employee Name",
                    "Full Days",
                    "Half Days",
                    "Absent Days",
                    "Base Salary",
                ],
                rowBuilder: (employee: SalarySummary) => [
                    employee.employeeName,
                    employee.fullDays,
                    employee.halfDays,
                    employee.absentDays,
                    formatCurrency(employee.baseSalary),
                ],
            },
            {
                suffix: "-allowances",
                headers: [
                    "Employee Name",
                    "Travel Allowance",
                    "Dearness Allowance",
                    "Approved Expenses",
                ],
                rowBuilder: (employee: SalarySummary) => [
                    employee.employeeName,
                    formatCurrency(employee.travelAllowance),
                    formatCurrency(employee.dearnessAllowance),
                    formatCurrency(employee.approvedExpenses),
                ],
            },
        ];

        exportConfigs.forEach((config) => {
            const rows = filteredSummaryData.map(config.rowBuilder);
            downloadCsvFile(config.headers, rows, config.suffix);
        });
    };

    // Get date range display name
    const getDateRangeDisplay = () => {
        if (!startDate || !endDate) {
            return 'Select Date Range';
        }
        return `${format(new Date(startDate), 'MMM dd, yyyy')} - ${format(new Date(endDate), 'MMM dd, yyyy')}`;
    };

    return (
        <div className="space-y-4">
            <Card className="gap-0 border-border/70 py-0 shadow-sm">
                <CardContent className="space-y-4 p-4">
                    {/* Filters Section */}
                    <div className="space-y-2 rounded-lg border border-border/70 bg-muted/20 p-3">
                        <div className="flex flex-col gap-3 lg:flex-row lg:flex-nowrap lg:items-end lg:gap-2">
                        <div className="min-w-0 space-y-1.5 lg:w-[220px] lg:shrink-0">
                            <div className="flex items-center justify-between">
                                <Label className="text-xs font-medium text-foreground">Employee</Label>
                                {selectedEmployeeIds.length > 0 && (
                                    <button
                                        type="button"
                                        className="text-sm text-primary transition hover:underline"
                                        onClick={() => {
                                            setSelectedEmployeeIds([]);
                                            setEmployeeSearchTerm("");
                                        }}
                                    >
                                        Clear
                                    </button>
                                )}
                            </div>
                            <Popover open={isEmployeePopoverOpen} onOpenChange={setIsEmployeePopoverOpen}>
                                <PopoverTrigger asChild>
                                    <Button
                                        variant="outline"
                                        className="h-9 w-full justify-between px-3 text-sm font-normal shadow-none"
                                    >
                                        <span className="flex items-center gap-2 truncate">
                                            <Users className="h-4 w-4 text-muted-foreground" />
                                            {selectedEmployeeIds.length === 0
                                                ? "All employees"
                                                : `${selectedEmployeeIds.length} employee${selectedEmployeeIds.length > 1 ? "s" : ""} selected`}
                                        </span>
                                        <ChevronDown className="h-4 w-4 text-muted-foreground" />
                                    </Button>
                                </PopoverTrigger>
                                <PopoverContent className="w-[320px] p-0" align="start">
                                    <div className="border-b p-3 space-y-2">
                                        <div className="relative">
                                            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                                            <Input
                                                placeholder="Search by name..."
                                                value={employeeSearchTerm}
                                                onChange={(event) => setEmployeeSearchTerm(event.target.value)}
                                                className="pl-10"
                                            />
                                        </div>
                                        <div className="flex flex-wrap items-center justify-between gap-2">
                                            <Button
                                                type="button"
                                                variant="ghost"
                                                size="sm"
                                                className="justify-start text-primary"
                                                onClick={handleClearEmployeeSelection}
                                            >
                                                Clear all
                                            </Button>
                                            {visibleEmployeeIds.length > 0 && (
                                                <label className="flex cursor-pointer items-center gap-2 rounded-md border border-dashed border-muted-foreground/50 bg-muted/40 px-3 py-2">
                                                    <Checkbox
                                                        aria-label="Select all employees"
                                                        checked={selectAllCheckedState}
                                                        onCheckedChange={handleSelectAllVisibleEmployees}
                                                    />
                                                    <div className="flex flex-col text-left leading-tight">
                                                        <span className="text-sm font-medium text-foreground">
                                                            Select all ({visibleEmployeeIds.length})
                                                        </span>
                                                        <span className="text-xs text-muted-foreground">
                                                            {employeeSearchTerm ? "Matches current search" : "All loaded employees"}
                                                        </span>
                                                    </div>
                                                </label>
                                            )}
                                        </div>
                                    </div>
                                    <div className="max-h-64 overflow-y-auto">
                                        {employeesLoading ? (
                                            <div className="p-6 text-center text-sm text-muted-foreground">
                                                <Loader2 className="h-4 w-4 animate-spin mx-auto mb-2" />
                                                Loading employees...
                                            </div>
                                        ) : filteredEmployeeOptionsList.length === 0 ? (
                                            <div className="p-6 text-center text-sm text-muted-foreground">
                                                {employeeOptions.length === 0
                                                    ? "No employees available."
                                                    : "No employees match your search."}
                                            </div>
                                        ) : (
                                            <div className="divide-y">
                                                {filteredEmployeeOptionsList.map((option) => {
                                                    const isSelected = selectedEmployeeIds.includes(option.value);
                                                    return (
                                                        <label
                                                            key={option.value}
                                                            className="flex cursor-pointer items-center gap-3 p-3 hover:bg-muted/40"
                                                        >
                                                            <Checkbox
                                                                checked={isSelected}
                                                                onCheckedChange={(checked) => {
                                                                    setSelectedEmployeeIds((prev) =>
                                                                        checked
                                                                            ? [...prev, option.value]
                                                                            : prev.filter((id) => id !== option.value)
                                                                    );
                                                                }}
                                                            />
                                                            <span className="text-sm font-medium text-foreground">
                                                                {option.label}
                                                            </span>
                                                        </label>
                                                    );
                                                })}
                                            </div>
                                        )}
                                    </div>
                                </PopoverContent>
                            </Popover>
                        </div>
                        <div className="space-y-1.5 lg:w-[180px] lg:shrink-0">
                            <Label className="text-xs font-medium text-foreground">From date</Label>
                            <Popover open={isStartDatePopoverOpen} onOpenChange={setIsStartDatePopoverOpen}>
                                <PopoverTrigger asChild>
                                    <Button
                                        variant="outline"
                                        className={`h-9 w-full justify-start px-3 text-left text-sm font-normal shadow-none ${!startDate && 'text-muted-foreground'}`}
                                    >
                                        <CalendarIcon className="mr-2 h-4 w-4" />
                                        {startDate ? format(new Date(startDate), 'MMM dd, yyyy') : <span>Pick start date</span>}
                                    </Button>
                                </PopoverTrigger>
                                <PopoverContent className="w-auto p-0">
                                    <SpacedCalendar
                                        mode="single"
                                        selected={startDate ? new Date(startDate) : undefined}
                                        onSelect={(date) => {
                                            setStartDate(formatDateForFilter(date));
                                            setIsStartDatePopoverOpen(false);
                                        }}
                                        initialFocus
                                    />
                                </PopoverContent>
                            </Popover>
                        </div>
                        <div className="space-y-1.5 lg:w-[180px] lg:shrink-0">
                            <Label className="text-xs font-medium text-foreground">To date</Label>
                            <Popover open={isEndDatePopoverOpen} onOpenChange={setIsEndDatePopoverOpen}>
                                <PopoverTrigger asChild>
                                    <Button
                                        variant="outline"
                                        className={`h-9 w-full justify-start px-3 text-left text-sm font-normal shadow-none ${!endDate && 'text-muted-foreground'}`}
                                    >
                                        <CalendarIcon className="mr-2 h-4 w-4" />
                                        {endDate ? format(new Date(endDate), 'MMM dd, yyyy') : <span>Pick end date</span>}
                                    </Button>
                                </PopoverTrigger>
                                <PopoverContent className="w-auto p-0">
                                    <SpacedCalendar
                                        mode="single"
                                        selected={endDate ? new Date(endDate) : undefined}
                                        onSelect={(date) => {
                                            setEndDate(formatDateForFilter(date));
                                            setIsEndDatePopoverOpen(false);
                                        }}
                                        initialFocus
                                    />
                                </PopoverContent>
                            </Popover>
                        </div>
                        <div className="flex min-w-0 flex-1 flex-col justify-end gap-1.5 lg:ml-auto lg:flex-none">
                            <div className="flex flex-nowrap items-end gap-2 lg:justify-end">
                                <Button
                                    type="button"
                                    variant="outline"
                                    onClick={handleResetFilters}
                                    className="h-9 flex-1 text-sm font-medium shadow-none sm:flex-none lg:w-[92px]"
                                    disabled={summaryLoading || filtersAreAtDefaults}
                                >
                                    <RotateCcw className="mr-2 h-4 w-4" />
                                    Reset
                                </Button>
                                <Button
                                    onClick={() => void fetchSummaryData()}
                                    className="h-9 flex-1 text-sm font-medium shadow-none sm:flex-none lg:w-[112px]"
                                    disabled={summaryLoading}
                                >
                                    {summaryLoading ? (
                                        <>
                                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                            Loading...
                                        </>
                                    ) : (
                                        'Apply'
                                    )}
                                </Button>
                                <Button
                                    variant="outline"
                                    className="h-9 flex-1 text-sm shadow-none sm:flex-none lg:w-[124px]"
                                    onClick={handleExportCsv}
                                    disabled={summaryLoading || filteredSummaryData.length === 0}
                                >
                                    <Download className="mr-2 h-4 w-4" />
                                    Export CSV
                                </Button>
                            </div>
                        </div>
                        </div>
                        <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                            <CalendarIcon className="h-3.5 w-3.5 shrink-0" />
                            Select the first and last day of one complete calendar month.
                        </p>
                    </div>

                    {summaryLoading && (
                        <div className="space-y-4">
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 p-4 bg-muted/30 rounded-lg">
                                {[...Array(4)].map((_, i) => (
                                    <div key={i} className="space-y-2">
                                        <Skeleton className="h-4 w-32" />
                                        <Skeleton className="h-10 w-full" />
                                    </div>
                                ))}
                            </div>

                            <div className="md:hidden space-y-3">
                                {[...Array(4)].map((_, i) => (
                                    <Card key={i}>
                                        <CardHeader className="pb-2">
                                            <div className="flex items-center justify-between">
                                                <Skeleton className="h-5 w-40" />
                                                <Skeleton className="h-5 w-20" />
                                            </div>
                                        </CardHeader>
                                        <CardContent>
                                            <div className="grid grid-cols-1 gap-2">
                                                {[...Array(5)].map((_, j) => (
                                                    <div key={j} className="flex items-center justify-between">
                                                        <Skeleton className="h-3 w-28" />
                                                        <Skeleton className="h-3 w-16" />
                                                    </div>
                                                ))}
                                            </div>
                                        </CardContent>
                                    </Card>
                                ))}
                            </div>

                            <div className="hidden md:block rounded-lg border bg-card">
                                <div className="p-4 border-b">
                                    <Skeleton className="h-5 w-64" />
                                    <Skeleton className="h-4 w-40 mt-2" />
                                </div>
                                <div className="p-4 space-y-2">
                                    {[...Array(6)].map((_, i) => (
                                        <div key={i} className="flex items-center justify-between p-3 border rounded">
                                            <Skeleton className="h-4 w-40" />
                                            <div className="flex gap-4">
                                                {[...Array(9)].map((_, k) => (
                                                    <Skeleton key={k} className="h-4 w-20" />
                                                ))}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    )}

                    {error && (
                        <div className="p-4 text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded-md">
                            <div className="flex items-center justify-between">
                                <p><strong>Error:</strong> {error}</p>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => void fetchSummaryData()}
                                    disabled={summaryLoading}
                                >
                                    Try Again
                                </Button>
                            </div>
                        </div>
                    )}

                    {!summaryLoading && !error && (
                        <>
                            {/* Mobile view */}
                            <div className="space-y-3 md:hidden">
                                <Card>
                                    <CardHeader className="pb-3">
                                        <CardTitle className="text-sm font-semibold">Summary results</CardTitle>
                                        <p className="text-xs text-muted-foreground">{getDateRangeDisplay()}</p>
                                    </CardHeader>
                                    <CardContent className="pt-0">
                                        {summaryLoading ? (
                                            <div className="space-y-4">
                                                {[...Array(4)].map((_, i) => (
                                                    <Card key={i}>
                                                        <CardHeader className="pb-3">
                                                            <div className="flex items-center justify-between">
                                                                <Skeleton className="h-6 w-48" />
                                                                <Skeleton className="h-8 w-24" />
                                                            </div>
                                                        </CardHeader>
                                                        <CardContent>
                                                            <div className="grid grid-cols-1 gap-3">
                                                                {[...Array(5)].map((_, j) => (
                                                                    <div key={j} className="flex items-center justify-between">
                                                                        <Skeleton className="h-4 w-32" />
                                                                        <Skeleton className="h-4 w-20" />
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        </CardContent>
                                                    </Card>
                                                ))}
                                            </div>
                                        ) : summaryData.length === 0 ? (
                                            <div className="text-center py-12 text-muted-foreground text-2xl">
                                                No summary data available
                                            </div>
                                        ) : (
                                            <div className="space-y-5">
                                                {filteredSummaryData.map((employee) => (
                                                    <motion.div
                                                        key={employee.employeeId}
                                                        initial={{ opacity: 0, y: 20 }}
                                                        animate={{ opacity: 1, y: 0 }}
                                                        transition={{ duration: 0.3 }}
                                                    >
                                                        <Card className="border-l-4 border-l-primary shadow-md hover:shadow-lg transition-shadow duration-300">
                                                            <CardContent className="p-6">
                                                                {/* Header Section */}
                                                                <div className="mb-6">
                                                                    <div className="flex items-start justify-between mb-3">
                                                                        <h4 className="font-bold text-2xl text-foreground leading-tight flex-1 mr-2">
                                                                            {employee.employeeName}
                                                                        </h4>
                                                                    </div>
                                                                    <div className="flex items-center justify-between">
                                                                        <p className="text-xl text-muted-foreground">
                                                                            {getDateRangeDisplay()}
                                                                        </p>
                                                                        <Badge variant="default" className="text-2xl font-bold px-5 py-2.5 bg-primary">
                                                                            {formatCurrency(employee.totalSalary)}
                                                                        </Badge>
                                                                    </div>
                                                                </div>

                                                                {/* Attendance Section */}
                                                                <div className="mb-6">
                                                                    <h5 className="text-xl font-semibold text-foreground mb-4 uppercase tracking-wide">
                                                                        Attendance
                                                                    </h5>
                                                                    <div className="grid grid-cols-2 gap-4">
                                                                        <div className="flex flex-col py-4 px-4 bg-muted/30 rounded-lg border border-border/50">
                                                                            <span className="text-lg font-medium text-muted-foreground mb-2">Present Days</span>
                                                                            <span className="text-3xl font-bold text-foreground">{employee.presentDays}</span>
                                                                        </div>
                                                                        <div className="flex flex-col py-4 px-4 bg-muted/30 rounded-lg border border-border/50">
                                                                            <span className="text-lg font-medium text-muted-foreground mb-2">Full Days</span>
                                                                            <span className="text-3xl font-bold text-foreground">{employee.fullDays}</span>
                                                                        </div>
                                                                        <div className="flex flex-col py-4 px-4 bg-muted/30 rounded-lg border border-border/50">
                                                                            <span className="text-lg font-medium text-muted-foreground mb-2">Half Days</span>
                                                                            <span className="text-3xl font-bold text-foreground">{employee.halfDays}</span>
                                                                        </div>
                                                                        <div className="flex flex-col py-4 px-4 bg-muted/30 rounded-lg border border-border/50">
                                                                            <span className="text-lg font-medium text-muted-foreground mb-2">Absent Days</span>
                                                                            <span className="text-3xl font-bold text-foreground">{employee.absentDays}</span>
                                                                        </div>
                                                                    </div>
                                                                </div>
                                                                
                                                                {/* Separator */}
                                                                <div className="border-t border-border/50 my-6"></div>
                                                                
                                                                {/* Salary Section */}
                                                                <div>
                                                                    <h5 className="text-xl font-semibold text-foreground mb-4 uppercase tracking-wide">
                                                                        Salary Breakdown
                                                                    </h5>
                                                                    <div className="space-y-3">
                                                                        <div className="flex justify-between items-center py-4 px-4 bg-muted/30 rounded-lg border border-border/50">
                                                                            <span className="text-xl font-medium text-muted-foreground">Base Salary</span>
                                                                            <span className="text-2xl font-bold text-foreground">{formatCurrency(employee.baseSalary)}</span>
                                                                        </div>
                                                                        <div className="flex justify-between items-center py-4 px-4 bg-muted/30 rounded-lg border border-border/50">
                                                                            <span className="text-xl font-medium text-muted-foreground">Travel Allowance</span>
                                                                            <span className="text-2xl font-bold text-foreground">{formatCurrency(employee.travelAllowance)}</span>
                                                                        </div>
                                                                        <div className="flex justify-between items-center py-4 px-4 bg-muted/30 rounded-lg border border-border/50">
                                                                            <span className="text-xl font-medium text-muted-foreground">Dearness Allowance</span>
                                                                            <span className="text-2xl font-bold text-foreground">{formatCurrency(employee.dearnessAllowance)}</span>
                                                                        </div>
                                                                        <div className="flex justify-between items-start gap-4 py-4 px-4 bg-muted/30 rounded-lg border border-border/50">
                                                                            <span className="text-xl font-medium text-muted-foreground">Final Salary</span>
                                                                            <span className="text-2xl font-bold text-foreground">{formatCurrency(employee.totalSalary)}</span>
                                                                        </div>
                                                                    </div>
                                                                </div>
                                                            </CardContent>
                                                        </Card>
                                                    </motion.div>
                                                ))}
                                            </div>
                                        )}
                                    </CardContent>
                                </Card>
                            </div>

                            {/* Desktop view */}
                            <div className="hidden md:block">
                                <div className="rounded-lg border bg-card">
                                    <div className="border-b p-4">
                                        <h3 className="text-sm font-semibold text-foreground">Summary results</h3>
                                        <p className="mt-0.5 text-xs text-muted-foreground">{getDateRangeDisplay()}</p>
                                    </div>
                                    <div className="overflow-x-auto">
                                        {summaryLoading ? (
                                            <div className="p-4 space-y-2">
                                                {/* Header skeleton */}
                                                <div className="flex items-center justify-between p-3 border rounded">
                                                    <Skeleton className="h-4 w-40" />
                                                    <div className="flex gap-4">
                                                        {[...Array(9)].map((_, k) => (
                                                            <Skeleton key={k} className="h-4 w-20" />
                                                        ))}
                                                    </div>
                                                </div>
                                                {/* Rows skeleton */}
                                                {[...Array(6)].map((_, i) => (
                                                    <div key={i} className="flex items-center justify-between p-3 border rounded">
                                                        <Skeleton className="h-4 w-40" />
                                                        <div className="flex gap-4">
                                                            {[...Array(9)].map((_, k) => (
                                                                <Skeleton key={k} className="h-4 w-20" />
                                                            ))}
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        ) : filteredSummaryData.length === 0 ? (
                                            <div className="text-center py-8 text-muted-foreground">
                                                {summaryData.length === 0 ? 'No summary data available' : 'No employees found matching your search'}
                                            </div>
                                        ) : (
                                            <Table>
                                                <TableHeader>
                                                    <TableRow>
                                                        <TableHead>Employee Name</TableHead>
                                                        <TableHead>Full Days</TableHead>
                                                        <TableHead>Half Days</TableHead>
                                                        <TableHead>Absent Days</TableHead>
                                                        <TableHead>Base Salary</TableHead>
                                                        <TableHead>Travel Allowance</TableHead>
                                                        <TableHead>Dearness Allowance</TableHead>
                                                        <TableHead>Expenses</TableHead>
                                                        <TableHead>Total Salary</TableHead>
                                                    </TableRow>
                                                </TableHeader>
                                                <TableBody>
                                                    {filteredSummaryData.map((employee) => (
                                                        <TableRow key={employee.employeeId}>
                                                            <TableCell className="font-medium">{employee.employeeName}</TableCell>
                                                            <TableCell>{employee.fullDays}</TableCell>
                                                            <TableCell>{employee.halfDays}</TableCell>
                                                            <TableCell>{employee.absentDays}</TableCell>
                                                            <TableCell>{formatCurrency(employee.baseSalary)}</TableCell>
                                                            <TableCell>{formatCurrency(employee.travelAllowance)}</TableCell>
                                                            <TableCell>{formatCurrency(employee.dearnessAllowance)}</TableCell>
                                                            <TableCell>{formatCurrency(employee.approvedExpenses)}</TableCell>
                                                            <TableCell className="font-bold">{formatCurrency(employee.totalSalary)}</TableCell>
                                                        </TableRow>
                                                    ))}
                                                </TableBody>
                                            </Table>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </>
                    )}
                </CardContent>
            </Card>

        </div>
    );
};

export default EmployeeSummary;
