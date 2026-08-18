"use client";

import { type FormEvent, type ReactNode, useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Edit3,
  Loader2,
  Plus,
  RefreshCw,
  Search,
  Target,
  X,
} from "lucide-react";

import {
  API,
  type EmployeeUserDto,
  type SalesTargetCreatePayload,
  type SalesTargetDto,
  type SalesTargetType,
  type StoreDto,
} from "@/lib/api";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SearchableSelect } from "@/components/ui/searchable-select2";
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
import { Switch } from "@/components/ui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
] as const;
const WORK_START_HOUR = 9;
const WORK_END_HOUR = 18;
const WORK_HOURS = WORK_END_HOUR - WORK_START_HOUR;

type TargetTypeFilter = "ALL" | SalesTargetType;
type PaceState = "behind" | "slipping" | "onpace" | "met";
type StatusFilter = "ALL" | PaceState;

interface TargetFilters {
  month: number;
  year: number;
  targetType: TargetTypeFilter;
  storeId: string;
  employeeId: string;
}

interface TargetFormState {
  targetType: SalesTargetType;
  storeId: string;
  employeeId: string;
  month: number;
  year: number;
  targetDate: string;
  targetTons: string;
  manualFulfilment: boolean;
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
  rateUnit: "t/hr" | "t/day";
  remainingUnits: number;
  remainingLabel: string;
}

const formatLocalDate = (date: Date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const parseLocalDate = (value: string) => {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, month - 1, day);
};

const getMonthRange = (month: number, year: number) => {
  const lastDay = new Date(year, month, 0).getDate();
  return {
    startDate: `${year}-${String(month).padStart(2, "0")}-01`,
    endDate: `${year}-${String(month).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`,
  };
};

const numberFormatter = new Intl.NumberFormat("en-IN", { maximumFractionDigits: 2 });
const formatTons = (value: number | null | undefined) => `${numberFormatter.format(Number(value) || 0)} t`;

const isFieldOfficer = (employee: EmployeeUserDto) => {
  const role = employee.role?.trim().toLowerCase().replace(/[_-]+/g, " ");
  return role === "field officer" || role === "role field officer";
};

const employeeName = (employee: EmployeeUserDto) =>
  [employee.firstName, employee.lastName].filter(Boolean).join(" ").trim() || `Employee #${employee.id}`;

const getInitials = (name: string) =>
  name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]?.toUpperCase()).join("") || "FO";

