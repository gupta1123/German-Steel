"use client";

import React, { useState, useEffect, useCallback } from 'react';
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
import { DollarSign, Truck, Loader2, ChevronLeft, ChevronRight } from "lucide-react";
import { API } from "@/lib/api";
import { useUnsavedChanges } from '@/components/unsaved-changes-provider';

interface Employee {
    id: number;
    firstName: string;
    lastName: string;
    travelAllowance?: number;
    dearnessAllowance?: number;
    fullMonthSalary?: number;
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

    const fetchEmployees = useCallback(async () => {
        if (!token) {
            setError('Authentication token not found. Please log in.');
            return;
        }

        setIsLoading(true);
        setError(null);
        try {
            const data = await API.getAllEmployees<Employee>();
            const sortedData = data.sort((a: Employee, b: Employee) => a.firstName.localeCompare(b.firstName));
            setEmployees(sortedData);
        } catch (error) {
            setError(error instanceof Error ? error.message : 'An unknown error occurred');
        } finally {
            setIsLoading(false);
        }
    }, [token]);

    const fetchTravelRates = useCallback(async () => {
        if (!token) return;

        try {
            const response = await fetch('http://ec2-18-211-58-135.compute-1.amazonaws.com:8081/travel-rates/getAll', {
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

        setIsSaving(true);
        try {
            const salaryResponse = await fetch(`http://ec2-18-211-58-135.compute-1.amazonaws.com:8081/employee/setSalary`, {
                method: 'PUT',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    travelAllowance: employee.travelAllowance,
                    dearnessAllowance: employee.dearnessAllowance,
                    fullMonthSalary: employee.fullMonthSalary,
                    employeeId: employeeId,
                }),
            });

            if (!salaryResponse.ok) {
                throw new Error('Failed to update salary');
            }

            const existingTravelRate = travelRates.find(rate => rate.employeeId === employeeId);
            const travelRateData = {
                employeeId: employeeId,
                carRatePerKm: parseFloat(String(employee.carRatePerKm || 0)) || 0,
                bikeRatePerKm: parseFloat(String(employee.bikeRatePerKm || 0)) || 0
            };

            let travelRateResponse;
            if (existingTravelRate) {
                travelRateResponse = await fetch(`http://ec2-18-211-58-135.compute-1.amazonaws.com:8081/travel-rates/edit?id=${existingTravelRate.id}`, {
                    method: 'PUT',
                    headers: {
                        'Authorization': `Bearer ${token}`,
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify(travelRateData),
                });
            } else {
                travelRateResponse = await fetch(`http://ec2-18-211-58-135.compute-1.amazonaws.com:8081/travel-rates/create`, {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${token}`,
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify(travelRateData),
                });
            }

            if (!travelRateResponse.ok) {
                throw new Error('Failed to update travel rates');
            }

            fetchEmployees();
            fetchTravelRates();
            setEditMode(prevMode => ({
                ...prevMode,
                [employeeId]: false
            }));
        } catch (error) {
            console.error('Error saving changes:', error);
            setError(error instanceof Error ? error.message : 'Error saving changes');
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

    const indexOfLastRow = currentPage * itemsPerPage;
    const indexOfFirstRow = indexOfLastRow - itemsPerPage;
    const currentRows = employees.slice(indexOfFirstRow, indexOfLastRow);
    const totalPages = Math.ceil(employees.length / itemsPerPage);

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
        <div className="space-y-6">
            <Card className="border-0 shadow-sm">
                <CardHeader className="pb-4">
                    <CardTitle className="text-3xl md:text-xl font-semibold text-foreground">Allowance Details</CardTitle>
                    <p className="text-lg md:text-sm text-muted-foreground">Manage employee allowances, salaries, and travel rates</p>
                </CardHeader>
                <CardContent className="space-y-6">
                    {isLoading && (
                        <div className="flex justify-center items-center py-12">
                            <div className="flex flex-col items-center gap-3">
                                <Loader2 className="w-8 h-8 animate-spin text-primary" />
                                <p className="text-sm text-muted-foreground">Loading employee data...</p>
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

                    {!isLoading && !error && (
                        <>
                            {/* Mobile view - Cards */}
                            <div className="md:hidden space-y-4">
                                {currentRows.map((employee) => (
                                    <Card key={employee.id} className="overflow-hidden">
                                        <CardHeader className="pb-2">
                                            <div className="flex items-center justify-between">
                                                <div className="flex items-center space-x-3">
                                                    <Avatar className="h-12 w-12 bg-primary">
                                                        <AvatarFallback className="text-primary-foreground">
                                                            {getInitials(employee.firstName, employee.lastName)}
                                                        </AvatarFallback>
                                                    </Avatar>
                                                    <div>
                                                        <CardTitle className="text-xl font-bold">{`${employee.firstName} ${employee.lastName}`}</CardTitle>
                                                    </div>
                                                </div>
                                            </div>
                                        </CardHeader>
                                        <CardContent className="pt-2">
                                            <div className="space-y-4 text-lg">
                                                <div className="flex items-center justify-between">
                                                    <div className="flex items-center space-x-3">
                                                        <DollarSign className="h-6 w-6 text-foreground" />
                                                        <span className="font-medium">DA:</span>
                                                    </div>
                                                    {editMode[employee.id] ? (
                                                        <Input
                                                            type="number"
                                                            min="0"
                                                            step="0.01"
                                                            value={String(editedData[employee.id]?.dearnessAllowance ?? employee.dearnessAllowance ?? 0)}
                                                            onChange={(e) => handleInputChange(employee.id, 'dearnessAllowance', e.target.value)}
                                                            className="w-32 text-right h-12 text-lg"
                                                        />
                                                    ) : (
                                                        <span className="font-semibold">{formatCurrency(employee.dearnessAllowance || 0)}</span>
                                                    )}
                                                </div>
                                                <div className="flex items-center justify-between">
                                                    <div className="flex items-center space-x-3">
                                                        <DollarSign className="h-6 w-6 text-foreground" />
                                                        <span className="font-medium">Salary:</span>
                                                    </div>
                                                    {editMode[employee.id] ? (
                                                        <Input
                                                            type="number"
                                                            min="0"
                                                            step="0.01"
                                                            value={String(editedData[employee.id]?.fullMonthSalary ?? employee.fullMonthSalary ?? 0)}
                                                            onChange={(e) => handleInputChange(employee.id, 'fullMonthSalary', e.target.value)}
                                                            className="w-32 text-right h-12 text-lg"
                                                        />
                                                    ) : (
                                                        <span className="font-semibold">{formatCurrency(employee.fullMonthSalary || 0)}</span>
                                                    )}
                                                </div>
                                                <div className="flex items-center justify-between">
                                                    <div className="flex items-center space-x-3">
                                                        <Truck className="h-6 w-6 text-foreground" />
                                                        <span className="font-medium">Car Rate:</span>
                                                    </div>
                                                    {editMode[employee.id] ? (
                                                        <Input
                                                            type="number"
                                                            min="0"
                                                            step="0.01"
                                                            value={String(editedData[employee.id]?.carRatePerKm ?? travelRates.find(rate => rate.employeeId === employee.id)?.carRatePerKm ?? 0)}
                                                            onChange={(e) => handleInputChange(employee.id, 'carRatePerKm', e.target.value)}
                                                            className="w-32 text-right h-12 text-lg"
                                                        />
                                                    ) : (
                                                        <span className="font-semibold">{formatRatePerKm(travelRates.find(rate => rate.employeeId === employee.id)?.carRatePerKm ?? 0)}</span>
                                                    )}
                                                </div>
                                                <div className="flex items-center justify-between">
                                                    <div className="flex items-center space-x-3">
                                                        <Truck className="h-6 w-6 text-foreground" />
                                                        <span className="font-medium">Bike Rate:</span>
                                                    </div>
                                                    {editMode[employee.id] ? (
                                                        <Input
                                                            type="number"
                                                            min="0"
                                                            step="0.01"
                                                            value={String(editedData[employee.id]?.bikeRatePerKm ?? travelRates.find(rate => rate.employeeId === employee.id)?.bikeRatePerKm ?? 0)}
                                                            onChange={(e) => handleInputChange(employee.id, 'bikeRatePerKm', e.target.value)}
                                                            className="w-32 text-right h-12 text-lg"
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
                                                            className="flex-1 h-14 text-lg font-medium" 
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
                                                        <Button onClick={() => cancelEdit(employee.id)} variant="outline" className="flex-1 h-14 text-lg font-medium">Cancel</Button>
                                                    </div>
                                                ) : (
                                                    <Button onClick={() => startEdit(employee.id)} className="w-full h-14 text-lg font-medium">Edit</Button>
                                                )}
                                            </div>
                                        </CardContent>
                                    </Card>
                                ))}
                            </div>

                            {/* Desktop view - Table */}
                            <div className="hidden md:block">
                                <div className="rounded-lg border bg-card">
                                    <div className="p-4 border-b">
                                        <h3 className="text-lg font-semibold text-foreground">Employee Allowances</h3>
                                        <p className="text-sm text-muted-foreground">Manage DA, Salary, and vehicle rates per employee</p>
                                    </div>
                                    <div className="overflow-x-auto">
                                        <Table>
                                            <TableHeader>
                                                <TableRow>
                                                    <TableHead>Employee</TableHead>
                                                    <TableHead>DA</TableHead>
                                                    <TableHead>Salary</TableHead>
                                                    <TableHead>Car Rate (per km)</TableHead>
                                                    <TableHead>Bike Rate (per km)</TableHead>
                                                    <TableHead>Action</TableHead>
                                                </TableRow>
                                            </TableHeader>
                                            <TableBody>
                                                {currentRows.map((employee) => (
                                                    <TableRow key={employee.id}>
                                                        <TableCell className="font-medium">{employee.firstName} {employee.lastName}</TableCell>
                                                        <TableCell>
                                                            {editMode[employee.id] ? (
                                                                <Input
                                                                    type="number"
                                                                    min="0"
                                                                    step="0.01"
                                                                    value={String(editedData[employee.id]?.dearnessAllowance ?? employee.dearnessAllowance ?? 0)}
                                                                    onChange={(e) => handleInputChange(employee.id, 'dearnessAllowance', e.target.value)}
                                                                    className="w-full"
                                                                />
                                                            ) : (
                                                                formatCurrency(employee.dearnessAllowance || 0)
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
                                                                    className="w-full"
                                                                />
                                                            ) : (
                                                                formatCurrency(employee.fullMonthSalary || 0)
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
                                                                    className="w-full"
                                                                />
                                                            ) : (
                                                                formatRatePerKm(travelRates.find(rate => rate.employeeId === employee.id)?.carRatePerKm ?? 0)
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
                                                                    className="w-full"
                                                                />
                                                            ) : (
                                                                formatRatePerKm(travelRates.find(rate => rate.employeeId === employee.id)?.bikeRatePerKm ?? 0)
                                                            )}
                                                        </TableCell>
                                                        <TableCell>
                                                            {editMode[employee.id] ? (
                                                                <div className="flex space-x-2">
                                                                    <Button 
                                                                        onClick={() => updateSalary(employee.id)} 
                                                                        className="flex-1" 
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
                                                                    <Button onClick={() => cancelEdit(employee.id)} variant="outline" className="flex-1">Cancel</Button>
                                                                </div>
                                                            ) : (
                                                                <Button onClick={() => startEdit(employee.id)} className="w-full">Edit</Button>
                                                            )}
                                                        </TableCell>
                                                    </TableRow>
                                                ))}
                                            </TableBody>
                                        </Table>
                                    </div>
                                </div>
                            </div>

                            {totalPages > 0 && (
                                <div className="flex items-center justify-between mt-4">
                                    <div className="flex items-center space-x-2">
                                        <Label htmlFor="pageSize">Rows per page:</Label>
                                        <Select value={itemsPerPage.toString()} onValueChange={(value) => {
                                            const next = parseInt(value);
                                            setItemsPerPage(next);
                                            // If current page exceeds new total, clamp it
                                            const nextTotal = Math.ceil(employees.length / next) || 1;
                                            if (currentPage > nextTotal) setCurrentPage(nextTotal);
                                        }}>
                                            <SelectTrigger className="w-20">
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
                                    <div className="flex items-center space-x-2">
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                                            disabled={currentPage === 1}
                                        >
                                            <ChevronLeft className="h-4 w-4" />
                                            Previous
                                        </Button>
                                        <span className="text-sm text-muted-foreground">
                                            Page {currentPage} of {Math.max(totalPages, 1)}
                                        </span>
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                                            disabled={currentPage >= totalPages}
                                        >
                                            Next
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
