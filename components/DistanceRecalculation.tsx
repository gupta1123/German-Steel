"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { format } from "date-fns";
import {
  CalendarIcon,
  Check,
  Loader2,
  Route,
  Users,
  X,
} from "lucide-react";

import { API, type DailyBreakdownDto, type EmployeeUserDto } from "@/lib/api";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { SpacedCalendar } from "@/components/ui/spaced-calendar";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";

type EmployeeDirectoryEntry = EmployeeUserDto & {
  status?: string;
};

const getEmployeeDisplayName = (employee: EmployeeDirectoryEntry): string => {
  const primary = [employee.firstName, employee.lastName].filter(Boolean).join(" ").trim();
  const secondary = employee.userDto
    ? [employee.userDto.firstName, employee.userDto.lastName].filter(Boolean).join(" ").trim()
    : "";
  return primary || secondary || employee.userName || employee.email || `Employee ${employee.id}`;
};

const getEmployeeMeta = (employee: EmployeeDirectoryEntry): string => {
  const employeeCode = employee.employeeId ?? employee.userDto?.employeeId ?? null;
  const role = employee.role?.trim();
  return [employeeCode ? `ID ${employeeCode}` : null, role || null].filter(Boolean).join(" • ");
};

const formatDateInput = (date: Date | undefined): string => (date ? format(date, "yyyy-MM-dd") : "");

const formatCurrency = (amount: number): string =>
  new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR" }).format(amount);

const getDisplayDistanceKm = (row: DailyBreakdownDto): number => {
  const positiveCar = row.carDistanceKm > 0 ? row.carDistanceKm : 0;
  const positiveBike = row.bikeDistanceKm > 0 ? row.bikeDistanceKm : 0;
  return positiveCar + positiveBike;
};

