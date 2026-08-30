"use client";

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { 
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { DollarSign, Truck, Loader2, ChevronLeft, ChevronRight, Search, RotateCcw, ChevronsUpDown, Check } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { API } from "@/lib/api";
import { useUnsavedChanges } from '@/components/unsaved-changes-provider';
import { getEmployeeRoleCategory } from '@/lib/employee-role';
import { toast } from 'sonner';

interface Employee {
    id: number;
    firstName: string;
    lastName: string;
    travelAllowance?: number;
    dearnessAllowance?: number;
    fullMonthSalary?: number;
    role?: string;
}

interface TravelRate {
    id: number;
    employeeId: number;
    carRatePerKm: number;
    bikeRatePerKm: number;
}

const ALLOWANCE_AMOUNT_FIELDS = [
    'travelAllowance',
    'dearnessAllowance',
    'fullMonthSalary',
    'carRatePerKm',
    'bikeRatePerKm',
] as const;

const isValidAmount = (value: unknown) => {
    if (value === null || value === undefined) return false;
    if (typeof value === 'string' && value.trim() === '') return false;
    const amount = Number(value);
    return Number.isFinite(amount) && amount >= 0;
};

function Ellipsis({ value }: { value: string | number | null | undefined }) {
    const displayValue = value === null || value === undefined || value === '' ? '—' : String(value);
    return <span className="block min-w-0 truncate" title={displayValue}>{displayValue}</span>;
}

const Allowance: React.FC = () => {
    const [employees, setEmployees] = useState<Employee[]>([]);
    const [editMode, setEditMode] = useState<{ [key: number]: boolean }>({});
    const [editedData, setEditedData] = useState<{ [key: number]: Record<string, unknown> }>({});
    const [currentPage, setCurrentPage] = useState<number>(1);
    const [travelRates, setTravelRates] = useState<TravelRate[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [isSaving, setIsSaving] = useState(false);
    const [itemsPerPage, setItemsPerPage] = useState<number>(10);
    const [employeeFilter, setEmployeeFilter] = useState('all');
    const [employeeFilterSearch, setEmployeeFilterSearch] = useState('');
    const [employeeFilterOpen, setEmployeeFilterOpen] = useState(false);
    const [roleFilter, setRoleFilter] = useState('all');

    const employeeAllowanceIsDirty = (employee: Employee) => {
        if (!editMode[employee.id] || !editedData[employee.id]) return false;
        const draft = editedData[employee.id];
        const travelRate = travelRates.find((rate) => rate.employeeId === employee.id);
        return Number(draft.travelAllowance ?? 0) !== Number(employee.travelAllowance ?? 0) ||
            Number(draft.dearnessAllowance ?? 0) !== Number(employee.dearnessAllowance ?? 0) ||
            Number(draft.fullMonthSalary ?? 0) !== Number(employee.fullMonthSalary ?? 0) ||
            Number(draft.carRatePerKm ?? 0) !== Number(travelRate?.carRatePerKm ?? 0) ||
            Number(draft.bikeRatePerKm ?? 0) !== Number(travelRate?.bikeRatePerKm ?? 0);
    };
    const allowanceChangesAreDirty = employees.some(employeeAllowanceIsDirty);
    const { requestDiscard } = useUnsavedChanges(allowanceChangesAreDirty);

    // Get auth data from localStorage instead of props
    const token = typeof window !== 'undefined' ? localStorage.getItem('authToken') : null;

    const fetchEmployees = useCallback(async (forceRefresh = false, showLoading = true) => {
        if (!token) {
            setError('Authentication token not found. Please log in.');
            return;
        }

        if (showLoading) setIsLoading(true);
        setError(null);
        try {
            const data = await API.getAllEmployees<Employee>({ forceRefresh });
            const sortedData = data.sort((a: Employee, b: Employee) => a.firstName.localeCompare(b.firstName));
            setEmployees(sortedData);
        } catch (error) {
            setError(error instanceof Error ? error.message : 'An unknown error occurred');
        } finally {
            if (showLoading) setIsLoading(false);
        }
    }, [token]);

    const fetchTravelRates = useCallback(async () => {
        if (!token) return;

        try {
            const response = await fetch('http://ec2-18-211-58-135.compute-1.amazonaws.com:8081/travel-rates/getAll', {
                cache: 'no-store',
                headers: {
                    'Authorization': `Bearer ${token}`,
                },
            });
            if (!response.ok) {
                throw new Error('Failed to fetch travel rates');
            }
            const data = await response.json();
            setTravelRates(data);
        } catch (error) {
            console.error('Error fetching travel rates:', error);
        }
    }, [token]);

    useEffect(() => {
        if (token) {
            fetchEmployees();
            fetchTravelRates();
        }
    }, [fetchEmployees, fetchTravelRates]);

    const handleInputChange = (employeeId: number, field: string, value: string) => {
        setEditedData(prevData => ({
            ...prevData,
            [employeeId]: {
                ...prevData[employeeId],
                [field]: value
            }
        }));
    };

    const isEmployeeEditValid = (employeeId: number) => {
        const draft = editedData[employeeId];
        return Boolean(draft && ALLOWANCE_AMOUNT_FIELDS.every((field) => isValidAmount(draft[field])));
    };

    const updateSalary = async (employeeId: number) => {
        const employee = editedData[employeeId];
        const savedEmployee = employees.find((candidate) => candidate.id === employeeId);
        if (!employee || !savedEmployee || !isEmployeeEditValid(employeeId) || !employeeAllowanceIsDirty(savedEmployee)) return;

        const updatedSalary = {
            travelAllowance: Number(employee.travelAllowance),
            dearnessAllowance: Number(employee.dearnessAllowance),
            fullMonthSalary: Number(employee.fullMonthSalary),
        };
        const updatedTravelRate = {
            employeeId,
            carRatePerKm: Number(employee.carRatePerKm),
            bikeRatePerKm: Number(employee.bikeRatePerKm),
        };

        setIsSaving(true);
        try {
            const salaryResponse = await fetch(`http://ec2-18-211-58-135.compute-1.amazonaws.com:8081/employee/setSalary`, {
                method: 'PUT',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    ...updatedSalary,
                    employeeId,
                }),
            });

            if (!salaryResponse.ok) {
                throw new Error('Failed to update salary');
            }

            const existingTravelRate = travelRates.find(rate => rate.employeeId === employeeId);
            let travelRateResponse;
            if (existingTravelRate) {
                travelRateResponse = await fetch(`http://ec2-18-211-58-135.compute-1.amazonaws.com:8081/travel-rates/edit?id=${existingTravelRate.id}`, {
                    method: 'PUT',
                    headers: {
                        'Authorization': `Bearer ${token}`,
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify(updatedTravelRate),
                });
            } else {
                travelRateResponse = await fetch(`http://ec2-18-211-58-135.compute-1.amazonaws.com:8081/travel-rates/create`, {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${token}`,
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify(updatedTravelRate),
                });
            }

            if (!travelRateResponse.ok) {
                throw new Error('Failed to update travel rates');
            }

            // Reconcile the acknowledged values immediately. The employee directory is
            // cached, so a normal refetch here would otherwise restore the pre-save row.
            setEmployees((currentEmployees) => currentEmployees.map((currentEmployee) => (
                currentEmployee.id === employeeId
                    ? { ...currentEmployee, ...updatedSalary }
                    : currentEmployee
            )));
            setTravelRates((currentRates) => {
                const currentRate = currentRates.find((rate) => rate.employeeId === employeeId);
                if (currentRate) {
                    return currentRates.map((rate) => (
                        rate.employeeId === employeeId
                            ? { ...rate, ...updatedTravelRate }
                            : rate
                    ));
                }

                return [...currentRates, { id: -employeeId, ...updatedTravelRate }];
            });

            API.invalidateEmployeeDirectory();
            setEditMode(prevMode => ({
                ...prevMode,
                [employeeId]: false
            }));
            setEditedData((currentData) => {
                const nextData = { ...currentData };
                delete nextData[employeeId];
                return nextData;
            });
            setError(null);
            toast.success('Allowance details updated', { duration: 3000 });

            // Revalidate without replacing the table with a loading state. This also
            // replaces the temporary id used when a travel-rate record was just created.
            void Promise.all([fetchEmployees(true, false), fetchTravelRates()]);
        } catch (error) {
            console.error('Error saving changes:', error);
            const message = error instanceof Error ? error.message : 'Error saving changes';
            setError(message);
            toast.error(message, { duration: 3000 });
        } finally {
            setIsSaving(false);
        }
    };

    const startEdit = (employeeId: number) => {
        const employee = employees.find(e => e.id === employeeId);
        const travelRate = travelRates.find(rate => rate.employeeId === employeeId);
        setEditMode(prevMode => ({
            ...prevMode,
            [employeeId]: true
        }));
        setEditedData(prevData => ({
            ...prevData,
            [employeeId]: {
                travelAllowance: employee?.travelAllowance || 0,
                dearnessAllowance: employee?.dearnessAllowance || 0,
                fullMonthSalary: employee?.fullMonthSalary || 0,
                carRatePerKm: travelRate?.carRatePerKm || 0,
                bikeRatePerKm: travelRate?.bikeRatePerKm || 0
            }
        }));
    };

    const cancelEdit = (employeeId: number) => {
        const employee = employees.find((candidate) => candidate.id === employeeId);
        requestDiscard(() => {
            setEditMode(prevMode => ({
                ...prevMode,
                [employeeId]: false
            }));
            setEditedData(prevData => {
                const newData = { ...prevData };
                delete newData[employeeId];
                return newData;
            });
        }, employee ? employeeAllowanceIsDirty(employee) : false);
    };

    const eligibleEmployees = useMemo(() => employees.filter((employee) => {
        const category = getEmployeeRoleCategory(employee.role);
        return category === 'regional-manager' || category === 'field-officer';
    }), [employees]);

    const filteredEmployeeOptions = useMemo(() => {
        const query = employeeFilterSearch.trim().toLowerCase();
        if (!query) return eligibleEmployees;
        return eligibleEmployees.filter((employee) =>
            `${employee.firstName} ${employee.lastName}`.trim().toLowerCase().includes(query)
        );
    }, [eligibleEmployees, employeeFilterSearch]);

    const selectedEmployeeLabel = useMemo(() => {
        if (employeeFilter === 'all') return 'All employees';
        const employee = eligibleEmployees.find((candidate) => String(candidate.id) === employeeFilter);
        return employee ? `${employee.firstName} ${employee.lastName}`.trim() : 'All employees';
    }, [eligibleEmployees, employeeFilter]);

    const filteredEmployees = useMemo(() => {
        return eligibleEmployees.filter((employee) => {
            const matchesEmployee = employeeFilter === 'all' || String(employee.id) === employeeFilter;
            const matchesRole = roleFilter === 'all' || getEmployeeRoleCategory(employee.role) === roleFilter;
            return matchesEmployee && matchesRole;
        });
    }, [eligibleEmployees, employeeFilter, roleFilter]);

    useEffect(() => {
        setCurrentPage(1);
    }, [employeeFilter, roleFilter]);

    const filtersAreActive = employeeFilter !== 'all' || roleFilter !== 'all';
    const resetFilters = () => {
        setEmployeeFilter('all');
        setEmployeeFilterSearch('');
        setEmployeeFilterOpen(false);
        setRoleFilter('all');
    };

    const indexOfLastRow = currentPage * itemsPerPage;
    const indexOfFirstRow = indexOfLastRow - itemsPerPage;
    const currentRows = filteredEmployees.slice(indexOfFirstRow, indexOfLastRow);
    const totalPages = Math.ceil(filteredEmployees.length / itemsPerPage);

    const getInitials = (firstName: string, lastName: string) => {
        return `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase();
    };

    const formatCurrency = (amount: number) => {
        return new Intl.NumberFormat('en-IN', {
            style: 'currency',
            currency: 'INR'
        }).format(amount);
    };

    const formatRatePerKm = (amount: number) => `${formatCurrency(amount)}/km`;

    return (
        <div className="space-y-4">
            <Card className="gap-0 border-border/70 py-0 shadow-sm">
                <CardContent className="space-y-4 p-4">
                    <div className="flex flex-col gap-2 rounded-lg border border-border/70 bg-muted/20 p-3 sm:flex-row sm:items-center">
                        <Popover open={employeeFilterOpen} onOpenChange={setEmployeeFilterOpen}>
                            <PopoverTrigger asChild>
                                <Button
                                    type="button"
                                    variant="outline"
                                    className="h-9 w-full justify-between px-3 text-sm font-normal shadow-none sm:w-[280px]"
                                >
                                    <span className="truncate">{selectedEmployeeLabel}</span>
                                    <ChevronsUpDown className="h-4 w-4 shrink-0 text-muted-foreground" />
                                </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-[280px] p-0" align="start">
                                <div className="border-b p-2">
                                    <div className="relative">
                                        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                                        <Input
                                            value={employeeFilterSearch}
                                            onChange={(event) => setEmployeeFilterSearch(event.target.value)}
                                            placeholder="Search employees..."
                                            className="h-9 pl-9 text-sm shadow-none"
                                        />
                                    </div>
                                </div>
                                <div className="max-h-64 overflow-y-auto py-1">
                                    <button
                                        type="button"
                                        className={`flex w-full items-center justify-between px-3 py-2 text-sm ${employeeFilter === 'all' ? 'bg-primary/10 font-medium text-primary' : 'hover:bg-muted/50'}`}
                                        onClick={() => {
                                            setEmployeeFilter('all');
                                            setEmployeeFilterSearch('');
                                            setEmployeeFilterOpen(false);
                                        }}
                                    >
                                        <span>All employees</span>
                                        {employeeFilter === 'all' && <Check className="h-4 w-4" />}
                                    </button>
                                    {filteredEmployeeOptions.map((employee) => {
                                        const value = String(employee.id);
                                        const selected = employeeFilter === value;
                                        return (
                                            <button
                                                key={employee.id}
                                                type="button"
                                                className={`flex w-full items-center justify-between gap-2 px-3 py-2 text-sm ${selected ? 'bg-primary/10 font-medium text-primary' : 'hover:bg-muted/50'}`}
                                                onClick={() => {
                                                    setEmployeeFilter(value);
                                                    setEmployeeFilterSearch('');
                                                    setEmployeeFilterOpen(false);
                                                }}
                                            >
                                                <span className="truncate">{employee.firstName} {employee.lastName}</span>
                                                {selected && <Check className="h-4 w-4 shrink-0" />}
                                            </button>
                                        );
                                    })}
                                    {filteredEmployeeOptions.length === 0 && (
                                        <p className="px-3 py-6 text-center text-sm text-muted-foreground">No employees found.</p>
                                    )}
                                </div>
                            </PopoverContent>
                        </Popover>
                        <Select value={roleFilter} onValueChange={setRoleFilter}>
                            <SelectTrigger className="h-9 w-full text-sm shadow-none sm:w-[180px]">
                                <SelectValue placeholder="All roles" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">All roles</SelectItem>
                                <SelectItem value="regional-manager">Regional Managers</SelectItem>
                                <SelectItem value="field-officer">Field Officers</SelectItem>
                            </SelectContent>
                        </Select>
                        <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="h-9 shadow-none"
                            onClick={resetFilters}
                            disabled={!filtersAreActive}
                        >
                            <RotateCcw className="mr-2 h-4 w-4" />
                            Reset
                        </Button>
                        <span className="text-xs text-muted-foreground sm:ml-auto">
                            {filteredEmployees.length} employee{filteredEmployees.length === 1 ? '' : 's'}
                        </span>
                    </div>

                    {error && (
                        <div className="p-4 text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded-md">
                            <div className="flex items-center justify-between">
                                <p><strong>Error:</strong> {error}</p>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => {
                                        setError(null);
                                        fetchEmployees();
                                        fetchTravelRates();
                                    }}
                                >
                                    Try Again
                                </Button>
                            </div>
                        </div>
                    )}

                    {!error && (
                        <>
                            {/* Mobile view - Cards */}
                            <div className="space-y-3 md:hidden">
                                {isLoading ? (
                                    Array.from({ length: 3 }, (_, index) => (
                                        <Skeleton key={index} className="h-48 w-full rounded-xl" />
                                    ))
                                ) : (
                                    <>
                                {currentRows.length === 0 && (
                                    <div className="rounded-lg border py-10 text-center text-sm text-muted-foreground">
                                        No employees match these filters.
                                    </div>
                                )}
                                {currentRows.map((employee) => (
                                    <Card key={employee.id} className="overflow-hidden">
                                        <CardHeader className="pb-2">
                                            <div className="flex items-center justify-between">
                                                <div className="flex items-center space-x-3">
                                                    <Avatar className="h-9 w-9 bg-primary">
                                                        <AvatarFallback className="text-primary-foreground">
                                                            {getInitials(employee.firstName, employee.lastName)}
                                                        </AvatarFallback>
                                                    </Avatar>
                                                    <div>
                                                        <CardTitle className="text-sm font-semibold">{`${employee.firstName} ${employee.lastName}`}</CardTitle>
                                                    </div>
                                                </div>
                                            </div>
                                        </CardHeader>
                                        <CardContent className="pt-2">
                                            <div className="space-y-3 text-sm">
                                                <div className="flex items-center justify-between">
                                                    <div className="flex items-center space-x-3">
                                                        <DollarSign className="h-4 w-4 text-muted-foreground" />
                                                        <span className="font-medium">DA:</span>
                                                    </div>
                                                    {editMode[employee.id] ? (
                                                        <Input
                                                            type="number"
                                                            min="0"
                                                            step="0.01"
                                                            value={String(editedData[employee.id]?.dearnessAllowance ?? employee.dearnessAllowance ?? 0)}
                                                            onChange={(e) => handleInputChange(employee.id, 'dearnessAllowance', e.target.value)}
                                                            className="h-9 w-28 text-right text-sm"
                                                        />
                                                    ) : (
                                                        <span className="font-semibold">{formatCurrency(employee.dearnessAllowance || 0)}</span>
                                                    )}
                                                </div>
                                                <div className="flex items-center justify-between">
                                                    <div className="flex items-center space-x-3">
                                                        <DollarSign className="h-4 w-4 text-muted-foreground" />
                                                        <span className="font-medium">Salary:</span>
                                                    </div>
                                                    {editMode[employee.id] ? (
                                                        <Input
                                                            type="number"
                                                            min="0"
                                                            step="0.01"
                                                            value={String(editedData[employee.id]?.fullMonthSalary ?? employee.fullMonthSalary ?? 0)}
                                                            onChange={(e) => handleInputChange(employee.id, 'fullMonthSalary', e.target.value)}
                                                            className="h-9 w-28 text-right text-sm"
                                                        />
                                                    ) : (
                                                        <span className="font-semibold">{formatCurrency(employee.fullMonthSalary || 0)}</span>
                                                    )}
                                                </div>
                                                <div className="flex items-center justify-between">
                                                    <div className="flex items-center space-x-3">
                                                        <Truck className="h-4 w-4 text-muted-foreground" />
                                                        <span className="font-medium">Car Rate:</span>
                                                    </div>
                                                    {editMode[employee.id] ? (
                                                        <Input
                                                            type="number"
                                                            min="0"
                                                            step="0.01"
                                                            value={String(editedData[employee.id]?.carRatePerKm ?? travelRates.find(rate => rate.employeeId === employee.id)?.carRatePerKm ?? 0)}
                                                            onChange={(e) => handleInputChange(employee.id, 'carRatePerKm', e.target.value)}
                                                            className="h-9 w-28 text-right text-sm"
                                                        />
                                                    ) : (
                                                        <span className="font-semibold">{formatRatePerKm(travelRates.find(rate => rate.employeeId === employee.id)?.carRatePerKm ?? 0)}</span>
                                                    )}
                                                </div>
                                                <div className="flex items-center justify-between">
                                                    <div className="flex items-center space-x-3">
                                                        <Truck className="h-4 w-4 text-muted-foreground" />
                                                        <span className="font-medium">Bike Rate:</span>
                                                    </div>
                                                    {editMode[employee.id] ? (
                                                        <Input
                                                            type="number"
                                                            min="0"
                                                            step="0.01"
                                                            value={String(editedData[employee.id]?.bikeRatePerKm ?? travelRates.find(rate => rate.employeeId === employee.id)?.bikeRatePerKm ?? 0)}
                                                            onChange={(e) => handleInputChange(employee.id, 'bikeRatePerKm', e.target.value)}
                                                            className="h-9 w-28 text-right text-sm"
                                                        />
                                                    ) : (
                                                        <span className="font-semibold">{formatRatePerKm(travelRates.find(rate => rate.employeeId === employee.id)?.bikeRatePerKm ?? 0)}</span>
                                                    )}
                                                </div>
                                            </div>
                                            <div className="mt-5">
                                                {editMode[employee.id] ? (
                                                    <div className="flex space-x-3">
                                                        <Button 
                                                            onClick={() => updateSalary(employee.id)} 
                                                            className="h-9 flex-1 text-sm font-medium"
                                                            disabled={isSaving || !isEmployeeEditValid(employee.id) || !employeeAllowanceIsDirty(employee)}
                                                        >
                                                            {isSaving ? (
                                                                <>
                                                                    <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                                                                    Saving...
                                                                </>
                                                            ) : (
                                                                'Save'
                                                            )}
                                                        </Button>
                                                        <Button onClick={() => cancelEdit(employee.id)} variant="outline" className="h-9 flex-1 text-sm font-medium">Cancel</Button>
                                                    </div>
                                                ) : (
                                                    <Button onClick={() => startEdit(employee.id)} className="h-9 w-full text-sm font-medium">Edit</Button>
                                                )}
                                            </div>
                                        </CardContent>
                                    </Card>
                                ))}
                                    </>
                                )}
                            </div>

                            {/* Desktop view - Table */}
                            <div className="hidden min-w-0 overflow-x-auto md:block">
                                        <Table className="table-fixed text-xs font-poppins">
                                            <colgroup>
                                                <col className="w-[24%]" />
                                                <col className="w-[12%]" />
                                                <col className="w-[15%]" />
                                                <col className="w-[18%]" />
                                                <col className="w-[18%]" />
                                                <col className="w-[13%]" />
                                            </colgroup>
                                            <TableHeader>
                                                <TableRow>
                                                    {['Employee', 'DA', 'Salary', 'Car Rate (per km)', 'Bike Rate (per km)', 'Action'].map((heading) => (
                                                        <TableHead key={heading} className="overflow-hidden text-ellipsis whitespace-nowrap" title={heading}>
                                                            {heading}
                                                        </TableHead>
                                                    ))}
                                                </TableRow>
                                            </TableHeader>
                                            <TableBody>
                                                {isLoading ? (
                                                    Array.from({ length: 3 }, (_, rowIndex) => (
                                                        <TableRow key={`allowance-loading-${rowIndex}`}>
                                                            {Array.from({ length: 6 }, (_, cellIndex) => (
                                                                <TableCell key={cellIndex}>
                                                                    <Skeleton className="h-4 w-full max-w-24" />
                                                                </TableCell>
                                                            ))}
                                                        </TableRow>
                                                    ))
                                                ) : currentRows.length === 0 ? (
                                                    <TableRow>
                                                        <TableCell colSpan={6} className="h-24 text-center text-muted-foreground">
                                                            No employees match these filters.
                                                        </TableCell>
                                                    </TableRow>
                                                ) : currentRows.map((employee) => (
                                                    <TableRow key={employee.id}>
                                                        <TableCell className="font-medium">
                                                            <Ellipsis value={`${employee.firstName} ${employee.lastName}`} />
                                                        </TableCell>
                                                        <TableCell>
                                                            {editMode[employee.id] ? (
                                                                <Input
                                                                    type="number"
                                                                    min="0"
                                                                    step="0.01"
                                                                    value={String(editedData[employee.id]?.dearnessAllowance ?? employee.dearnessAllowance ?? 0)}
                                                                    onChange={(e) => handleInputChange(employee.id, 'dearnessAllowance', e.target.value)}
                                                                    className="h-8 w-full min-w-0 text-xs"
                                                                />
                                                            ) : (
                                                                <Ellipsis value={formatCurrency(employee.dearnessAllowance || 0)} />
                                                            )}
                                                        </TableCell>
                                                        <TableCell>
                                                            {editMode[employee.id] ? (
                                                                <Input
                                                                    type="number"
                                                                    min="0"
                                                                    step="0.01"
                                                                    value={String(editedData[employee.id]?.fullMonthSalary ?? employee.fullMonthSalary ?? 0)}
                                                                    onChange={(e) => handleInputChange(employee.id, 'fullMonthSalary', e.target.value)}
                                                                    className="h-8 w-full min-w-0 text-xs"
                                                                />
                                                            ) : (
                                                                <Ellipsis value={formatCurrency(employee.fullMonthSalary || 0)} />
                                                            )}
                                                        </TableCell>
                                                        <TableCell>
                                                            {editMode[employee.id] ? (
                                                                <Input
                                                                    type="number"
                                                                    min="0"
                                                                    step="0.01"
                                                                    value={String(editedData[employee.id]?.carRatePerKm ?? travelRates.find(rate => rate.employeeId === employee.id)?.carRatePerKm ?? 0)}
                                                                    onChange={(e) => handleInputChange(employee.id, 'carRatePerKm', e.target.value)}
                                                                    className="h-8 w-full min-w-0 text-xs"
                                                                />
                                                            ) : (
                                                                <Ellipsis value={formatRatePerKm(travelRates.find(rate => rate.employeeId === employee.id)?.carRatePerKm ?? 0)} />
                                                            )}
                                                        </TableCell>
                                                        <TableCell>
                                                            {editMode[employee.id] ? (
                                                                <Input
                                                                    type="number"
                                                                    min="0"
                                                                    step="0.01"
                                                                    value={String(editedData[employee.id]?.bikeRatePerKm ?? travelRates.find(rate => rate.employeeId === employee.id)?.bikeRatePerKm ?? 0)}
                                                                    onChange={(e) => handleInputChange(employee.id, 'bikeRatePerKm', e.target.value)}
                                                                    className="h-8 w-full min-w-0 text-xs"
                                                                />
                                                            ) : (
                                                                <Ellipsis value={formatRatePerKm(travelRates.find(rate => rate.employeeId === employee.id)?.bikeRatePerKm ?? 0)} />
                                                            )}
                                                        </TableCell>
                                                        <TableCell>
                                                            {editMode[employee.id] ? (
                                                                <div className="flex items-center gap-1">
                                                                    <Button 
                                                                        onClick={() => updateSalary(employee.id)} 
                                                                        size="sm"
                                                                        className="h-7 px-2 text-xs"
                                                                        disabled={isSaving || !isEmployeeEditValid(employee.id) || !employeeAllowanceIsDirty(employee)}
                                                                    >
                                                                        {isSaving ? (
                                                                            <>
                                                                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                                                                Saving...
                                                                            </>
                                                                        ) : (
                                                                            'Save'
                                                                        )}
                                                                    </Button>
                                                                    <Button onClick={() => cancelEdit(employee.id)} variant="outline" size="sm" className="h-7 px-2 text-xs">Cancel</Button>
                                                                </div>
                                                            ) : (
                                                                <Button variant="ghost" size="sm" onClick={() => startEdit(employee.id)} className="h-7 px-2 text-xs">Edit</Button>
                                                            )}
                                                        </TableCell>
                                                    </TableRow>
                                                ))}
                                            </TableBody>
                                        </Table>
                            </div>

                            {!isLoading && totalPages > 0 && (
                                <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                                    <div className="flex items-center gap-2 text-xs">
                                        <Label htmlFor="pageSize" className="text-xs">Rows per page:</Label>
                                        <Select value={itemsPerPage.toString()} onValueChange={(value) => {
                                            const next = parseInt(value);
                                            setItemsPerPage(next);
                                            // If current page exceeds new total, clamp it
                                            const nextTotal = Math.ceil(filteredEmployees.length / next) || 1;
                                            if (currentPage > nextTotal) setCurrentPage(nextTotal);
                                        }}>
                                            <SelectTrigger className="h-8 w-20 text-xs">
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="10">10</SelectItem>
                                                <SelectItem value="25">25</SelectItem>
                                                <SelectItem value="50">50</SelectItem>
                                                <SelectItem value="100">100</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                                            disabled={currentPage === 1}
                                            className="h-8"
                                        >
                                            <ChevronLeft className="h-4 w-4" />
                                            <span className="hidden sm:inline">Previous</span>
                                        </Button>
                                        <span className="text-xs text-muted-foreground">
                                            Page {currentPage} of {Math.max(totalPages, 1)}
                                        </span>
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                                            disabled={currentPage >= totalPages}
                                            className="h-8"
                                        >
                                            <span className="hidden sm:inline">Next</span>
                                            <ChevronRight className="h-4 w-4" />
                                        </Button>
                                    </div>
                                </div>
                            )}
                        </>
                    )}
                </CardContent>
            </Card>
        </div>
    );
};

export default Allowance;
