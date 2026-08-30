"use client";

import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Loader2, CalendarDays, Clock3, Pencil } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { useUnsavedChanges } from '@/components/unsaved-changes-provider';
import { toast } from 'sonner';

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

            setWorkingDays(payload);
            setEditedData(payload);
            setEditMode(false);
            toast.success('Working-day settings updated', { duration: 3000 });
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Error updating working days';
            setError(message);
            toast.error(message, { duration: 3000 });
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
        <Card className="gap-0 border-border/70 py-0 shadow-sm">
            <CardContent className="space-y-4 p-4">
                    {isLoading && (
                        <div className="grid gap-3 sm:grid-cols-2">
                            <Skeleton className="h-32 rounded-xl" />
                            <Skeleton className="h-32 rounded-xl" />
                            <Skeleton className="h-16 rounded-xl sm:col-span-2" />
                        </div>
                    )}

                    {error && (
                        <div className="rounded-lg border border-destructive/20 bg-destructive/10 p-3 text-sm text-destructive">
                            <div className="flex flex-wrap items-center justify-between gap-3">
                                <p>{error}</p>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    className="h-8"
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
                        <div className="space-y-3">
                            <div className="grid gap-3 sm:grid-cols-2">
                                <section className="rounded-xl border border-border/70 bg-card p-4">
                                    <div className="flex items-start justify-between gap-4">
                                        <div className="flex items-center gap-3">
                                            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/8 text-primary">
                                                <CalendarDays className="h-4 w-4" />
                                            </span>
                                            <div>
                                                <Label htmlFor="fullDayCount" className="text-sm font-semibold text-foreground">Full days</Label>
                                                <p className="mt-0.5 text-xs text-muted-foreground">Complete attendance value</p>
                                            </div>
                                        </div>
                                        {editMode ? (
                                            <Input
                                                id="fullDayCount"
                                                type="number"
                                                value={editedData.fullDayCount}
                                                onChange={(event) => handleInputChange('fullDayCount', event.target.value)}
                                                className="h-9 w-24 text-right text-sm font-semibold"
                                                min="1"
                                                step="1"
                                                aria-invalid={!isValidDayCount(editedData.fullDayCount)}
                                            />
                                        ) : (
                                            <span className="text-2xl font-semibold tracking-tight text-foreground">{workingDays.fullDayCount}</span>
                                        )}
                                    </div>
                                </section>

                                <section className="rounded-xl border border-border/70 bg-card p-4">
                                    <div className="flex items-start justify-between gap-4">
                                        <div className="flex items-center gap-3">
                                            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-amber-500/10 text-amber-700 dark:text-amber-400">
                                                <Clock3 className="h-4 w-4" />
                                            </span>
                                            <div>
                                                <Label htmlFor="halfDayCount" className="text-sm font-semibold text-foreground">Half days</Label>
                                                <p className="mt-0.5 text-xs text-muted-foreground">Partial attendance value</p>
                                            </div>
                                        </div>
                                        {editMode ? (
                                            <Input
                                                id="halfDayCount"
                                                type="number"
                                                value={editedData.halfDayCount}
                                                onChange={(event) => handleInputChange('halfDayCount', event.target.value)}
                                                className="h-9 w-24 text-right text-sm font-semibold"
                                                min="1"
                                                step="1"
                                                aria-invalid={!isValidDayCount(editedData.halfDayCount)}
                                            />
                                        ) : (
                                            <span className="text-2xl font-semibold tracking-tight text-foreground">{workingDays.halfDayCount}</span>
                                        )}
                                    </div>
                                </section>
                            </div>

                            <div className="flex flex-col gap-3 rounded-xl border border-border/60 bg-muted/20 p-3 sm:flex-row sm:items-center sm:justify-between">
                                <div className="flex min-w-0 items-start gap-3">
                                    <CalendarDays className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                                    <p className="max-w-3xl text-xs leading-5 text-muted-foreground">
                                        These values determine how attendance is classified for salary calculations. Full days represent complete attendance; half days represent partial attendance.
                                    </p>
                                </div>
                                {editMode ? (
                                    <div className="flex shrink-0 gap-2">
                                        <Button onClick={cancelEdit} variant="outline" size="sm" className="h-8">Cancel</Button>
                                        <Button
                                            onClick={updateWorkingDays}
                                            size="sm"
                                            className="h-8 min-w-24"
                                            disabled={isSaving || !isWorkingDaysFormValid || !workingDaysAreDirty}
                                        >
                                            {isSaving ? (
                                                <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Saving...</>
                                            ) : 'Save changes'}
                                        </Button>
                                    </div>
                                ) : (
                                    <Button onClick={startEdit} variant="outline" size="sm" className="h-8 shrink-0">
                                        <Pencil className="mr-2 h-3.5 w-3.5" />
                                        Edit values
                                    </Button>
                                )}
                            </div>
                        </div>
                    )}
            </CardContent>
        </Card>
    );
};

export default WorkingDays;
