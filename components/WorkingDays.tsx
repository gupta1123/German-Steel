"use client";

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { useAuth } from '@/components/auth-provider';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { Switch } from '@/components/ui/switch';
import { useUnsavedChanges } from '@/components/unsaved-changes-provider';
import { AttendanceRule, attendanceRulesApi } from '@/lib/attendance-rules-api';
import { CheckCircle2, Clock3, Loader2, Pencil, Route } from 'lucide-react';
import { toast } from 'sonner';

interface RuleFormData {
    halfDayVisitCount: number | '';
    fullDayVisitCount: number | '';
    active: boolean;
}

const roleLabel = (role: string): string => {
    const labels: Record<string, string> = {
        RETAIL_FE: 'Retail Field Executive',
        INSTITUTION_PROJECT_FE: 'Institution & Project Field Executive',
        DUAL_FE: 'Dual Field Executive',
        ZONAL_SUPERVISOR: 'Zonal Supervisor',
        MANAGER: 'Manager',
        HO_ADMIN: 'Head Office Admin',
    };
    return labels[role] ?? role.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, (letter) => letter.toUpperCase());
};

const WorkingDays: React.FC = () => {
    const { token } = useAuth();
    const [rules, setRules] = useState<AttendanceRule[]>([]);
    const [editingRuleId, setEditingRuleId] = useState<number | null>(null);
    const [editedData, setEditedData] = useState<RuleFormData | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [isSaving, setIsSaving] = useState(false);

    const editingRule = useMemo(
        () => rules.find((rule) => rule.id === editingRuleId) ?? null,
        [editingRuleId, rules],
    );
    const isValidVisitCount = (value: number | '') =>
        value !== '' && Number.isInteger(value) && value >= 1;
    const isFormValid = Boolean(
        editedData &&
        isValidVisitCount(editedData.halfDayVisitCount) &&
        isValidVisitCount(editedData.fullDayVisitCount) &&
        Number(editedData.fullDayVisitCount) > Number(editedData.halfDayVisitCount),
    );
    const ruleIsDirty = Boolean(
        editingRule &&
        editedData &&
        (
            Number(editedData.halfDayVisitCount) !== editingRule.halfDayVisitCount ||
            Number(editedData.fullDayVisitCount) !== editingRule.fullDayVisitCount ||
            editedData.active !== editingRule.active
        ),
    );
    const { requestDiscard } = useUnsavedChanges(ruleIsDirty);

    const fetchRules = useCallback(async () => {
        if (!token) {
            setError('Authentication token not found. Please log in.');
            setIsLoading(false);
            return;
        }

        setIsLoading(true);
        setError(null);
        try {
            setRules(await attendanceRulesApi.getRules(token));
        } catch (error) {
            setError(error instanceof Error ? error.message : 'Could not load attendance rules.');
        } finally {
            setIsLoading(false);
        }
    }, [token]);

    useEffect(() => {
        void fetchRules();
    }, [fetchRules]);

    const openEditor = (rule: AttendanceRule) => {
        requestDiscard(() => {
            setEditingRuleId(rule.id);
            setEditedData({
                halfDayVisitCount: rule.halfDayVisitCount,
                fullDayVisitCount: rule.fullDayVisitCount,
                active: rule.active,
            });
        }, ruleIsDirty);
    };

    const cancelEdit = () => {
        requestDiscard(() => {
            setEditingRuleId(null);
            setEditedData(null);
        }, ruleIsDirty);
    };

    const updateCount = (field: 'halfDayVisitCount' | 'fullDayVisitCount', value: string) => {
        if (!editedData) return;
        if (value === '') {
            setEditedData({ ...editedData, [field]: '' });
            return;
        }
        const numericValue = Number(value);
        if (Number.isInteger(numericValue)) setEditedData({ ...editedData, [field]: numericValue });
    };

    const saveRule = async () => {
        if (!token || !editingRule || !editedData || !isFormValid || !ruleIsDirty) return;

        setIsSaving(true);
        setError(null);
        try {
            const updatedRule = await attendanceRulesApi.updateRule(token, {
                ...editingRule,
                halfDayVisitCount: Number(editedData.halfDayVisitCount),
                fullDayVisitCount: Number(editedData.fullDayVisitCount),
                active: editedData.active,
            });
            setRules((currentRules) => currentRules.map((rule) => (
                rule.id === updatedRule.id ? updatedRule : rule
            )));
            setEditingRuleId(null);
            setEditedData(null);
            toast.success('Attendance rule updated', { duration: 3000 });
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Could not update attendance rule.';
            setError(message);
            toast.error(message, { duration: 3000 });
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <Card className="gap-0 border-border/70 py-0 shadow-sm">
            <CardContent className="space-y-4 p-4">
                <div className="rounded-xl border border-border/60 bg-muted/20 p-3">
                    <div className="flex items-start gap-3">
                        <Route className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                        <div>
                            <p className="text-sm font-medium text-foreground">Attendance is based on completed visits</p>
                            <p className="mt-1 text-xs leading-5 text-muted-foreground">
                                No vehicle means absent. With a vehicle, zero completed visits means present; reaching the configured thresholds changes the day to half day or full day.
                            </p>
                        </div>
                    </div>
                </div>

                {isLoading && (
                    <div className="grid gap-3 lg:grid-cols-2">
                        {Array.from({ length: 4 }, (_, index) => (
                            <Skeleton key={index} className="h-52 rounded-xl" />
                        ))}
                    </div>
                )}

                {error && (
                    <div className="rounded-lg border border-destructive/20 bg-destructive/10 p-3 text-sm text-destructive">
                        <div className="flex flex-wrap items-center justify-between gap-3">
                            <p>{error}</p>
                            <Button variant="outline" size="sm" className="h-8" onClick={() => void fetchRules()}>
                                Try Again
                            </Button>
                        </div>
                    </div>
                )}

                {!isLoading && !error && rules.length === 0 && (
                    <div className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">
                        No attendance rules are configured.
                    </div>
                )}

                {!isLoading && rules.length > 0 && (
                    <div className="grid gap-3 lg:grid-cols-2">
                        {rules.map((rule) => {
                            const isEditing = editingRuleId === rule.id && editedData;
                            return (
                                <section key={rule.id} className="rounded-xl border border-border/70 bg-card p-4 shadow-sm">
                                    <div className="flex flex-wrap items-start justify-between gap-3">
                                        <div className="min-w-0">
                                            <div className="flex flex-wrap items-center gap-2">
                                                <h3 className="truncate text-sm font-semibold text-foreground">{rule.ruleName}</h3>
                                                <Badge variant={rule.active ? 'default' : 'secondary'}>
                                                    {rule.active ? 'Active' : 'Inactive'}
                                                </Badge>
                                            </div>
                                            <p className="mt-1 text-xs text-muted-foreground">{roleLabel(rule.employeeRole)}</p>
                                        </div>
                                        {!isEditing && (
                                            <Button variant="outline" size="sm" className="h-8" onClick={() => openEditor(rule)}>
                                                <Pencil className="mr-2 h-3.5 w-3.5" />
                                                Edit
                                            </Button>
                                        )}
                                    </div>

                                    <div className="mt-4 grid gap-3 sm:grid-cols-2">
                                        <div className="rounded-lg border border-border/60 bg-muted/20 p-3">
                                            <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
                                                <Clock3 className="h-3.5 w-3.5 text-amber-600" />
                                                Half-day visits
                                            </div>
                                            {isEditing ? (
                                                <Input
                                                    type="number"
                                                    min="1"
                                                    step="1"
                                                    className="mt-2 h-9"
                                                    value={editedData.halfDayVisitCount}
                                                    onChange={(event) => updateCount('halfDayVisitCount', event.target.value)}
                                                />
                                            ) : (
                                                <p className="mt-2 text-2xl font-semibold tabular-nums">{rule.halfDayVisitCount}</p>
                                            )}
                                        </div>
                                        <div className="rounded-lg border border-border/60 bg-muted/20 p-3">
                                            <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
                                                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                                                Full-day visits
                                            </div>
                                            {isEditing ? (
                                                <Input
                                                    type="number"
                                                    min="1"
                                                    step="1"
                                                    className="mt-2 h-9"
                                                    value={editedData.fullDayVisitCount}
                                                    onChange={(event) => updateCount('fullDayVisitCount', event.target.value)}
                                                />
                                            ) : (
                                                <p className="mt-2 text-2xl font-semibold tabular-nums">{rule.fullDayVisitCount}</p>
                                            )}
                                        </div>
                                    </div>

                                    {isEditing && (
                                        <div className="mt-3 space-y-3 rounded-lg border border-border/60 p-3">
                                            <div className="flex items-center justify-between gap-3">
                                                <div>
                                                    <Label htmlFor={`active-rule-${rule.id}`} className="text-sm font-medium">Rule active</Label>
                                                    <p className="text-xs text-muted-foreground">Use this rule for new attendance calculations.</p>
                                                </div>
                                                <Switch
                                                    id={`active-rule-${rule.id}`}
                                                    checked={editedData.active}
                                                    onCheckedChange={(active) => setEditedData({ ...editedData, active })}
                                                />
                                            </div>
                                            {!isFormValid && (
                                                <p className="text-xs text-destructive">
                                                    Enter positive whole numbers, with the full-day threshold higher than the half-day threshold.
                                                </p>
                                            )}
                                            <div className="flex justify-end gap-2 border-t pt-3">
                                                <Button variant="outline" size="sm" onClick={cancelEdit} disabled={isSaving}>Cancel</Button>
                                                <Button size="sm" onClick={() => void saveRule()} disabled={isSaving || !isFormValid || !ruleIsDirty}>
                                                    {isSaving ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Saving...</> : 'Save changes'}
                                                </Button>
                                            </div>
                                        </div>
                                    )}
                                </section>
                            );
                        })}
                    </div>
                )}
            </CardContent>
        </Card>
    );
};

export default WorkingDays;
