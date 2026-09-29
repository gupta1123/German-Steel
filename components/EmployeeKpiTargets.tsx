'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Loader2, Pencil, Plus, Power } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/components/auth-provider';
import { getErrorMessage } from '@/lib/api-error';
import {
  targetsApi,
  type EmployeeKpiMetric,
  type EmployeeKpiProgress,
  type EmployeeUserDto,
  type SalesTargetDto,
} from '@/lib/targets-api';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { SearchableSelect } from '@/components/ui/searchable-select2';

const KPI_OPTIONS: { value: EmployeeKpiMetric; label: string; unit: string }[] = [
  { value: 'SALES_MT', label: 'Sales', unit: 'MT' },
  { value: 'NEW_APPROVALS', label: 'New approvals', unit: 'approvals' },
];

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

const kpiMeta = (metric: string): { label: string; unit: string } =>
  KPI_OPTIONS.find((option) => option.value === metric)
  ?? { label: metric.replaceAll('_', ' ').toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase()), unit: '' };

const formatValue = (value: number, unit: string): string =>
  `${Number(value ?? 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}${unit ? ` ${unit}` : ''}`;

function KpiProgressBar({ percent }: { percent: number }) {
  const clamped = Math.min(100, Math.max(0, percent));
  return (
    <div role="progressbar" aria-valuenow={Math.round(clamped)} aria-valuemin={0} aria-valuemax={100} className="h-1.5 min-w-12 flex-1 overflow-hidden rounded-full bg-muted">
      <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${clamped}%` }} />
    </div>
  );
}

export default function EmployeeKpiTargets() {
  const { token } = useAuth();
  const now = new Date();
  const [employees, setEmployees] = useState<EmployeeUserDto[]>([]);
  const [employeesLoading, setEmployeesLoading] = useState(true);
  const [selectedEmployeeId, setSelectedEmployeeId] = useState('');
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());
  const [targets, setTargets] = useState<SalesTargetDto[]>([]);
  const [kpis, setKpis] = useState<EmployeeKpiProgress[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingTarget, setEditingTarget] = useState<SalesTargetDto | null>(null);
  const [formMetric, setFormMetric] = useState<EmployeeKpiMetric>('SALES_MT');
  const [formValue, setFormValue] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const employeeOptions = useMemo(() => employees.map((employee) => {
    const name = [employee.firstName, employee.lastName].filter(Boolean).join(' ').trim();
    return { value: String(employee.id), label: name ? `${name} · ${employee.employeeId || employee.id}` : `Employee #${employee.id}` };
  }).sort((a, b) => a.label.localeCompare(b.label)), [employees]);

  const selectedEmployee = useMemo(
    () => employees.find((employee) => String(employee.id) === selectedEmployeeId) ?? null,
    [employees, selectedEmployeeId],
  );

  const yearOptions = useMemo(() => {
    const current = new Date().getFullYear();
    return [current - 1, current, current + 1, current + 2];
  }, []);

  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    setEmployeesLoading(true);
    targetsApi.getEmployees(token)
      .then((list) => { if (!cancelled) setEmployees(list); })
      .catch(() => { if (!cancelled) setEmployees([]); })
      .finally(() => { if (!cancelled) setEmployeesLoading(false); });
    return () => { cancelled = true; };
  }, [token]);

  const load = useCallback(async () => {
    if (!token || !selectedEmployeeId) {
      setTargets([]);
      setKpis([]);
      return;
    }
    setIsLoading(true);
    setLoadError(null);
    try {
      const employeeId = Number(selectedEmployeeId);
      const [targetsResult, kpisResult] = await Promise.allSettled([
        targetsApi.searchSalesTargets(token, { targetType: 'MONTHLY', employeeId, year, month }),
        targetsApi.getMonthlyEmployeeKpis(token, { employeeId, year, month }),
      ]);
      // searchSalesTargets may return legacy MONTHLY/DAILY targetTypes; keep employee-scope rows only.
      if (targetsResult.status === 'fulfilled') {
        setTargets(targetsResult.value.filter((target) => target.employeeId === employeeId && (target.storeId === 0 || target.storeId == null)));
      } else {
        throw targetsResult.reason;
      }
      setKpis(kpisResult.status === 'fulfilled' ? kpisResult.value : []);
      if (kpisResult.status === 'rejected') {
        toast.warning('Targets loaded, but live progress is unavailable.');
      }
    } catch (error) {
      setTargets([]);
      setKpis([]);
      setLoadError(getErrorMessage(error, 'Unable to load KPI targets.'));
    } finally {
      setIsLoading(false);
    }
  }, [token, selectedEmployeeId, year, month]);

  useEffect(() => { void load(); }, [load]);

  const kpiByMetric = useMemo(() => new Map(kpis.map((kpi) => [kpi.metric.toUpperCase(), kpi])), [kpis]);

  const openAssign = (metric: EmployeeKpiMetric) => {
    setEditingTarget(null);
    setFormMetric(metric);
    setFormValue('');
    setFormError(null);
    setDialogOpen(true);
  };

  const openEdit = (target: SalesTargetDto) => {
    setEditingTarget(target);
    const metric = (target.metric ?? 'SALES_MT').toUpperCase() as EmployeeKpiMetric;
    setFormMetric(metric === 'NEW_APPROVALS' ? 'NEW_APPROVALS' : 'SALES_MT');
    setFormValue(String(target.targetTons ?? ''));
    setFormError(null);
    setDialogOpen(true);
  };

  const save = async () => {
    if (!token || !selectedEmployeeId) return;
    const value = Number(formValue);
    if (!Number.isFinite(value) || value <= 0) {
      setFormError('Enter a target value greater than zero.');
      return;
    }
    // Prevent duplicates for the same employee, month and KPI.
    if (!editingTarget && targets.some((target) => (target.metric ?? 'SALES_MT').toUpperCase() === formMetric)) {
      setFormError(`A ${kpiMeta(formMetric).label.toLowerCase()} target already exists for this employee and month. Edit it instead.`);
      return;
    }
    setIsSaving(true);
    setFormError(null);
    try {
      if (editingTarget) {
        await targetsApi.editSalesTarget(token, editingTarget.id, { targetTons: value });
        toast.success('Target updated.');
      } else {
        await targetsApi.createSalesTarget(token, {
          employeeId: Number(selectedEmployeeId),
          targetType: 'MONTHLY',
          targetTons: value,
          month,
          year,
          metric: formMetric,
        });
        toast.success('Target assigned.');
      }
      setDialogOpen(false);
      setEditingTarget(null);
      await load();
    } catch (error) {
      const message = getErrorMessage(error, 'Unable to save target.');
      setFormError(message);
      toast.error(message);
    } finally {
      setIsSaving(false);
    }
  };

  const deactivate = async (target: SalesTargetDto) => {
    if (!token) return;
    const meta = kpiMeta(target.metric ?? 'SALES_MT');
    if (!window.confirm(`Deactivate the ${meta.label.toLowerCase()} target for ${MONTHS[month - 1]} ${year}?`)) return;
    try {
      await targetsApi.deleteSalesTarget(token, target.id);
      toast.success('Target deactivated.');
      await load();
    } catch (error) {
      toast.error(getErrorMessage(error, 'Unable to deactivate target.'));
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end">
        <div className="min-w-0 flex-1 space-y-1.5">
          <Label className="text-xs font-medium">Employee</Label>
          <SearchableSelect
            options={employeeOptions}
            value={selectedEmployeeId || undefined}
            onSelect={(option) => setSelectedEmployeeId(option?.value ?? '')}
            placeholder={employeesLoading ? 'Loading employees…' : 'Select employee'}
            searchPlaceholder="Search employees…"
            emptyMessage="No employees found"
            allowClear
            triggerClassName="h-9 w-full text-sm shadow-none"
            contentClassName="w-[var(--radix-popover-trigger-width)]"
          />
        </div>
        <div className="grid grid-cols-2 gap-3 lg:flex">
          <div className="space-y-1.5">
            <Label className="text-xs font-medium">Month</Label>
            <Select value={String(month)} onValueChange={(value) => setMonth(Number(value))}>
              <SelectTrigger className="h-9 w-full text-sm shadow-none lg:w-[150px]"><SelectValue /></SelectTrigger>
              <SelectContent>{MONTHS.map((label, index) => <SelectItem key={label} value={String(index + 1)}>{label}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs font-medium">Year</Label>
            <Select value={String(year)} onValueChange={(value) => setYear(Number(value))}>
              <SelectTrigger className="h-9 w-full text-sm shadow-none lg:w-[110px]"><SelectValue /></SelectTrigger>
              <SelectContent>{yearOptions.map((option) => <SelectItem key={option} value={String(option)}>{option}</SelectItem>)}</SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {!selectedEmployeeId ? (
        <Card className="shadow-none"><CardContent className="py-10 text-center text-sm text-muted-foreground">Select an employee to view and manage monthly KPI targets.</CardContent></Card>
      ) : isLoading ? (
        <div className="grid gap-4 md:grid-cols-2">
          {[0, 1].map((index) => (
            <Card key={index} className="shadow-none"><CardHeader><Skeleton className="h-4 w-32" /></CardHeader><CardContent className="space-y-2"><Skeleton className="h-7 w-24" /><Skeleton className="h-2 w-full" /></CardContent></Card>
          ))}
        </div>
      ) : loadError ? (
        <Card className="border-destructive/40 shadow-none"><CardContent className="py-6 text-sm text-destructive">{loadError}</CardContent></Card>
      ) : (
        <>
          <div className="grid gap-4 md:grid-cols-2">
            {KPI_OPTIONS.map((kpi) => {
              const progress = kpiByMetric.get(kpi.value);
              const targetRow = targets.find((target) => (target.metric ?? 'SALES_MT').toUpperCase() === kpi.value);
              const targetValue = progress?.targetValue ?? targetRow?.targetTons ?? 0;
              const achievedValue = progress?.achievedValue ?? 0;
              const remainingValue = progress?.remainingValue ?? Math.max(0, targetValue - achievedValue);
              const percent = progress?.achievementPercent ?? (targetValue > 0 ? (achievedValue / targetValue) * 100 : 0);
              const hasTarget = progress != null || targetRow != null;
              return (
                <Card key={kpi.value} className="shadow-none">
                  <CardHeader className="pb-2">
                    <CardTitle className="flex items-center justify-between text-sm font-semibold">
                      {kpi.label}
                      <span className="text-xs font-normal text-muted-foreground">{MONTHS[month - 1]} {year}</span>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {!hasTarget ? (
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-xs text-muted-foreground">No target set for this month.</p>
                        <Button size="sm" variant="outline" className="h-8 text-xs" onClick={() => openAssign(kpi.value)}><Plus className="mr-1.5 h-3.5 w-3.5" />Assign</Button>
                      </div>
                    ) : (
                      <>
                        <div className="grid grid-cols-3 gap-2 text-center">
                          <div><p className="text-[11px] text-muted-foreground">Target</p><p className="text-sm font-semibold tabular-nums">{formatValue(targetValue, kpi.unit)}</p></div>
                          <div><p className="text-[11px] text-muted-foreground">Achieved</p><p className="text-sm font-semibold tabular-nums">{formatValue(achievedValue, kpi.unit)}</p></div>
                          <div><p className="text-[11px] text-muted-foreground">Remaining</p><p className="text-sm font-semibold tabular-nums">{formatValue(remainingValue, kpi.unit)}</p></div>
                        </div>
                        <div className="flex items-center gap-2">
                          <KpiProgressBar percent={percent} />
                          <span className="text-xs font-medium tabular-nums">{Math.round(percent)}%</span>
                        </div>
                        {!progress && <p className="text-[11px] text-muted-foreground">Live progress unavailable — target only.</p>}
                      </>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>

          <Card className="shadow-none">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-semibold">Assigned targets · {selectedEmployee ? [selectedEmployee.firstName, selectedEmployee.lastName].filter(Boolean).join(' ') : ''}</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {targets.length === 0 ? (
                <p className="px-4 py-8 text-center text-xs text-muted-foreground">No KPI targets for {MONTHS[month - 1]} {year}. Assign one from the cards above.</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>KPI</TableHead>
                      <TableHead className="text-right">Target</TableHead>
                      <TableHead className="text-right">Achieved</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {targets.map((target) => {
                      const meta = kpiMeta(target.metric ?? 'SALES_MT');
                      const progress = kpiByMetric.get((target.metric ?? 'SALES_MT').toUpperCase());
                      return (
                        <TableRow key={target.id}>
                          <TableCell className="font-medium">{meta.label}</TableCell>
                          <TableCell className="text-right tabular-nums">{formatValue(target.targetTons, meta.unit)}</TableCell>
                          <TableCell className="text-right tabular-nums">{progress ? formatValue(progress.achievedValue, meta.unit) : '—'}</TableCell>
                          <TableCell>
                            <div className="flex justify-end gap-1">
                              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(target)} aria-label={`Edit ${meta.label} target`} title="Edit target"><Pencil className="h-3.5 w-3.5" /></Button>
                              <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-destructive" onClick={() => void deactivate(target)} aria-label={`Deactivate ${meta.label} target`} title="Deactivate target"><Power className="h-3.5 w-3.5" /></Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </>
      )}

      <Dialog open={dialogOpen} onOpenChange={(open) => { if (!isSaving) setDialogOpen(open); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editingTarget ? 'Edit target' : 'Assign target'}</DialogTitle>
            <DialogDescription>
              {selectedEmployee ? [selectedEmployee.firstName, selectedEmployee.lastName].filter(Boolean).join(' ') : ''} · {MONTHS[month - 1]} {year}. Achievement is calculated by the backend — it cannot be edited here.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="space-y-1.5">
              <Label>KPI</Label>
              <Select value={formMetric} onValueChange={(value) => setFormMetric(value as EmployeeKpiMetric)} disabled={!!editingTarget}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{KPI_OPTIONS.map((option) => <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="kpi-target-value">Target value {formMetric === 'SALES_MT' ? '(MT)' : '(count)'}</Label>
              <Input id="kpi-target-value" type="number" min="0.01" step="0.01" inputMode="decimal" value={formValue} onChange={(event) => setFormValue(event.target.value)} placeholder={formMetric === 'SALES_MT' ? 'e.g. 100' : 'e.g. 5'} />
            </div>
            {formError && <p role="alert" className="text-xs text-destructive">{formError}</p>}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)} disabled={isSaving}>Cancel</Button>
            <Button onClick={() => void save()} disabled={isSaving}>{isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}{editingTarget ? 'Save target' : 'Assign target'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
