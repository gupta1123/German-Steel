"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  eachMonthOfInterval,
  format,
  parse,
  subMonths,
} from "date-fns";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { useAuth } from "@/components/auth-provider";
import DashboardLayout from "@/components/dashboard-layout";
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { AlertCircle, ChevronDown } from "lucide-react";
import { API } from "@/lib/api";

type ReportRow = {
  employeeName: string;
  newStoreCount: number;
  visitCount?: number | null;
  storeCountDto?: Array<{
    storeId: number;
    visitCount: number;
    storeName: string;
    employeeId?: number | null;
    employeeName?: string | null;
  }>;
};

type EmployeeOption = {
  value: number;
  label: string;
};

type MonthReport = Record<string, ReportRow[]>;

type MultiSelectProps = {
  label: string;
  placeholder: string;
  options: EmployeeOption[];
  selected: EmployeeOption[];
  onChange: (next: EmployeeOption[]) => void;
};

const COLORS = [
  "#2563eb",
  "#16a34a",
  "#dc2626",
  "#7c3aed",
  "#ea580c",
  "#0891b2",
  "#d946ef",
  "#0ea5e9",
  "#f97316",
  "#22d3ee",
  "#facc15",
  "#14b8a6",
];

function EmployeeMultiSelect({
  label,
  placeholder,
  options,
  selected,
  onChange,
}: MultiSelectProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");

  const selectedIds = useMemo(
    () => new Set(selected.map((item) => item.value)),
    [selected],
  );

  const filteredOptions = useMemo(() => {
    const lower = query.trim().toLowerCase();
    if (!lower) return options;
    return options.filter((option) =>
      option.label.toLowerCase().includes(lower),
    );
  }, [options, query]);

  const toggleOption = (option: EmployeeOption, checked: boolean) => {
    if (checked) {
      onChange([...selected, option]);
      return;
    }
    onChange(selected.filter((item) => item.value !== option.value));
  };

  return (
    <div className="space-y-2">
      <p className="text-sm font-medium text-muted-foreground">{label}</p>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            className={cn(
              "w-full justify-between",
              selected.length === 0 && "text-muted-foreground",
            )}
          >
            {selected.length > 0
              ? `${selected.length} selected`
              : placeholder}
            <ChevronDown className="h-4 w-4 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-72 p-0" align="start">
          <div className="p-2">
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search..."
            />
          </div>
          <div className="max-h-60 overflow-y-auto px-2 pb-2">
            {filteredOptions.length === 0 ? (
              <p className="py-4 text-center text-sm text-muted-foreground">
                No results
              </p>
            ) : (
              filteredOptions.map((option) => {
                return (
                  <label
                    key={option.value}
                    className={cn(
                      "flex cursor-pointer items-center gap-3 rounded-md px-2 py-1.5 text-sm transition-colors",
                      "hover:bg-muted",
                    )}
                  >
                    <Checkbox
                      checked={selectedIds.has(option.value)}
                      onCheckedChange={(checked) => {
                        toggleOption(option, checked === true);
                      }}
                    />
                    <span className="truncate">{option.label}</span>
                  </label>
                );
              })
            )}
          </div>
        </PopoverContent>
      </Popover>
      {selected.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {selected.map((item) => (
            <Badge
              key={item.value}
              variant="secondary"
              className="flex items-center gap-1"
            >
              <span>{item.label}</span>
              <button
                type="button"
                className="text-xs text-muted-foreground transition hover:text-foreground"
                onClick={() =>
                  onChange(
                    selected.filter((option) => option.value !== item.value),
                  )
                }
              >
                ×
              </button>
            </Badge>
          ))}
        </div>
      )}
    </div>
  );
}

type Performer = {
  name: string;
  count: number;
};

type PerformerBuckets = {
  topPerformers: Performer[];
  bottomPerformers: Performer[];
  allPerformers: Performer[];
};

