'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { ChevronLeft, Loader2, Pencil, Plus, Power } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/components/auth-provider';
import { getErrorMessage } from '@/lib/api-error';
import { targetsApi, type EmployeeKpiMetric, type SalesTargetDto } from '@/lib/targets-api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Skeleton } from '@/components/ui/skeleton';

const KPI_OPTIONS: { value: EmployeeKpiMetric; label: string; unit: string; description: string }[] = [
  { value: 'SALES_MT', label: 'Sales', unit: 'MT', description: 'Retail and project sales in metric tonnes' },
  { value: 'NEW_APPROVALS', label: 'New approvals', unit: 'approvals', description: 'Institution and project approvals' },
];

// Financial year runs April to March: Q1 Apr-Jun, Q2 Jul-Sep, Q3 Oct-Dec, Q4 Jan-Mar.
// A financial year is identified by the calendar year it starts in (2026 = FY 2026-27).
const QUARTERS = [
  { value: 1, label: 'Q1', months: 'Apr–Jun', monthNumbers: [4, 5, 6] },
  { value: 2, label: 'Q2', months: 'Jul–Sep', monthNumbers: [7, 8, 9] },
  { value: 3, label: 'Q3', months: 'Oct–Dec', monthNumbers: [10, 11, 12] },
  { value: 4, label: 'Q4', months: 'Jan–Mar', monthNumbers: [1, 2, 3] },
] as const;

const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

const fyStartOf = (date: Date): number => (date.getMonth() + 1 >= 4 ? date.getFullYear() : date.getFullYear() - 1);
const quarterOfDate = (date: Date): number => QUARTERS.find((option) => (option.monthNumbers as readonly number[]).includes(date.getMonth() + 1))?.value ?? 1;
const calendarYearFor = (fyStart: number, month: number): number => (month >= 4 ? fyStart : fyStart + 1);
const fyLabel = (fyStart: number): string => `FY ${fyStart}–${String((fyStart + 1) % 100).padStart(2, '0')}`;

const monthsForQuarter = (quarter: number): { month: number; name: string }[] =>
  (QUARTERS.find((option) => option.value === quarter)?.monthNumbers ?? []).map((month) => ({ month, name: MONTH_NAMES[month - 1] }));

const quarterLabel = (quarter: number, fyStart: number): string => {
  const definition = QUARTERS.find((option) => option.value === quarter);
  return `${definition?.label ?? `Q${quarter}`} (${definition?.months ?? ''}) ${fyLabel(fyStart)}`;
};

const kpiMeta = (metric: string) => KPI_OPTIONS.find((option) => option.value === metric) ?? KPI_OPTIONS[0];

const formatValue = (value: number, unit: string): string => {
  const label = unit === 'approvals' && Number(value) === 1 ? 'approval' : unit;
  return `${Number(value ?? 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}${label ? ` ${label}` : ''}`;
};

type MonthTargetMap = Map<string, SalesTargetDto>;
const monthKey = (metric: string, month: number) => `${metric.toUpperCase()}-${month}`;

