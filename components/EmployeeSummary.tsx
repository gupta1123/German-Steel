"use client";

import React, { useEffect, useMemo, useState } from "react";
import { CheckedState } from "@radix-ui/react-checkbox";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Loader2, CalendarIcon, Search, Users, ChevronDown, Download, MoreHorizontal } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { motion } from 'framer-motion';
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { SpacedCalendar } from "@/components/ui/spaced-calendar";
import { format } from "date-fns";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { API } from "@/lib/api";

interface SummaryData {
    employeeName: string;
    fullDayThreshold: number;
    endDate: string;
    includeSundays: boolean;
    presentDays: number;
    fullDays: number;
    baseSalary: number;
    employeeId: number;
    absentDays: number;
    travelAllowance: number;
    halfDayThreshold: number;
    totalSalary: number;
    halfDays: number;
    approvedExpenses: number;
    startDate: string;
    dearnessAllowance: number;
    salaryAdjustmentAmount?: number | null;
    adjustedTotalSalary?: number | null;
}

interface EmployeeOption {
    value: string;
    label: string;
}

interface Employee {
    id: number;
    firstName: string;
    lastName: string;
}

const toFiniteNumber = (value: number | string | null | undefined): number => {
    const numericValue = Number(value);
    return Number.isFinite(numericValue) ? numericValue : 0;
};

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
    const monthRange = getFullCalendarMonthRange(startDate);
    if (!monthRange) {
        return "Please select a valid month.";
    }

    if (monthRange.start !== startDate || monthRange.end !== endDate) {
        return `Select a full calendar month (${monthRange.start} to ${monthRange.end}) to view and edit adjustments.`;
    }

    return null;
};