export default function Report2Page() {
  const { token } = useAuth();

  const [employees, setEmployees] = useState<EmployeeOption[]>([]);
  const [selectedEmployees, setSelectedEmployees] = useState<EmployeeOption[]>(
    [],
  );
  const [excludedEmployees, setExcludedEmployees] = useState<EmployeeOption[]>(
    [],
  );
  const [reportData, setReportData] = useState<MonthReport>({});
  const [startDate, setStartDate] = useState<string>(() =>
    format(subMonths(new Date(), 2), "yyyy-MM-dd"),
  );
  const [endDate, setEndDate] = useState<string>(() =>
    format(new Date(), "yyyy-MM-dd"),
  );
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showTopPerformers, setShowTopPerformers] = useState(true);
  const [isAutoSelect, setIsAutoSelect] = useState(true);

  const fetchEmployees = useCallback(async () => {
    if (!token) return;
    try {
      const data = await API.getAllEmployees<{
        id: number;
        firstName?: string;
        lastName?: string;
        role?: string;
      }>();

      const fieldOfficers = data
        .filter((employee) => employee.role === "Field Officer")
        .map((employee) => ({
          value: employee.id,
          label: `${employee.firstName ?? ""} ${employee.lastName ?? ""}`
            .trim()
            .replace(/\s+/g, " ")
            .trim() || `Employee ${employee.id}`,
        }))
        .sort((a, b) => a.label.localeCompare(b.label));

      setEmployees(fieldOfficers);
    } catch (err) {
      console.error("Failed to fetch employees:", err);
      setError("Unable to load employees. Please refresh the page.");
    }
  }, [token]);

  const fetchReportData = useCallback(async () => {
    if (!token || !startDate || !endDate) return;
    setIsLoading(true);
    setError(null);

    try {
      const start = parse(startDate, "yyyy-MM-dd", new Date());
      const end = parse(endDate, "yyyy-MM-dd", new Date());

      if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
        throw new Error("Please select valid start and end dates.");
      }

      if (start > end) {
        throw new Error("Start date must be before end date.");
      }

      const months = eachMonthOfInterval({ start, end });

      // Clear existing data so UI reflects the new range while loading
      setReportData({});

      const grouped = await API.getReportForEmployeeRange<ReportRow>(startDate, endDate);
      const normalized = Object.fromEntries(
        months.map((month) => {
          const label = format(month, "MMMM yyyy");
          const rows = Array.isArray(grouped[label]) ? grouped[label] : [];
          return [
            label,
            rows.filter((row) => row.newStoreCount > 0 || (row.storeCountDto?.length ?? 0) > 0),
          ];
        }),
      );
      setReportData(normalized);
    } catch (err) {
      console.error("Failed to load report:", err);
      setError(
        err instanceof Error ? err.message : "Failed to load report data.",
      );
      setReportData({});
    } finally {
      setIsLoading(false);
    }
  }, [token, startDate, endDate]);

  useEffect(() => {
    fetchEmployees();
  }, [fetchEmployees]);

  useEffect(() => {
    fetchReportData();
  }, [fetchReportData]);

  useEffect(() => {
    setSelectedEmployees((current) =>
      current.filter(
        (employee) =>
          !excludedEmployees.some((excluded) => excluded.value === employee.value),
      ),
    );
  }, [excludedEmployees]);

  const filteredReportData = useMemo(() => {
    if (Object.keys(reportData).length === 0) return {};
    const excludedNames = new Set(excludedEmployees.map((item) => item.label));
    return Object.fromEntries(
      Object.entries(reportData).map(([month, rows]) => [
        month,
        rows.filter((row) => !excludedNames.has(row.employeeName)),
      ]),
    );
  }, [reportData, excludedEmployees]);

  const performerBuckets: PerformerBuckets = useMemo(() => {
    const aggregated = Object.values(filteredReportData)
      .flat()
      .reduce<Record<string, number>>((acc, row) => {
        acc[row.employeeName] = (acc[row.employeeName] ?? 0) + row.newStoreCount;
        return acc;
      }, {});

    const sorted = Object.entries(aggregated)
      .sort(([, a], [, b]) => b - a)
      .map<Performer>(([name, count]) => ({ name, count }));

    return {
      topPerformers: sorted.slice(0, 5),
      bottomPerformers: sorted.slice(-5).reverse(),
      allPerformers: sorted,
    };
  }, [filteredReportData]);

  useEffect(() => {
    if (!isAutoSelect) return;
    const pool = showTopPerformers
      ? performerBuckets.topPerformers
      : performerBuckets.bottomPerformers;

    if (pool.length === 0) {
      setSelectedEmployees([]);
      return;
    }

    const selected = pool
      .map((performer) =>
        employees.find((employee) => employee.label === performer.name),
      )
      .filter((item): item is EmployeeOption => Boolean(item))
      .filter(
        (employee) =>
          !excludedEmployees.some(
            (excluded) => excluded.value === employee.value,
          ),
      );

    if (selected.length === 0) {
      setSelectedEmployees([]);
      return;
    }

    const alreadySelectedIds = new Set(selected.map((item) => item.value));
    const ranking = performerBuckets.allPerformers.map((performer) => performer.name);

    const fallback = employees
      .filter(
        (employee) =>
          !alreadySelectedIds.has(employee.value) &&
          !excludedEmployees.some((excluded) => excluded.value === employee.value),
      )
      .sort((a, b) => {
        const aIndex = ranking.indexOf(a.label);
        const bIndex = ranking.indexOf(b.label);
        if (aIndex === -1 && bIndex === -1) return a.label.localeCompare(b.label);
        if (aIndex === -1) return 1;
        if (bIndex === -1) return -1;
        return showTopPerformers ? aIndex - bIndex : bIndex - aIndex;
      });

    const combined = [...selected];
    for (const candidate of fallback) {
      if (combined.length >= 5) break;
      combined.push(candidate);
    }

    setSelectedEmployees(combined);
  }, [
    isAutoSelect,
    showTopPerformers,
    performerBuckets,
    employees,
    excludedEmployees,
  ]);

  const handleEmployeeSelection = (next: EmployeeOption[]) => {
    setSelectedEmployees(next);
    setIsAutoSelect(false);
  };

  const handleExcludedSelection = (next: EmployeeOption[]) => {
    setExcludedEmployees(next);
    if (!isAutoSelect) {
      setSelectedEmployees((current) =>
        current.filter(
          (employee) =>
            !next.some((excluded) => excluded.value === employee.value),
        ),
      );
    }
  };

  const months = useMemo(() => {
    const labels = Object.keys(filteredReportData);
    return labels.sort((a, b) => {
      const parsedA = parse(a, "MMMM yyyy", new Date());
      const parsedB = parse(b, "MMMM yyyy", new Date());
      return parsedA.getTime() - parsedB.getTime();
    });
  }, [filteredReportData]);

  const chartData = useMemo(() => {
    if (months.length === 0 || selectedEmployees.length === 0) return [];
    return months.map((month) => {
      const base: Record<string, number | string> = { month };
      const rows = filteredReportData[month] ?? [];
      selectedEmployees.forEach((employee) => {
        const entry = rows.find(
          (row) => row.employeeName === employee.label,
        );
        base[employee.label] = entry?.newStoreCount ?? 0;
      });
      return base;
    });
  }, [months, filteredReportData, selectedEmployees]);

  const getTotalNewCustomers = (employeeName: string) =>
    Object.values(filteredReportData).reduce((total, rows) => {
      const entry = rows.find((row) => row.employeeName === employeeName);
      return total + (entry?.newStoreCount ?? 0);
    }, 0);

  const pageContent = (
    <div className="flex w-full max-w-5xl flex-col gap-6 px-4 py-8 lg:max-w-4xl xl:max-w-5xl">
      <Card className="shadow-md">
        <CardHeader>
          <CardTitle>New Customers Report</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid gap-6 md:grid-cols-2">
            <div className="space-y-2">
              <p className="text-sm font-medium text-muted-foreground">
                Date Range
              </p>
              <div className="grid gap-2 sm:grid-cols-2">
                <Input
                  type="date"
                  value={startDate}
                  onChange={(event) => {
                    setStartDate(event.target.value);
                    setIsAutoSelect(true);
                  }}
                />
                <Input
                  type="date"
                  value={endDate}
                  onChange={(event) => {
                    setEndDate(event.target.value);
                    setIsAutoSelect(true);
                  }}
                />
              </div>
            </div>
            <div className="flex flex-col gap-2">
              <p className="text-sm font-medium text-muted-foreground">
                Quick Filters
              </p>
              <div className="flex flex-wrap gap-2">
                <Button
                  size="sm"
                  variant={
                    showTopPerformers && isAutoSelect ? "default" : "outline"
                  }
                  onClick={() => {
                    setShowTopPerformers(true);
                    setIsAutoSelect(true);
                  }}
                >
                  Top 5 Performers
                </Button>
                <Button
                  size="sm"
                  variant={
                    !showTopPerformers && isAutoSelect ? "default" : "outline"
                  }
                  onClick={() => {
                    setShowTopPerformers(false);
                    setIsAutoSelect(true);
                  }}
                >
                  Bottom 5 Performers
                </Button>
                <Button
                  size="sm"
                  onClick={() => {
                    fetchReportData();
                    setIsAutoSelect(true);
                  }}
                >
                  Refresh Data
                </Button>
              </div>
            </div>
          </div>

          <EmployeeMultiSelect
            label="Select Employees"
            placeholder="Choose employees…"
            options={employees.filter(
              (option) =>
                !excludedEmployees.some(
                  (excluded) => excluded.value === option.value,
                ),
            )}
            selected={selectedEmployees}
            onChange={handleEmployeeSelection}
          />

          <EmployeeMultiSelect
            label="Exclude Employees"
            placeholder="Exclude employees…"
            options={employees}
            selected={excludedEmployees}
            onChange={handleExcludedSelection}
          />

          {error && (
            <div className="flex items-center gap-2 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              <AlertCircle className="h-4 w-4" />
              <span>{error}</span>
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="shadow-md">
        <CardContent className="p-4">
          <div className="h-[320px]">
            {isLoading ? (
              <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
                Loading chart data…
              </div>
            ) : chartData.length === 0 || selectedEmployees.length === 0 ? (
              <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
                Select employees or adjust filters to see the chart.
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData} margin={{ left: 8, right: 16 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis dataKey="month" stroke="#6b7280" />
                  <YAxis stroke="#6b7280" />
                  <Tooltip
                    contentStyle={{
                      fontSize: "0.75rem",
                    }}
                  />
                  <Legend />
                  {selectedEmployees.map((employee, index) => (
                    <Line
                      key={employee.value}
                      type="monotone"
                      dataKey={employee.label}
                      stroke={COLORS[index % COLORS.length]}
                      strokeWidth={2}
                      activeDot={{ r: 5 }}
                    />
                  ))}
                </LineChart>
              </ResponsiveContainer>
            )}
          </div>
        </CardContent>
      </Card>

      <Card className="shadow-md">
        <CardHeader>
          <CardTitle>Selected Employees Performance</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {selectedEmployees.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No employees selected.
            </p>
          ) : (
            <ul className="space-y-2">
              {selectedEmployees.map((employee) => {
                const total = getTotalNewCustomers(employee.label);
                return (
                  <li
                    key={employee.value}
                    className="flex items-center justify-between rounded-md border border-border px-3 py-2 text-sm"
                  >
                    <span>{employee.label}</span>
                    <span className="font-semibold">
                      {total} new customer{total === 1 ? "" : "s"}
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );

  if (!token) {
    return (
      <DashboardLayout
        heading="New Customers Report"
        subheading="Visualise new customer acquisition by field officer"
      >
        <div className="mx-auto flex h-full max-w-4xl flex-col items-center justify-center gap-4 px-4 py-12">
          <AlertCircle className="h-10 w-10 text-muted-foreground" />
          <p className="text-lg font-medium text-muted-foreground">
            You need to be signed in to view this report.
          </p>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout
      heading="New Customers Report"
      subheading="Visualise new customer acquisition by field officer"
    >
      {pageContent}
    </DashboardLayout>
  );
}
