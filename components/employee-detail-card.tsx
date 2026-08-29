"use client";

import React, { useEffect, useMemo, useState, useCallback, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { 
  MapPin,
  ChevronUpIcon,
  ChevronDownIcon,
  ChevronRight,
  ChevronLeft
} from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";
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
}

const KPICard = ({ title, value }: KPICardProps) => {
  return (
    <Card>
      <CardHeader className="pb-2 md:pb-4">
        <CardTitle className="text-xs md:text-sm font-medium">{title}</CardTitle>
      </CardHeader>
      <CardContent className="pt-0">
        <p className="text-2xl md:text-4xl font-bold">{value}</p>
      </CardContent>
    </Card>
  );
};

interface VisitsByPurposeChartProps {
  data: { purpose: string; visits: number }[];
}

const VisitsByPurposeChart = ({ data }: VisitsByPurposeChartProps) => {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base md:text-lg text-white">Visits by Purpose</CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={250} className="md:hidden">
          <BarChart data={data}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255, 255, 255, 0.2)" />
            <XAxis dataKey="purpose" tick={{ fontSize: 10, fill: 'white' }} />
            <YAxis tick={{ fontSize: 10, fill: 'white' }} />
            <Tooltip contentStyle={{ backgroundColor: 'rgba(0, 0, 0, 0.8)', border: 'none', fontSize: '12px', color: 'white' }} />
            <Legend wrapperStyle={{ color: 'white', fontSize: '14px' }} />
            <Bar dataKey="visits" fill="#1a202c" />
          </BarChart>
        </ResponsiveContainer>
        <ResponsiveContainer width="100%" height={300} className="hidden md:block">
          <BarChart data={data}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255, 255, 255, 0.2)" />
            <XAxis dataKey="purpose" tick={{ fill: 'white' }} />
            <YAxis tick={{ fill: 'white' }} />
            <Tooltip contentStyle={{ backgroundColor: 'rgba(0, 0, 0, 0.8)', border: 'none', color: 'white' }} />
            <Legend wrapperStyle={{ color: 'white', fontSize: '14px' }} />
            <Bar dataKey="visits" fill="#1a202c" />
          </BarChart>
        </ResponsiveContainer>
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
    <Card>
      <CardHeader>
        <CardTitle className="text-base md:text-lg">Recent Completed Visits</CardTitle>
      </CardHeader>
      <CardContent>
        {/* Mobile Card View */}
        <div className="md:hidden space-y-3">
          {visitsToDisplay.map((visit) => {
            const { emoji, status } = getOutcomeStatus(visit);
            return (
              <Card key={visit.id} className="border-l-4 border-l-primary">
                <CardContent className="p-4">
                  <div className="flex justify-between items-start mb-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1.5">
                        <h4 className="font-semibold text-sm truncate">{visit.customer}</h4>
                        <Badge variant="outline" className="text-xs">{emoji} {status}</Badge>
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
        <div className="hidden md:block overflow-x-auto -mx-4 px-4 md:mx-0 md:px-0">
          <table className="w-full min-w-[600px]">
            <thead>
              <tr>
                <th className="px-2 md:px-4 py-2 text-xs md:text-sm cursor-pointer" onClick={() => handleSort('customer')}>
                  Store
                  {lastClickedColumn === 'customer' && (
                    sortOrder === 'asc' ? (
                      <ChevronUpIcon className="w-3 h-3 md:w-4 md:h-4 inline-block ml-1" />
                    ) : (
                      <ChevronDownIcon className="w-3 h-3 md:w-4 md:h-4 inline-block ml-1" />
                    )
                  )}
                </th>
                <th className="px-2 md:px-4 py-2 text-xs md:text-sm cursor-pointer" onClick={() => handleSort('date')}>
                  Date
                  {lastClickedColumn === 'date' && (
                    sortOrder === 'asc' ? (
                      <ChevronUpIcon className="w-3 h-3 md:w-4 md:h-4 inline-block ml-1" />
                    ) : (
                      <ChevronDownIcon className="w-3 h-3 md:w-4 md:h-4 inline-block ml-1" />
                    )
                  )}
                </th>
                <th className="px-2 md:px-4 py-2 text-xs md:text-sm cursor-pointer" onClick={() => handleSort('purpose')}>
                  Purpose
                  {lastClickedColumn === 'purpose' && (
                    sortOrder === 'asc' ? (
                      <ChevronUpIcon className="w-3 h-3 md:w-4 md:h-4 inline-block ml-1" />
                    ) : (
                      <ChevronDownIcon className="w-3 h-3 md:w-4 md:h-4 inline-block ml-1" />
                    )
                  )}
                </th>
                <th className="px-2 md:px-4 py-2 text-xs md:text-sm cursor-pointer" onClick={() => handleSort('employeeState')}>
                  City
                  {lastClickedColumn === 'employeeState' && (
                    sortOrder === 'asc' ? (
                      <ChevronUpIcon className="w-3 h-3 md:w-4 md:h-4 inline-block ml-1" />
                    ) : (
                      <ChevronDownIcon className="w-3 h-3 md:w-4 md:h-4 inline-block ml-1" />
                    )
                  )}
                </th>
                <th className="px-2 md:px-4 py-2 text-xs md:text-sm">Status</th>
                <th className="px-2 md:px-4 py-2 text-xs md:text-sm">Actions</th>
              </tr>
            </thead>
            <tbody>
              {visitsToDisplay.map((visit) => {
                const { emoji, status } = getOutcomeStatus(visit);
                return (
                  <tr key={visit.id}>
                    <td className="px-2 md:px-4 py-2 text-xs md:text-sm">{visit.customer}</td>
                    <td className="px-2 md:px-4 py-2 text-xs md:text-sm whitespace-nowrap">{format(parseISO(visit.date), "MMM dd, yyyy")}</td>
                    <td className="px-2 md:px-4 py-2 text-xs md:text-sm">{visit.purpose}</td>
                    <td className="px-2 md:px-4 py-2 text-xs md:text-sm capitalize">{visit.employeeState || 'N/A'}</td>
                    <td className="px-2 md:px-4 py-2 text-xs md:text-sm">
                      <Badge variant="outline" className="text-xs whitespace-nowrap">{emoji} {status}</Badge>
                    </td>
                    <td className="px-2 md:px-4 py-2">
                      <button
                        className="text-blue-500 hover:text-blue-700 text-xs md:text-sm"
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
        <div className="mt-4 border-t pt-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="text-sm text-muted-foreground">{totalElements} visits in this range</div>
          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              size="sm"
              onClick={() => onPageChange(Math.max(1, currentPage - 1))}
              disabled={currentPage <= 1}
            >
              <ChevronLeft className="h-4 w-4" />
              Previous
            </Button>
            <span className="text-sm text-muted-foreground">
              Page {Math.min(currentPage, safeTotalPages)} of {safeTotalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => onPageChange(Math.min(safeTotalPages, currentPage + 1))}
              disabled={currentPage >= safeTotalPages}
            >
              Next
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
      <div className="space-y-4 md:space-y-6">
        <div>
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-4 w-32 mt-2" />
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
          {[...Array(4)].map((_, i) => (
            <Card key={i}>
              <CardHeader className="pb-2 md:pb-4">
                <Skeleton className="h-4 w-28" />
              </CardHeader>
              <CardContent className="pt-0">
                <Skeleton className="h-8 w-16" />
              </CardContent>
            </Card>
          ))}
        </div>

        <Card>
          <CardHeader>
            <Skeleton className="h-6 w-56" />
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="flex items-center justify-between gap-4 p-3 border rounded">
                  <div className="flex-1 min-w-0">
                    <Skeleton className="h-4 w-40" />
                    <Skeleton className="h-3 w-56 mt-2" />
                  </div>
                  <Skeleton className="h-5 w-16" />
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <Skeleton className="h-6 w-40" />
          </CardHeader>
          <CardContent>
            <Skeleton className="h-64 w-full" />
          </CardContent>
        </Card>
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
    <div className="space-y-4 md:space-y-6 pb-20 md:pb-0">
      <div>
        <h1 className="text-2xl md:text-3xl font-bold capitalize">{employee.name}</h1>
        <p className="text-sm md:text-base text-muted-foreground">{employee.position}</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4 mb-6 md:mb-8">
        <KPICard title="Total Completed Visits" value={totalCompletedVisits} />
        <KPICard title="Full Days" value={employeeDetails?.statsDto?.fullDays || 0} />
        <KPICard title="Half Days" value={employeeDetails?.statsDto?.halfDays || 0} />
        <KPICard title="Absences" value={employeeDetails?.statsDto?.absences || 0} />
      </div>

      <VisitsTable
        visits={visits}
        onViewDetails={handleViewDetails}
        currentPage={currentPage}
        onPageChange={setCurrentPage}
        totalPages={visitTotalPages}
        totalElements={visitTotalElements}
      />
      
      <div className="mt-8">
        <VisitsByPurposeChart data={visitsByPurposeChartData} />
      </div>


      {/* Expense summary */}
      <div className="mt-6 md:mt-8 space-y-3 md:space-y-4">
        <h2 className="text-lg font-semibold">Expense Summary</h2>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
          <KPICard title="Total Expenses" value={employeeSummary?.expenseSummary.expenseCount || 0} />
          <KPICard title="Total Amount" value={`₹${(employeeSummary?.expenseSummary.totalAmount || 0).toFixed(2)}`} />
          <KPICard title="Approved" value={employeeSummary?.expenseSummary.approvedCount || 0} />
          <KPICard title="Pending" value={employeeSummary?.expenseSummary.pendingCount || 0} />
        </div>
      </div>

      {/* Pricing summary */}
      <div className="mt-8 space-y-4">
        <h2 className="text-lg font-semibold">Daily Pricing Summary</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <KPICard title="Pricing Entries" value={employeeSummary?.brandSummary.pricingEntryCount || 0} />
          <KPICard title="Distinct Brands" value={employeeSummary?.brandSummary.distinctBrandCount || 0} />
        </div>
      </div>
    </div>
  );
}