const EmployeeSummary: React.FC = () => {
    const [summaryData, setSummaryData] = useState<SummaryData[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [summaryLoading, setSummaryLoading] = useState(false);
    const [startDate, setStartDate] = useState(format(new Date(new Date().getFullYear(), new Date().getMonth(), 1), 'yyyy-MM-dd'));
    const [endDate, setEndDate] = useState(format(new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0), 'yyyy-MM-dd'));
    const [isStartDatePopoverOpen, setIsStartDatePopoverOpen] = useState(false);
    const [isEndDatePopoverOpen, setIsEndDatePopoverOpen] = useState(false);
    const [selectedEmployeeIds, setSelectedEmployeeIds] = useState<string[]>([]);
    const [isEmployeePopoverOpen, setIsEmployeePopoverOpen] = useState(false);
    const [employeeSearchTerm, setEmployeeSearchTerm] = useState("");
    const [allEmployees, setAllEmployees] = useState<Employee[]>([]);
    const [employeesLoading, setEmployeesLoading] = useState(false);
    const [adjustmentEmployee, setAdjustmentEmployee] = useState<SummaryData | null>(null);
    const [adjustmentAmountInput, setAdjustmentAmountInput] = useState("");
    const [isAdjustmentModalOpen, setIsAdjustmentModalOpen] = useState(false);
    const [adjustmentError, setAdjustmentError] = useState<string | null>(null);
    const [isApplyingAdjustment, setIsApplyingAdjustment] = useState(false);

    const handleClearEmployeeSelection = () => {
        setSelectedEmployeeIds([]);
        setEmployeeSearchTerm("");
        setIsEmployeePopoverOpen(false);
    };

    // Get auth data from localStorage instead of Redux
    const token = typeof window !== 'undefined' ? localStorage.getItem('authToken') : null;

    // Fetch all employees on component mount
    const fetchAllEmployees = async () => {
        if (!token) return;
        
        try {
            setEmployeesLoading(true);
            const data = await API.getAllEmployees<Employee>();
            if (data && Array.isArray(data)) {
                setAllEmployees(data);
            }
        } catch (error) {
            console.error('Error fetching employees:', error);
            // Don't set error state here, just log it so the component can still work
        } finally {
            setEmployeesLoading(false);
        }
    };

    // Fetch employees on mount
    useEffect(() => {
        fetchAllEmployees();
    }, [token]);

    // Helper function to format date for filter
    const formatDateForFilter = (date: Date | undefined) => {
        if (!date) return '';
        return format(date, 'yyyy-MM-dd');
    };

    const fetchSummaryData = async () => {
        setError(null);
        try {
            setSummaryLoading(true);
            
            if (!startDate || !endDate) {
                throw new Error('Please select a valid date range');
            }

            if (!token) {
                throw new Error('Authentication token not found. Please log in.');
            }

            const response = await fetch(
                `/api/proxy/salary-calculation/manual-summary-range?startDate=${startDate}&endDate=${endDate}`,
                {
                    headers: {
                        'Authorization': `Bearer ${token}`,
                    },
                }
            );

            if (!response.ok) {
                throw new Error(`Failed to fetch summary data: ${response.statusText}`);
            }

            const data = await response.json();
            if (!data) {
                throw new Error('No summary data received');
            }

            setSummaryData(data);
        } catch (error) {
            setError(error instanceof Error ? error.message : 'An unknown error occurred');
        } finally {
            setSummaryLoading(false);
        }
    };

    // Remove automatic data fetching - only fetch on Apply Filter

    const formatCurrency = (amount: number) => {
        return new Intl.NumberFormat('en-IN', {
            style: 'currency',
            currency: 'INR'
        }).format(amount);
    };

    const activeFullMonthError = getFullMonthError(startDate, endDate);
    const isFullMonthSelected = !activeFullMonthError;

    const getSalaryAdjustmentAmount = (employee: SummaryData) => toFiniteNumber(employee.salaryAdjustmentAmount);

    const getAdjustedTotalSalary = (employee: SummaryData) => {
        const regularTotalSalary = toFiniteNumber(employee.totalSalary);
        const adjustmentAmount = getSalaryAdjustmentAmount(employee);
        if (employee.adjustedTotalSalary == null) {
            return regularTotalSalary + adjustmentAmount;
        }

        return toFiniteNumber(employee.adjustedTotalSalary);
    };

    const renderTotalSalary = (employee: SummaryData) => {
        const adjustmentAmount = isFullMonthSelected ? getSalaryAdjustmentAmount(employee) : 0;
        const adjustedTotalSalary = isFullMonthSelected ? getAdjustedTotalSalary(employee) : toFiniteNumber(employee.totalSalary);
        const hasAdjustment = Math.abs(adjustmentAmount) > 0;

        return (
            <div className="flex flex-col gap-1">
                <div className="flex items-center gap-2">
                    <span className="font-bold">{formatCurrency(adjustedTotalSalary)}</span>
                    {hasAdjustment && (
                        <Badge variant="outline" className="h-5 px-1.5 text-[10px] font-medium text-emerald-700 border-emerald-300 bg-emerald-50">
                            Adjusted
                        </Badge>
                    )}
                </div>
                {hasAdjustment && (
                    <span className="text-xs text-muted-foreground">
                        Total {formatCurrency(employee.totalSalary)} + TA {formatCurrency(adjustmentAmount)}
                    </span>
                )}
            </div>
        );
    };

    const renderActions = (employee: SummaryData) => (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8">
                    <MoreHorizontal className="h-4 w-4" />
                    <span className="sr-only">Open actions</span>
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => openAdjustmentModal(employee)}>
                    Edit TA Adjustment
                </DropdownMenuItem>
            </DropdownMenuContent>
        </DropdownMenu>
    );

    const openAdjustmentModal = (employee: SummaryData) => {
        const existingAdjustment = getSalaryAdjustmentAmount(employee);
        setAdjustmentEmployee(employee);
        setAdjustmentAmountInput(existingAdjustment === 0 ? "" : String(existingAdjustment));
        setAdjustmentError(null);
        setIsAdjustmentModalOpen(true);
    };

    const resetAdjustmentModal = () => {
        setIsAdjustmentModalOpen(false);
        setAdjustmentEmployee(null);
        setAdjustmentAmountInput("");
        setAdjustmentError(null);
    };

    const closeAdjustmentModal = () => {
        if (isApplyingAdjustment) return;
        resetAdjustmentModal();
    };

    const handleApplySalaryAdjustment = async () => {
        if (!adjustmentEmployee) return;
        if (!token) {
            setAdjustmentError('Authentication token not found. Please log in.');
            return;
        }

        const trimmedAmount = adjustmentAmountInput.trim();
        const adjustmentAmount = Number(trimmedAmount);
        if (!trimmedAmount || !Number.isFinite(adjustmentAmount)) {
            setAdjustmentError('Enter a valid TA adjustment amount.');
            return;
        }

        const fullMonthError = getFullMonthError(startDate, endDate);
        if (fullMonthError) {
            setAdjustmentError(fullMonthError);
            return;
        }

        setAdjustmentError(null);
        setIsApplyingAdjustment(true);
        try {
            const adjustmentParams = new URLSearchParams({
                employeeIds: String(adjustmentEmployee.employeeId),
                startDate,
                endDate,
                adjustmentAmount: String(adjustmentAmount),
            });

            const response = await fetch(`/api/proxy/travel-allowance/apply-salary-adjustment?${adjustmentParams.toString()}`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json',
                },
            });

            if (!response.ok) {
                const errorText = await response.text().catch(() => '');
                throw new Error(errorText || `Failed to apply TA adjustment: ${response.statusText}`);
            }

            await fetchSummaryData();
            resetAdjustmentModal();
        } catch (error) {
            setAdjustmentError(error instanceof Error ? error.message : 'Failed to apply TA adjustment.');
        } finally {
            setIsApplyingAdjustment(false);
        }
    };

    const employeeOptions = useMemo<EmployeeOption[]>(() => {
        // Use allEmployees instead of summaryData to populate dropdown
        return allEmployees
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
                    "TA Adjustment",
                    "Adjusted Total Salary",
                    "Start Date",
                    "End Date",
                ],
                rowBuilder: (employee: SummaryData) => [
                    employee.employeeName,
                    employee.fullDays,
                    employee.halfDays,
                    employee.absentDays,
                    formatCurrency(employee.baseSalary),
                    formatCurrency(employee.travelAllowance),
                    formatCurrency(employee.dearnessAllowance),
                    formatCurrency(employee.approvedExpenses),
                    formatCurrency(employee.totalSalary),
                    formatCurrency(getSalaryAdjustmentAmount(employee)),
                    formatCurrency(getAdjustedTotalSalary(employee)),
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
                rowBuilder: (employee: SummaryData) => [
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
                rowBuilder: (employee: SummaryData) => [
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

    const hasAdjustmentAmountInput = adjustmentAmountInput.trim() !== "";
    const adjustmentInputAmount = hasAdjustmentAmountInput ? Number(adjustmentAmountInput) : 0;
    const previewAdjustmentAmount = Number.isFinite(adjustmentInputAmount) ? adjustmentInputAmount : 0;
    const regularTotalSalary = adjustmentEmployee ? toFiniteNumber(adjustmentEmployee.totalSalary) : 0;
    const currentTravelAllowance = adjustmentEmployee ? toFiniteNumber(adjustmentEmployee.travelAllowance) : 0;
    const projectedAdjustedTotalSalary = regularTotalSalary + previewAdjustmentAmount;

    return (
        <div className="space-y-6">
            <Card className="border-0 shadow-sm">
                <CardHeader className="pb-6">
                    <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                        <div>
                            <CardTitle className="text-3xl md:text-xl font-semibold text-foreground">Employee Summary</CardTitle>
                            <p className="text-lg md:text-sm text-muted-foreground">View employee salary summaries and attendance data</p>
                        </div>
                        <Button
                            variant="outline"
                            className="w-full md:w-auto"
                            onClick={handleExportCsv}
                            disabled={summaryLoading || filteredSummaryData.length === 0}
                        >
                            <Download className="mr-2 h-4 w-4" />
                            Export CSV
                        </Button>
                    </div>
                </CardHeader>
                <CardContent className="space-y-6">
                    {/* Filters Section */}
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 p-6 bg-muted/30 rounded-lg">
                        <div className="space-y-3">
                            <div className="flex items-center justify-between">
                                <Label className="text-lg md:text-sm font-medium text-foreground">Search Employees</Label>
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
                                        className="w-full h-14 text-lg justify-between md:h-10 md:text-sm"
                                    >
                                        <span className="flex items-center gap-2 truncate">
                                            <Users className="h-5 w-5 text-primary" />
                                            {selectedEmployeeIds.length === 0
                                                ? "Select employees..."
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
                        <div className="space-y-3">
                            <Label className="text-lg md:text-sm font-medium text-foreground">From Date</Label>
                            <Popover open={isStartDatePopoverOpen} onOpenChange={setIsStartDatePopoverOpen}>
                                <PopoverTrigger asChild>
                                    <Button
                                        variant="outline"
                                        className={`w-full h-14 md:h-10 text-lg md:text-sm justify-start text-left font-normal ${!startDate && 'text-muted-foreground'}`}
                                    >
                                        <CalendarIcon className="mr-2 h-4 w-4" />
                                        {startDate ? format(new Date(startDate), 'MMM d, yyyy') : <span>Pick start date</span>}
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
                        <div className="space-y-3">
                            <Label className="text-lg md:text-sm font-medium text-foreground">To Date</Label>
                            <Popover open={isEndDatePopoverOpen} onOpenChange={setIsEndDatePopoverOpen}>
                                <PopoverTrigger asChild>
                                    <Button
                                        variant="outline"
                                        className={`w-full h-14 md:h-10 text-lg md:text-sm justify-start text-left font-normal ${!endDate && 'text-muted-foreground'}`}
                                    >
                                        <CalendarIcon className="mr-2 h-4 w-4" />
                                        {endDate ? format(new Date(endDate), 'MMM d, yyyy') : <span>Pick end date</span>}
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
                        <div className="flex items-end">
                            <Button onClick={fetchSummaryData} className="w-full h-14 text-lg md:h-10 md:text-sm font-medium" disabled={summaryLoading}>
                                {summaryLoading ? (
                                    <>
                                        <Loader2 className="mr-2 h-6 w-6 md:h-4 md:w-4 animate-spin" />
                                        Loading...
                                    </>
                                ) : (
                                    'Apply Filter'
                                )}
                            </Button>
                        </div>
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
                                    onClick={fetchSummaryData}
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
                            <div className="md:hidden space-y-6">
                                <Card>
                                    <CardHeader className="pb-4">
                                        <CardTitle className="text-3xl">Employee Salary Summary ({getDateRangeDisplay()})</CardTitle>
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
                                                                        {isFullMonthSelected && renderActions(employee)}
                                                                    </div>
                                                                    <div className="flex items-center justify-between">
                                                                        <p className="text-xl text-muted-foreground">
                                                                            {getDateRangeDisplay()}
                                                                        </p>
                                                                        <Badge variant="default" className="text-2xl font-bold px-5 py-2.5 bg-primary">
                                                                            {formatCurrency(isFullMonthSelected ? getAdjustedTotalSalary(employee) : employee.totalSalary)}
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
                                                                        {isFullMonthSelected && Math.abs(getSalaryAdjustmentAmount(employee)) > 0 && (
                                                                            <div className="flex justify-between items-center py-4 px-4 bg-muted/30 rounded-lg border border-border/50">
                                                                                <span className="text-xl font-medium text-muted-foreground">TA Adjustment</span>
                                                                                <span className="text-2xl font-bold text-emerald-700">{formatCurrency(getSalaryAdjustmentAmount(employee))}</span>
                                                                            </div>
                                                                        )}
                                                                        <div className="flex justify-between items-start gap-4 py-4 px-4 bg-muted/30 rounded-lg border border-border/50">
                                                                            <span className="text-xl font-medium text-muted-foreground">Final Salary</span>
                                                                            <div className="text-right">{renderTotalSalary(employee)}</div>
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
                                    <div className="p-4 border-b">
                                        <h3 className="text-lg font-semibold text-foreground">Employee Salary Summary ({getDateRangeDisplay()})</h3>
                                        <p className="text-sm text-muted-foreground">Overview of employee attendance and salary calculations</p>
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
                                                        {isFullMonthSelected && <TableHead className="w-12 text-right">Actions</TableHead>}
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
                                                            <TableCell>{renderTotalSalary(employee)}</TableCell>
                                                            {isFullMonthSelected && <TableCell className="text-right">{renderActions(employee)}</TableCell>}
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

            <Dialog open={isAdjustmentModalOpen} onOpenChange={(open) => (open ? setIsAdjustmentModalOpen(true) : closeAdjustmentModal())}>
                <DialogContent className="sm:max-w-lg">
                    <DialogHeader>
                        <DialogTitle>Edit TA Adjustment</DialogTitle>
                        <DialogDescription>
                            {adjustmentEmployee ? `${adjustmentEmployee.employeeName} - ${getDateRangeDisplay()}` : getDateRangeDisplay()}
                        </DialogDescription>
                    </DialogHeader>

                    {adjustmentEmployee && (
                        <div className="space-y-4">
                            <div className="rounded-lg border bg-muted/30 p-3 text-sm space-y-2">
                                <div className="flex flex-wrap items-center justify-between gap-2">
                                    <span className="text-muted-foreground">Current TA</span>
                                    <span className="font-medium">{formatCurrency(currentTravelAllowance)}</span>
                                </div>
                                <div className="flex flex-wrap items-center justify-between gap-2">
                                    <span className="text-muted-foreground">TA adjustment</span>
                                    <span className="font-medium">{formatCurrency(previewAdjustmentAmount)}</span>
                                </div>
                                <div className="flex flex-wrap items-center justify-between gap-2">
                                    <span className="text-muted-foreground">Current total salary</span>
                                    <span className="font-medium">{formatCurrency(regularTotalSalary)}</span>
                                </div>
                                <div className="flex flex-wrap items-center justify-between gap-2 border-t pt-2">
                                    <span className="text-muted-foreground">New total salary</span>
                                    <span className="font-semibold">{formatCurrency(projectedAdjustedTotalSalary)}</span>
                                </div>
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="salary-adjustment-amount">TA adjustment amount</Label>
                                <Input
                                    id="salary-adjustment-amount"
                                    type="number"
                                    step="0.01"
                                    value={adjustmentAmountInput}
                                    onChange={(event) => setAdjustmentAmountInput(event.target.value)}
                                    placeholder="Example: 3000"
                                    autoFocus
                                />
                                <p className="text-xs text-muted-foreground">
                                    This replaces the saved TA adjustment for this month. Enter 0 to remove it.
                                </p>
                            </div>

                            {activeFullMonthError && (
                                <div className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-800">
                                    {activeFullMonthError}
                                </div>
                            )}

                            {adjustmentError && (
                                <div className="rounded-md border border-destructive/20 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                                    {adjustmentError}
                                </div>
                            )}
                        </div>
                    )}

                    <DialogFooter>
                        <Button variant="outline" onClick={closeAdjustmentModal} disabled={isApplyingAdjustment}>
                            Cancel
                        </Button>
                        <Button
                            onClick={handleApplySalaryAdjustment}
                            disabled={isApplyingAdjustment || !hasAdjustmentAmountInput || !Number.isFinite(adjustmentInputAmount) || Boolean(activeFullMonthError)}
                        >
                            {isApplyingAdjustment ? (
                                <>
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    Applying...
                                </>
                            ) : (
                                'Save TA Adjustment'
                            )}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
};

export default EmployeeSummary;
