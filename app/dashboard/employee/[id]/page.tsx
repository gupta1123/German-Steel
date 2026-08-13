"use client";

import { useState, useEffect, useRef, useCallback, useMemo, use } from 'react';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import Head from 'next/head';
import { useAuth } from '@/components/auth-provider';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { format, formatDuration, intervalToDuration } from "date-fns";
import { Calendar as CalendarIcon } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from "lucide-react";
import {
  Select,
  SelectTrigger,
  SelectContent,
  SelectValue,
  SelectItem
} from "@/components/ui/select";
import { SpacedCalendar } from "@/components/ui/spaced-calendar";
import { API } from "@/lib/api";

const ACTIVITY_TABS = [
  { value: 'visits', label: 'Visits', icon: 'fas fa-map-marked-alt' },
  { value: 'attendance', label: 'Attendance', icon: 'fas fa-calendar-check' },
  { value: 'expenses', label: 'Expenses', icon: 'fas fa-receipt' },
  { value: 'daily-pricing', label: 'Daily Pricing', icon: 'fas fa-tags' },
];

const VISIT_FILTER_OPTIONS = ['today', 'yesterday', 'last-2-days', 'this-week', 'this-month', 'last-month'] as const;
type VisitFilterOption = typeof VISIT_FILTER_OPTIONS[number];
const VISIT_FILTER_SET = new Set<string>(VISIT_FILTER_OPTIONS);

interface Visit {
  id: number;
  storeId: number;
  storeName: string;
  employeeName: string;
  visit_date: string;
  scheduledStartTime: string | null;
  scheduledEndTime: string | null;
  checkinDate: string | null;
  checkoutDate: string | null;
  checkinTime: string | null;
  checkoutTime: string | null;
  purpose: string;
  outcome: string | null;
}

interface Expense {
  id: number;
  type: string;
  subType: string;
  amount: number;
  approvalStatus: string;
  description: string;
  approvalDate: string;
  expenseDate: string;
  employeeName: string;
}

interface EmployeeData {
  id: number;
  firstName: string;
  lastName: string;
  employeeId: string;
  primaryContact: string | number;
  email: string;
  role: string;
  city: string;
  state: string;
  country: string;
  dateOfJoining: string;
  departmentName: string;
}

interface PricingData {
  id: number;
  brandName: string;
  price: number;
  city: string;
}