function ProgressBar({ percent }: { percent: number }) {
  const clamped = Math.min(100, Math.max(0, percent));
  return (
    <div role="progressbar" aria-valuenow={Math.round(clamped)} aria-valuemin={0} aria-valuemax={100} className="h-2 w-full overflow-hidden rounded-full bg-muted">
      <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${clamped}%` }} />
    </div>
  );
}

interface EmployeeKpiSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  employeeId: number;
  employeeName: string;
  employeeRoleLabel?: string;
  readOnly?: boolean;
  /** Called after targets change so surrounding lists can refresh. */
  onChanged?: () => void;
}

/**
 * Side panel for one employee's quarterly KPI targets (sales MT and new approvals).
 * Two views in the same panel: an overview of the quarter, and an edit/assign form for one KPI.
 * Targets are entered month by month but always shown as quarter totals.
 */
export default function EmployeeKpiSheet({
  open,
  onOpenChange,
  employeeId,
  employeeName,
  employeeRoleLabel = 'Employee',
  readOnly = false,
  onChanged,
}: EmployeeKpiSheetProps) {
  const { token } = useAuth();
  const now = new Date();
  const currentFy = fyStartOf(now);
  const [quarter, setQuarter] = useState(quarterOfDate(now));
  const [fyStart, setFyStart] = useState(currentFy);
  // Month records for the quarter (any status), so deactivated months are reactivated instead of duplicated.
  const [monthTargets, setMonthTargets] = useState<MonthTargetMap>(new Map());
  const [totals, setTotals] = useState<Map<string, { target: number; achieved: number }>>(new Map());
  const [progressComplete, setProgressComplete] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [view, setView] = useState<'overview' | 'edit'>('overview');
  const [formMetric, setFormMetric] = useState<EmployeeKpiMetric>('SALES_MT');
  const [formEditing, setFormEditing] = useState(false);
  const [monthValues, setMonthValues] = useState<Record<number, string>>({});
  const [quarterTotal, setQuarterTotal] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const quarterMonths = useMemo(() => monthsForQuarter(quarter), [quarter]);
  // Targets go live this financial year, so only the current and the next financial year are offered.
  const fyOptions = useMemo(() => [currentFy, currentFy + 1], [currentFy]);

  const load = useCallback(async () => {
    if (!token) return;
    setIsLoading(true);
    setLoadError(null);
    try {
      const months = monthsForQuarter(quarter);
      const [targetResults, kpiResults] = await Promise.all([
        Promise.allSettled(months.map(({ month }) => targetsApi.searchSalesTargets(token, {
          targetType: 'EMPLOYEE',
          employeeId,
          year: calendarYearFor(fyStart, month),
          month,
        }))),
        Promise.allSettled(months.map(({ month }) => targetsApi.getMonthlyEmployeeKpis(token, {
          employeeId,
          year: calendarYearFor(fyStart, month),
          month,
        }))),
      ]);

      const rejectedTarget = targetResults.find((result) => result.status === 'rejected');
      if (rejectedTarget && rejectedTarget.status === 'rejected') throw rejectedTarget.reason;

      const nextTargets: MonthTargetMap = new Map();
      targetResults.forEach((result, index) => {
        if (result.status !== 'fulfilled') return;
        const month = months[index].month;
        result.value
          .filter((target) => target.employeeId === employeeId && (target.storeId === 0 || target.storeId == null) && target.month === month)
          .forEach((target) => nextTargets.set(monthKey(target.metric ?? 'SALES_MT', month), target));
      });
      setMonthTargets(nextTargets);

      const complete = kpiResults.every((result) => result.status === 'fulfilled');
      setProgressComplete(complete);
      const nextTotals = new Map<string, { target: number; achieved: number }>();
      KPI_OPTIONS.forEach((option) => nextTotals.set(option.value, { target: 0, achieved: 0 }));
      kpiResults.forEach((result) => {
        if (result.status !== 'fulfilled') return;
        result.value.forEach((row) => {
          const entry = nextTotals.get(row.metric.toUpperCase());
          if (!entry) return;
          entry.target += row.targetValue ?? 0;
          entry.achieved += row.achievedValue ?? 0;
        });
      });
      setTotals(nextTotals);
      if (!complete) {
        const failedCount = kpiResults.filter((result) => result.status === 'rejected').length;
        toast.warning(`Targets loaded, but progress is unavailable for ${failedCount} month${failedCount === 1 ? '' : 's'} in this quarter.`);
      }
    } catch (error) {
      setMonthTargets(new Map());
      setTotals(new Map());
      setLoadError(getErrorMessage(error, 'Unable to load KPI targets.'));
    } finally {
      setIsLoading(false);
    }
  }, [token, employeeId, fyStart, quarter]);

  useEffect(() => { if (open) void load(); }, [open, load]);

  // Always reopen on the overview.
  useEffect(() => { if (!open) { setView('overview'); setFormError(null); } }, [open]);

  const activeMonthValue = (metric: string, month: number): number | null => {
    const record = monthTargets.get(monthKey(metric, month));
    return record && record.status.toUpperCase() !== 'INACTIVE' ? record.targetTons : null;
  };

  const openEditor = (metric: EmployeeKpiMetric) => {
    if (readOnly) return;
    const values: Record<number, string> = {};
    let total = 0;
    let hasAny = false;
    quarterMonths.forEach(({ month }) => {
      const value = activeMonthValue(metric, month);
      values[month] = value != null ? String(value) : '';
      if (value != null) { total += value; hasAny = true; }
    });
    setFormMetric(metric);
    setFormEditing(hasAny);
    setMonthValues(values);
    setQuarterTotal(hasAny ? String(total) : '');
    setFormError(null);
    setView('edit');
  };

  const backToOverview = () => {
    if (isSaving) return;
    setFormError(null);
    setView('overview');
  };

  const isCount = formMetric === 'NEW_APPROVALS';
  const meta = kpiMeta(formMetric);

  const splitEvenly = () => {
    const total = Number(quarterTotal);
    if (!Number.isFinite(total) || total <= 0) { setFormError('Enter a quarter total greater than zero to split it.'); return; }
    if (isCount && !Number.isInteger(total)) { setFormError('Approval targets must be whole numbers.'); return; }
    setFormError(null);
    const count = quarterMonths.length;
    const next: Record<number, string> = {};
    if (isCount) {
      const base = Math.floor(total / count);
      const extra = total - base * count;
      quarterMonths.forEach(({ month }, index) => { next[month] = String(base + (index < extra ? 1 : 0)); });
    } else {
      const base = Math.floor((total / count) * 100) / 100;
      const last = Math.round((total - base * (count - 1)) * 100) / 100;
      quarterMonths.forEach(({ month }, index) => { next[month] = String(index === count - 1 ? last : base); });
    }
    setMonthValues(next);
  };

  const enteredTotal = quarterMonths.reduce((sum, { month }) => sum + (Number(monthValues[month]) || 0), 0);

  const save = async () => {
    if (!token || readOnly) return;
    const parsed = quarterMonths.map(({ month }) => ({ month, raw: (monthValues[month] ?? '').trim() }));
    for (const { raw } of parsed) {
      if (raw === '') continue;
      const value = Number(raw);
      if (!Number.isFinite(value) || value < 0) { setFormError('Monthly targets must be zero or greater.'); return; }
      if (isCount && !Number.isInteger(value)) { setFormError('Approval targets must be whole numbers.'); return; }
    }
    if (parsed.every(({ raw }) => raw === '' || Number(raw) === 0) && !formEditing) {
      setFormError('Enter a target for at least one month.');
      return;
    }
    setIsSaving(true);
    setFormError(null);
    try {
      for (const { month, raw } of parsed) {
        const value = raw === '' ? 0 : Number(raw);
        const record = monthTargets.get(monthKey(formMetric, month));
        const recordActive = record != null && record.status.toUpperCase() !== 'INACTIVE';
        if (value > 0) {
          await targetsApi.saveEmployeeKpiTarget(token, {
            id: record?.id ?? null,
            employeeId,
            metric: formMetric,
            year: calendarYearFor(fyStart, month),
            month,
            targetValue: value,
          });
        } else if (recordActive && record) {
          await targetsApi.deleteSalesTarget(token, record.id);
        }
      }
      toast.success(formEditing ? 'Targets updated.' : 'Targets assigned.');
      setView('overview');
      await load();
      onChanged?.();
    } catch (error) {
      const message = getErrorMessage(error, 'Unable to save targets.');
      setFormError(message);
      toast.error(message);
      await load();
      onChanged?.();
    } finally {
      setIsSaving(false);
    }
  };

  const deactivateQuarter = async (metric: EmployeeKpiMetric) => {
    if (!token || readOnly) return;
    const label = kpiMeta(metric).label;
    if (!window.confirm(`Deactivate the ${label.toLowerCase()} targets for ${quarterLabel(quarter, fyStart)}?`)) return;
    try {
      for (const { month } of quarterMonths) {
        const record = monthTargets.get(monthKey(metric, month));
        if (record && record.status.toUpperCase() !== 'INACTIVE') await targetsApi.deleteSalesTarget(token, record.id);
      }
      toast.success('Targets deactivated.');
      await load();
      onChanged?.();
    } catch (error) {
      toast.error(getErrorMessage(error, 'Unable to deactivate targets.'));
      await load();
      onChanged?.();
    }
  };

  const guardedOpenChange = (next: boolean) => {
    if (!next && isSaving) return;
    onOpenChange(next);
  };

  return (
    <Sheet open={open} onOpenChange={guardedOpenChange}>
      <SheetContent className="flex w-full flex-col gap-0 overflow-hidden p-0 sm:max-w-[560px]">
        <SheetHeader className="shrink-0 space-y-1 border-b px-5 py-4 pr-12 text-left">
          {view === 'edit' && (
            <Button type="button" variant="ghost" size="sm" className="-ml-2 mb-1 h-7 w-fit px-2 text-xs text-muted-foreground" onClick={backToOverview} disabled={isSaving}>
              <ChevronLeft className="mr-1 h-3.5 w-3.5" />Quarterly targets
            </Button>
          )}
          <SheetTitle className="text-base">{view === 'edit' ? `${formEditing ? 'Edit' : 'Assign'} ${meta.label.toLowerCase()} targets` : employeeName}</SheetTitle>
          <SheetDescription className="text-xs">
            {view === 'edit'
              ? `${employeeName} · ${quarterLabel(quarter, fyStart)}`
              : `${employeeRoleLabel} · quarterly KPI targets${readOnly ? ' · view only' : ''}`}
          </SheetDescription>
        </SheetHeader>

        {view === 'overview' ? (
          <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-5">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <h3 className="text-sm font-semibold tracking-tight">Quarterly KPI targets</h3>
                <p className="mt-0.5 text-xs text-muted-foreground">{quarterLabel(quarter, fyStart)}</p>
              </div>
              <div className="flex gap-2">
                <Select value={String(quarter)} onValueChange={(value) => setQuarter(Number(value))}>
                  <SelectTrigger className="h-8 w-[132px] text-xs shadow-none" aria-label="Quarter"><SelectValue /></SelectTrigger>
                  <SelectContent>{QUARTERS.map((option) => <SelectItem key={option.value} value={String(option.value)}>{option.label} · {option.months}</SelectItem>)}</SelectContent>
                </Select>
                <Select value={String(fyStart)} onValueChange={(value) => setFyStart(Number(value))}>
                  <SelectTrigger className="h-8 w-[118px] text-xs shadow-none" aria-label="Financial year"><SelectValue /></SelectTrigger>
                  <SelectContent>{fyOptions.map((option) => <SelectItem key={option} value={String(option)}>{fyLabel(option)}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>

            {isLoading ? (
              <div className="grid gap-3">
                {[0, 1].map((index) => (
                  <div key={index} className="space-y-3 rounded-lg border p-4"><Skeleton className="h-4 w-28" /><Skeleton className="h-8 w-32" /><Skeleton className="h-2 w-full" /></div>
                ))}
              </div>
            ) : loadError ? (
              <div className="space-y-2 rounded-lg border border-destructive/40 p-4 text-sm text-destructive">
                <p>{loadError}</p>
                <Button size="sm" variant="outline" onClick={() => void load()}>Try again</Button>
              </div>
            ) : (
              <div className="grid gap-3">
                {KPI_OPTIONS.map((kpi) => {
                  const entry = totals.get(kpi.value) ?? { target: 0, achieved: 0 };
                  const hasTarget = entry.target > 0;
                  const remaining = Math.max(0, entry.target - entry.achieved);
                  const percent = hasTarget ? (entry.achieved / entry.target) * 100 : 0;
                  return (
                    <article key={kpi.value} className="rounded-lg border bg-card p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <h4 className="text-sm font-semibold leading-5">{kpi.label}</h4>
                          <p className="mt-0.5 text-xs text-muted-foreground">{kpi.description}</p>
                        </div>
                        {hasTarget && !readOnly && (
                          <div className="flex shrink-0 gap-1">
                            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEditor(kpi.value)} aria-label={`Edit ${kpi.label} targets`} title="Edit targets"><Pencil className="h-3.5 w-3.5" /></Button>
                            <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive" onClick={() => void deactivateQuarter(kpi.value)} aria-label={`Deactivate ${kpi.label} targets`} title="Deactivate targets"><Power className="h-3.5 w-3.5" /></Button>
                          </div>
                        )}
                      </div>

                      {!hasTarget ? (
                        <div className="mt-4 flex items-center justify-between gap-3 rounded-md border border-dashed px-3 py-3">
                          <p className="text-xs text-muted-foreground">No target set for this quarter.</p>
                          {!readOnly && <Button size="sm" variant="outline" className="h-8 text-xs" onClick={() => openEditor(kpi.value)}><Plus className="mr-1.5 h-3.5 w-3.5" />Assign</Button>}
                        </div>
                      ) : (
                        <div className="mt-4 space-y-3">
                          <div className="flex items-baseline justify-between gap-3">
                            <p className="text-2xl font-semibold tabular-nums leading-none">{progressComplete ? formatValue(entry.achieved, kpi.unit) : '—'}</p>
                            <p className="text-xs text-muted-foreground">of <span className="font-medium tabular-nums text-foreground">{formatValue(entry.target, kpi.unit)}</span> target</p>
                          </div>
                          <ProgressBar percent={progressComplete ? percent : 0} />
                          <dl className="grid grid-cols-2 gap-3 text-xs">
                            <div><dt className="text-muted-foreground">Remaining</dt><dd className="mt-0.5 text-sm font-medium tabular-nums">{progressComplete ? formatValue(remaining, kpi.unit) : '—'}</dd></div>
                            <div><dt className="text-muted-foreground">Progress</dt><dd className="mt-0.5 text-sm font-medium tabular-nums">{progressComplete ? `${Math.round(percent)}%` : '—'}</dd></div>
                          </dl>
                          {!progressComplete && <p className="text-[11px] text-muted-foreground">Progress is unavailable because one or more monthly calculations failed.</p>}
                        </div>
                      )}
                    </article>
                  );
                })}
              </div>
            )}
          </div>
        ) : (
          <>
            <form
              id="kpi-target-form"
              onSubmit={(event) => { event.preventDefault(); void save(); }}
              className="min-h-0 flex-1 space-y-5 overflow-y-auto p-5"
            >
              <p className="text-xs leading-relaxed text-muted-foreground">
                Set the target for each month. The quarter shows the total, and achieved values are calculated automatically.
              </p>

              <div className="space-y-1.5">
                <Label htmlFor="kpi-quarter-total" className="text-xs">Quarter total {isCount ? '(count)' : '(MT)'} <span className="font-normal text-muted-foreground">· optional shortcut</span></Label>
                <div className="flex gap-2">
                  <Input id="kpi-quarter-total" type="number" min="0" step={isCount ? '1' : '0.01'} inputMode="decimal" value={quarterTotal} onChange={(event) => setQuarterTotal(event.target.value)} placeholder={isCount ? 'e.g. 15' : 'e.g. 420'} />
                  <Button type="button" variant="outline" onClick={splitEvenly}>Split evenly</Button>
                </div>
              </div>

              <fieldset className="space-y-3 rounded-lg border p-4">
                <legend className="px-1 text-xs font-medium text-muted-foreground">Month by month</legend>
                {quarterMonths.map(({ month, name }) => (
                  <div key={month} className="flex items-center gap-3">
                    <Label htmlFor={`kpi-month-${month}`} className="w-36 shrink-0 text-sm font-normal">{name} {calendarYearFor(fyStart, month)}</Label>
                    <Input
                      id={`kpi-month-${month}`}
                      type="number"
                      min="0"
                      step={isCount ? '1' : '0.01'}
                      inputMode="decimal"
                      value={monthValues[month] ?? ''}
                      onChange={(event) => setMonthValues((current) => ({ ...current, [month]: event.target.value }))}
                      placeholder="0"
                    />
                  </div>
                ))}
                <div className="flex items-center justify-between border-t pt-3">
                  <span className="text-sm text-muted-foreground">Quarter total</span>
                  <span className="text-lg font-semibold tabular-nums">{formatValue(enteredTotal, isCount ? '' : 'MT')}</span>
                </div>
              </fieldset>

              {formError && <p role="alert" className="text-xs text-destructive">{formError}</p>}
            </form>
            <SheetFooter className="shrink-0 flex-row justify-end gap-2 border-t bg-background px-5 py-3 sm:space-x-0">
              <Button type="button" variant="outline" size="sm" onClick={backToOverview} disabled={isSaving}>Cancel</Button>
              <Button type="submit" form="kpi-target-form" size="sm" disabled={isSaving}>
                {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}{formEditing ? 'Save targets' : 'Assign targets'}
              </Button>
            </SheetFooter>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
