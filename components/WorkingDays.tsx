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
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useUnsavedChanges } from '@/components/unsaved-changes-provider';
import { AttendanceRule, attendanceRulesApi } from '@/lib/attendance-rules-api';
import { CheckCircle2, Clock3, Loader2, Pencil, Plus } from 'lucide-react';
import { getEmployeeFullRoleLabel } from '@/lib/employee-role';
import { toast } from 'sonner';

interface RuleFormData {
    halfDayVisitCount: number | '';
    fullDayVisitCount: number | '';
    active: boolean;
}

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

    // Every rule is shown, ordered default first, then field executives, supervisors and managers.
    const ROLE_ORDER = useMemo(() => [
        '', 'RETAIL_FE', 'EMPANELMENT_FE', 'PROJECT_FE', 'RETAIL_EMPANELMENT_FE', 'RETAIL_PROJECT_FE',
        'INSTITUTION_PROJECT_FE', 'DUAL_FE', 'ZONAL_SUPERVISOR', 'MANAGER', 'HO_ADMIN',
    ], []);
    const roleRank = useCallback((role: string | null | undefined) => {
        const index = ROLE_ORDER.indexOf(role ?? '');
        return index === -1 ? ROLE_ORDER.length : index;
    }, [ROLE_ORDER]);
    // Managers do not have visit-based attendance, so their rule is not shown or editable here.
    const filteredRules = useMemo(
        () => rules
            .filter((rule) => rule.employeeRole !== 'MANAGER')
            .sort((a, b) => roleRank(a.employeeRole) - roleRank(b.employeeRole)),
        [rules, roleRank],
    );
    const defaultRule = useMemo(() => rules.find((rule) => !rule.employeeRole && rule.active) ?? rules.find((rule) => !rule.employeeRole) ?? null, [rules]);
    // Roles that have no rule of their own fall back to the default rule.
    const rolesWithoutRule = useMemo(() => ROLE_ORDER.filter((role) => role && role !== 'HO_ADMIN' && role !== 'MANAGER' && !rules.some((rule) => rule.employeeRole === role)), [ROLE_ORDER, rules]);
    const [creatingRole, setCreatingRole] = useState<string | null>(null);

    const ruleTitle = (rule: AttendanceRule) => rule.employeeRole ? getEmployeeFullRoleLabel(rule.employeeRole) : 'Default rule';
    const ruleSubtitle = (rule: AttendanceRule) => rule.employeeRole ? null : 'Applies to every role that has no rule of its own';
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

    const createRuleForRole = async (role: string) => {
        if (!token) return;
        setCreatingRole(role);
        try {
            const created = await attendanceRulesApi.createRule(token, {
                ruleName: `${getEmployeeFullRoleLabel(role)} attendance rule`,
                employeeRole: role,
                halfDayVisitCount: defaultRule?.halfDayVisitCount ?? 1,
                fullDayVisitCount: defaultRule?.fullDayVisitCount ?? 3,
                active: true,
            });
            setRules((current) => [...current, created]);
            toast.success(`Rule created for ${getEmployeeFullRoleLabel(role)}`, { duration: 3000 });
        } catch (error) {
            toast.error(error instanceof Error ? error.message : 'Could not create the rule.', { duration: 3000 });
        } finally {
            setCreatingRole(null);
        }
    };

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
            <CardContent className="space-y-5 p-5">
                <div>
                    <h2 className="text-base font-semibold tracking-tight">Attendance rules</h2>
                    <p className="mt-1 text-sm text-muted-foreground">
                        Visits an employee must complete in a day to count as a half day or a full day, set per role.
                        Roles without their own rule use the default rule.
                    </p>
                </div>

                {isLoading && (
                    <div className="space-y-2">
                        {Array.from({ length: 6 }, (_, index) => <Skeleton key={index} className="h-11 w-full rounded-md" />)}
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

                {!isLoading && !error && filteredRules.length === 0 && (
                    <div className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">
                        No attendance rules are configured.
                    </div>
                )}

                {!isLoading && filteredRules.length > 0 && (
                    <div className="overflow-hidden rounded-lg border">
                        <Table className="table-fixed text-sm">
                            <TableHeader>
                                <TableRow className="bg-muted/30 hover:bg-muted/30">
                                    <TableHead className="w-[38%] px-4">Role</TableHead>
                                    <TableHead className="w-[16%]">
                                        <span className="inline-flex items-center gap-1.5"><Clock3 className="h-3.5 w-3.5 text-amber-600" />Half day</span>
                                    </TableHead>
                                    <TableHead className="w-[16%]">
                                        <span className="inline-flex items-center gap-1.5"><CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />Full day</span>
                                    </TableHead>
                                    <TableHead className="w-[12%]">Status</TableHead>
                                    <TableHead className="w-[18%] pr-4 text-right"><span className="sr-only">Actions</span></TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {filteredRules.map((rule) => {
                                    const isEditing = Boolean(editingRuleId === rule.id && editedData);
                                    return (
                                        <TableRow key={rule.id} className={isEditing ? 'bg-muted/20' : undefined}>
                                            <TableCell className="px-4 py-3">
                                                <p className="truncate font-medium">{ruleTitle(rule)}</p>
                                                {ruleSubtitle(rule) && <p className="mt-0.5 truncate text-xs text-muted-foreground">{ruleSubtitle(rule)}</p>}
                                            </TableCell>
                                            <TableCell>
                                                {isEditing && editedData ? (
                                                    <Input
                                                        type="number"
                                                        min="1"
                                                        step="1"
                                                        aria-label={`Half-day visits for ${ruleTitle(rule)}`}
                                                        className="h-8 w-20"
                                                        value={editedData.halfDayVisitCount}
                                                        onChange={(event) => updateCount('halfDayVisitCount', event.target.value)}
                                                    />
                                                ) : (
                                                    <span className="tabular-nums">{rule.halfDayVisitCount} {rule.halfDayVisitCount === 1 ? 'visit' : 'visits'}</span>
                                                )}
                                            </TableCell>
                                            <TableCell>
                                                {isEditing && editedData ? (
                                                    <Input
                                                        type="number"
                                                        min="1"
                                                        step="1"
                                                        aria-label={`Full-day visits for ${ruleTitle(rule)}`}
                                                        className="h-8 w-20"
                                                        value={editedData.fullDayVisitCount}
                                                        onChange={(event) => updateCount('fullDayVisitCount', event.target.value)}
                                                    />
                                                ) : (
                                                    <span className="tabular-nums">{rule.fullDayVisitCount} {rule.fullDayVisitCount === 1 ? 'visit' : 'visits'}</span>
                                                )}
                                            </TableCell>
                                            <TableCell>
                                                {isEditing && editedData ? (
                                                    <Switch
                                                        id={`active-rule-${rule.id}`}
                                                        aria-label="Rule active"
                                                        checked={editedData.active}
                                                        onCheckedChange={(active) => setEditedData({ ...editedData, active })}
                                                    />
                                                ) : (
                                                    <Badge variant={rule.active ? 'default' : 'secondary'}>{rule.active ? 'Active' : 'Inactive'}</Badge>
                                                )}
                                            </TableCell>
                                            <TableCell className="pr-4 text-right">
                                                {isEditing ? (
                                                    <div className="flex justify-end gap-2">
                                                        <Button variant="outline" size="sm" className="h-8" onClick={cancelEdit} disabled={isSaving}>Cancel</Button>
                                                        <Button size="sm" className="h-8" onClick={() => void saveRule()} disabled={isSaving || !isFormValid || !ruleIsDirty}>
                                                            {isSaving ? <Loader2 className="h-4 w-4 animate-spin" aria-label="Saving" /> : 'Save'}
                                                        </Button>
                                                    </div>
                                                ) : (
                                                    <Button variant="ghost" size="sm" className="h-8" onClick={() => openEditor(rule)}>
                                                        <Pencil className="mr-1.5 h-3.5 w-3.5" />Edit
                                                    </Button>
                                                )}
                                            </TableCell>
                                        </TableRow>
                                    );
                                })}
                            </TableBody>
                        </Table>
                        {editingRule && editedData && !isFormValid && (
                            <p role="alert" className="border-t bg-destructive/5 px-4 py-2 text-xs text-destructive">
                                Enter positive whole numbers, with the full-day threshold higher than the half-day threshold.
                            </p>
                        )}
                    </div>
                )}

                {!isLoading && !error && rolesWithoutRule.length > 0 && (
                    <div className="space-y-2 rounded-lg border border-dashed p-4">
                        <div>
                            <h3 className="text-sm font-semibold">Roles using the default rule</h3>
                            <p className="text-xs text-muted-foreground">Create a rule to give one of these roles its own visit counts.</p>
                        </div>
                        <ul className="divide-y rounded-md border">
                            {rolesWithoutRule.map((role) => (
                                <li key={role} className="flex items-center justify-between gap-3 px-3 py-2">
                                    <span className="text-sm">{getEmployeeFullRoleLabel(role)}</span>
                                    <Button variant="outline" size="sm" className="h-8" disabled={creatingRole !== null} onClick={() => void createRuleForRole(role)}>
                                        {creatingRole === role ? <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" /> : <Plus className="mr-2 h-3.5 w-3.5" />}
                                        Create rule
                                    </Button>
                                </li>
                            ))}
                        </ul>
                    </div>
                )}
            </CardContent>
        </Card>
    );
};

export default WorkingDays;