export default function SalesExecutivePage({ params }: { params: Promise<{ id: string }> }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const searchParamsString = searchParams.toString();

  const resolvedParams = use(params);
  const id = resolvedParams.id;
  const { token } = useAuth();

  const [activeTab, setActiveTab] = useState('visits');
  const [activeInfoTab, setActiveInfoTab] = useState('personal-info');
  const [showExpenseStartCalendar, setShowExpenseStartCalendar] = useState(false);
  const [showExpenseEndCalendar, setShowExpenseEndCalendar] = useState(false);

  const [employeeData, setEmployeeData] = useState<EmployeeData | null>(null);
  const [visits, setVisits] = useState<Visit[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [attendanceStats, setAttendanceStats] = useState<Record<string, unknown> | null>(null);
  const [dailyPricing, setDailyPricing] = useState<PricingData[]>([]);

  const [visitFilter, setVisitFilter] = useState<VisitFilterOption>('today');
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());
  const [selectedMonth, setSelectedMonth] = useState<number>(new Date().getMonth() + 1);
  const [expenseStartDate, setExpenseStartDate] = useState<Date | undefined>(new Date());
  const [expenseEndDate, setExpenseEndDate] = useState<Date | undefined>(new Date());
  const [pricingStartDate, setPricingStartDate] = useState<Date | undefined>(new Date());
  const [pricingEndDate, setPricingEndDate] = useState<Date | undefined>(new Date());
  const [visitPage, setVisitPage] = useState(1);
  const [visitPageSize, setVisitPageSize] = useState(5);
  const [visitTotalElements, setVisitTotalElements] = useState(0);
  const [visitTotalPages, setVisitTotalPages] = useState(1);

  const [showPricingStartCalendar, setShowPricingStartCalendar] = useState(false);
  const [showPricingEndCalendar, setShowPricingEndCalendar] = useState(false);
  const [filtersHydrated, setFiltersHydrated] = useState(false);

  const handleVisitFilterChange = useCallback((value: string) => {
    if (VISIT_FILTER_SET.has(value)) {
      setVisitFilter(value as VisitFilterOption);
    }
  }, []);

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(word => word[0])
      .join('')
      .toUpperCase();
  };

  const getStatusInfo = (status: string) => {
    switch (status) {
      case 'Completed':
        return { emoji: '✅', color: 'bg-green-100 text-green-800' };
      case 'In Progress':
        return { emoji: '🟡', color: 'bg-blue-100 text-blue-800' };
      default:
        return { emoji: '⏳', color: 'bg-gray-100 text-gray-800' };
    }
  };
  
  const handleBack = () => {
    // If navigated from employees list, simple back will restore persisted filters
    try {
      const raw = sessionStorage.getItem('employees.last.view');
      if (raw) {
        router.back();
        return;
      }
    } catch {}
    router.back();
  };

  const handleViewVisit = useCallback((visitId: number) => {
    try {
      sessionStorage.setItem('employee.visit.last', JSON.stringify({ tab: activeTab, visitFilter }));
    } catch {}
    router.push(`/dashboard/visits/${visitId}`);
  }, [router, activeTab, visitFilter]);

  useEffect(() => {
    if (filtersHydrated) return;

    const params = new URLSearchParams(searchParamsString);
    const fallbackRaw = (() => {
      try {
        return sessionStorage.getItem('employee.visit.last');
      } catch {
        return null;
      }
    })();

    const saved = fallbackRaw ? (() => {
      try {
        return JSON.parse(fallbackRaw) ?? {};
      } catch {
        return {};
      }
    })() : {};

    const tabParam = params.get('tab') ?? saved.tab;
    if (tabParam && ACTIVITY_TABS.some((tab) => tab.value === tabParam)) {
      setActiveTab(tabParam);
    }

    const visitFilterParam = params.get('visitFilter') ?? saved.visitFilter;
    if (visitFilterParam && VISIT_FILTER_SET.has(visitFilterParam)) {
      setVisitFilter(visitFilterParam as VisitFilterOption);
    }

    setFiltersHydrated(true);
  }, [filtersHydrated, searchParamsString]);

  useEffect(() => {
    if (!filtersHydrated) return;

    const params = new URLSearchParams(searchParamsString);

    if (activeTab && activeTab !== 'visits') {
      params.set('tab', activeTab);
    } else {
      params.delete('tab');
    }

    if (visitFilter && visitFilter !== 'today') {
      params.set('visitFilter', visitFilter);
    } else {
      params.delete('visitFilter');
    }

    const nextQuery = params.toString();
    const nextUrl = nextQuery ? `${pathname}?${nextQuery}` : pathname;
    const currentUrl = searchParamsString ? `${pathname}?${searchParamsString}` : pathname;

    if (nextUrl !== currentUrl) {
      router.replace(nextUrl, { scroll: false });
    }
  }, [activeTab, visitFilter, filtersHydrated, pathname, router, searchParamsString]);

  useEffect(() => {
    const fetchEmployeeData = async () => {
      try {
        const employee = await API.getEmployeeById(Number(id));
        setEmployeeData(employee as EmployeeData);
      } catch (error) {
        console.error("Error fetching employee data:", error);
      }
    };

    if (token && id) {
      fetchEmployeeData();
    }
  }, [token, id]);

  useEffect(() => {
    const fetchVisitsAndStats = async () => {
      if (!filtersHydrated || !token || !id) {
        return;
      }

      const now = new Date();
      let startDate = now.toISOString().split('T')[0];
      let endDate = startDate;

      if (visitFilter === 'today') {
        startDate = now.toISOString().split('T')[0];
        endDate = now.toISOString().split('T')[0];
      } else if (visitFilter === 'yesterday') {
        const yesterday = new Date(now);
        yesterday.setDate(yesterday.getDate() - 1);
        startDate = yesterday.toISOString().split('T')[0];
        endDate = yesterday.toISOString().split('T')[0];
      } else if (visitFilter === 'last-2-days') {
        const twoDaysAgo = new Date(now);
        twoDaysAgo.setDate(twoDaysAgo.getDate() - 2);
        startDate = twoDaysAgo.toISOString().split('T')[0];
        endDate = now.toISOString().split('T')[0];
      } else if (visitFilter === 'this-week') {
        const startOfWeek = new Date(now);
        startOfWeek.setDate(now.getDate() - now.getDay()); // Start from Sunday
        startDate = startOfWeek.toISOString().split('T')[0];
        endDate = now.toISOString().split('T')[0]; // Cap at today
      } else if (visitFilter === 'this-month') {
        startDate = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
        endDate = now.toISOString().split('T')[0]; // Cap at today instead of end of month
      } else if (visitFilter === 'last-month') {
        startDate = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString().split('T')[0];
        endDate = new Date(now.getFullYear(), now.getMonth(), 0).toISOString().split('T')[0];
      }

      try {
        const data = await API.getEmployeeStatsOptimized(
          Number(id),
          startDate,
          endDate,
          visitPage - 1,
          visitPageSize,
          'id,desc',
        );
        setVisits((data.visitPage.content || []) as Visit[]);
        setVisitTotalElements(data.visitPage.totalElements || 0);
        setVisitTotalPages(Math.max(data.visitPage.totalPages || 1, 1));
      } catch (error) {
        console.error("Error fetching visits and stats:", error);
      }
    };

    fetchVisitsAndStats();
  }, [token, id, visitFilter, filtersHydrated, visitPage, visitPageSize]);

  useEffect(() => {
    const fetchExpenses = async () => {
      if (token && id) {
        const start = expenseStartDate ? expenseStartDate.toISOString().split('T')[0] : `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}-01`;
        const end = expenseEndDate ? expenseEndDate.toISOString().split('T')[0] : `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}-30`;
        try {
          const response = await fetch(`http://ec2-18-211-58-135.compute-1.amazonaws.com:8081/expense/getByEmployeeAndDate?start=${start}&end=${end}&id=${id}`, {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          });
          const data = await response.json();
          setExpenses(data);
        } catch (error) {
          console.error("Error fetching expenses:", error);
        }
      }
    };

    fetchExpenses();
  }, [token, id, expenseStartDate, expenseEndDate]);

  useEffect(() => {
    const fetchAttendanceStats = async () => {
      if (token && id) {
        try {
          const start = `${selectedYear}-${String(selectedMonth).padStart(2, '0')}-01`;
          const end = format(new Date(selectedYear, selectedMonth, 0), 'yyyy-MM-dd');
          const data = await API.getEmployeeDashboardSummary(Number(id), start, end);
          setAttendanceStats({ statsDto: data.statsDto });
        } catch (error) {
          console.error("Error fetching attendance stats:", error);
        }
      }
    };

    fetchAttendanceStats();
  }, [token, id, selectedYear, selectedMonth]);

  useEffect(() => {
    const fetchDailyPricing = async () => {
      if (token && id) {
        const start = pricingStartDate ? pricingStartDate.toISOString().split('T')[0] : `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}-01`;
        const end = pricingEndDate ? pricingEndDate.toISOString().split('T')[0] : `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}-30`;
        try {
          const response = await fetch(`http://ec2-18-211-58-135.compute-1.amazonaws.com:8081/brand/getByDateRangeForEmployee?start=${start}&end=${end}&id=${id}`, {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          });
          const data = await response.json();
          setDailyPricing(data);
        } catch (error) {
          console.error("Error fetching daily pricing:", error);
        }
      }
    };

    fetchDailyPricing();
  }, [token, id, pricingStartDate, pricingEndDate]);


  const paginatedVisits = visits;
  const totalVisitPages = visitTotalPages;

  useEffect(() => {
    setVisitPage(1);
  }, [visitFilter, visitPageSize]);

    return (
      <div className="space-y-6">
      <Head>
        <title>Sales Executive Detail Page</title>
      </Head>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column - Employee Profile */}
        <div className="lg:col-span-1">
          <Card className="border-0 shadow-sm">
            <CardHeader className="pb-4">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-xl font-semibold text-foreground">Employee Details</CardTitle>
                  <p className="text-sm text-muted-foreground">Employee information and actions</p>
                </div>
                <Button variant="ghost" size="sm" onClick={handleBack}>
                  <i className="fas fa-arrow-left mr-2"></i> Back
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-start gap-4">
                <div className="h-14 w-14 rounded-xl border-2 border-dashed bg-muted flex items-center justify-center">
                  <span className="text-lg font-semibold text-muted-foreground">
                    {employeeData ? getInitials(`${employeeData.firstName} ${employeeData.lastName}`) : 'AW'}
                  </span>
                </div>
                <div className="flex-1 min-w-0 space-y-1">
                  <h3 className="text-lg font-semibold text-foreground truncate">
                    {employeeData ? `${employeeData.firstName} ${employeeData.lastName}` : 'Abhijeet Wagh'}
                  </h3>
                  <p className="text-sm text-muted-foreground truncate">
                    {employeeData ? employeeData.role : 'Field Officer'}
                  </p>
                </div>
              </div>

        
            <div className="space-y-4">
                <div className="flex border-b">
                  <button
                    className={`px-3 py-2 text-sm font-medium border-b-2 transition-colors ${
                      activeInfoTab === 'personal-info' 
                        ? 'border-primary text-primary' 
                        : 'border-transparent text-muted-foreground hover:text-foreground'
                    }`}
                    onClick={() => setActiveInfoTab('personal-info')}
                  >
                    Personal Info
                  </button>
                  <button
                    className={`px-3 py-2 text-sm font-medium border-b-2 transition-colors ${
                      activeInfoTab === 'work-info' 
                        ? 'border-primary text-primary' 
                        : 'border-transparent text-muted-foreground hover:text-foreground'
                    }`}
                    onClick={() => setActiveInfoTab('work-info')}
                  >
                    Work Info
                  </button>
                </div>
                
                {activeInfoTab === 'personal-info' && (
                  <div className="space-y-3">
                    {employeeData?.email && (
                      <div className="flex items-start gap-3">
                        <div className="flex h-8 w-8 items-center justify-center rounded-md bg-muted">
                          <i className="fas fa-envelope text-sm text-muted-foreground"></i>
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-foreground">Email</p>
                          <p className="text-sm text-muted-foreground">{employeeData.email}</p>
                        </div>
                      </div>
                    )}
                    {employeeData?.primaryContact && (
                      <div className="flex items-start gap-3">
                        <div className="flex h-8 w-8 items-center justify-center rounded-md bg-muted">
                          <i className="fas fa-phone text-sm text-muted-foreground"></i>
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-foreground">Phone</p>
                          <p className="text-sm text-muted-foreground">{employeeData.primaryContact}</p>
                        </div>
                      </div>
                    )}
                    {(employeeData?.city || employeeData?.state || employeeData?.country) && (
                      <div className="flex items-start gap-3">
                        <div className="flex h-8 w-8 items-center justify-center rounded-md bg-muted">
                          <i className="fas fa-map-marker-alt text-sm text-muted-foreground"></i>
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-foreground">Location</p>
                          <p className="text-sm text-muted-foreground">
                            {[employeeData?.city, employeeData?.state, employeeData?.country].filter(Boolean).join(', ')}
                          </p>
                        </div>
                      </div>
                    )}
                    {employeeData?.dateOfJoining && (
                      <div className="flex items-start gap-3">
                        <div className="flex h-8 w-8 items-center justify-center rounded-md bg-muted">
                          <i className="fas fa-calendar text-sm text-muted-foreground"></i>
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-foreground">Joined</p>
                          <p className="text-sm text-muted-foreground">
                            {format(new Date(employeeData.dateOfJoining), 'MMM d, yyyy')}
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
                )}
                
                {activeInfoTab === 'work-info' && (
                  <div className="space-y-3">
                    {employeeData?.departmentName && (
                      <div className="flex items-start gap-3">
                        <div className="flex h-8 w-8 items-center justify-center rounded-md bg-muted">
                          <i className="fas fa-building text-sm text-muted-foreground"></i>
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-foreground">Department</p>
                          <p className="text-sm text-muted-foreground">{employeeData.departmentName}</p>
                        </div>
                      </div>
                    )}
                    {employeeData?.role && (
                      <div className="flex items-start gap-3">
                        <div className="flex h-8 w-8 items-center justify-center rounded-md bg-muted">
                          <i className="fas fa-user-tie text-sm text-muted-foreground"></i>
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-foreground">Role</p>
                          <p className="text-sm text-muted-foreground">{employeeData.role}</p>
                        </div>
                      </div>
                    )}
                  </div>
                )}
            </div>
          </CardContent>
        </Card>
      </div>

        {/* Right Column - Activity Details */}
        <div className="lg:col-span-2">
          <Card className="border-0 shadow-sm">
            <CardHeader className="pb-4">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-xl font-semibold text-foreground">Employee Activity</CardTitle>
                  <p className="text-sm text-muted-foreground">View visits, attendance, expenses, and daily pricing</p>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                <div className="md:hidden">
                  <Select value={activeTab} onValueChange={setActiveTab}>
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Select section" />
                    </SelectTrigger>
                    <SelectContent>
                      {ACTIVITY_TABS.map((tab) => (
                        <SelectItem key={tab.value} value={tab.value}>
                          <div className="flex items-center gap-2">
                            <i className={tab.icon}></i>
                            <span>{tab.label}</span>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="hidden md:flex border-b">
                  {ACTIVITY_TABS.map((tab) => (
                    <button
                      key={tab.value}
                      className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 ${
                        activeTab === tab.value
                          ? 'border-primary text-primary'
                          : 'border-transparent text-muted-foreground hover:text-foreground'
                      }`}
                      onClick={() => setActiveTab(tab.value)}
                    >
                      <i className={tab.icon}></i> {tab.label}
                    </button>
                  ))}
                </div>

                {activeTab === 'visits' && (
                  <div className="space-y-4">
                    <div className="flex flex-wrap items-center gap-4">
                      <Select value={visitFilter} onValueChange={handleVisitFilterChange}>
                        <SelectTrigger className="w-[180px]">
                          <SelectValue placeholder="Select Filter" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="today">Today</SelectItem>
                          <SelectItem value="yesterday">Yesterday</SelectItem>
                          <SelectItem value="last-2-days">Last 2 Days</SelectItem>
                          <SelectItem value="this-week">This Week</SelectItem>
                          <SelectItem value="this-month">This Month</SelectItem>
                          <SelectItem value="last-month">Last Month</SelectItem>
                        </SelectContent>
                      </Select>
                      <Select
                        value={visitPageSize.toString()}
                        onValueChange={(value) => setVisitPageSize(parseInt(value, 10))}
                      >
                        <SelectTrigger className="w-[150px]">
                          <SelectValue placeholder="Page size" />
                        </SelectTrigger>
                        <SelectContent>
                          {[5, 10, 20].map((size) => (
                            <SelectItem key={size} value={size.toString()}>
                              {size} per page
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <p className="text-sm text-muted-foreground">
                        Showing {visits.length === 0 ? 0 : (visitPage - 1) * visitPageSize + 1}-
                        {Math.min(visitPage * visitPageSize, visitTotalElements)} of {visitTotalElements}
                      </p>
                    </div>
                    <div className="space-y-3">
                      {paginatedVisits.length === 0 ? (
                        <div className="rounded-lg border bg-muted/30 p-6 text-center text-sm text-muted-foreground">
                          No visits found for this filter
                        </div>
                      ) : (
                        paginatedVisits.map((visit) => {
                          let status = 'Scheduled';
                          if (visit.checkinDate && visit.checkinTime && visit.checkoutDate && visit.checkoutTime) {
                            status = 'Completed';
                          } else if (visit.checkinDate && visit.checkinTime) {
                            status = 'In Progress';
                          }
                          const { emoji, color } = getStatusInfo(status);
                          return (
                            <div
                              key={visit.id}
                              className="rounded-lg border bg-card p-4 hover:shadow-sm transition-shadow"
                            >
                              <div className="flex items-center justify-between mb-2">
                                <div className="flex items-center gap-2">
                                  <div>
                                    <h4 className="font-semibold text-sm">{visit.storeName}</h4>
                                    <p className="text-xs text-muted-foreground">
                                      Visit on {format(new Date(visit.visit_date), 'MMM dd, yyyy')}
                                    </p>
                                  </div>
                                </div>
                                <span
                                  className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${color}`}
                                >
                                  {emoji} {status}
                                </span>
                              </div>
                              <div className="text-sm text-muted-foreground mb-2">
                                <span className="font-medium">Purpose:</span> {visit.purpose}
                              </div>
                              {visit.checkinTime && visit.checkoutTime && (
                                <div className="text-sm text-muted-foreground">
                                  <span className="font-medium">Duration:</span>{' '}
                                  {formatDuration(
                                    intervalToDuration({
                                      start: new Date(`${visit.checkinDate}T${visit.checkinTime}`),
                                      end: new Date(`${visit.checkoutDate}T${visit.checkoutTime}`),
                                    })
                                  )}
                                </div>
                              )}
                              <div className="flex justify-end mt-4">
                                <Button variant="outline" size="sm" onClick={() => handleViewVisit(visit.id)}>
                                  View Visit
                                </Button>
                              </div>
                            </div>
                          );
                        })
                      )}
                    </div>
                    {paginatedVisits.length > 0 && totalVisitPages > 1 && (
                      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2 border-t">
                        <p className="text-sm text-muted-foreground">
                          Page {visitPage} of {totalVisitPages}
                        </p>
                        <div className="flex items-center gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setVisitPage((prev) => Math.max(1, prev - 1))}
                            disabled={visitPage === 1}
                          >
                            Previous
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setVisitPage((prev) => Math.min(totalVisitPages, prev + 1))}
                            disabled={visitPage === totalVisitPages}
                          >
                            Next
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {activeTab === 'attendance' && (
                  <div className="space-y-4">
                    <div className="flex items-center gap-4">
                      <Select value={selectedYear.toString()} onValueChange={(value) => setSelectedYear(parseInt(value))}>
                        <SelectTrigger className="w-[150px]">
                          <SelectValue placeholder="Select Year" />
                        </SelectTrigger>
                        <SelectContent>
                          {Array.from({ length: 27 }, (_, index) => (
                            <SelectItem key={index} value={(2023 + index).toString()}>
                              {2023 + index}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Select value={selectedMonth.toString()} onValueChange={(value) => setSelectedMonth(parseInt(value))}>
                        <SelectTrigger className="w-[150px]">
                          <SelectValue placeholder="Select Month" />
                        </SelectTrigger>
                        <SelectContent>
                          {["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"].map((month, index) => (
                            <SelectItem key={index} value={(index + 1).toString()}>
                              {month}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="rounded-lg border bg-card p-6">
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <div className="text-center">
                          <div className="text-3xl font-bold text-blue-600 mb-2">
                            {(attendanceStats as { statsDto?: { fullDays?: number } })?.statsDto?.fullDays || 0}
                          </div>
                          <div className="text-sm font-medium text-muted-foreground">Full Days</div>
                        </div>
                        <div className="text-center">
                          <div className="text-3xl font-bold text-yellow-600 mb-2">
                            {(attendanceStats as { statsDto?: { halfDays?: number } })?.statsDto?.halfDays || 0}
                          </div>
                          <div className="text-sm font-medium text-muted-foreground">Half Days</div>
                        </div>
                        <div className="text-center">
                          <div className="text-3xl font-bold text-red-600 mb-2">
                            {(attendanceStats as { statsDto?: { absences?: number } })?.statsDto?.absences || 0}
                          </div>
                          <div className="text-sm font-medium text-muted-foreground">Absences</div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {activeTab === 'expenses' && (
                  <div className="space-y-4">
                    <div className="flex items-center gap-4">
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button variant="outline" className="w-[200px] justify-start">
                            <CalendarIcon className="mr-2 h-4 w-4" />
                            {expenseStartDate ? format(expenseStartDate, 'MMM d, yyyy') : 'Select Start Date'}
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0">
                          <SpacedCalendar
                            mode="single"
                            selected={expenseStartDate}
                            onSelect={setExpenseStartDate}
                            initialFocus
                          />
                        </PopoverContent>
                      </Popover>
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button variant="outline" className="w-[200px] justify-start">
                            <CalendarIcon className="mr-2 h-4 w-4" />
                            {expenseEndDate ? format(expenseEndDate, 'MMM d, yyyy') : 'Select End Date'}
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0">
                          <SpacedCalendar
                            mode="single"
                            selected={expenseEndDate}
                            onSelect={setExpenseEndDate}
                            initialFocus
                          />
                        </PopoverContent>
                      </Popover>
                    </div>

                    <div className="space-y-3">
                      {expenses.map((expense) => (
                        <div key={expense.id} className="rounded-lg border bg-card p-4">
                          <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-2">
                              <span className="text-lg">💰</span>
                              <div>
                                <h4 className="font-semibold text-sm capitalize">{expense.type}</h4>
                                <p className="text-xs text-muted-foreground">
                                  {format(new Date(expense.expenseDate), 'MMM dd, yyyy')}
                                </p>
                              </div>
                            </div>
                            <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                              expense.approvalStatus.toLowerCase() === 'approved' ? 'bg-green-100 text-green-800' :
                              expense.approvalStatus.toLowerCase() === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                              'bg-red-100 text-red-800'
                            }`}>
                              {expense.approvalStatus}
                            </span>
                          </div>
                          <div className="text-sm text-muted-foreground">
                            <span className="font-medium">Amount:</span> ₹{expense.amount.toFixed(2)}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {activeTab === 'daily-pricing' && (
                  <div className="space-y-4">
        <div className="flex items-center gap-4">
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button variant="outline" className="w-[200px] justify-start">
                            <CalendarIcon className="mr-2 h-4 w-4" />
                            {pricingStartDate ? format(pricingStartDate, 'MMM d, yyyy') : 'Select Start Date'}
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0">
                          <SpacedCalendar
                            mode="single"
                            selected={pricingStartDate}
                            onSelect={setPricingStartDate}
                            initialFocus
                          />
                        </PopoverContent>
                      </Popover>
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button variant="outline" className="w-[200px] justify-start">
                            <CalendarIcon className="mr-2 h-4 w-4" />
                            {pricingEndDate ? format(pricingEndDate, 'MMM d, yyyy') : 'Select End Date'}
          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0">
                          <SpacedCalendar
                            mode="single"
                            selected={pricingEndDate}
                            onSelect={setPricingEndDate}
                            initialFocus
                          />
                        </PopoverContent>
                      </Popover>
        </div>
        
                    <div className="space-y-3">
                      {dailyPricing.map((pricing) => (
                        <div key={pricing.id} className="rounded-lg border bg-card p-4">
                          <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-2">
                              <span className="text-lg">🏷️</span>
                              <div>
                                <h4 className="font-semibold text-sm capitalize">{pricing.brandName}</h4>
                                <p className="text-xs text-muted-foreground">{pricing.city}</p>
                              </div>
                            </div>
                            <span className="text-sm text-muted-foreground bg-muted px-2 py-1 rounded-full">
                              {pricing.city}
                            </span>
                          </div>
                          <div className="text-2xl font-bold text-foreground">
                            ₹{pricing.price.toFixed(2)}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
          </CardContent>
        </Card>
      </div>
      </div>
    </div>
  );
};
