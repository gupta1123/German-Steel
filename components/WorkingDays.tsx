"use client";

import { useState, useEffect, useCallback } from 'react';
import {
    Table,
    TableHeader,
    TableBody,
    TableHead,
    TableRow,
    TableCell,
} from "@/components/ui/table";
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Loader2, Calendar, Clock } from 'lucide-react';
import { useUnsavedChanges } from '@/components/unsaved-changes-provider';

interface WorkingDaysData {
    fullDayCount: number;
    halfDayCount: number;
}

type WorkingDaysFormData = {
    fullDayCount: number | "";
    halfDayCount: number | "";
};

const WorkingDays: React.FC = () => {
    const [workingDays, setWorkingDays] = useState<WorkingDaysData>({ fullDayCount: 6, halfDayCount: 3 });
    const [editMode, setEditMode] = useState(false);
    const [editedData, setEditedData] = useState<WorkingDaysFormData>({ fullDayCount: 6, halfDayCount: 3 });
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [isSaving, setIsSaving] = useState(false);
    const isValidDayCount = (value: number | "") =>
        value !== "" && Number.isInteger(value) && value >= 1;
    const isWorkingDaysFormValid =
        isValidDayCount(editedData.fullDayCount) && isValidDayCount(editedData.halfDayCount);
    const workingDaysAreDirty = editMode && (
        Number(editedData.fullDayCount) !== workingDays.fullDayCount ||
        Number(editedData.halfDayCount) !== workingDays.halfDayCount
    );
    const { requestDiscard } = useUnsavedChanges(workingDaysAreDirty);

    // Get auth data from localStorage instead of props
    const token = typeof window !== 'undefined' ? localStorage.getItem('authToken') : null;

    const fetchWorkingDays = useCallback(async () => {
        if (!token) {
            setError('Authentication token not found. Please log in.');
            return;
        }

        setIsLoading(true);
        setError(null);
        try {
            const response = await fetch(`http://ec2-18-211-58-135.compute-1.amazonaws.com:8081/attendance-rule/getById?id=2`, {
                headers: {
                    'Authorization': `Bearer ${token}`,
                },
            });

            if (!response.ok) {
                throw new Error(`Failed to fetch working days: ${response.statusText}`);
            }

            const result = await response.json();
            setWorkingDays(result);
            setEditedData(result);
        } catch (error) {
            setError(error instanceof Error ? error.message : 'An unknown error occurred');
        } finally {
            setIsLoading(false);
        }
    }, [token]);

    const updateWorkingDays = async () => {
        if (!isWorkingDaysFormValid) return;

        if (!token) {
            setError('Authentication token not found. Please log in.');
            return;
        }

        setIsSaving(true);
        setError(null);
        try {
            const payload = {
                fullDayCount: Number(editedData.fullDayCount),
                halfDayCount: Number(editedData.halfDayCount),
            };

            const response = await fetch(`http://ec2-18-211-58-135.compute-1.amazonaws.com:8081/attendance-rule/edit?id=2`, {
                method: 'PUT',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(payload),
            });

            if (!response.ok) {
                throw new Error(`Failed to update working days: ${response.statusText}`);
            }

            await fetchWorkingDays();
            setEditMode(false);
        } catch (error) {
            setError(error instanceof Error ? error.message : 'Error updating working days');
        } finally {
            setIsSaving(false);
        }
    };

    const handleInputChange = (field: keyof WorkingDaysData, value: string) => {
        if (value === "") {
            setEditedData(prev => ({
                ...prev,
                [field]: ""
            }));
            return;
        }

        const parsedValue = parseInt(value, 10);
        if (!Number.isNaN(parsedValue)) {
            setEditedData(prev => ({
                ...prev,
                [field]: parsedValue
            }));
        }
    };

    const startEdit = () => {
        setEditedData({
            fullDayCount: workingDays.fullDayCount,
            halfDayCount: workingDays.halfDayCount
        });
        setEditMode(true);
    };

    const cancelEdit = () => {
        requestDiscard(() => {
            setEditedData({
                fullDayCount: workingDays.fullDayCount,
                halfDayCount: workingDays.halfDayCount
            });
            setEditMode(false);
        });
    };

    useEffect(() => {
        if (token) {
            fetchWorkingDays();
        }
    }, [fetchWorkingDays]);

    return (
        <div className="space-y-6">
            <Card className="border-0 shadow-sm">
                <CardHeader className="pb-4">
                    <CardTitle className="text-3xl md:text-xl font-semibold text-foreground">Working Days Configuration</CardTitle>
                    <p className="text-lg md:text-sm text-muted-foreground">Configure full day and half day thresholds for attendance calculations</p>
                </CardHeader>
                <CardContent className="space-y-6">
                    {isLoading && (
                        <div className="flex justify-center items-center py-12">
                            <div className="flex flex-col items-center gap-3">
                                <Loader2 className="w-8 h-8 animate-spin text-primary" />
                                <p className="text-sm text-muted-foreground">Loading working days configuration...</p>
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
                                        fetchWorkingDays();
                                    }}
                                >
                                    Try Again
                                </Button>
                            </div>
                        </div>
                    )}

                    {!isLoading && !error && (
                        <>
                            {/* Mobile view */}
                            <div className="md:hidden space-y-4">
                                <Card className="overflow-hidden">
                                    <CardContent className="space-y-5">
                                        <div className="space-y-4">
                                            <div className="flex items-center justify-between py-3 px-4 bg-muted/30 rounded-lg border border-border/50">
                                                <div className="flex items-center space-x-3">
                                                    <Clock className="h-6 w-6 text-foreground" />
                                                    <Label className="font-medium text-lg">Full Days:</Label>
                                                </div>
                                                {editMode ? (
                                                    <Input
                                                        type="number"
                                                        value={editedData.fullDayCount}
                                                        onChange={(e) => handleInputChange('fullDayCount', e.target.value)}
                                                        className="w-32 text-right h-12 text-lg"
                                                        min="1"
                                                        step="1"
                                                        aria-invalid={!isValidDayCount(editedData.fullDayCount)}
                                                    />
                                                ) : (
                                                    <span className="font-semibold text-xl">{workingDays.fullDayCount}</span>
                                                )}
                                            </div>
                                            <div className="flex items-center justify-between py-3 px-4 bg-muted/30 rounded-lg border border-border/50">
                                                <div className="flex items-center space-x-3">
                                                    <Clock className="h-6 w-6 text-foreground" />
                                                    <Label className="font-medium text-lg">Half Days:</Label>
                                                </div>
                                                {editMode ? (
                                                    <div className="space-y-1 text-right">
                                                        <Input
                                                            id="mobile-half-day-count"
                                                            type="number"
                                                            value={editedData.halfDayCount}
                                                            onChange={(e) => handleInputChange('halfDayCount', e.target.value)}
                                                            className="w-32 text-right h-12 text-lg"
                                                            min="1"
                                                            step="1"
                                                            aria-describedby="mobile-half-day-minimum"
                                                            aria-invalid={!isValidDayCount(editedData.halfDayCount)}
                                                        />
                                                        <p id="mobile-half-day-minimum" className="text-xs text-muted-foreground">Minimum: 1</p>
                                                    </div>
                                                ) : (
                                                    <span className="font-semibold text-xl">{workingDays.halfDayCount}</span>
                                                )}
                                            </div>
                                        </div>
                                        <div className="pt-4 border-t">
                                            {editMode ? (
                                                <div className="flex space-x-3">
                                                    <Button 
                                                        onClick={updateWorkingDays} 
                                                        className="flex-1 h-14 text-lg font-medium" 
                                                        disabled={isSaving || !isWorkingDaysFormValid}
                                                    >
                                                        {isSaving ? (
                                                            <>
                                                                <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                                                                Saving...
                                                            </>
                                                        ) : (
                                                            'Save Changes'
                                                        )}
                                                    </Button>
                                                    <Button onClick={cancelEdit} variant="outline" className="flex-1 h-14 text-lg font-medium">
                                                        Cancel
                                                    </Button>
                                                </div>
                                            ) : (
                                                <Button onClick={startEdit} className="w-full h-14 text-lg font-medium">
                                                    Edit Configuration
                                                </Button>
                                            )}
                                        </div>
                                    </CardContent>
                                </Card>
                            </div>

                            {/* Desktop view */}
                            <div className="hidden md:block">
                                <div className="rounded-lg border bg-card">
                                    <div className="overflow-x-auto">
                                        <Table>
                                            <TableHeader>
                                                <TableRow>
                                                    <TableHead className="w-1/3">Full Days</TableHead>
                                                    <TableHead className="w-1/3">Half Days</TableHead>
                                                    <TableHead className="w-1/3 text-right">Action</TableHead>
                                                </TableRow>
                                            </TableHeader>
                                            <TableBody>
                                                <TableRow>
                                                    <TableCell>
                                                        {editMode ? (
                                                            <div className="space-y-2">
                                                                <Label htmlFor="fullDayCount" className="text-sm font-medium text-foreground">
                                                                    Full Days Count
                                                                </Label>
                                                                <Input
                                                                    id="fullDayCount"
                                                                    type="number"
                                                                    value={editedData.fullDayCount}
                                                                    onChange={(e) => handleInputChange('fullDayCount', e.target.value)}
                                                                    className="w-full"
                                                                    min="1"
                                                                    step="1"
                                                                    aria-invalid={!isValidDayCount(editedData.fullDayCount)}
                                                                />
                                                            </div>
                                                        ) : (
                                                            <div className="flex items-center space-x-2">
                                                                <Clock className="h-5 w-5 text-foreground" />
                                                                <span className="font-semibold text-lg">{workingDays.fullDayCount}</span>
                                                            </div>
                                                        )}
                                                    </TableCell>
                                                    <TableCell>
                                                        {editMode ? (
                                                            <div className="space-y-2">
                                                                <Label htmlFor="halfDayCount" className="text-sm font-medium text-foreground">
                                                                    Half Days Count
                                                                </Label>
                                                                <Input
                                                                    id="halfDayCount"
                                                                    type="number"
                                                                    value={editedData.halfDayCount}
                                                                    onChange={(e) => handleInputChange('halfDayCount', e.target.value)}
                                                                    className="w-full"
                                                                    min="1"
                                                                    step="1"
                                                                    aria-describedby="half-day-minimum"
                                                                    aria-invalid={!isValidDayCount(editedData.halfDayCount)}
                                                                />
                                                                <p id="half-day-minimum" className="text-xs text-muted-foreground">Minimum: 1</p>
                                                            </div>
                                                        ) : (
                                                            <div className="flex items-center space-x-2">
                                                                <Clock className="h-5 w-5 text-foreground" />
                                                                <span className="font-semibold text-lg">{workingDays.halfDayCount}</span>
                                                            </div>
                                                        )}
                                                    </TableCell>
                                                    <TableCell className="text-right">
                                                        {editMode ? (
                                                            <div className="flex justify-end gap-2">
                                                                <Button 
                                                                    onClick={updateWorkingDays} 
                                                                    size="sm"
                                                                    className="min-w-24"
                                                                    disabled={isSaving || !isWorkingDaysFormValid}
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
                                                                <Button onClick={cancelEdit} variant="outline" size="sm" className="min-w-24">
                                                                    Cancel
                                                                </Button>
                                                            </div>
                                                        ) : (
                                                            <Button onClick={startEdit} size="sm" className="min-w-24">
                                                                Edit
                                                            </Button>
                                                        )}
                                                    </TableCell>
                                                </TableRow>
                                            </TableBody>
                                        </Table>
                                    </div>
                                </div>
                            </div>

                            {/* Information Card */}
                            <Card className="bg-muted/30">
                                <CardContent className="pt-6">
                                    <div className="flex items-start space-x-3">
                                        <Calendar className="h-6 w-6 text-foreground mt-0.5" />
                                        <div className="space-y-2">
                                            <h4 className="font-medium text-xl text-foreground">About Working Days Configuration</h4>
                                            <p className="text-lg md:text-sm text-muted-foreground">
                                                This configuration determines how attendance is calculated for salary purposes. 
                                                Full days represent complete working days, while half days represent partial attendance.
                                            </p>
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>
                        </>
                    )}
                </CardContent>
            </Card>
        </div>
    );
};

export default WorkingDays;