const getTargetPeriod = (target: SalesTargetDto) => {
  if (target.targetType === "DAILY") {
    if (!target.targetDate) return "Daily target";
    return parseLocalDate(target.targetDate).toLocaleDateString("en-IN", {
      day: "2-digit", month: "short", year: "numeric",
    });
  }
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

const formatHoursLeft = (hours: number) => {
  if (hours <= 0) return "Period ended";
  const totalMinutes = Math.max(0, Math.round(hours * 60));
  const wholeHours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return wholeHours > 0 ? `${wholeHours} h ${minutes} m` : `${minutes} m`;
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
  let rateUnit: PaceMetrics["rateUnit"] = "t/day";
  let remainingLabel = "Period ended";

  if (target.targetType === "DAILY") {
    const targetDate = target.targetDate
      ? parseLocalDate(target.targetDate)
      : new Date(fallbackYear, fallbackMonth - 1, 1);
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const targetDay = new Date(targetDate.getFullYear(), targetDate.getMonth(), targetDate.getDate());
    const targetIsSunday = targetDay.getDay() === 0;

    if (targetDay.getTime() < today.getTime()) elapsedFraction = 1;
    else if (targetDay.getTime() > today.getTime()) remainingUnits = targetIsSunday ? 0 : WORK_HOURS;
    else {
      elapsedFraction = workdayFraction(now);
      remainingUnits = targetIsSunday ? 0 : Math.max(0, WORK_HOURS * (1 - elapsedFraction));
    }
    rateUnit = "t/hr";
    remainingLabel = formatHoursLeft(remainingUnits);
  } else {
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
  }

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

const paceStateLabel: Record<PaceState, string> = {
  behind: "Behind", slipping: "Slipping", onpace: "On pace", met: "Met",
};

const paceTone = (state: PaceState) => {
  if (state === "met") return "border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400";
  if (state === "onpace") return "border-sky-500/30 bg-sky-500/10 text-sky-600 dark:text-sky-400";
  if (state === "slipping") return "border-amber-500/30 bg-amber-500/10 text-amber-600 dark:text-amber-400";
  return "border-destructive/30 bg-destructive/10 text-destructive";
};

const paceBarTone = (state: PaceState) => {
  if (state === "met") return "bg-emerald-500";
  if (state === "onpace") return "bg-sky-500";
  if (state === "slipping") return "bg-amber-500";
  return "bg-destructive";
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

function PaceProgress({ pace, compact = false }: { pace: PaceMetrics; compact?: boolean }) {
  const fulfilledWidth = Math.min(100, Math.max(0, pace.progressPercent));
  const expectedPosition = Math.min(100, Math.max(0, pace.expectedPercent));
  return (
    <div className={`relative overflow-visible rounded-full bg-muted ${compact ? "h-2" : "h-2.5"}`}>
      <div className={`h-full rounded-full transition-[width] duration-500 ${paceBarTone(pace.state)}`} style={{ width: `${fulfilledWidth}%` }} />
      <span
        aria-label={`${numberFormatter.format(pace.expected)} tonnes expected by now`}
        className="absolute -bottom-1 -top-1 w-0.5 rounded-full bg-foreground/80 shadow-[0_0_0_1px_hsl(var(--background))]"
        style={{ left: `${expectedPosition}%` }}
      />
    </div>
  );
}

export default function StoreTargets() {
  const today = useMemo(() => new Date(), []);
  const currentMonth = today.getMonth() + 1;
  const currentYear = today.getFullYear();
  const yearOptions = useMemo(() => Array.from({ length: 7 }, (_, index) => currentYear - 3 + index), [currentYear]);
  const initialFilters = useMemo<TargetFilters>(() => ({
    month: currentMonth, year: currentYear, targetType: "ALL", storeId: "", employeeId: "",
  }), [currentMonth, currentYear]);

  const createEmptyForm = useCallback((filters: TargetFilters = initialFilters): TargetFormState => {
    const targetDate = filters.month === currentMonth && filters.year === currentYear
      ? formatLocalDate(today)
      : `${filters.year}-${String(filters.month).padStart(2, "0")}-01`;
    return {
      targetType: filters.targetType === "DAILY" ? "DAILY" : "MONTHLY",
      storeId: filters.storeId,
      employeeId: filters.employeeId,
      month: filters.month,
      year: filters.year,
      targetDate,
      targetTons: "",
      manualFulfilment: false,
      fulfilledTons: "",
      remarks: "",
    };
  }, [currentMonth, currentYear, initialFilters, today]);

  const [targets, setTargets] = useState<SalesTargetDto[]>([]);
  const [stores, setStores] = useState<StoreDto[]>([]);
  const [employees, setEmployees] = useState<EmployeeUserDto[]>([]);
  const [filters, setFilters] = useState<TargetFilters>(initialFilters);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("ALL");
  const [searchQuery, setSearchQuery] = useState("");
  const [now, setNow] = useState(today);
  const [form, setForm] = useState<TargetFormState>(() => createEmptyForm());
  const [editingTarget, setEditingTarget] = useState<SalesTargetDto | null>(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isLoadingTargets, setIsLoadingTargets] = useState(true);
  const [isLoadingDirectory, setIsLoadingDirectory] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [directoryError, setDirectoryError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const storeOptions = useMemo(() => stores.map((store) => ({
    value: String(store.storeId), label: `${store.storeName}${store.city ? ` · ${store.city}` : ""}`, data: store,
  })), [stores]);
  const storeById = useMemo(() => new Map(stores.map((store) => [Number(store.storeId), store])), [stores]);
  const fieldOfficers = useMemo(() => employees.filter(isFieldOfficer), [employees]);
  const employeeOptions = useMemo(() => fieldOfficers.map((employee) => ({
    value: String(employee.id),
    label: `${employeeName(employee)}${employee.employeeId ? ` · ${employee.employeeId}` : ""}`,
    data: employee,
  })), [fieldOfficers]);
  const employeeById = useMemo(() => new Map(fieldOfficers.map((employee) => [Number(employee.id), employee])), [fieldOfficers]);

  const loadDirectory = useCallback(async () => {
    setIsLoadingDirectory(true);
    setDirectoryError(null);
    const [storeResult, employeeResult] = await Promise.allSettled([
      API.getStoresFiltered({ page: 0, size: 1000, sortBy: "storeName", sortOrder: "asc" }),
      API.getEmployees<EmployeeUserDto>(),
    ]);
    const errors: string[] = [];
    if (storeResult.status === "fulfilled") setStores(Array.isArray(storeResult.value) ? storeResult.value : []);
    else { setStores([]); errors.push("stores"); }
    if (employeeResult.status === "fulfilled") setEmployees(Array.isArray(employeeResult.value) ? employeeResult.value : []);
    else { setEmployees([]); errors.push("field officers"); }
    if (errors.length > 0) setDirectoryError(`Could not load ${errors.join(" and ")}. Retry before creating a target.`);
    setIsLoadingDirectory(false);
  }, []);

  const loadTargets = useCallback(async () => {
    setIsLoadingTargets(true);
    setLoadError(null);
    try {
      const range = getMonthRange(filters.month, filters.year);
      const response = await API.searchSalesTargets({
        ...range,
        targetType: filters.targetType === "ALL" ? undefined : filters.targetType,
        storeId: filters.storeId ? Number(filters.storeId) : undefined,
        employeeId: filters.employeeId ? Number(filters.employeeId) : undefined,
      });
      setTargets(Array.isArray(response) ? response : []);
    } catch (error) {
      setTargets([]);
      setLoadError(error instanceof Error ? error.message : "Failed to load sales targets.");
    } finally { setIsLoadingTargets(false); }
  }, [filters]);

  useEffect(() => { void loadDirectory(); }, [loadDirectory]);
  useEffect(() => { void loadTargets(); }, [loadTargets]);
  useEffect(() => {
    const interval = window.setInterval(() => setNow(new Date()), 60_000);
    return () => window.clearInterval(interval);
  }, []);

  const targetRows = useMemo(() => targets.map((target) => ({
    target, pace: getTargetPace(target, now, filters.month, filters.year),
  })), [filters.month, filters.year, now, targets]);

  const visibleRows = useMemo(() => {
    const normalizedSearch = searchQuery.trim().toLowerCase();
    return targetRows.filter(({ target, pace }) => {
      if (statusFilter !== "ALL" && pace.state !== statusFilter) return false;
      if (!normalizedSearch) return true;
      const store = storeById.get(Number(target.storeId));
      const employee = employeeById.get(Number(target.employeeId));
      return [target.storeName, target.storeCity, target.storeState, target.storeId, target.employeeName,
        target.employeeId, employee?.employeeId, store?.district]
        .filter((value) => value != null).join(" ").toLowerCase().includes(normalizedSearch);
    });
  }, [employeeById, searchQuery, statusFilter, storeById, targetRows]);

  const summary = useMemo(() => {
    const targetTons = visibleRows.reduce((total, row) => total + (Number(row.target.targetTons) || 0), 0);
    const fulfilledTons = visibleRows.reduce((total, row) => total + getEffectiveFulfilled(row.target), 0);
    const expectedTons = visibleRows.reduce((total, row) => total + row.pace.expected, 0);
    const pendingTons = Math.max(0, targetTons - fulfilledTons);
    const state = paceStateFor(fulfilledTons, targetTons, expectedTons);
    const leadRow = visibleRows.reduce<(typeof visibleRows)[number] | null>((lead, row) =>
      !lead || row.pace.pending > lead.pace.pending ? row : lead, null);
    const remainingUnits = leadRow?.pace.remainingUnits || 0;
    return {
      targetTons, fulfilledTons, expectedTons, pendingTons,
      delta: fulfilledTons - expectedTons,
      state,
      progressPercent: targetTons > 0 ? (fulfilledTons / targetTons) * 100 : 0,
      expectedPercent: targetTons > 0 ? (expectedTons / targetTons) * 100 : 0,
      rate: remainingUnits > 0 ? pendingTons / remainingUnits : pendingTons,
      rateUnit: leadRow?.pace.rateUnit || (filters.targetType === "DAILY" ? "t/hr" : "t/day"),
      remainingLabel: leadRow?.pace.remainingLabel || "No active target",
    };
  }, [filters.targetType, visibleRows]);

  const summaryPace: PaceMetrics = {
    expected: summary.expectedTons,
    pending: summary.pendingTons,
    delta: summary.delta,
    progressPercent: summary.progressPercent,
    expectedPercent: summary.expectedPercent,
    state: summary.state,
    rate: summary.rate,
    rateUnit: summary.rateUnit as PaceMetrics["rateUnit"],
    remainingUnits: 0,
    remainingLabel: summary.remainingLabel,
  };

  const activeSecondaryFilterCount = [
    filters.targetType !== "ALL", Boolean(filters.storeId), Boolean(filters.employeeId),
    statusFilter !== "ALL", Boolean(searchQuery.trim()),
  ].filter(Boolean).length;

  const targetTypeScope = useMemo(() => {
    const types = new Set(visibleRows.map(({ target }) => target.targetType));
    if (types.size === 0) return filters.targetType === "ALL" ? "all types" : filters.targetType.toLowerCase();
    if (types.size > 1) return "daily & monthly";
    return types.has("DAILY") ? "daily" : "monthly";
  }, [filters.targetType, visibleRows]);

  const formRateHint = useMemo(() => {
    const targetTons = Number(form.targetTons);
    if (!(targetTons > 0)) return null;
    if (form.targetType === "DAILY") {
      return `${formatTons(targetTons)} across the working day is ${numberFormatter.format(targetTons / WORK_HOURS)} t/hr from 09:00 to 18:00.`;
    }
    const workingDays = countWorkingDays(form.month, form.year);
    return `${formatTons(targetTons)} across ${workingDays} working days is ${numberFormatter.format(targetTons / Math.max(1, workingDays))} t/day.`;
  }, [form.month, form.targetTons, form.targetType, form.year]);

  const openCreateForm = () => {
    setEditingTarget(null);
    setForm(createEmptyForm(filters));
    setFormError(null);
    setSuccessMessage(null);
    setIsFormOpen(true);
  };

  const openEditForm = (target: SalesTargetDto) => {
    setEditingTarget(target);
    setForm({
      targetType: target.targetType,
      storeId: String(target.storeId),
      employeeId: String(target.employeeId),
      month: Number(target.month) || filters.month,
      year: Number(target.year) || filters.year,
      targetDate: target.targetDate || formatLocalDate(today),
      targetTons: String(target.targetTons ?? ""),
      manualFulfilment: target.fulfilledTons != null,
      fulfilledTons: String(target.fulfilledTons ?? getEffectiveFulfilled(target)),
      remarks: target.remarks || "",
    });
    setFormError(null);
    setSuccessMessage(null);
    setIsFormOpen(true);
  };

  const handleStoreSelection = (storeId: string) => {
    const selectedStore = stores.find((store) => String(store.storeId) === storeId);
    setForm((current) => ({
      ...current, storeId,
      employeeId: selectedStore?.employeeId ? String(selectedStore.employeeId) : current.employeeId,
    }));
  };

  const validateForm = () => {
    if (!form.storeId) return "Select a store.";
    if (!form.employeeId) return "Select the field officer responsible for this target.";
    if (!form.targetTons || Number(form.targetTons) <= 0) return "Target tons must be greater than zero.";
    if (form.targetType === "DAILY" && !form.targetDate) return "Select the daily target date.";
    if (form.manualFulfilment && (form.fulfilledTons === "" || Number(form.fulfilledTons) < 0)) return "Manual fulfilment must be zero or greater.";
    return null;
  };

  const handleSave = async (event: FormEvent) => {
    event.preventDefault();
    const validationError = validateForm();
    if (validationError) { setFormError(validationError); return; }
    setIsSaving(true);
    setFormError(null);
    try {
      if (editingTarget) {
        await API.editSalesTarget(editingTarget.id, {
          targetTons: Number(form.targetTons),
          fulfilledTons: form.manualFulfilment ? Number(form.fulfilledTons) : null,
          remarks: form.remarks.trim(),
        });
        setSuccessMessage(`Target for ${editingTarget.storeName} was updated.`);
      } else {
        const payload: SalesTargetCreatePayload = {
          employeeId: Number(form.employeeId), storeId: Number(form.storeId),
          targetType: form.targetType, targetTons: Number(form.targetTons),
          remarks: form.remarks.trim() || undefined,
          ...(form.targetType === "MONTHLY" ? { month: form.month, year: form.year } : { targetDate: form.targetDate }),
        };
        await API.createSalesTarget(payload);
        const selectedStore = stores.find((store) => String(store.storeId) === form.storeId);
        setSuccessMessage(`Target for ${selectedStore?.storeName || "the selected store"} was created.`);
      }
      setIsFormOpen(false);
      setEditingTarget(null);
      await loadTargets();
    } catch (error) {
      setFormError(error instanceof Error ? error.message : "Failed to save the target.");
    } finally { setIsSaving(false); }
  };

  const updateFilters = (patch: Partial<TargetFilters>) => {
    setSuccessMessage(null);
    setFilters((current) => ({ ...current, ...patch }));
  };

  const changeMonth = (offset: number) => {
    const shifted = new Date(filters.year, filters.month - 1 + offset, 1);
    updateFilters({ month: shifted.getMonth() + 1, year: shifted.getFullYear() });
  };

  const clearFilters = () => {
    setSuccessMessage(null);
    setFilters((current) => ({ ...current, targetType: "ALL", storeId: "", employeeId: "" }));
    setStatusFilter("ALL");
    setSearchQuery("");
  };

  const setFormOpen = (open: boolean) => {
    if (isSaving) return;
    setIsFormOpen(open);
    if (!open) { setEditingTarget(null); setFormError(null); }
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Store Targets</h2>
          <p className="mt-1 text-sm text-muted-foreground">Set store targets and see whether fulfilment is keeping pace with the period.</p>
        </div>
        <Button onClick={openCreateForm} disabled={isLoadingDirectory} className="shrink-0">
          {isLoadingDirectory ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Plus className="mr-2 h-4 w-4" />}
          Add target
        </Button>
      </div>

      {successMessage && <InlineMessage title="Saved" tone="success">{successMessage}</InlineMessage>}
      {directoryError && (
        <InlineMessage title="Target form data is unavailable" action={
          <Button type="button" variant="outline" size="sm" onClick={() => void loadDirectory()}><RefreshCw className="mr-2 h-4 w-4" />Retry</Button>
        }>{directoryError}</InlineMessage>
      )}

      <Card className="overflow-hidden">
        <CardContent className="grid gap-8 p-5 lg:grid-cols-[minmax(0,1.65fr)_minmax(280px,0.8fr)] lg:p-7">
          <div className="min-w-0">
            <div className="flex flex-col gap-1 sm:flex-row sm:items-baseline sm:justify-between">
              <h3 className="text-lg font-semibold">{MONTHS[filters.month - 1]} {filters.year}</h3>
              <p className="text-xs text-muted-foreground">{visibleRows.length} target{visibleRows.length === 1 ? "" : "s"} in view · {targetTypeScope}</p>
            </div>
            <div className="mt-8">
              <div className="relative">
                <PaceProgress pace={summaryPace} />
                {summary.targetTons > 0 && (
                  <span className="absolute -top-6 -translate-x-1/2 whitespace-nowrap text-[10px] font-medium text-muted-foreground" style={{ left: `${Math.min(96, Math.max(4, summary.expectedPercent))}%` }}>expected now</span>
                )}
              </div>
              <div className="mt-2 flex justify-between font-mono text-[10px] text-muted-foreground"><span>0</span><span>{formatTons(summary.targetTons / 2)}</span><span>{formatTons(summary.targetTons)}</span></div>
            </div>
            <p className="mt-5 text-sm text-muted-foreground"><strong className="text-foreground">{formatTons(summary.fulfilledTons)}</strong> booked of <strong className="text-foreground">{formatTons(summary.targetTons)}</strong> — {formatTons(summary.pendingTons)} left.</p>
          </div>
          <div className="flex flex-col justify-center border-t pt-6 lg:border-l lg:border-t-0 lg:pl-8 lg:pt-0">
            <div>
              <Badge variant="outline" className={`px-3 py-1 text-sm ${paceTone(summary.state)}`}>{paceStateLabel[summary.state]}</Badge>
              <p className="mt-2 text-sm text-muted-foreground">
                {Math.abs(summary.delta) < 0.01 ? "Exactly where this period should be" : `${summary.delta > 0 ? "+" : "−"}${formatTons(Math.abs(summary.delta))} ${summary.delta > 0 ? "ahead of" : "behind"} where this period should be`}
              </p>
            </div>
            <dl className="mt-6 grid grid-cols-2 gap-5">
              <div><dt className="text-xs text-muted-foreground">Needed to close</dt><dd className="mt-1 text-xl font-semibold">{numberFormatter.format(summary.rate)} <span className="text-xs font-normal text-muted-foreground">{summary.rateUnit}</span></dd></div>
              <div><dt className="text-xs text-muted-foreground">Time left in period</dt><dd className="mt-1 text-sm font-semibold">{summary.remainingLabel}</dd></div>
            </dl>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col gap-2 xl:flex-row xl:items-center">
              <div className="flex min-w-0 shrink-0 items-center rounded-md border bg-background">
                <Button type="button" variant="ghost" size="icon" className="h-9 w-9 shrink-0 rounded-r-none" onClick={() => changeMonth(-1)} aria-label="Previous month"><ChevronLeft className="h-4 w-4" /></Button>
                <Select value={String(filters.month)} onValueChange={(value) => updateFilters({ month: Number(value) })}>
                  <SelectTrigger className="h-9 min-w-28 rounded-none border-y-0 border-l border-r-0 shadow-none focus:ring-0 xl:min-w-24"><SelectValue /></SelectTrigger>
                  <SelectContent>{MONTHS.map((month, index) => <SelectItem key={month} value={String(index + 1)}>{month}</SelectItem>)}</SelectContent>
                </Select>
                <Select value={String(filters.year)} onValueChange={(value) => updateFilters({ year: Number(value) })}>
                  <SelectTrigger className="h-9 w-24 rounded-none border-y-0 border-l shadow-none focus:ring-0 xl:w-20"><SelectValue /></SelectTrigger>
                  <SelectContent>{yearOptions.map((year) => <SelectItem key={year} value={String(year)}>{year}</SelectItem>)}</SelectContent>
                </Select>
                <Button type="button" variant="ghost" size="icon" className="h-9 w-9 shrink-0 rounded-l-none border-l" onClick={() => changeMonth(1)} aria-label="Next month"><ChevronRight className="h-4 w-4" /></Button>
              </div>
              <Select value={filters.targetType} onValueChange={(value: TargetTypeFilter) => updateFilters({ targetType: value })}>
                <SelectTrigger className="h-9 w-full xl:w-28"><span className="mr-1 text-xs text-muted-foreground">Type</span><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="ALL">All</SelectItem><SelectItem value="MONTHLY">Monthly</SelectItem><SelectItem value="DAILY">Daily</SelectItem></SelectContent>
              </Select>
              <div className="min-w-0 xl:w-40"><SearchableSelect options={storeOptions} value={filters.storeId || undefined} onSelect={(option) => updateFilters({ storeId: option?.value || "" })} placeholder="Store · All" searchPlaceholder="Search stores..." allowClear loading={isLoadingDirectory} triggerClassName="h-9 w-full" contentClassName="w-[min(420px,calc(100vw-2rem))]" /></div>
              <div className="min-w-0 xl:w-44"><SearchableSelect options={employeeOptions} value={filters.employeeId || undefined} onSelect={(option) => updateFilters({ employeeId: option?.value || "" })} placeholder="Officer · All" searchPlaceholder="Search field officers..." allowClear loading={isLoadingDirectory} triggerClassName="h-9 w-full" contentClassName="w-[min(420px,calc(100vw-2rem))]" /></div>
              <Select value={statusFilter} onValueChange={(value: StatusFilter) => setStatusFilter(value)}>
                <SelectTrigger className="h-9 w-full xl:w-32"><span className="mr-1 text-xs text-muted-foreground">Status</span><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="ALL">All</SelectItem><SelectItem value="behind">Behind</SelectItem><SelectItem value="slipping">Slipping</SelectItem><SelectItem value="onpace">On pace</SelectItem><SelectItem value="met">Met</SelectItem></SelectContent>
              </Select>
              {activeSecondaryFilterCount > 0 && <Button type="button" variant="ghost" size="sm" className="h-9 shrink-0 justify-start xl:justify-center" onClick={clearFilters}>Clear filters</Button>}
              <div className="relative min-w-56 flex-1 xl:ml-auto xl:max-w-60">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input type="search" value={searchQuery} onChange={(event) => setSearchQuery(event.target.value)} placeholder="Search store, officer or code" className="h-9 pl-9 pr-9" />
                {searchQuery && <button type="button" onClick={() => setSearchQuery("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground" aria-label="Clear search"><X className="h-4 w-4" /></button>}
              </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-4 border-b pb-4">
          <div className="flex items-baseline gap-3"><CardTitle className="text-lg">Fulfilment</CardTitle><span className="text-xs text-muted-foreground">{visibleRows.length} target{visibleRows.length === 1 ? "" : "s"}</span></div>
          <Button type="button" variant="ghost" size="sm" onClick={() => void loadTargets()} disabled={isLoadingTargets}><RefreshCw className={`mr-2 h-4 w-4 ${isLoadingTargets ? "animate-spin" : ""}`} />Refresh</Button>
        </CardHeader>
        <CardContent className="p-0">
          {loadError ? (
            <div className="p-5"><InlineMessage title="Could not load targets">{loadError}</InlineMessage></div>
          ) : isLoadingTargets ? (
            <div className="flex min-h-64 items-center justify-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-5 w-5 animate-spin" />Loading store targets...</div>
          ) : visibleRows.length === 0 ? (
            <div className="flex min-h-64 flex-col items-center justify-center px-6 py-10 text-center">
              <Target className="mb-3 h-9 w-9 text-muted-foreground" /><p className="font-medium">No targets match these filters</p>
              <p className="mt-1 max-w-md text-sm text-muted-foreground">Clear the filters to see all of {MONTHS[filters.month - 1]}, or add a target for a store that does not have one yet.</p>
              <div className="mt-4 flex gap-2">{activeSecondaryFilterCount > 0 && <Button variant="outline" onClick={clearFilters}>Clear filters</Button>}<Button onClick={openCreateForm} disabled={isLoadingDirectory}><Plus className="mr-2 h-4 w-4" />Add target</Button></div>
            </div>
          ) : (
            <>
              <div className="hidden overflow-x-auto lg:block">
                <Table>
                  <TableHeader><TableRow className="hover:bg-transparent"><TableHead>Store</TableHead><TableHead>Field officer</TableHead><TableHead>Period</TableHead><TableHead className="text-right">Target</TableHead><TableHead className="min-w-60">Progress against pace</TableHead><TableHead className="text-right">Left</TableHead><TableHead>Status</TableHead><TableHead><span className="sr-only">Actions</span></TableHead></TableRow></TableHeader>
                  <TableBody>
                    {visibleRows.map(({ target, pace }) => {
                      const employee = employeeById.get(Number(target.employeeId));
                      return (
                        <TableRow key={target.id}>
                          <TableCell><div className="font-medium">{target.storeName || `Store #${target.storeId}`}</div><div className="mt-0.5 text-xs text-muted-foreground">{[target.storeCity, target.storeState].filter(Boolean).join(", ") || `Store #${target.storeId}`}</div></TableCell>
                          <TableCell><div className="flex items-center gap-2.5"><span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border bg-muted text-[11px] font-semibold">{getInitials(target.employeeName || "Field officer")}</span><div><div className="font-medium">{target.employeeName || `Employee #${target.employeeId}`}</div><div className="text-xs text-muted-foreground">{employee?.employeeId || `ID ${target.employeeId}`}</div></div></div></TableCell>
                          <TableCell><div>{getTargetPeriod(target)}</div><div className="mt-0.5 text-xs text-muted-foreground">{target.targetType === "DAILY" ? "Daily" : "Monthly"}</div></TableCell>
                          <TableCell className="text-right font-mono font-medium">{formatTons(target.targetTons)}</TableCell>
                          <TableCell><PaceProgress pace={pace} compact /><div className="mt-2 flex justify-between gap-3 text-[11px] text-muted-foreground"><span>{formatTons(getEffectiveFulfilled(target))} · {target.fulfilledTons == null ? "sales" : "manual"}</span><span>Expected {formatTons(pace.expected)}</span></div></TableCell>
                          <TableCell className="text-right font-mono">{formatTons(pace.pending)}</TableCell>
                          <TableCell><Badge variant="outline" className={paceTone(pace.state)}>{paceStateLabel[pace.state]}</Badge></TableCell>
                          <TableCell className="text-right"><Button type="button" variant="ghost" size="icon" onClick={() => openEditForm(target)} aria-label={`Edit target for ${target.storeName}`}><Edit3 className="h-4 w-4" /></Button></TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
              <div className="divide-y lg:hidden">
                {visibleRows.map(({ target, pace }) => (
                  <article key={target.id} className="space-y-4 p-4 sm:p-5">
                    <div className="flex items-start justify-between gap-3"><div><h3 className="font-semibold">{target.storeName || `Store #${target.storeId}`}</h3><p className="mt-0.5 text-xs text-muted-foreground">{[target.storeCity, target.storeState].filter(Boolean).join(", ") || `Store #${target.storeId}`}</p></div><Badge variant="outline" className={paceTone(pace.state)}>{paceStateLabel[pace.state]}</Badge></div>
                    <div className="grid grid-cols-2 gap-4 text-sm"><div><p className="text-xs text-muted-foreground">Field officer</p><p className="mt-1 font-medium">{target.employeeName || `Employee #${target.employeeId}`}</p></div><div><p className="text-xs text-muted-foreground">Period</p><p className="mt-1 font-medium">{getTargetPeriod(target)}</p></div></div>
                    <div><div className="mb-2 flex items-end justify-between gap-3"><div><p className="text-xs text-muted-foreground">Fulfilled</p><p className="font-mono font-semibold">{formatTons(getEffectiveFulfilled(target))} <span className="font-sans text-xs font-normal text-muted-foreground">of {formatTons(target.targetTons)}</span></p></div><p className="text-xs text-muted-foreground">{formatTons(pace.pending)} left</p></div><PaceProgress pace={pace} compact /><div className="mt-2 flex justify-between text-[11px] text-muted-foreground"><span>{target.fulfilledTons == null ? "From recorded sales" : "Manual fulfilment"}</span><span>Expected {formatTons(pace.expected)}</span></div></div>
                    <div className="flex justify-end"><Button type="button" variant="outline" size="sm" onClick={() => openEditForm(target)}><Edit3 className="mr-2 h-4 w-4" />Edit target</Button></div>
                  </article>
                ))}
              </div>
              <div className="border-t px-5 py-3 text-xs text-muted-foreground"><span className="mr-2 inline-block h-3 w-0.5 align-middle bg-foreground/80" />Pace marker — tonnage expected by this point in the period</div>
            </>
          )}
        </CardContent>
      </Card>

      <Sheet open={isFormOpen} onOpenChange={setFormOpen}>
        <SheetContent className="w-full overflow-y-auto p-0 sm:max-w-lg">
          <form onSubmit={handleSave} className="flex min-h-full flex-col">
            <SheetHeader className="border-b p-6 pr-12"><SheetTitle>{editingTarget ? "Edit store target" : "Add store target"}</SheetTitle><SheetDescription>{editingTarget ? "Update the target, fulfilment, or notes. Its store and period remain unchanged." : "Create a monthly target, or choose Daily for a one-day target."}</SheetDescription></SheetHeader>
            <div className="flex-1 space-y-5 p-6">
              {formError && <InlineMessage title="Could not save target">{formError}</InlineMessage>}
              <div className="space-y-2"><Label>Store</Label>{editingTarget ? <Input value={`${editingTarget.storeName} (${editingTarget.storeCity || "No city"})`} disabled /> : <SearchableSelect options={storeOptions} value={form.storeId || undefined} onSelect={(option) => handleStoreSelection(option?.value || "")} placeholder="Select store" searchPlaceholder="Search stores..." loading={isLoadingDirectory} triggerClassName="w-full" contentClassName="w-[min(420px,calc(100vw-2rem))]" />}</div>
              <div className="space-y-2"><Label>Field officer</Label>{editingTarget ? <Input value={editingTarget.employeeName || `Employee #${editingTarget.employeeId}`} disabled /> : <SearchableSelect options={employeeOptions} value={form.employeeId || undefined} onSelect={(option) => setForm((current) => ({ ...current, employeeId: option?.value || "" }))} placeholder="Select field officer" searchPlaceholder="Search field officers..." loading={isLoadingDirectory} triggerClassName="w-full" contentClassName="w-[min(420px,calc(100vw-2rem))]" />}{!editingTarget && form.storeId && stores.find((store) => String(store.storeId) === form.storeId)?.employeeId && <p className="text-xs text-muted-foreground">Pre-filled from the store&apos;s assigned field officer.</p>}</div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2"><Label htmlFor="sales-target-type">Target type</Label><Select value={form.targetType} onValueChange={(value: SalesTargetType) => setForm((current) => ({ ...current, targetType: value }))} disabled={Boolean(editingTarget)}><SelectTrigger id="sales-target-type"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="MONTHLY">Monthly</SelectItem><SelectItem value="DAILY">Daily</SelectItem></SelectContent></Select></div>
                {form.targetType === "MONTHLY" ? (
                  <div className="space-y-2"><Label htmlFor="sales-target-month">Period</Label><div className="grid grid-cols-[1fr_90px] gap-2"><Select value={String(form.month)} onValueChange={(value) => setForm((current) => ({ ...current, month: Number(value) }))} disabled={Boolean(editingTarget)}><SelectTrigger id="sales-target-month"><SelectValue /></SelectTrigger><SelectContent>{MONTHS.map((month, index) => <SelectItem key={month} value={String(index + 1)}>{month.slice(0, 3)}</SelectItem>)}</SelectContent></Select><Select value={String(form.year)} onValueChange={(value) => setForm((current) => ({ ...current, year: Number(value) }))} disabled={Boolean(editingTarget)}><SelectTrigger aria-label="Target year"><SelectValue /></SelectTrigger><SelectContent>{yearOptions.map((year) => <SelectItem key={year} value={String(year)}>{year}</SelectItem>)}</SelectContent></Select></div></div>
                ) : <div className="space-y-2"><Label htmlFor="sales-target-date">Period</Label><Input id="sales-target-date" type="date" value={form.targetDate} disabled={Boolean(editingTarget)} onChange={(event) => setForm((current) => ({ ...current, targetDate: event.target.value }))} /></div>}
              </div>
              <div className="space-y-2"><Label htmlFor="sales-target-tons">Target (tonnes)</Label><Input id="sales-target-tons" type="number" min="0.01" step="0.01" inputMode="decimal" value={form.targetTons} onChange={(event) => setForm((current) => ({ ...current, targetTons: event.target.value }))} placeholder="e.g. 50" />{formRateHint && <p className="rounded-md border bg-muted/30 px-3 py-2 text-xs leading-relaxed text-muted-foreground">{formRateHint}</p>}</div>
              {editingTarget && <div className="space-y-3 rounded-lg border p-4"><div className="flex items-center justify-between gap-4"><div><Label htmlFor="manual-fulfilment">Manual fulfilment</Label><p className="text-xs text-muted-foreground">Turn off to use recorded sales tons.</p></div><Switch id="manual-fulfilment" checked={form.manualFulfilment} onCheckedChange={(checked) => setForm((current) => ({ ...current, manualFulfilment: checked, fulfilledTons: checked && current.fulfilledTons === "" ? String(getEffectiveFulfilled(editingTarget)) : current.fulfilledTons }))} /></div>{form.manualFulfilment && <div className="space-y-2"><Label htmlFor="fulfilled-tons">Fulfilled tons</Label><Input id="fulfilled-tons" type="number" min="0" step="0.01" inputMode="decimal" value={form.fulfilledTons} onChange={(event) => setForm((current) => ({ ...current, fulfilledTons: event.target.value }))} /></div>}</div>}
              <div className="space-y-2"><Label htmlFor="sales-target-remarks">Remarks</Label><Textarea id="sales-target-remarks" value={form.remarks} onChange={(event) => setForm((current) => ({ ...current, remarks: event.target.value }))} placeholder="Optional context for this target" rows={4} /></div>
            </div>
            <SheetFooter className="sticky bottom-0 border-t bg-background p-6"><Button type="button" variant="outline" onClick={() => setFormOpen(false)} disabled={isSaving}>Cancel</Button><Button type="submit" disabled={isSaving || isLoadingDirectory}>{isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}{editingTarget ? "Save changes" : "Create target"}</Button></SheetFooter>
          </form>
        </SheetContent>
      </Sheet>
    </div>
  );
}
