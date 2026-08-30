"use client";

import { type FormEvent, type ReactNode, useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AlertCircle,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Edit3,
  Loader2,
  Plus,
  RefreshCw,
  Target,
  X,
} from "lucide-react";

import {
  API,
  type EmployeeUserDto,
  type SalesTargetCreatePayload,
  type SalesTargetDto,
  type StoreDto,
} from "@/lib/api";
import { toast } from "sonner";
import { groupOfficerTargets, isTargetFieldOfficer, summarizeTargets } from "@/lib/officer-targets";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SearchableSelect } from "@/components/ui/searchable-select2";
import { formatCityLabel } from "@/lib/city-options";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { useUnsavedChanges } from "@/components/unsaved-changes-provider";

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
] as const;
const WORK_START_HOUR = 9;
const WORK_END_HOUR = 18;
const WORK_HOURS = WORK_END_HOUR - WORK_START_HOUR;

type PaceState = "behind" | "slipping" | "onpace" | "met";

interface TargetFilters {
  month: number;
  year: number;
  employeeId: string;
}

interface TargetFormState {
  storeId: string;
  employeeId: string;
  month: number;
  year: number;
  targetTons: string;
  fulfilledTons: string;
  remarks: string;
}

interface PaceMetrics {
  expected: number;
  pending: number;
  delta: number;
  progressPercent: number;
  expectedPercent: number;
  state: PaceState;
  rate: number;
  rateUnit: "t/day";
  remainingUnits: number;
  remainingLabel: string;
}

const getMonthRange = (month: number, year: number) => {
  const lastDay = new Date(year, month, 0).getDate();
  return {
    startDate: `${year}-${String(month).padStart(2, "0")}-01`,
    endDate: `${year}-${String(month).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`,
  };
};

const numberFormatter = new Intl.NumberFormat("en-IN", { maximumFractionDigits: 2 });
const formatTons = (value: number | null | undefined) => `${numberFormatter.format(Number(value) || 0)} t`;

const employeeName = (employee: EmployeeUserDto) =>
  [employee.firstName, employee.lastName].filter(Boolean).join(" ").trim() || "Unnamed field officer";

const getTargetPeriod = (target: SalesTargetDto) => {
  const month = Number(target.month);
  return month >= 1 && month <= 12 && target.year
    ? `${MONTHS[month - 1]} ${target.year}`
    : "Monthly target";
};

const getEffectiveFulfilled = (target: SalesTargetDto) =>
  Number(target.effectiveFulfilledTons ?? target.fulfilledTons ?? target.salesTons ?? 0) || 0;

const countWorkingDays = (month: number, year: number) => {
  const lastDay = new Date(year, month, 0).getDate();
  let count = 0;
  for (let day = 1; day <= lastDay; day += 1) {
    if (new Date(year, month - 1, day).getDay() !== 0) count += 1;
  }
  return count;
};

const workdayFraction = (now: Date) => {
  if (now.getDay() === 0) return 0;
  const currentHour = now.getHours() + now.getMinutes() / 60 + now.getSeconds() / 3600;
  return Math.min(1, Math.max(0, (currentHour - WORK_START_HOUR) / WORK_HOURS));
};

const formatDaysLeft = (days: number) => {
  if (days <= 0) return "Period ended";
  return `${numberFormatter.format(days)} working day${Math.abs(days - 1) < 0.001 ? "" : "s"}`;
};

const paceStateFor = (fulfilled: number, target: number, expected: number): PaceState => {
  if (target > 0 && fulfilled >= target) return "met";
  if (expected <= 0 || fulfilled / expected >= 1) return "onpace";
  if (fulfilled / expected >= 0.85) return "slipping";
  return "behind";
};

const getTargetPace = (
  target: SalesTargetDto,
  now: Date,
  fallbackMonth: number,
  fallbackYear: number,
): PaceMetrics => {
  const targetTons = Number(target.targetTons) || 0;
  const fulfilled = getEffectiveFulfilled(target);
  let elapsedFraction = 0;
  let remainingUnits = 0;
  const rateUnit: PaceMetrics["rateUnit"] = "t/day";
  let remainingLabel = "Period ended";

  const month = Number(target.month) || fallbackMonth;
  const year = Number(target.year) || fallbackYear;
  const totalWorkingDays = countWorkingDays(month, year);
  const periodKey = year * 12 + month;
  const currentKey = now.getFullYear() * 12 + now.getMonth() + 1;
  let elapsedWorkingDays = 0;

  if (periodKey < currentKey) elapsedWorkingDays = totalWorkingDays;
  else if (periodKey === currentKey) {
    for (let day = 1; day < now.getDate(); day += 1) {
      if (new Date(year, month - 1, day).getDay() !== 0) elapsedWorkingDays += 1;
    }
    elapsedWorkingDays += workdayFraction(now);
  }

  elapsedFraction = totalWorkingDays > 0 ? elapsedWorkingDays / totalWorkingDays : 0;
  remainingUnits = Math.max(0, totalWorkingDays - elapsedWorkingDays);
  remainingLabel = formatDaysLeft(remainingUnits);

  const expected = targetTons * Math.min(1, Math.max(0, elapsedFraction));
  const pending = Math.max(0, targetTons - fulfilled);
  const state = paceStateFor(fulfilled, targetTons, expected);
  return {
    expected,
    pending,
    delta: fulfilled - expected,
    progressPercent: targetTons > 0 ? (fulfilled / targetTons) * 100 : 0,
    expectedPercent: targetTons > 0 ? (expected / targetTons) * 100 : 0,
    state,
    rate: remainingUnits > 0 ? pending / remainingUnits : pending,
    rateUnit,
    remainingUnits,
    remainingLabel,
  };
};