export default function DistanceRecalculation() {
  const searchParams = useSearchParams();
  const searchParamsKey = searchParams.toString();
  const today = new Date();
  const firstOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);

  const [employees, setEmployees] = useState<EmployeeDirectoryEntry[]>([]);
  const [isLoadingEmployees, setIsLoadingEmployees] = useState(false);
  const [employeeSearch, setEmployeeSearch] = useState("");
  const [selectedEmployeeIds, setSelectedEmployeeIds] = useState<number[]>([]);
  const [isEmployeePickerOpen, setIsEmployeePickerOpen] = useState(false);

  const [startDate, setStartDate] = useState(format(firstOfMonth, "yyyy-MM-dd"));
  const [endDate, setEndDate] = useState(format(today, "yyyy-MM-dd"));
  const [isStartDatePopoverOpen, setIsStartDatePopoverOpen] = useState(false);
  const [isEndDatePopoverOpen, setIsEndDatePopoverOpen] = useState(false);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isRefreshingVerification, setIsRefreshingVerification] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [responseText, setResponseText] = useState("");
  const [verificationRows, setVerificationRows] = useState<DailyBreakdownDto[]>([]);
  const [, setVerificationErrors] = useState<string[]>([]);

  const fetchEmployees = useCallback(async () => {
    setIsLoadingEmployees(true);
    try {
      const data = await API.getAllEmployees();
      const sorted = [...data].sort((a, b) =>
        getEmployeeDisplayName(a as EmployeeDirectoryEntry).localeCompare(getEmployeeDisplayName(b as EmployeeDirectoryEntry))
      );
      setEmployees(sorted as EmployeeDirectoryEntry[]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load employees.");
    } finally {
      setIsLoadingEmployees(false);
    }
  }, []);

  useEffect(() => {
    fetchEmployees();
  }, [fetchEmployees]);

  useEffect(() => {
    const currentParams = new URLSearchParams(searchParamsKey);
    const queryStartDate = currentParams.get("startDate");
    const queryEndDate = currentParams.get("endDate");
    const queryEmployeeIds = currentParams.get("employeeIds") ?? currentParams.get("employeeId");

    if (queryStartDate) {
      setStartDate(queryStartDate);
    }

    if (queryEndDate) {
      setEndDate(queryEndDate);
    }

    if (queryEmployeeIds) {
      const parsedEmployeeIds = Array.from(
        new Set(
          queryEmployeeIds
            .split(",")
            .map((value) => Number.parseInt(value.trim(), 10))
            .filter((value) => Number.isFinite(value))
        )
      );

      if (parsedEmployeeIds.length > 0) {
        setSelectedEmployeeIds(parsedEmployeeIds);
      }
    }

    if (queryStartDate || queryEndDate || queryEmployeeIds) {
      setError(null);
      setResponseText("");
      setVerificationRows([]);
      setVerificationErrors([]);
    }
  }, [searchParamsKey]);

  const filteredEmployees = useMemo(() => {
    const normalizedSearch = employeeSearch.trim().toLowerCase();
    if (!normalizedSearch) return employees;
    return employees.filter((employee) => {
      const haystack = [
        getEmployeeDisplayName(employee),
        getEmployeeMeta(employee),
        employee.email,
        employee.userName,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return haystack.includes(normalizedSearch);
    });
  }, [employeeSearch, employees]);

  const selectedEmployees = useMemo(() => {
    const selectedSet = new Set(selectedEmployeeIds);
    return employees.filter((employee) => selectedSet.has(employee.id));
  }, [employees, selectedEmployeeIds]);

  const selectedEmployeeLabel = useMemo(() => {
    if (selectedEmployees.length === 0) return "Select employees";
    if (selectedEmployees.length === 1) return getEmployeeDisplayName(selectedEmployees[0]);
    return `${selectedEmployees.length} employees selected`;
  }, [selectedEmployees]);

  const verificationSummaries = useMemo(() => {
    return selectedEmployees.map((employee) => {
      const rows = verificationRows.filter((row) => row.employeeId === employee.id);
      const totalDistanceKm = rows.reduce((sum, row) => sum + getDisplayDistanceKm(row), 0);
      const totalTravelAllowance = rows.reduce((sum, row) => sum + row.travelAllowance, 0);
      return {
        employeeId: employee.id,
        employeeName: getEmployeeDisplayName(employee),
        rowCount: rows.length,
        totalDistanceKm,
        totalTravelAllowance,
      };
    });
  }, [selectedEmployees, verificationRows]);

  const calculationTotals = useMemo(() => {
    return verificationSummaries.reduce(
      (totals, summary) => ({
        rowCount: totals.rowCount + summary.rowCount,
        totalDistanceKm: totals.totalDistanceKm + summary.totalDistanceKm,
        totalTravelAllowance: totals.totalTravelAllowance + summary.totalTravelAllowance,
      }),
      { rowCount: 0, totalDistanceKm: 0, totalTravelAllowance: 0 }
    );
  }, [verificationSummaries]);

  const hasMultipleEmployeeResults = verificationSummaries.length > 1;

  const toggleEmployee = (employeeId: number) => {
    setSelectedEmployeeIds((prev) =>
      prev.includes(employeeId) ? prev.filter((id) => id !== employeeId) : [...prev, employeeId]
    );
  };

  const selectVisibleEmployees = () => {
    setSelectedEmployeeIds((prev) => {
      const next = new Set(prev);
      filteredEmployees.forEach((employee) => next.add(employee.id));
      return Array.from(next);
    });
  };

  const clearSelectedEmployees = () => {
    setSelectedEmployeeIds([]);
  };

  const refreshVerification = useCallback(async (employeeIds: number[], rangeStart: string, rangeEnd: string) => {
    if (employeeIds.length === 0) {
      setVerificationRows([]);
      setVerificationErrors([]);
      return;
    }

    setIsRefreshingVerification(true);

    try {
      const selectedSet = new Set(employeeIds);
      const selectedEmployeesSnapshot = employees.filter((employee) => selectedSet.has(employee.id));
      const results = await Promise.allSettled(
        selectedEmployeesSnapshot.map(async (employee) => {
          const rows = await API.getDailyBreakdown(employee.id, rangeStart, rangeEnd);
          return { employee, rows };
        })
      );

      const nextRows: DailyBreakdownDto[] = [];
      const nextErrors: string[] = [];

      results.forEach((result, index) => {
        if (result.status === "fulfilled") {
          nextRows.push(...result.value.rows);
        } else {
          const employee = selectedEmployeesSnapshot[index];
          nextErrors.push(
            `${employee ? getEmployeeDisplayName(employee) : `Employee ${index + 1}`}: ${
              result.reason instanceof Error ? result.reason.message : "Failed to load daily breakdown."
            }`
          );
        }
      });

      setVerificationRows(nextRows);
      setVerificationErrors(nextErrors);
    } finally {
      setIsRefreshingVerification(false);
    }
  }, [employees]);

  const handleRecalculate = async () => {
    if (selectedEmployeeIds.length === 0) {
      setError("Select at least one employee.");
      return;
    }

    if (!startDate || !endDate) {
      setError("Select both start and end date.");
      return;
    }

    if (startDate > endDate) {
      setError("Start date cannot be after end date.");
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const text = await API.recalculateDistanceForEmployeesWithOlaMaps(selectedEmployeeIds, startDate, endDate);
      setResponseText(text);
      await refreshVerification(selectedEmployeeIds, startDate, endDate);
    } catch {
      setError("Distance recalculation could not be completed. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <Card className="border-0 shadow-sm bg-background">
        <CardHeader className="pb-4">
          <CardTitle className="text-xl md:text-2xl font-semibold">Distance Recalculation</CardTitle>
          <p className="text-sm text-muted-foreground">
            Recalculate stored travelled distance using Ola Maps for a selected employee batch and date range.
          </p>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-1 gap-4 rounded-xl border bg-muted/30 p-3 sm:p-4 md:grid-cols-3">
            <div className="space-y-2">
              <Label className="text-xs font-semibold uppercase text-muted-foreground">Employees</Label>
              <Popover open={isEmployeePickerOpen} onOpenChange={setIsEmployeePickerOpen}>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="w-full justify-between bg-card">
                    <span className="truncate text-left">{selectedEmployeeLabel}</span>
                    <Users className="h-4 w-4 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[calc(100vw-2rem)] p-0 sm:w-[360px]" align="start">
                  <div className="border-b p-2">
                    <Input
                      value={employeeSearch}
                      onChange={(event) => setEmployeeSearch(event.target.value)}
                      placeholder="Search..."
                      className="h-8"
                    />
                    <div className="mt-2 flex items-center justify-between gap-2">
                      <Button variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={selectVisibleEmployees}>
                        Select Visible
                      </Button>
                      <Button variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={clearSelectedEmployees}>
                        Clear All
                      </Button>
                    </div>
                  </div>
                  <ScrollArea className="h-60">
                    <div className="p-1">
                      {isLoadingEmployees ? (
                        <div className="flex items-center justify-center gap-2 py-8 text-sm text-muted-foreground">
                          <Loader2 className="h-4 w-4 animate-spin" />
                          Loading employees...
                        </div>
                      ) : filteredEmployees.length === 0 ? (
                        <div className="py-8 text-center text-sm text-muted-foreground">No employees found.</div>
                      ) : (
                        filteredEmployees.map((employee) => {
                          const checked = selectedEmployeeIds.includes(employee.id);
                          const employeeMeta = getEmployeeMeta(employee);
                          return (
                            <div
                              key={employee.id}
                              role="checkbox"
                              aria-checked={checked}
                              tabIndex={0}
                              onClick={() => toggleEmployee(employee.id)}
                              onKeyDown={(event) => {
                                if (event.key === "Enter" || event.key === " ") {
                                  event.preventDefault();
                                  toggleEmployee(employee.id);
                                }
                              }}
                              className={cn(
                                "flex w-full cursor-pointer items-start justify-between gap-2 rounded px-2 py-1.5 text-left transition-colors hover:bg-muted focus:outline-none focus:ring-2 focus:ring-ring",
                                checked && "bg-muted font-medium"
                              )}
                            >
                              <div className="flex min-w-0 flex-1 items-start gap-2">
                                <Checkbox
                                  checked={checked}
                                  onCheckedChange={() => toggleEmployee(employee.id)}
                                  className="pointer-events-none mt-0.5"
                                />
                                <div className="min-w-0">
                                  <div className="truncate text-sm">{getEmployeeDisplayName(employee)}</div>
                                  {employeeMeta && (
                                    <div className="truncate text-xs text-muted-foreground">{employeeMeta}</div>
                                  )}
                                </div>
                              </div>
                              <span className="ml-2 shrink-0 rounded p-1 text-muted-foreground">
                                {checked ? <Check className="h-4 w-4 text-primary" /> : <span className="block h-4 w-4" />}
                              </span>
                            </div>
                          );
                        })
                      )}
                    </div>
                  </ScrollArea>
                </PopoverContent>
              </Popover>
              {selectedEmployees.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {selectedEmployees.map((employee) => (
                    <Badge key={employee.id} variant="secondary" className="h-6 gap-1 px-2 text-xs font-normal">
                      <span className="max-w-36 truncate">{getEmployeeDisplayName(employee)}</span>
                      <button
                        type="button"
                        onClick={() => toggleEmployee(employee.id)}
                        className="rounded-full p-0.5 transition hover:bg-foreground/10"
                        aria-label={`Remove ${getEmployeeDisplayName(employee)}`}
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </Badge>
                  ))}
                </div>
              )}
            </div>

            <div className="space-y-2">
              <Label className="text-xs font-semibold uppercase text-muted-foreground">Start Date</Label>
              <Popover open={isStartDatePopoverOpen} onOpenChange={setIsStartDatePopoverOpen}>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="w-full justify-start bg-card text-left font-normal">
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {startDate ? format(new Date(startDate), "MMM d, yyyy") : "Select date"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <SpacedCalendar
                    mode="single"
                    selected={startDate ? new Date(startDate) : undefined}
                    onSelect={(date) => {
                      setStartDate(formatDateInput(date));
                      setIsStartDatePopoverOpen(false);
                    }}
                  />
                </PopoverContent>
              </Popover>
            </div>

            <div className="space-y-2">
              <Label className="text-xs font-semibold uppercase text-muted-foreground">End Date</Label>
              <Popover open={isEndDatePopoverOpen} onOpenChange={setIsEndDatePopoverOpen}>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="w-full justify-start bg-card text-left font-normal">
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {endDate ? format(new Date(endDate), "MMM d, yyyy") : "Select date"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <SpacedCalendar
                    mode="single"
                    selected={endDate ? new Date(endDate) : undefined}
                    onSelect={(date) => {
                      setEndDate(formatDateInput(date));
                      setIsEndDatePopoverOpen(false);
                    }}
                  />
                </PopoverContent>
              </Popover>
            </div>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row">
            <Button
              onClick={handleRecalculate}
              disabled={isSubmitting || isRefreshingVerification || selectedEmployeeIds.length === 0}
              className="w-full sm:w-auto sm:min-w-56"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Recalculating...
                </>
              ) : (
                <>
                  <Route className="mr-2 h-4 w-4" />
                  Recalculate Distance
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      {error && (
        <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      )}

      {(responseText || isSubmitting || isRefreshingVerification || verificationSummaries.length > 0) && (
        <Card className="border-0 shadow-sm bg-background">
          <CardHeader className="pb-4">
            <CardTitle className="text-lg font-semibold">Calculated Amount</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {isSubmitting || isRefreshingVerification ? (
              <div className="flex items-center justify-center gap-2 py-10 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Calculating amount...
              </div>
            ) : verificationSummaries.length > 0 ? (
              <>
                {hasMultipleEmployeeResults ? (
                  <div className="overflow-x-auto rounded-xl border">
                    <Table className="min-w-[640px]">
                      <TableHeader>
                        <TableRow className="bg-muted/50">
                          <TableHead className="w-14">#</TableHead>
                          <TableHead>Employee</TableHead>
                          <TableHead className="text-right">Days</TableHead>
                          <TableHead className="text-right">Distance</TableHead>
                          <TableHead className="text-right">Amount</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {verificationSummaries.map((summary, index) => (
                          <TableRow key={summary.employeeId}>
                            <TableCell className="text-muted-foreground">{index + 1}</TableCell>
                            <TableCell className="font-medium">{summary.employeeName}</TableCell>
                            <TableCell className="text-right">{summary.rowCount}</TableCell>
                            <TableCell className="text-right">{summary.totalDistanceKm.toFixed(1)} km</TableCell>
                            <TableCell className="text-right font-medium">{formatCurrency(summary.totalTravelAllowance)}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                ) : (
                  <>
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
                      <div className="rounded-xl border bg-muted/20 p-3 sm:p-4">
                        <div className="text-xs font-medium uppercase text-muted-foreground">Total Amount</div>
                        <div className="mt-2 text-xl font-semibold sm:text-2xl">{formatCurrency(calculationTotals.totalTravelAllowance)}</div>
                      </div>
                      <div className="rounded-xl border bg-muted/20 p-3 sm:p-4">
                        <div className="text-xs font-medium uppercase text-muted-foreground">Total Distance</div>
                        <div className="mt-2 text-xl font-semibold sm:text-2xl">{calculationTotals.totalDistanceKm.toFixed(1)} km</div>
                      </div>
                      <div className="rounded-xl border bg-muted/20 p-3 sm:p-4">
                        <div className="text-xs font-medium uppercase text-muted-foreground">Employees</div>
                        <div className="mt-2 text-xl font-semibold sm:text-2xl">{verificationSummaries.length}</div>
                      </div>
                      <div className="rounded-xl border bg-muted/20 p-3 sm:p-4">
                        <div className="text-xs font-medium uppercase text-muted-foreground">Days Included</div>
                        <div className="mt-2 text-xl font-semibold sm:text-2xl">{calculationTotals.rowCount}</div>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
                      {verificationSummaries.map((summary) => (
                        <div key={summary.employeeId} className="rounded-xl border bg-muted/20 p-4">
                          <div className="mb-4">
                            <div className="font-medium">{summary.employeeName}</div>
                            <div className="text-xs text-muted-foreground">{summary.rowCount} day rows calculated</div>
                          </div>
                          <div className="grid grid-cols-2 gap-3 text-sm">
                            <div>
                              <div className="text-muted-foreground">Distance</div>
                              <div className="font-medium">{summary.totalDistanceKm.toFixed(1)} km</div>
                            </div>
                            <div>
                              <div className="text-muted-foreground">Amount</div>
                              <div className="font-medium">{formatCurrency(summary.totalTravelAllowance)}</div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </>
            ) : (
              <div className="rounded-lg border bg-muted/20 px-4 py-3 text-sm text-muted-foreground">
                Recalculation completed. Calculated amount will appear here when verification data is available.
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
