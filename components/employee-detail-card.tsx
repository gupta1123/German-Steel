"use client";

import React, { useEffect, useMemo, useState, useCallback, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { 
  MapPin,
  CheckCircle2,
  CalendarCheck2,
  Clock3,
  UserRoundX,
  BarChart3,
  ChevronUpIcon,
  ChevronDownIcon,
  ChevronRight,
  ChevronLeft
} from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { format, parseISO } from "date-fns";
import { Skeleton } from "@/components/ui/skeleton";
import { useRouter } from 'next/navigation';
import { API, type VisitDto, type EmployeeStatsWithVisits, type EmployeeDashboardSummary } from "@/lib/api";

interface Employee {
  id: number;
  name: string;
  position: string;
  avatar: string;
  lastUpdated: string;
  status: string;
  location: string;
}

interface VisitRow {
  id: number;
  date: string;
  customer: string;
  purpose: string;
  status: "completed" | "in-progress" | "scheduled";
  duration: string;
  checkinTime?: string;
  checkoutTime?: string;
  employeeState?: string;
}

interface KPICardProps {
  title: string;
  value: React.ReactNode;
  icon?: React.ReactNode;
}

const KPICard = ({ title, value, icon }: KPICardProps) => {
  return (
    <Card className="rounded-lg shadow-none">
      <CardContent className="flex min-h-[72px] items-center justify-between gap-3 p-3 sm:min-h-[82px] sm:p-4">
        <div className="min-w-0">
          <p className="truncate text-xs font-medium text-muted-foreground">{title}</p>
          <p className="mt-1 text-2xl font-semibold leading-none tracking-tight text-foreground">{value}</p>
        </div>
        {icon && (
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground">
            {icon}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

interface VisitsByPurposeChartProps {
  data: { purpose: string; visits: number }[];
}

const VisitsByPurposeChart = ({ data }: VisitsByPurposeChartProps) => {
  const hasData = data.some((item) => item.visits > 0);

  return (
    <Card className="h-full rounded-lg shadow-none">
      <CardHeader className="border-b px-4 py-3">
        <div className="flex items-center gap-2">
          <BarChart3 className="h-4 w-4 text-muted-foreground" />
          <CardTitle className="text-sm font-semibold">Visits by purpose</CardTitle>
        </div>
      </CardHeader>
      <CardContent className="p-4">
        {hasData ? (
          <ResponsiveContainer width="100%" height={210}>
            <BarChart data={data} margin={{ top: 4, right: 4, left: -24, bottom: 0 }}>
              <CartesianGrid vertical={false} stroke="hsl(var(--border))" strokeDasharray="3 3" />
              <XAxis
                dataKey="purpose"
                axisLine={false}
                tickLine={false}
                tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
              />
              <YAxis
                allowDecimals={false}
                axisLine={false}
                tickLine={false}
                tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
              />
              <Tooltip
                cursor={{ fill: "hsl(var(--muted) / 0.55)" }}
                contentStyle={{
                  backgroundColor: "hsl(var(--popover))",
                  border: "1px solid hsl(var(--border))",
                  borderRadius: "8px",
                  color: "hsl(var(--popover-foreground))",
                  fontSize: "12px",
                  boxShadow: "0 8px 24px hsl(var(--foreground) / 0.08)",
                }}
              />
              <Bar dataKey="visits" name="Visits" fill="hsl(var(--primary))" radius={[5, 5, 0, 0]} maxBarSize={54} />
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <div className="flex h-[210px] items-center justify-center text-xs text-muted-foreground">
            No visit-purpose data for this range
          </div>
        )}
      </CardContent>
    </Card>
  );
};

interface VisitsTableProps {
  visits: VisitRow[];
  onViewDetails: (visitId: number) => void;
  currentPage: number;
  onPageChange: (page: number) => void;
  totalPages: number;
  totalElements: number;
}

const VisitsTable = ({ visits, onViewDetails, currentPage, onPageChange, totalPages, totalElements }: VisitsTableProps) => {
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [sortColumn, setSortColumn] = useState<keyof VisitRow>('date');
  const [lastClickedColumn, setLastClickedColumn] = useState<keyof VisitRow | null>(null);

  const getOutcomeStatus = (visit: VisitRow): { emoji: React.ReactNode; status: string } => {
    if (visit.checkinTime && visit.checkoutTime) {
      return { emoji: '✅', status: 'Completed' };
    } else if (visit.checkoutTime) {
      return { emoji: '⏱️', status: 'Checked Out' };
    } else if (visit.checkinTime) {
      return { emoji: '🕰️', status: 'On Going' };
    }
    return { emoji: '📅', status: 'Assigned' };
  };

  const handleSort = (column: keyof VisitRow) => {
    if (column === sortColumn) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortColumn(column);
      setSortOrder('desc');
    }
    setLastClickedColumn(column);
  };

  const sortedVisits = [...visits].sort((a, b) => {
    const valueA = a[sortColumn];
    const valueB = b[sortColumn];

    if (valueA === null || valueA === undefined) {
      return 1;
    }
    if (valueB === null || valueB === undefined) {
      return -1;
    }

    if (typeof valueA === 'string' && typeof valueB === 'string') {
      return sortOrder === 'asc' ? valueA.localeCompare(valueB) : valueB.localeCompare(valueA);
    }

    if (valueA < valueB) {
      return sortOrder === 'asc' ? -1 : 1;
    }
    if (valueA > valueB) {
      return sortOrder === 'asc' ? 1 : -1;
    }
    return 0;
  });

  // Filter to only completed visits for pagination calculation
  const completedVisits = sortedVisits.filter(visit => getOutcomeStatus(visit).status === 'Completed');
  
  const safeTotalPages = totalPages === 0 ? 1 : totalPages;
  const visitsToDisplay = completedVisits;

  return (
    <Card className="rounded-lg shadow-none">
      <CardHeader className="border-b px-4 py-3">
        <div className="flex items-center justify-between gap-3">
          <CardTitle className="text-sm font-semibold">Recent completed visits</CardTitle>
          <span className="text-xs text-muted-foreground">{totalElements} in range</span>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        {/* Mobile Card View */}
        <div className="space-y-2 p-3 md:hidden">
          {visitsToDisplay.map((visit) => {
            const { status } = getOutcomeStatus(visit);
            return (
              <Card key={visit.id} className="rounded-md border-l-2 border-l-primary shadow-none">
                <CardContent className="p-3">
                  <div className="flex justify-between items-start mb-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1.5">
                        <h4 className="font-semibold text-sm truncate">{visit.customer}</h4>
                        <Badge variant="outline" className="gap-1 border-emerald-200 bg-emerald-50 text-[11px] font-medium text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-300">
                          <CheckCircle2 className="h-3 w-3" /> {status}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {format(parseISO(visit.date), "MMM dd, yyyy")} • {visit.purpose}
                      </p>
                    </div>
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => onViewDetails(visit.id)}>
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                  <div className="mt-2 flex items-center justify-between text-xs">
                    <div className="flex items-center gap-1 text-muted-foreground">
                      <MapPin className="h-3.5 w-3.5" />
                      <span className="capitalize truncate max-w-[150px]">{visit.employeeState || 'N/A'}</span>
                    </div>
                    <Button variant="link" className="px-0 h-auto text-xs" onClick={() => onViewDetails(visit.id)}>
                      View
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
          {visitsToDisplay.length === 0 && (
            <div className="text-xs text-muted-foreground">No completed visits available</div>
          )}
        </div>

        {/* Desktop Table View */}
        <div className="hidden overflow-x-auto md:block">
          <table className="w-full min-w-[600px]">
            <thead className="bg-muted/45">
              <tr className="border-b">
                <th className="px-3 py-2 text-left text-[11px] font-medium uppercase tracking-wide text-muted-foreground cursor-pointer" onClick={() => handleSort('customer')}>
                  Store
                  {lastClickedColumn === 'customer' && (
                    sortOrder === 'asc' ? (
                      <ChevronUpIcon className="w-3 h-3 md:w-4 md:h-4 inline-block ml-1" />
                    ) : (
                      <ChevronDownIcon className="w-3 h-3 md:w-4 md:h-4 inline-block ml-1" />
                    )
                  )}
                </th>
                <th className="px-3 py-2 text-left text-[11px] font-medium uppercase tracking-wide text-muted-foreground cursor-pointer" onClick={() => handleSort('date')}>
                  Date
                  {lastClickedColumn === 'date' && (
                    sortOrder === 'asc' ? (
                      <ChevronUpIcon className="w-3 h-3 md:w-4 md:h-4 inline-block ml-1" />
                    ) : (
                      <ChevronDownIcon className="w-3 h-3 md:w-4 md:h-4 inline-block ml-1" />
                    )
                  )}
                </th>
                <th className="px-3 py-2 text-left text-[11px] font-medium uppercase tracking-wide text-muted-foreground cursor-pointer" onClick={() => handleSort('purpose')}>
                  Purpose
                  {lastClickedColumn === 'purpose' && (
                    sortOrder === 'asc' ? (
                      <ChevronUpIcon className="w-3 h-3 md:w-4 md:h-4 inline-block ml-1" />
                    ) : (
                      <ChevronDownIcon className="w-3 h-3 md:w-4 md:h-4 inline-block ml-1" />
                    )
                  )}
                </th>
                <th className="px-3 py-2 text-left text-[11px] font-medium uppercase tracking-wide text-muted-foreground cursor-pointer" onClick={() => handleSort('employeeState')}>
                  City
                  {lastClickedColumn === 'employeeState' && (
                    sortOrder === 'asc' ? (
                      <ChevronUpIcon className="w-3 h-3 md:w-4 md:h-4 inline-block ml-1" />
                    ) : (
                      <ChevronDownIcon className="w-3 h-3 md:w-4 md:h-4 inline-block ml-1" />
                    )
                  )}
                </th>
                <th className="px-3 py-2 text-left text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Status</th>
                <th className="px-3 py-2 text-right text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Action</th>
              </tr>
            </thead>
            <tbody>
              {visitsToDisplay.map((visit) => {
                const { emoji, status } = getOutcomeStatus(visit);
                return (
                  <tr key={visit.id} className="border-b last:border-b-0 hover:bg-muted/25">
                    <td className="max-w-[190px] truncate px-3 py-2.5 text-xs font-medium">{visit.customer}</td>
                    <td className="whitespace-nowrap px-3 py-2.5 text-xs text-muted-foreground">{format(parseISO(visit.date), "MMM dd, yyyy")}</td>
                    <td className="max-w-[130px] truncate px-3 py-2.5 text-xs">{visit.purpose}</td>
                    <td className="max-w-[120px] truncate px-3 py-2.5 text-xs capitalize text-muted-foreground">{visit.employeeState || 'N/A'}</td>
                    <td className="px-3 py-2.5 text-xs">
                      <Badge variant="outline" className="gap-1 whitespace-nowrap border-emerald-200 bg-emerald-50 px-1.5 py-0 text-[11px] font-medium text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-300">
                        <CheckCircle2 className="h-3 w-3" /> {status}
                      </Badge>
                    </td>
                    <td className="px-3 py-2.5 text-right">
                      <button
                        className="text-xs font-medium text-primary hover:underline"
                        onClick={() => onViewDetails(visit.id)}
                      >
                        View
                      </button>
                    </td>
                  </tr>
                );
              })}
              {visitsToDisplay.length === 0 && (
                <tr>
                  <td className="px-2 md:px-4 py-2 text-xs md:text-sm text-center" colSpan={6}>No visits available</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </CardContent>
      {totalElements > 0 && (
        <div className="flex flex-col gap-2 border-t px-3 py-2.5 sm:flex-row sm:items-center sm:justify-between">
          <div className="text-xs text-muted-foreground">{totalElements} visits in this range</div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => onPageChange(Math.max(1, currentPage - 1))}
              disabled={currentPage <= 1}
            >
              <ChevronLeft className="h-3.5 w-3.5" />
              <span className="sr-only sm:not-sr-only">Previous</span>
            </Button>
            <span className="text-xs text-muted-foreground">
              Page {Math.min(currentPage, safeTotalPages)} of {safeTotalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => onPageChange(Math.min(safeTotalPages, currentPage + 1))}
              disabled={currentPage >= safeTotalPages}
            >
              <span className="sr-only sm:not-sr-only">Next</span>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </Card>
  );
};

interface EmployeeDetailCardProps {
  employee: Employee;
  dateRange: { start: Date; end: Date };
}

export default function EmployeeDetailCard({ employee, dateRange }: EmployeeDetailCardProps) {
  const [employeeDetails, setEmployeeDetails] = useState<EmployeeStatsWithVisits | null>(null);
  const [employeeSummary, setEmployeeSummary] = useState<EmployeeDashboardSummary | null>(null);
  const [visitTotalPages, setVisitTotalPages] = useState(1);
  const [visitTotalElements, setVisitTotalElements] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const router = useRouter();
  const DETAIL_STATE_KEY = 'dashboard.employeeDetail.state.v1';
  const VIEW_STATE_KEY = 'dashboard.view.state.v1';
  const hasHydratedRef = useRef(false);

  // Hydrate filters if returning back from Visit Detail
  useEffect(() => {
    if (typeof window === 'undefined' || hasHydratedRef.current) return;
    try {
      const raw = sessionStorage.getItem(DETAIL_STATE_KEY);
      if (!raw) {
        hasHydratedRef.current = true;
        return;
      }
      const saved = JSON.parse(raw) as Record<string, unknown>;
      if (saved?.employeeId !== employee.id) {
        hasHydratedRef.current = true;
        return;
      }

      const startKey = format(dateRange.start, 'yyyy-MM-dd');
      const endKey = format(dateRange.end, 'yyyy-MM-dd');
      const savedStartKey = typeof saved.startKey === 'string' ? saved.startKey : null;
      const savedEndKey = typeof saved.endKey === 'string' ? saved.endKey : null;
      const savedPage = typeof saved.currentPage === 'number' ? saved.currentPage : null;

      if (savedPage != null && savedStartKey === startKey && savedEndKey === endKey) {
        setCurrentPage(savedPage);
      }

      hasHydratedRef.current = true;
    } catch {
      hasHydratedRef.current = true;
    }
  }, [employee.id, dateRange.start, dateRange.end]);

  // Persist filters on change
  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      sessionStorage.setItem(DETAIL_STATE_KEY, JSON.stringify({
        employeeId: employee.id,
        currentPage,
        startKey: format(dateRange.start, 'yyyy-MM-dd'),
        endKey: format(dateRange.end, 'yyyy-MM-dd'),
      }));
    } catch {}
  }, [employee.id, currentPage, dateRange.start, dateRange.end]);

  useEffect(() => {
    setCurrentPage(1);
  }, [employee.id, dateRange.start, dateRange.end]);

  // Visits + stats loaded using parent-provided date range
  useEffect(() => {
    const run = async () => {
      setLoading(true);
      setError(null);
      try {
        const start = format(dateRange.start, 'yyyy-MM-dd');
        const end = format(dateRange.end, 'yyyy-MM-dd');
        const data = await API.getEmployeeStatsOptimized(employee.id, start, end, currentPage - 1, 10, 'id,desc');
        setEmployeeDetails({ statsDto: data.statsDto, visitDto: data.visitPage.content || [] });
        setVisitTotalPages(Math.max(data.visitPage.totalPages || 1, 1));
        setVisitTotalElements(data.visitPage.totalElements || 0);
      } catch (e) {
        setError((e as Error)?.message || 'Failed to load employee details');
      } finally {
        setLoading(false);
      }
    };
    run();
  }, [employee.id, dateRange.start, dateRange.end, currentPage]);

  useEffect(() => {
    const run = async () => {
      try {
        const start = format(dateRange.start, 'yyyy-MM-dd');
        const end = format(dateRange.end, 'yyyy-MM-dd');
        setEmployeeSummary(await API.getEmployeeDashboardSummary(employee.id, start, end));
      } catch (e) {
        setError((e as Error)?.message || 'Failed to load employee summary');
      }
    };
    run();
  }, [employee.id, dateRange.start, dateRange.end]);

  const visitsByPurposeChartData = useMemo(() => {
    return (employeeSummary?.visitSummary.visitsByPurpose || []).map(({ purpose, count }) => ({
      purpose: purpose.charAt(0).toUpperCase() + purpose.slice(1),
      visits: count,
    }));
  }, [employeeSummary]);

  const handleViewDetails = (visitId: number) => {
    // Persist parent view state to ensure return lands back here
    try {
      let selectedState: Record<string, unknown> | null = null;
      const existingRaw = sessionStorage.getItem(VIEW_STATE_KEY);
      if (existingRaw) {
        const existing = JSON.parse(existingRaw) as Record<string, unknown>;
        if (existing?.selectedState) {
          selectedState = existing.selectedState as Record<string, unknown>;
        }
      }
      sessionStorage.setItem(VIEW_STATE_KEY, JSON.stringify({
        view: 'employeeDetail',
        selectedState,
        selectedEmployee: {
          id: employee.id,
          name: employee.name,
          position: employee.position,
          avatar: employee.avatar,
          location: employee.location,
        }
      }));
    } catch {}
    router.push(`/dashboard/visits/${visitId}`);
  };

  if (error) {
    return <div className="space-y-4"><div className="text-sm text-red-700 bg-red-50 border border-red-200 rounded p-3">{error}</div></div>;
  }

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-2.5 lg:grid-cols-4">
          {[...Array(4)].map((_, i) => (
            <Card key={i} className="rounded-lg shadow-none">
              <CardContent className="flex min-h-[82px] items-center justify-between p-4">
                <div>
                  <Skeleton className="h-3 w-28" />
                  <Skeleton className="mt-2 h-6 w-12" />
                </div>
                <Skeleton className="h-8 w-8 rounded-md" />
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,1.65fr)_minmax(300px,0.75fr)]">
          <Card className="rounded-lg shadow-none">
            <CardHeader className="border-b px-4 py-3">
              <Skeleton className="h-4 w-44" />
            </CardHeader>
            <CardContent className="p-0">
              <div className="space-y-px">
                {[...Array(4)].map((_, i) => (
                  <div key={i} className="flex items-center justify-between gap-4 border-b p-3 last:border-0">
                    <div className="min-w-0 flex-1">
                      <Skeleton className="h-3.5 w-40" />
                      <Skeleton className="mt-2 h-3 w-56" />
                    </div>
                    <Skeleton className="h-5 w-16" />
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
          <Card className="rounded-lg shadow-none">
            <CardHeader className="border-b px-4 py-3">
              <Skeleton className="h-4 w-36" />
            </CardHeader>
            <CardContent className="p-4">
              <Skeleton className="h-[210px] w-full" />
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  const visits: VisitRow[] = (employeeDetails?.visitDto || []).map((v: VisitDto) => ({
    id: v.id,
    date: v.visit_date,
    customer: v.storeName,
    purpose: v.purpose || '—',
    status: 'completed',
    duration: '-',
    checkinTime: v.checkinTime,
    checkoutTime: v.checkoutTime,
    employeeState: v.state,
  }));

  const totalCompletedVisits = employeeSummary?.visitSummary.completedVisits || 0;

  return (
    <div className="space-y-4 pb-12 md:pb-0">
      <section aria-label="Performance snapshot">
        <div className="grid grid-cols-2 gap-2.5 lg:grid-cols-4">
          <KPICard
            title="Completed visits"
            value={totalCompletedVisits}
            icon={<CheckCircle2 className="h-4 w-4" />}
          />
          <KPICard
            title="Full days"
            value={employeeDetails?.statsDto?.fullDays || 0}
            icon={<CalendarCheck2 className="h-4 w-4" />}
          />
          <KPICard
            title="Half days"
            value={employeeDetails?.statsDto?.halfDays || 0}
            icon={<Clock3 className="h-4 w-4" />}
          />
          <KPICard
            title="Absences"
            value={employeeDetails?.statsDto?.absences || 0}
            icon={<UserRoundX className="h-4 w-4" />}
          />
        </div>
      </section>

      <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,1.65fr)_minmax(300px,0.75fr)]">
        <VisitsTable
          visits={visits}
          onViewDetails={handleViewDetails}
          currentPage={currentPage}
          onPageChange={setCurrentPage}
          totalPages={visitTotalPages}
          totalElements={visitTotalElements}
        />
        <VisitsByPurposeChart data={visitsByPurposeChartData} />
      </div>

      <section className="space-y-2.5" aria-labelledby="activity-summary-heading">
        <div>
          <h2 id="activity-summary-heading" className="text-sm font-semibold">Additional activity</h2>
          <p className="text-xs text-muted-foreground">Expenses and pricing recorded for this period.</p>
        </div>
        <div className="grid grid-cols-2 gap-2.5 md:grid-cols-3 xl:grid-cols-6">
          <KPICard title="Expenses" value={employeeSummary?.expenseSummary.expenseCount || 0} />
          <KPICard title="Amount" value={`₹${(employeeSummary?.expenseSummary.totalAmount || 0).toFixed(2)}`} />
          <KPICard title="Approved" value={employeeSummary?.expenseSummary.approvedCount || 0} />
          <KPICard title="Pending" value={employeeSummary?.expenseSummary.pendingCount || 0} />
          <KPICard title="Pricing entries" value={employeeSummary?.brandSummary.pricingEntryCount || 0} />
          <KPICard title="Distinct brands" value={employeeSummary?.brandSummary.distinctBrandCount || 0} />
        </div>
      </section>
    </div>
  );
}