function InlineMessage({ title, children, tone = "error", action }: {
  title: string;
  children: ReactNode;
  tone?: "error" | "success";
  action?: ReactNode;
}) {
  const isSuccess = tone === "success";
  return (
    <div
      role={isSuccess ? "status" : "alert"}
      className={`flex flex-col gap-3 rounded-lg border p-4 sm:flex-row sm:items-start sm:justify-between ${
        isSuccess ? "border-emerald-500/30 bg-emerald-500/5" : "border-destructive/40 bg-destructive/5"
      }`}
    >
      <div className="flex gap-3">
        {isSuccess ? <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" /> : <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />}
        <div><p className="text-sm font-medium">{title}</p><div className="mt-1 text-sm text-muted-foreground">{children}</div></div>
      </div>
      {action}
    </div>
  );
}

function TargetProgress({ percent }: { percent: number }) {
  return (
    <div className="flex items-center gap-2">
      <div role="progressbar" aria-label="Target achieved" aria-valuenow={Math.min(100, Math.max(0, percent))} aria-valuemin={0} aria-valuemax={100} aria-valuetext={numberFormatter.format(percent) + "% achieved"} className="h-1.5 min-w-12 flex-1 overflow-hidden rounded-full bg-muted">
        <div className={percent >= 100 ? "h-full rounded-full bg-emerald-600 dark:bg-emerald-400" : "h-full rounded-full bg-primary/70"} style={{ width: Math.min(100, Math.max(0, percent)) + "%" }} />
      </div>
      <span className="w-10 shrink-0 text-right text-xs tabular-nums text-muted-foreground">{numberFormatter.format(percent)}%</span>
    </div>
  );
}

export default function StoreTargets() {
  const today = useMemo(() => new Date(), []);
  const currentMonth = today.getMonth() + 1;
  const currentYear = today.getFullYear();
  const yearOptions = useMemo(() => Array.from({ length: 7 }, (_, index) => currentYear - 3 + index), [currentYear]);
  const initialFilters = useMemo<TargetFilters>(() => ({
    month: currentMonth, year: currentYear, employeeId: "",
  }), [currentMonth, currentYear]);

  const createEmptyForm = useCallback((filters: TargetFilters = initialFilters): TargetFormState => {
    return {
      storeId: "",
      employeeId: filters.employeeId,
      month: filters.month,
      year: filters.year,
      targetTons: "",
      fulfilledTons: "",
      remarks: "",
    };
  }, [initialFilters]);

  const [targets, setTargets] = useState<SalesTargetDto[]>([]);
  const latestRequest = useRef(0);
  const [storeDirectory, setStoreDirectory] = useState<{ officerId: number; stores: StoreDto[] } | null>(null);
  const [isLoadingStores, setIsLoadingStores] = useState(false);
  const [storeError, setStoreError] = useState<string | null>(null);
  const [storeRetry, setStoreRetry] = useState(0);
  const [employees, setEmployees] = useState<EmployeeUserDto[]>([]);
  const [filters, setFilters] = useState<TargetFilters>(initialFilters);
  const [panelMode, setPanelMode] = useState<"officer" | "details" | "target" | "achievement">("officer");
  const [selectedOfficerId, setSelectedOfficerId] = useState<number | null>(null);
  const [now, setNow] = useState(today);
  const [form, setForm] = useState<TargetFormState>(() => createEmptyForm());
  const [baselineForm, setBaselineForm] = useState<TargetFormState>(() => createEmptyForm());
  const [editingTarget, setEditingTarget] = useState<SalesTargetDto | null>(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isLoadingTargets, setIsLoadingTargets] = useState(true);
  const [isLoadingDirectory, setIsLoadingDirectory] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [directoryError, setDirectoryError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const targetFormIsDirty = isFormOpen && (panelMode === "target" || panelMode === "achievement") && JSON.stringify(form) !== JSON.stringify(baselineForm);
  const { markSaved, requestDiscard } = useUnsavedChanges(targetFormIsDirty);
  const targetTonsValue = Number(form.targetTons);
  const fulfilledTonsValue = Number(form.fulfilledTons);
  const hasValidTargetTons = form.targetTons.trim() !== "" && Number.isFinite(targetTonsValue) && targetTonsValue > 0;
  const hasValidPeriod = Number.isInteger(form.month) && form.month >= 1 && form.month <= 12
    && Number.isInteger(form.year) && form.year > 0;
  const duplicateTarget = !editingTarget && targets.some((target) =>
    String(target.employeeId) === form.employeeId && String(target.storeId) === form.storeId
    && target.targetType === "MONTHLY");
  const hasValidAchievement = panelMode !== "achievement" || (
    form.fulfilledTons.trim() !== "" && Number.isFinite(fulfilledTonsValue) && fulfilledTonsValue >= 0
  );
  const isTargetFormValid = Boolean(
    form.storeId &&
    form.employeeId &&
    hasValidTargetTons &&
    hasValidPeriod &&
    hasValidAchievement && !duplicateTarget && (Boolean(editingTarget) || (
      !isLoadingStores && !storeError && storeDirectory?.officerId === selectedOfficerId
      && storeDirectory.stores.some((store) => String(store.storeId) === form.storeId)
    ))
  );

  const stores = useMemo(() => storeDirectory?.officerId === selectedOfficerId ? storeDirectory.stores : [], [storeDirectory, selectedOfficerId]);
  const storeOptions = useMemo(() => stores.map((store) => ({
    value: String(store.storeId), label: `${store.storeName}${store.city ? ` · ${formatCityLabel(store.city)}` : ""}`, data: store,
  })), [stores]);
  const storeById = useMemo(() => new Map(stores.map((store) => [Number(store.storeId), store])), [stores]);
  const fieldOfficers = useMemo(() => employees.filter(isTargetFieldOfficer), [employees]);
  const employeeOptions = useMemo(() => fieldOfficers.map((employee) => ({
    value: String(employee.id),
    label: employeeName(employee),
    data: employee,
  })), [fieldOfficers]);

  const loadDirectory = useCallback(async () => {
    setIsLoadingDirectory(true);
    setDirectoryError(null);
    try {
      const result = await API.getEmployees<EmployeeUserDto>();
      setEmployees(Array.isArray(result) ? result : []);
    } catch {
      setDirectoryError("Could not load field officers.");
    } finally { setIsLoadingDirectory(false); }
  }, []);

  useEffect(() => {
    if (!isFormOpen || selectedOfficerId == null) return;
    let cancelled = false;
    setIsLoadingStores(true);
    setStoreError(null);
    setStoreDirectory(null);
    void API.getStoresByEmployee(selectedOfficerId, { sortBy: "storeName", sortOrder: "asc" })
      .then((response) => {
        if (cancelled) return;
        if (!Array.isArray(response.content)) throw new Error("Could not load assigned stores.");
        const assigned = response.content.filter((store) =>
          store.employeeId == null || Number(store.employeeId) === selectedOfficerId);
        setStoreDirectory({ officerId: selectedOfficerId, stores: assigned });
      })
      .catch(() => { if (!cancelled) setStoreError("Could not load this officer’s stores."); })
      .finally(() => { if (!cancelled) setIsLoadingStores(false); });
    return () => { cancelled = true; };
  }, [isFormOpen, selectedOfficerId, storeRetry]);

  const loadTargets = useCallback(async () => {
    const requestId = ++latestRequest.current;
    setIsLoadingTargets(true);
    setLoadError(null);
    try {
      const range = getMonthRange(filters.month, filters.year);
      const response = await API.searchSalesTargets({
        ...range,
        targetType: "MONTHLY",
      });
      if (requestId === latestRequest.current) setTargets(Array.isArray(response) ? response.filter((target) => target.targetType === "MONTHLY") : []);
    } catch (error) {
      if (requestId !== latestRequest.current) return;
      setTargets([]);
      setLoadError(error instanceof Error ? error.message : "Failed to load sales targets.");
    } finally { if (requestId === latestRequest.current) setIsLoadingTargets(false); }
  }, [filters.month, filters.year]);

  useEffect(() => { void loadDirectory(); }, [loadDirectory]);
  useEffect(() => { void loadTargets(); return () => { latestRequest.current += 1; }; }, [loadTargets]);
  useEffect(() => {
    const interval = window.setInterval(() => setNow(new Date()), 60_000);
    return () => window.clearInterval(interval);
  }, []);

  const officers = useMemo(() => groupOfficerTargets(employees, targets), [employees, targets]);
  const visibleOfficers = useMemo(() => officers.filter((officer) => !filters.employeeId || String(officer.id) === filters.employeeId), [officers, filters.employeeId]);
  const summary = useMemo(() => summarizeTargets(visibleOfficers.flatMap((officer) => officer.targets)), [visibleOfficers]);
  const selectedOfficer = officers.find((officer) => officer.id === selectedOfficerId);
  const isLoading = isLoadingTargets || isLoadingDirectory;
  const hasFilters = Boolean(filters.employeeId);
  const periodLabel = MONTHS[filters.month - 1] + " " + filters.year;
  const frequencyLabel = "Monthly";
  const returnToOfficer = () => requestDiscard(() => {
    markSaved();
    setEditingTarget(null);
    setForm(baselineForm);
    setFormError(null);
    setPanelMode("officer");
  });
  const openOfficer = (id: number) => {
    setSelectedOfficerId(id);
    setEditingTarget(null);
    setFormError(null);
    setPanelMode("officer");
    setIsFormOpen(true);
  };
  const selectedPace = editingTarget ? getTargetPace(editingTarget, now, filters.month, filters.year) : null;

  const openCreateForm = () => {
    if (!selectedOfficer) return;
    const emptyForm = { ...createEmptyForm(filters), employeeId: String(selectedOfficer.id) };
    setEditingTarget(null);
    setPanelMode("target");
    setForm(emptyForm);
    setBaselineForm(emptyForm);
    setFormError(null);
    setIsFormOpen(true);
  };

  const openEditForm = (target: SalesTargetDto, mode: "details" | "target" | "achievement" = "details") => {
    const targetForm: TargetFormState = {
      storeId: String(target.storeId),
      employeeId: String(target.employeeId),
      month: Number(target.month) || filters.month,
      year: Number(target.year) || filters.year,
      targetTons: String(target.targetTons ?? ""),
      fulfilledTons: String(getEffectiveFulfilled(target)),
      remarks: target.remarks || "",
    };
    setEditingTarget(target);
    setPanelMode(mode);
    setForm(targetForm);
    setBaselineForm(targetForm);
    setFormError(null);
    setIsFormOpen(true);
  };

  const handleStoreSelection = (storeId: string) => {
    setForm((current) => ({ ...current, storeId }));
  };

  const validateForm = () => {
    if (!form.storeId) return "Select a store.";
    if (!form.employeeId) return "Select the field officer responsible for this target.";
    if (!hasValidTargetTons) return "Target tons must be a valid number greater than zero.";
    if (!hasValidPeriod) return "Select a valid target month and year.";
    if (duplicateTarget) return "This store already has a target for this officer and period. Edit the existing target instead.";
    if (!hasValidAchievement) return "Enter an achieved amount of zero or more.";
    if (!editingTarget && (isLoadingStores || storeError || !stores.some((store) => String(store.storeId) === form.storeId))) return "Select a store assigned to this officer.";
    return null;
  };

  const handleSave = async (event: FormEvent) => {
    event.preventDefault();
    if (isSaving) return;
    const validationError = validateForm();
    if (validationError) { setFormError(validationError); toast.error(validationError, { duration: 3000 }); return; }
    setIsSaving(true);
    setFormError(null);
    try {
      if (editingTarget) {
        const updated = await API.editSalesTarget(editingTarget.id, {
          ...(panelMode === "achievement"
            ? { fulfilledTons: Number(form.fulfilledTons) }
            : { targetTons: Number(form.targetTons) }),
          remarks: form.remarks.trim(),
        });
        if (updated?.id != null && updated.targetTons != null) {
          setTargets((current) => current.map((target) => target.id === updated.id ? updated : target));
        }
        toast.success(panelMode === "achievement" ? "Achievement updated" : "Target updated", { duration: 3000 });
      } else {
        const payload: SalesTargetCreatePayload = {
          employeeId: Number(form.employeeId), storeId: Number(form.storeId),
          targetType: "MONTHLY", targetTons: Number(form.targetTons),
          remarks: form.remarks.trim() || undefined,
          month: form.month, year: form.year,
        };
        await API.createSalesTarget(payload);
        toast.success("Target created", { duration: 3000 });
      }
      markSaved();
      setBaselineForm(form);
      setEditingTarget(null);
      setPanelMode("officer");
      await loadTargets();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to save the target.";
      setFormError(message);
      toast.error(message, { duration: 3000 });
    } finally { setIsSaving(false); }
  };

  const updateFilters = (patch: Partial<TargetFilters>) => {
    setFilters((current) => ({ ...current, ...patch }));
  };

  const changeMonth = (offset: number) => {
    const shifted = new Date(filters.year, filters.month - 1 + offset, 1);
    updateFilters({ month: shifted.getMonth() + 1, year: shifted.getFullYear() });
  };

  const clearFilters = () => {
    setFilters((current) => ({ ...current, employeeId: "" }));
  };

  const setFormOpen = (open: boolean) => {
    if (isSaving) return;
    if (open) {
      setIsFormOpen(true);
      return;
    }
    requestDiscard(() => {
      markSaved();
      setIsFormOpen(false);
      setSelectedOfficerId(null);
      setEditingTarget(null);
      setFormError(null);
    });
  };

  return (
    <div className="min-w-0 space-y-4 text-sm">
      <div className="flex flex-wrap items-end gap-3">
        <div className="min-w-0 space-y-1.5">
          <Label htmlFor="targets-month" className="text-xs">Period</Label>
          <div className="flex items-center gap-1">
            <Button variant="outline" size="icon" className="h-9 w-7 shrink-0" aria-label="Previous month" onClick={() => changeMonth(-1)}><ChevronLeft className="h-3.5 w-3.5" /></Button>
            <Select value={String(filters.month)} onValueChange={(value) => updateFilters({ month: Number(value) })}><SelectTrigger id="targets-month" className="h-9 w-[120px] text-xs"><SelectValue /></SelectTrigger><SelectContent>{MONTHS.map((month, index) => <SelectItem key={month} value={String(index + 1)}>{month}</SelectItem>)}</SelectContent></Select>
            <Select value={String(filters.year)} onValueChange={(value) => updateFilters({ year: Number(value) })}><SelectTrigger aria-label="Year" className="h-9 w-[76px] text-xs"><SelectValue /></SelectTrigger><SelectContent>{Array.from(new Set([...yearOptions, filters.year])).sort((a,b) => a-b).map((year) => <SelectItem key={year} value={String(year)}>{year}</SelectItem>)}</SelectContent></Select>
            <Button variant="outline" size="icon" className="h-9 w-7 shrink-0" aria-label="Next month" onClick={() => changeMonth(1)}><ChevronRight className="h-3.5 w-3.5" /></Button>
          </div>
        </div>
        <div className="min-w-0 flex-1 space-y-1.5 sm:max-w-[280px]">
          <Label htmlFor="targets-officer" className="text-xs">Field officer</Label>
          <SearchableSelect triggerId="targets-officer" options={employeeOptions} value={filters.employeeId || undefined} onSelect={(option) => updateFilters({ employeeId: option?.value || "" })} placeholder="All field officers" searchPlaceholder="Search field officers..." allowClear loading={isLoadingDirectory} triggerClassName="h-9 w-full min-w-[180px] overflow-hidden text-xs" contentClassName="w-[min(340px,calc(100vw-2rem))]" />
        </div>
        <div className="flex h-9 items-center gap-1 sm:ml-auto">
          {hasFilters && <Button variant="ghost" size="sm" onClick={clearFilters} className="text-xs"><X className="mr-1 h-3.5 w-3.5" />Clear</Button>}
          <Button variant="outline" size="icon" className="h-9 w-9" aria-label="Refresh targets" disabled={isLoading} onClick={() => void loadTargets()}><RefreshCw className="h-3.5 w-3.5" /></Button>
        </div>
      </div>

      {directoryError && <InlineMessage title="Some options are unavailable" action={<Button size="sm" variant="outline" onClick={() => void loadDirectory()}>Retry</Button>}>{directoryError}</InlineMessage>}
      {!isLoading && !loadError && visibleOfficers.length > 1 && (
        <dl className="grid grid-cols-3 gap-4 border-y py-3">
          {[["Total target", summary.target], ["Achieved", summary.achieved], ["Remaining", summary.remaining]].map(([label,value]) => <div key={label} className="min-w-0"><dt className="text-xs text-muted-foreground">{label}</dt><dd className="mt-1 text-lg font-semibold tabular-nums">{formatTons(Number(value))}</dd></div>)}
        </dl>
      )}
      <div className="flex flex-wrap items-center justify-between gap-1 text-xs text-muted-foreground" aria-live="polite">
        <span>{isLoading ? "Loading officers…" : visibleOfficers.length + " field officers · " + visibleOfficers.filter((officer) => officer.targets.length === 0).length + " not assigned"}</span>
        <span>{frequencyLabel} · {periodLabel} · Tonnes</span>
      </div>
      <Card className="gap-0 overflow-hidden py-0 shadow-none">
        <CardContent className="p-0">
          {loadError ? <div className="p-4"><InlineMessage title="Could not load targets" action={<Button size="sm" variant="outline" onClick={() => void loadTargets()}>Retry</Button>}>{loadError}</InlineMessage></div>
          : isLoading ? <div role="status" className="flex min-h-48 items-center justify-center gap-2 text-xs text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" />Loading officers and targets…</div>
          : visibleOfficers.length === 0 ? <div className="space-y-2 p-10 text-center"><p className="font-medium">No field officers found</p><p className="text-xs text-muted-foreground">{hasFilters ? "Clear the filter to see all field officers." : "Add a field officer from Employees to start assigning targets."}</p>{hasFilters && <Button size="sm" variant="link" onClick={clearFilters}>Clear filter</Button>}</div>
          : <>
            <div className="hidden md:block">
              <Table className="w-full table-fixed text-xs">
                <TableHeader><TableRow className="bg-muted/30 hover:bg-muted/30"><TableHead className="w-[28%] px-4">Field officer</TableHead><TableHead className="w-[10%] text-right">Stores</TableHead><TableHead className="w-[12%] text-right">Target</TableHead><TableHead className="w-[12%] text-right">Achieved</TableHead><TableHead className="w-[12%] text-right">Remaining</TableHead><TableHead className="w-[18%] pl-4">Progress</TableHead><TableHead className="w-[8%]"><span className="sr-only">Store targets</span></TableHead></TableRow></TableHeader>
                <TableBody>{visibleOfficers.map((officer) => (
                  <TableRow key={officer.id}>
                    <TableCell className="px-4 py-3"><button onClick={() => openOfficer(officer.id)} className="block w-full truncate text-left text-[13px] font-medium underline-offset-4 hover:underline focus-visible:rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" title={officer.name}>{officer.name}</button></TableCell>
                    <TableCell className="text-right tabular-nums">{officer.storeCount || "—"}</TableCell>
                    <TableCell className="text-right tabular-nums">{officer.targets.length ? numberFormatter.format(officer.target) : "—"}</TableCell>
                    <TableCell className="text-right font-medium tabular-nums">{officer.targets.length ? numberFormatter.format(officer.achieved) : "—"}</TableCell>
                    <TableCell className="text-right tabular-nums">{officer.targets.length ? numberFormatter.format(officer.remaining) : "—"}</TableCell>
                    <TableCell className="pl-4">{officer.targets.length ? <TargetProgress percent={officer.percent} /> : <Badge variant="secondary" className="whitespace-nowrap text-[11px] font-normal text-muted-foreground">Not assigned</Badge>}</TableCell>
                    <TableCell className="text-right"><Button size="icon" variant="ghost" className="h-8 w-8" aria-label={"View store targets for " + officer.name} onClick={() => openOfficer(officer.id)}><ChevronRight className="h-4 w-4" /></Button></TableCell>
                  </TableRow>
                ))}</TableBody>
              </Table>
            </div>
            <div className="divide-y md:hidden">{visibleOfficers.map((officer) => (
              <article key={officer.id} className="space-y-3 p-4">
                <div className="flex items-start justify-between gap-2"><div className="min-w-0"><button onClick={() => openOfficer(officer.id)} className="text-left text-sm font-medium hover:underline">{officer.name}</button><p className="mt-1 text-xs text-muted-foreground">{officer.targets.length ? officer.storeCount + (officer.storeCount === 1 ? " store" : " stores") : "Not assigned"}</p></div><Button size="icon" variant="ghost" className="h-7 w-7 shrink-0" aria-label={"View store targets for " + officer.name} onClick={() => openOfficer(officer.id)}><ChevronRight className="h-4 w-4" /></Button></div>
                {officer.targets.length > 0 && <><dl className="grid grid-cols-3 gap-3">{[["Target", officer.target], ["Achieved", officer.achieved], ["Remaining", officer.remaining]].map(([label,value]) => <div key={label}><dt className="text-[11px] text-muted-foreground">{label}</dt><dd className="mt-0.5 text-sm font-medium tabular-nums">{formatTons(Number(value))}</dd></div>)}</dl><TargetProgress percent={officer.percent} /></>}
              </article>
            ))}</div>
          </>}
        </CardContent>
      </Card>
      <Sheet open={isFormOpen} onOpenChange={setFormOpen}>
        <SheetContent className="flex w-full flex-col gap-0 overflow-hidden p-0 sm:max-w-[620px]">
          <SheetHeader className="shrink-0 space-y-1 border-b px-5 py-4 pr-12 text-left">
            {panelMode !== "officer" && <Button type="button" variant="ghost" size="sm" className="mb-1 h-7 w-fit -ml-2 px-2 text-xs text-muted-foreground" onClick={returnToOfficer} disabled={isSaving}><ChevronLeft className="mr-1 h-3.5 w-3.5" />Store targets</Button>}
            <SheetTitle className="text-base">{panelMode === "officer" ? selectedOfficer?.name || "Field officer" : !editingTarget ? "Add store target" : panelMode === "details" ? "Target details" : panelMode === "achievement" ? "Update achievement" : "Edit target"}</SheetTitle>
            <SheetDescription className="text-xs">{panelMode === "officer" ? "Field officer · " : selectedOfficer?.name + " · "}{editingTarget ? getTargetPeriod(editingTarget) : periodLabel} · {frequencyLabel}</SheetDescription>
          </SheetHeader>

          {panelMode === "officer" ? (
            <div className="min-h-0 flex-1 overflow-y-auto p-5">
              {selectedOfficer && <>
                <dl className="grid grid-cols-3 gap-4 border-b pb-4">
                  {[["Target", selectedOfficer.target], ["Achieved", selectedOfficer.achieved], ["Remaining", selectedOfficer.remaining]].map(([label,value]) => <div key={label}><dt className="text-xs text-muted-foreground">{label}</dt><dd className="mt-1 text-lg font-semibold tabular-nums">{selectedOfficer.targets.length ? formatTons(Number(value)) : "—"}</dd></div>)}
                </dl>
                <div className="my-4 flex items-center justify-between gap-3"><h3 className="text-sm font-medium">Store targets <span className="ml-1 text-xs font-normal text-muted-foreground">({selectedOfficer.targets.length})</span></h3><Button size="sm" onClick={openCreateForm} disabled={isLoading || Boolean(directoryError)}><Plus className="mr-1.5 h-3.5 w-3.5" />Add store target</Button></div>
                {loadError ? <InlineMessage title="Could not refresh targets" action={<Button size="sm" variant="outline" onClick={() => void loadTargets()}>Retry</Button>}>{loadError}</InlineMessage>
                : isLoadingTargets ? <p role="status" className="py-10 text-center text-xs text-muted-foreground">Refreshing targets…</p>
                : selectedOfficer.targets.length === 0 ? <div className="space-y-2 rounded-lg border border-dashed px-5 py-8 text-center"><Target className="mx-auto mb-2 h-6 w-6 text-muted-foreground" /><p className="text-sm font-medium">No targets assigned</p><p className="text-xs text-muted-foreground">Add a store target for {periodLabel} to get started.</p></div>
                : <div className="divide-y rounded-lg border">{selectedOfficer.targets.map((target) => {
                  const pace = getTargetPace(target, now, filters.month, filters.year);
                  return <article key={target.id} className="space-y-3 p-4">
                    <div className="flex items-start justify-between gap-3"><div className="min-w-0"><button onClick={() => openEditForm(target)} className="text-left text-sm font-medium hover:underline">{target.storeName || "Store #" + target.storeId}</button><p className="mt-1 text-xs text-muted-foreground">{formatCityLabel(target.storeCity || storeById.get(Number(target.storeId))?.city || "")}</p></div><Badge variant="secondary" className="shrink-0 text-[11px] font-normal">{pace.progressPercent >= 100 ? "Achieved" : getEffectiveFulfilled(target) > 0 ? "In progress" : "Not started"}</Badge></div>
                    <dl className="grid grid-cols-3 gap-3">{[["Target", target.targetTons], ["Achieved", getEffectiveFulfilled(target)], ["Remaining", pace.pending]].map(([label,value]) => <div key={label}><dt className="text-[11px] text-muted-foreground">{label}</dt><dd className="mt-0.5 text-sm font-medium tabular-nums">{formatTons(Number(value))}</dd></div>)}</dl>
                    <TargetProgress percent={pace.progressPercent} />
                    <div className="flex flex-wrap items-center justify-between gap-2"><span className="text-[11px] text-muted-foreground">{target.fulfilledTons == null ? "From recorded sales" : "Manually updated"}</span><div className="flex gap-2"><Button variant="outline" size="sm" className="h-8 text-xs" onClick={() => openEditForm(target, "target")}>Edit target</Button><Button variant="outline" size="sm" className="h-8 text-xs" onClick={() => openEditForm(target, "achievement")}>Update achievement</Button></div></div>
                  </article>;
                })}</div>}
              </>}
            </div>
          ) : editingTarget && panelMode === "details" && selectedPace ? (
            <div className="flex-1 space-y-5 overflow-y-auto p-5">
              <div>
                <h3 className="text-sm font-semibold leading-5">{editingTarget.storeName || "Store #" + editingTarget.storeId}</h3>
                <p className="mt-1 text-xs text-muted-foreground">{formatCityLabel(editingTarget.storeCity || storeById.get(Number(editingTarget.storeId))?.city || "")}</p>
                <p className="mt-2 text-xs"><span className="text-muted-foreground">Field officer · </span>{editingTarget.employeeName || "Unnamed field officer"}</p>
              </div>
              <div className="space-y-3 border-y py-4">
                <dl className="grid grid-cols-3 gap-3">{[["Target", editingTarget.targetTons], ["Achieved", getEffectiveFulfilled(editingTarget)], ["Remaining", selectedPace.pending]].map(([label, value]) => <div key={label}><dt className="text-xs text-muted-foreground">{label}</dt><dd className="mt-1 text-lg font-semibold tabular-nums">{formatTons(Number(value))}</dd></div>)}</dl>
                <TargetProgress percent={selectedPace.progressPercent} />
                <div className="flex flex-wrap items-center justify-between gap-2 text-xs"><Badge variant="secondary" className="text-[11px] font-normal">{selectedPace.progressPercent >= 100 ? "Achieved" : getEffectiveFulfilled(editingTarget) > 0 ? "In progress" : "Not started"}</Badge><span className="text-muted-foreground">{editingTarget.fulfilledTons == null ? "From recorded sales" : "Manually updated"}</span></div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <Button variant="outline" size="sm" onClick={() => setPanelMode("target")}><Edit3 className="mr-1.5 h-3.5 w-3.5" />Edit target</Button>
                <Button size="sm" onClick={() => setPanelMode("achievement")}>Update achievement</Button>
              </div>
              {editingTarget.remarks && <div><h4 className="text-xs font-medium">Note</h4><p className="mt-1.5 whitespace-pre-wrap break-words text-xs leading-relaxed text-muted-foreground">{editingTarget.remarks}</p></div>}
              <details className="border-t pt-3">
                <summary className="cursor-pointer text-xs font-medium">Pace details</summary>
                <dl className="mt-3 space-y-2 text-xs"><div className="flex justify-between gap-3"><dt className="text-muted-foreground">Expected by now</dt><dd className="tabular-nums">{formatTons(selectedPace.expected)}</dd></div><div className="flex justify-between gap-3"><dt className="text-muted-foreground">Working time remaining</dt><dd>{selectedPace.remainingLabel}</dd></div>{selectedPace.remainingUnits > 0 && <div className="flex justify-between gap-3"><dt className="text-muted-foreground">Pace needed</dt><dd className="tabular-nums">{numberFormatter.format(selectedPace.rate)} {selectedPace.rateUnit}</dd></div>}</dl>
                <p className="mt-3 text-[11px] leading-relaxed text-muted-foreground">Estimate based on Monday–Saturday, 9 am–6 pm. This does not change the target or achieved amount.</p>
              </details>
            </div>
          ) : (
            <form onSubmit={handleSave} className="flex min-h-0 flex-1 flex-col">
              <div className="flex-1 space-y-4 overflow-y-auto p-5 [&_label]:text-xs [&_input]:h-9 [&_input]:text-sm">
                {formError && <InlineMessage title="Could not save">{formError}</InlineMessage>}
                {!editingTarget && storeError && <InlineMessage title="Stores unavailable" action={<Button size="sm" variant="outline" onClick={() => setStoreRetry((value) => value + 1)}>Retry</Button>}>{storeError}</InlineMessage>}
                {duplicateTarget && <p role="status" className="rounded-md bg-muted/50 p-3 text-xs">A target already exists. Edit it from Store targets.</p>}
                {editingTarget ? (
                  <p className="text-sm font-medium">{editingTarget.storeName}</p>
                ) : (
                  <>
                    <div className="space-y-1.5"><Label htmlFor="sales-target-store">Store <span className="text-destructive">*</span></Label><SearchableSelect triggerId="sales-target-store" required options={storeOptions} emptyMessage="No stores assigned to this officer" value={form.storeId || undefined} onSelect={(option) => handleStoreSelection(option?.value || "")} placeholder="Select store" searchPlaceholder="Search stores..." loading={isLoadingStores} triggerClassName="h-9 w-full overflow-hidden text-xs" contentClassName="w-[min(480px,calc(100vw-2rem))]" /></div>
                  </>
                )}

                {panelMode !== "achievement" && <div className="space-y-1.5"><Label htmlFor="sales-target-tons">Target (tonnes) <span className="text-destructive">*</span></Label><Input id="sales-target-tons" type="number" min="0.01" step="0.01" inputMode="decimal" value={form.targetTons} required onChange={(event) => setForm((current) => ({ ...current, targetTons: event.target.value }))} placeholder="e.g. 50" /></div>}
                {editingTarget && panelMode === "achievement" && (
                  <div className="space-y-1.5">
                    <Label htmlFor="fulfilled-tons">Achieved (tonnes) <span className="text-destructive">*</span></Label>
                    <Input id="fulfilled-tons" type="number" min="0" step="0.01" inputMode="decimal" value={form.fulfilledTons} required aria-describedby="achievement-hint" onChange={(event) => setForm((current) => ({ ...current, fulfilledTons: event.target.value }))} />
                    <p id="achievement-hint" className="text-xs text-muted-foreground">Total achieved so far, not an additional amount.</p>
                  </div>
                )}
                <div className="space-y-1.5"><Label htmlFor="sales-target-remarks">Note <span className="font-normal text-muted-foreground">(optional)</span></Label><Textarea id="sales-target-remarks" className="min-h-20 text-sm" value={form.remarks} onChange={(event) => setForm((current) => ({ ...current, remarks: event.target.value }))} placeholder="Add a note" rows={3} /></div>
              </div>
              <SheetFooter className="shrink-0 flex-row justify-end gap-2 border-t bg-background px-5 py-3 sm:space-x-0">
                <Button type="button" variant="outline" size="sm" disabled={isSaving} onClick={returnToOfficer}>Cancel</Button>
                <Button type="submit" size="sm" disabled={isSaving || (!editingTarget && isLoadingDirectory) || !isTargetFormValid}>{isSaving && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}{isSaving ? "Saving…" : !editingTarget ? "Create target" : panelMode === "achievement" ? "Save achievement" : "Save target"}</Button>
              </SheetFooter>
            </form>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
