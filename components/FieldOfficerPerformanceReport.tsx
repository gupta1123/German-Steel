"use client";

import { type FormEvent, useMemo, useState } from "react";
import {
  AlertCircle,
  BarChart3,
  Loader2,
  RefreshCw,
  Users,
} from "lucide-react";

import { API, type FieldOfficerPerformanceDto } from "@/lib/api";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { DateRangeError, isDateRangeInvalid } from "@/components/date-range-error";
import { formatCityLabel } from "@/lib/city-options";

export interface PerformanceOfficerOption {
  id: number;
  firstName?: string | null;
  lastName?: string | null;
  employeeId?: string | number | null;
  city?: string | null;
  assignedCity?: string[] | null;
  teamId?: string | number | null;
}

interface FieldOfficerPerformanceReportProps {
  officers: PerformanceOfficerOption[];
  officersLoading?: boolean;
  officersError?: string | null;
}

type DatePreset = "THIS_MONTH" | "LAST_MONTH" | "LAST_30_DAYS" | "CUSTOM";

const formatDate = (date: Date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const formatDisplayDate = (value: string) =>
  new Date(`${value}T00:00:00`).toLocaleDateString("en-US", {
    month: "short",
    day: "2-digit",
    year: "numeric",
  });

const getPresetRange = (preset: DatePreset, today: Date) => {
  if (preset === "LAST_MONTH") {
    const first = new Date(today.getFullYear(), today.getMonth() - 1, 1);
    const last = new Date(today.getFullYear(), today.getMonth(), 0);
    return { startDate: formatDate(first), endDate: formatDate(last) };
  }
  if (preset === "LAST_30_DAYS") {
    const first = new Date(today);
    first.setDate(first.getDate() - 29);
    return { startDate: formatDate(first), endDate: formatDate(today) };
  }
  return {
    startDate: formatDate(new Date(today.getFullYear(), today.getMonth(), 1)),
    endDate: formatDate(today),
  };
};

const formatNumber = new Intl.NumberFormat("en-IN", { maximumFractionDigits: 2 });

const asNumber = (value: number | null | undefined) => Number(value) || 0;

const formatMetric = (value: number | null | undefined) => formatNumber.format(asNumber(value));

const boundedPercent = (value: number | null | undefined) =>
  Math.min(100, Math.max(0, asNumber(value)));

const getInitials = (name: string | null | undefined) => {
  const initials = String(name || "")
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
  return initials || "FO";
};

const officerName = (officer: PerformanceOfficerOption) =>
  [officer.firstName, officer.lastName].filter(Boolean).join(" ").trim() || `Officer #${officer.id}`;

const ratingClassName = (rating: string) => {
  switch (rating?.trim().toLowerCase()) {
    case "excellent":
      return "border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400";
    case "good":
      return "border-blue-500/30 bg-blue-500/10 text-blue-600 dark:text-blue-400";
    case "average":
      return "border-amber-500/30 bg-amber-500/10 text-amber-600 dark:text-amber-400";
    case "poor":
      return "border-destructive/30 bg-destructive/10 text-destructive";
    default:
      return "border-border bg-muted text-muted-foreground";
  }
};

export default function FieldOfficerPerformanceReport({
  officers,
  officersLoading = false,
  officersError,
}: FieldOfficerPerformanceReportProps) {
  const today = useMemo(() => new Date(), []);
  const initialRange = useMemo(() => getPresetRange("THIS_MONTH", today), [today]);
  const [preset, setPreset] = useState<DatePreset>("THIS_MONTH");
  const [startDate, setStartDate] = useState(initialRange.startDate);
  const [endDate, setEndDate] = useState(initialRange.endDate);
  const dateRangeInvalid = isDateRangeInvalid(startDate, endDate);
  const [employeeId, setEmployeeId] = useState("");
  const [city, setCity] = useState("ALL");
  const [teamId, setTeamId] = useState("ALL");
  const [rows, setRows] = useState<FieldOfficerPerformanceDto[]>([]);
  const [hasRun, setHasRun] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const officerOptions = useMemo(
    () => {
      const options = officers.map((officer) => ({
        value: String(officer.id),
        label: `${officerName(officer)}${officer.employeeId ? ` · ${officer.employeeId}` : ""}`,
      }));
      const knownIds = new Set(options.map((option) => option.value));
      rows.forEach((row) => {
        const value = String(row.employeeId);
        if (!knownIds.has(value)) {
          options.push({
            value,
            label: `${row.employeeName || `Officer #${row.employeeId}`}${row.employeeCode ? ` · ${row.employeeCode}` : ""}`,
          });
          knownIds.add(value);
        }
      });
      return options.sort((left, right) => left.label.localeCompare(right.label));
    },
    [officers, rows],
  );

  const cityOptions = useMemo(() => {
    const values = officers.flatMap((officer) => {
      const assignedCities = Array.isArray(officer.assignedCity)
        ? officer.assignedCity.filter((value): value is string => Boolean(value?.trim()))
        : [];
      return assignedCities.length > 0 ? assignedCities : officer.city?.trim() ? [officer.city.trim()] : [];
    });
    values.push(...rows.map((row) => row.city?.trim()).filter((value): value is string => Boolean(value)));
    return Array.from(new Set(values.map((value) => value.trim()))).sort((left, right) => left.localeCompare(right));
  }, [officers, rows]);

  const teamOptions = useMemo(() => {
    const values = officers
      .map((officer) => officer.teamId)
      .filter((value): value is string | number => value !== null && value !== undefined && value !== "");
    values.push(...rows.map((row) => row.teamId).filter((value): value is number => value !== null && value !== undefined));
    return Array.from(new Set(values.map(String))).sort((left, right) => Number(left) - Number(right));
  }, [officers, rows]);

  const sortedRows = useMemo(
    () => [...rows].sort((left, right) => left.employeeName.localeCompare(right.employeeName)),
    [rows],
  );

  const handlePresetChange = (value: DatePreset) => {
    setPreset(value);
    if (value !== "CUSTOM") {
      const range = getPresetRange(value, today);
      setStartDate(range.startDate);
      setEndDate(range.endDate);
    }
  };

  const generateReport = async (event?: FormEvent) => {
    event?.preventDefault();
    if (!startDate || !endDate) {
      setError("Select both start and end dates.");
      return;
    }
    if (dateRangeInvalid) {
      return;
    }

    setIsLoading(true);
    setError(null);
    try {
      const response = await API.getFieldOfficerPerformance({
        startDate,
        endDate,
        employeeId: employeeId ? Number(employeeId) : undefined,
        city: city === "ALL" ? undefined : city,
        teamId: teamId === "ALL" ? undefined : Number(teamId),
      });
      setRows(Array.isArray(response) ? response : []);
      setHasRun(true);
    } catch (requestError) {
      setRows([]);
      setHasRun(true);
      setError(requestError instanceof Error ? requestError.message : "Failed to load field officer performance.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-6">
        <form onSubmit={generateReport} className="space-y-3 border-b pb-4">
          <div className="grid gap-x-4 gap-y-3 sm:grid-cols-2 xl:grid-cols-[minmax(145px,.8fr)_minmax(220px,1.2fr)_minmax(145px,.8fr)_minmax(145px,.8fr)_minmax(180px,1fr)] xl:items-end">
            <div className="min-w-0 space-y-1.5">
              <Label htmlFor="performance-range" className="text-xs font-medium text-foreground">
                Date range
              </Label>
              <Select value={preset} onValueChange={(value: DatePreset) => handlePresetChange(value)}>
                <SelectTrigger id="performance-range" className="h-9 w-full"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="THIS_MONTH">This month</SelectItem>
                  <SelectItem value="LAST_MONTH">Last month</SelectItem>
                  <SelectItem value="LAST_30_DAYS">Last 30 days</SelectItem>
                  <SelectItem value="CUSTOM">Custom range</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="min-w-0 space-y-1.5">
              <Label htmlFor="performance-officer" className="text-xs font-medium text-foreground">
                Field officer
              </Label>
              <SearchableSelect
                triggerId="performance-officer"
                options={officerOptions}
                value={employeeId || undefined}
                onSelect={(option) => setEmployeeId(option?.value || "")}
                placeholder="All field officers"
                searchPlaceholder="Search officers..."
                emptyMessage={officersError || "No officers available"}
                allowClear
                loading={officersLoading}
                triggerClassName="h-9 w-full"
                contentClassName="w-[min(400px,calc(100vw-2rem))]"
              />
            </div>

            <div className="min-w-0 space-y-1.5">
              <Label htmlFor="performance-city" className="text-xs font-medium text-foreground">
                City
              </Label>
              <Select value={city} onValueChange={setCity} disabled={officersLoading || cityOptions.length === 0}>
                <SelectTrigger id="performance-city" className="h-9 w-full"><SelectValue placeholder="All cities" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">All cities</SelectItem>
                  {cityOptions.map((option) => <SelectItem key={option} value={option}>{formatCityLabel(option)}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            <div className="min-w-0 space-y-1.5">
              <Label htmlFor="performance-team" className="text-xs font-medium text-foreground">
                Team
              </Label>
              <Select value={teamId} onValueChange={setTeamId} disabled={officersLoading || teamOptions.length === 0}>
                <SelectTrigger id="performance-team" className="h-9 w-full"><SelectValue placeholder="All teams" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">All teams</SelectItem>
                  {teamOptions.map((option) => <SelectItem key={option} value={option}>Team {option}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            <Button type="submit" disabled={isLoading || dateRangeInvalid || !startDate || !endDate} className="h-9 w-full whitespace-nowrap font-semibold sm:col-span-2 xl:col-span-1">
              {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
              {isLoading ? "Generating..." : "Generate report"}
            </Button>
          </div>

          {preset === "CUSTOM" && (
            <div className="grid max-w-xl gap-3 border-t pt-3 sm:grid-cols-2">
              <div className="min-w-0 space-y-1.5">
                <Label htmlFor="performance-start-date" className="text-xs font-medium text-foreground">
                  From
                </Label>
                <Input
                  id="performance-start-date"
                  type="date"
                  value={startDate}
                  onChange={(event) => setStartDate(event.target.value)}
                />
              </div>
              <div className="min-w-0 space-y-1.5">
                <Label htmlFor="performance-end-date" className="text-xs font-medium text-foreground">
                  To
                </Label>
                <Input
                  id="performance-end-date"
                  type="date"
                  value={endDate}
                  min={startDate || undefined}
                  onChange={(event) => setEndDate(event.target.value)}
                />
              </div>
            </div>
          )}
          <DateRangeError fromDate={startDate} toDate={endDate} />
        </form>

        {error && (
          <div role="alert" className="flex flex-col justify-between gap-4 rounded-xl border border-destructive/40 bg-destructive/5 p-4 sm:flex-row sm:items-start">
            <div className="flex gap-3">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
              <div>
                <p className="text-sm font-medium">Could not generate report</p>
                <p className="mt-1 text-sm text-muted-foreground">{error}</p>
              </div>
            </div>
            <Button type="button" variant="outline" size="sm" onClick={() => void generateReport()} disabled={isLoading}>
              <RefreshCw className="mr-2 h-4 w-4" />
              Retry
            </Button>
          </div>
        )}

        {isLoading ? (
          <div className="flex min-h-72 items-center justify-center gap-2 rounded-xl border text-sm text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" />
            Loading officer performance...
          </div>
        ) : hasRun && !error && rows.length === 0 ? (
          <div className="flex min-h-72 flex-col items-center justify-center rounded-xl border text-center">
            <Users className="mb-3 h-9 w-9 text-muted-foreground" />
            <p className="font-medium">No performance data found</p>
            <p className="mt-1 max-w-md px-4 text-sm text-muted-foreground">
              No field officer performance matched the selected date range and filters.
            </p>
          </div>
        ) : rows.length > 0 ? (
          <>
            <section className="rounded-xl border p-4 md:p-7">
              <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
                <div>
                  <div className="flex items-center gap-2">
                    <BarChart3 className="h-4 w-4 text-muted-foreground" />
                    <h3 className="font-semibold">Officer Performance Benchmarking</h3>
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Target achievement versus visit completion for {formatDisplayDate(startDate)} to {formatDisplayDate(endDate)}.
                  </p>
                </div>
                <div className="flex flex-wrap gap-x-5 gap-y-2 text-xs font-medium text-muted-foreground">
                  <span className="flex items-center gap-2">
                    <span className="h-2.5 w-2.5 rounded-sm bg-teal-500" />
                    Target achievement
                  </span>
                  <span className="flex items-center gap-2">
                    <span className="h-2.5 w-2.5 rounded-sm bg-emerald-500" />
                    Visit completion
                  </span>
                </div>
              </div>

              <div className="mt-7 overflow-x-auto pb-2">
                <div className="flex min-w-max">
                  <div className="w-12 shrink-0 pr-3">
                    <div className="flex h-[220px] flex-col justify-between text-right text-[11px] font-semibold text-muted-foreground">
                      <span>100%</span>
                      <span>75%</span>
                      <span>50%</span>
                      <span>25%</span>
                      <span>0%</span>
                    </div>
                  </div>

                  <div style={{ minWidth: `${Math.max(640, sortedRows.length * 132)}px` }}>
                    <div className="relative h-[220px] border-b-2 border-border">
                      {["top-0", "top-1/4", "top-1/2", "top-3/4"].map((position) => (
                        <div key={position} className={`pointer-events-none absolute inset-x-0 ${position} border-t border-border/60`} />
                      ))}
                      <div className="relative z-10 flex h-full items-end justify-around">
                        {sortedRows.map((row) => {
                          const achievement = boundedPercent(row.achievementPercent);
                          const completion = boundedPercent(row.completionRate);
                          return (
                            <div key={row.employeeId} className="flex h-full min-w-[120px] flex-1 items-end justify-center gap-2 px-3">
                              <div
                                tabIndex={0}
                                role="img"
                                aria-label={`${row.employeeName} target achievement ${formatMetric(row.achievementPercent)} percent`}
                                className="group relative w-5 rounded-t bg-gradient-to-t from-teal-700 to-teal-400 outline-none transition-[height,filter] duration-500 hover:brightness-110 focus-visible:ring-2 focus-visible:ring-teal-500"
                                style={{ height: `${achievement}%`, minHeight: "4px" }}
                              >
                                <div className="pointer-events-none absolute bottom-full left-1/2 z-20 mb-2 -translate-x-1/2 rounded-lg bg-foreground px-3 py-2 text-center text-xs text-background opacity-0 shadow-lg transition-opacity group-hover:opacity-100 group-focus:opacity-100">
                                  <span className="block whitespace-nowrap text-[10px] uppercase opacity-70">Target achievement</span>
                                  <strong className="whitespace-nowrap">
                                    {formatMetric(row.achievementPercent)}% ({formatMetric(row.achievedValue)} / {formatMetric(row.targetValue)})
                                  </strong>
                                </div>
                              </div>
                              <div
                                tabIndex={0}
                                role="img"
                                aria-label={`${row.employeeName} visit completion ${formatMetric(row.completionRate)} percent`}
                                className="group relative w-5 rounded-t bg-gradient-to-t from-emerald-700 to-emerald-400 outline-none transition-[height,filter] duration-500 hover:brightness-110 focus-visible:ring-2 focus-visible:ring-emerald-500"
                                style={{ height: `${completion}%`, minHeight: "4px" }}
                              >
                                <div className="pointer-events-none absolute bottom-full left-1/2 z-20 mb-2 -translate-x-1/2 rounded-lg bg-foreground px-3 py-2 text-center text-xs text-background opacity-0 shadow-lg transition-opacity group-hover:opacity-100 group-focus:opacity-100">
                                  <span className="block whitespace-nowrap text-[10px] uppercase opacity-70">Visit completion</span>
                                  <strong className="whitespace-nowrap">
                                    {formatMetric(row.completionRate)}% ({formatMetric(row.completedVisits)} / {formatMetric(row.totalVisits)})
                                  </strong>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                    <div className="flex justify-around pt-3">
                      {sortedRows.map((row) => (
                        <div key={row.employeeId} className="min-w-[120px] flex-1 px-2 text-center">
                          <p className="truncate text-xs font-semibold" title={row.employeeName}>{row.employeeName || `Officer #${row.employeeId}`}</p>
                          <p
                            className="mt-0.5 truncate text-[10px] text-muted-foreground"
                            title={`ID: ${row.employeeCode || row.employeeId}`}
                          >
                            ID: {row.employeeCode || row.employeeId}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </section>

            <section className="space-y-4">
              <div>
                <h3 className="font-semibold">Officer-Wise Totals</h3>
                <p className="mt-1 text-sm text-muted-foreground">Detailed performance, store coverage, and attendance summary.</p>
              </div>
              <div className="overflow-x-auto rounded-xl border">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/30 hover:bg-muted/30">
                      <TableHead className="min-w-60 text-xs font-semibold uppercase tracking-wider">Field officer</TableHead>
                      <TableHead className="text-xs font-semibold uppercase tracking-wider">Rating</TableHead>
                      <TableHead className="min-w-64 text-xs font-semibold uppercase tracking-wider">Target achievement</TableHead>
                      <TableHead className="min-w-64 text-xs font-semibold uppercase tracking-wider">Visit completion</TableHead>
                      <TableHead className="min-w-32 text-xs font-semibold uppercase tracking-wider">Stores visited</TableHead>
                      <TableHead className="min-w-64 text-xs font-semibold uppercase tracking-wider">Attendance summary</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {sortedRows.map((row) => (
                      <TableRow key={row.employeeId}>
                        <TableCell>
                          <div className="flex items-center gap-3">
                            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border bg-primary/10 text-xs font-bold text-primary">
                              {getInitials(row.employeeName)}
                            </div>
                            <div className="min-w-0">
                              <div className="font-semibold">{row.employeeName || `Officer #${row.employeeId}`}</div>
                              <div className="mt-0.5 text-xs text-muted-foreground">
                                {[`ID: ${row.employeeCode || row.employeeId}`, row.city, row.teamId ? `Team ${row.teamId}` : null].filter(Boolean).join(" · ")}
                              </div>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className={ratingClassName(row.rating)}>{row.rating || "Not Rated"}</Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-3">
                            <div className="h-1.5 w-24 overflow-hidden rounded-full bg-muted">
                              <div className="h-full rounded-full bg-teal-500" style={{ width: `${boundedPercent(row.achievementPercent)}%` }} />
                            </div>
                            <div className="whitespace-nowrap text-sm font-semibold">
                              {formatMetric(row.achievementPercent)}%
                              <span className="ml-1 font-normal text-muted-foreground">({formatMetric(row.achievedValue)} / {formatMetric(row.targetValue)})</span>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-3">
                            <div className="h-1.5 w-24 overflow-hidden rounded-full bg-muted">
                              <div className="h-full rounded-full bg-emerald-500" style={{ width: `${boundedPercent(row.completionRate)}%` }} />
                            </div>
                            <div className="whitespace-nowrap text-sm font-semibold">
                              {formatMetric(row.completionRate)}%
                              <span className="ml-1 font-normal text-muted-foreground">({formatMetric(row.completedVisits)} / {formatMetric(row.totalVisits)})</span>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="font-semibold">{formatMetric(row.uniqueStoresVisited)} visited</div>
                          <div className="mt-0.5 text-xs text-muted-foreground">{formatMetric(row.newStores)} new stores</div>
                        </TableCell>
                        <TableCell>
                          <div className="grid grid-cols-4 gap-2">
                            {[
                              { label: "PR", title: "Present days", value: row.presentDays },
                              { label: "FL", title: "Full days", value: row.fullDays },
                              { label: "HL", title: "Half days", value: row.halfDays },
                              { label: "AB", title: "Absent days", value: row.absences },
                            ].map((item) => (
                              <div key={item.label} title={item.title} className="min-w-11 rounded-md border bg-background px-2 py-1.5 text-center">
                                <span className="block text-[10px] font-semibold uppercase text-muted-foreground">{item.label}</span>
                                <strong className={item.label === "AB" ? "text-sm text-destructive" : "text-sm"}>{formatMetric(item.value)}</strong>
                              </div>
                            ))}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </section>
          </>
        ) : !error ? (
          <div className="flex min-h-72 flex-col items-center justify-center rounded-xl border border-dashed text-center">
            <BarChart3 className="mb-3 h-9 w-9 text-muted-foreground" />
            <p className="font-medium">Ready to generate performance analytics</p>
            <p className="mt-1 max-w-md px-4 text-sm text-muted-foreground">
              Choose a date range or filters, then generate the report to compare field officers.
            </p>
          </div>
        ) : null}
    </div>
  );
}
