"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { CalendarIcon as CalendarIconLucide } from 'lucide-react';
import { format } from 'date-fns';
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetFooter } from '@/components/ui/sheet';
import { ChevronLeft, ChevronRight, Filter, Loader2, MapPin, RefreshCw, Store, Phone, DollarSign, Users } from 'lucide-react';
import { DateRangeError, isDateRangeInvalid } from '@/components/date-range-error';
import { API, type LocationMasterDto } from '@/lib/api';

interface SalesData {
  [monthYear: string]: number;
}

interface Enquiry {
  id: number;
  taluka: string;
  city?: string;
  state?: string;
  population: number;
  dealerName: string;
  expenses: number;
  contactNumber: string;
  sales: SalesData;
  storeCount?: number;
}

interface PaginatedEnquiryResponse {
  content: Enquiry[];
  totalPages?: number;
  totalElements?: number;
}

const formatDateToMMMyy = (date: Date | undefined): string => {
  return date ? format(date, 'MMM-yy') : '';
};

const formatMonthYearToString = (month: number | undefined, year: number | undefined): string => {
  if (typeof month === 'number' && typeof year === 'number') {
    const date = new Date(year, month);
    return format(date, 'MMM-yy');
  }
  return '';
};

export default function EnquiriesPage() {
  const [token, setToken] = useState<string | null>(null);

  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [storeNameFilter, setStoreNameFilter] = useState<string>('');
  const [talukaFilter, setTalukaFilter] = useState<string>('');
  const [cityFilter, setCityFilter] = useState<string>('');
  const [stateFilter, setStateFilter] = useState<string>('');

  const [tempStartMonth, setTempStartMonth] = useState<number | undefined>(undefined);
  const [tempStartYear, setTempStartYear] = useState<number | undefined>(undefined);
  const [tempEndMonth, setTempEndMonth] = useState<number | undefined>(undefined);
  const [tempEndYear, setTempEndYear] = useState<number | undefined>(undefined);
  const tempStartDate = tempStartYear !== undefined && tempStartMonth !== undefined
    ? `${tempStartYear}-${String(tempStartMonth + 1).padStart(2, '0')}-01`
    : '';
  const tempEndDate = tempEndYear !== undefined && tempEndMonth !== undefined
    ? `${tempEndYear}-${String(tempEndMonth + 1).padStart(2, '0')}-01`
    : '';
  const dateRangeInvalid = isDateRangeInvalid(tempStartDate, tempEndDate);

  const [tempStoreNameFilter, setTempStoreNameFilter] = useState<string>('');
  const [tempTalukaFilter, setTempTalukaFilter] = useState<string>('');
  const [tempCityFilter, setTempCityFilter] = useState<string>('');
  const [tempStateFilter, setTempStateFilter] = useState<string>('');
  
  const firstEnquiryYear = 2026;
  const lastEnquiryYear = Math.max(new Date().getFullYear() + 10, firstEnquiryYear + 10);
  const years = Array.from(
    { length: lastEnquiryYear - firstEnquiryYear + 1 },
    (_, index) => firstEnquiryYear + index
  );
  const months = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"
  ];

  // Pagination and Sorting State
  const [currentPage, setCurrentPage] = useState<number>(0);
  const [pageSize, setPageSize] = useState<number>(10);
  const [totalPages, setTotalPages] = useState<number>(0);
  const [isSortByStoreCount, setIsSortByStoreCount] = useState<boolean>(false);

  const [isMobileFilterExpanded, setIsMobileFilterExpanded] = useState<boolean>(false);

  // Data state
  const [enquiriesData, setEnquiriesData] = useState<PaginatedEnquiryResponse | null>(null);
  const [locationStates, setLocationStates] = useState<LocationMasterDto[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Handle client-side hydration
  useEffect(() => {
    setToken(localStorage.getItem('authToken'));
  }, []);

  useEffect(() => {
    let isMounted = true;

    API.getLocationStates()
      .then((states) => {
        if (!isMounted) return;
        setLocationStates(
          [...states].sort((left, right) => left.name.localeCompare(right.name))
        );
      })
      .catch(() => {
        if (isMounted) setLocationStates([]);
      });

    return () => {
      isMounted = false;
    };
  }, []);

  const fetchEnquiries = useCallback(async () => {
    if (!token) {
      setError('No token available. Please log in.');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const queryParams = new URLSearchParams();
      const baseUrl = 'http://ec2-18-211-58-135.compute-1.amazonaws.com:8081/enquiry/filtered';

      if (storeNameFilter) queryParams.append('storeName', storeNameFilter);
      if (talukaFilter) queryParams.append('taluka', talukaFilter);
      if (cityFilter) queryParams.append('city', cityFilter);
      if (stateFilter) queryParams.append('state', stateFilter);
      if (startDate) queryParams.append('startMonthYear', startDate);
      if (endDate) queryParams.append('endMonthYear', endDate);
      
      queryParams.append('sortByStoreCount', String(isSortByStoreCount));
      queryParams.append('page', String(currentPage));
      queryParams.append('size', String(pageSize));

      const endpoint = `${baseUrl}?${queryParams.toString()}`;
      
      const response = await fetch(endpoint, {
        headers: { 'Authorization': `Bearer ${token}` },
      });
      
      if (!response.ok) {
        const errorData = await response.text();
        throw new Error(`Network response was not ok while fetching enquiries: ${errorData || response.statusText}`);
      }
      
      const data = await response.json();
      setEnquiriesData(data);
      setTotalPages(data.totalPages || 0);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setIsLoading(false);
    }
  }, [token, storeNameFilter, talukaFilter, cityFilter, stateFilter, startDate, endDate, currentPage, pageSize, isSortByStoreCount]);

  useEffect(() => {
    fetchEnquiries();
  }, [fetchEnquiries]);


  const handleApplyFilters = () => {
    if (dateRangeInvalid) return;
    setCurrentPage(0);

    const sDateStr = formatMonthYearToString(tempStartMonth, tempStartYear);
    const eDateStr = formatMonthYearToString(tempEndMonth, tempEndYear);

    if (sDateStr && !eDateStr) {
        setStartDate(sDateStr);
        setEndDate(sDateStr);
    } else {
        setStartDate(sDateStr);
        setEndDate(eDateStr);
    }

    setStoreNameFilter(tempStoreNameFilter);
    setTalukaFilter(tempTalukaFilter);
    setCityFilter(tempCityFilter);
    setStateFilter(tempStateFilter);
  };

  const handleClearFilters = () => {
    setCurrentPage(0);
    setTempStartMonth(undefined);
    setTempStartYear(undefined);
    setTempEndMonth(undefined);
    setTempEndYear(undefined);
    setTempStoreNameFilter('');
    setTempTalukaFilter('');
    setTempCityFilter('');
    setTempStateFilter('');
    
    setStartDate('');
    setEndDate('');
    setStoreNameFilter('');
    setTalukaFilter('');
    setCityFilter('');
    setStateFilter('');
    setIsSortByStoreCount(false);
  };

  const salesMonths = React.useMemo(() => {
    const monthsSet = new Set<string>();
    if (Array.isArray(enquiriesData?.content)) {
        enquiriesData.content.forEach((enquiry: Enquiry) => {
            if (enquiry.sales) {
                Object.keys(enquiry.sales).forEach(month => monthsSet.add(month));
            }
        });
    }
    return Array.from(monthsSet).sort((a, b) => {
      const parse = (str: string) => {
        const [mon, yr] = str.split('-');
        const monthIdx = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"].findIndex(m => m === mon);
        const yearNum = parseInt(yr, 10) + (parseInt(yr, 10) < 70 ? 2000 : 1900);
        return new Date(yearNum, monthIdx);
      };
      return parse(a).getTime() - parse(b).getTime();
    });
  }, [enquiriesData]);

  const baseDisplayColumns = ['Taluka', 'City', 'State', 'Population', 'Store Name', 'Expenses', 'Phone'];
  const tableDisplayColumns = [...baseDisplayColumns, ...salesMonths, 'Total Sales'];

  const calculateTotalSales = (sales: SalesData | undefined): number => {
    if (!sales) return 0;
    return Object.values(sales).reduce((sum, value) => sum + (Number(value) || 0), 0);
  };

  const renderMainContent = () => {
    if (!token && !isLoading) {
      return (
        <div className="rounded-lg border bg-card px-4 py-14 text-center">
          <div className="mx-auto max-w-sm">
            <h3 className="text-sm font-semibold text-foreground">Authentication required</h3>
            <p className="mt-1 text-xs text-muted-foreground">Please log in to view enquiries.</p>
          </div>
        </div>
      );
    }
    if (isLoading) return (
      <div className="flex min-h-52 items-center justify-center rounded-lg border bg-card">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          <span>Loading enquiries…</span>
        </div>
      </div>
    );
    if (error) return (
      <div className="rounded-lg border border-destructive/25 bg-destructive/5 p-4">
        <div className="flex items-center justify-between gap-4">
          <div className="min-w-0">
              <h3 className="text-sm font-semibold text-destructive">Could not load enquiries</h3>
              <p className="mt-1 truncate text-xs text-muted-foreground">{error}</p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => fetchEnquiries()}
            className="h-8 shrink-0"
          >
            <RefreshCw className="mr-2 h-3.5 w-3.5" />
            Retry
          </Button>
        </div>
      </div>
    );
    return (
      <div className="overflow-hidden rounded-lg border border-border/80 bg-card">
        
        {/* Desktop Table View */}
        <div className="hidden overflow-x-auto md:block">
          <Table className="text-xs">
            <TableHeader className="bg-muted/35">
              <TableRow>
                {tableDisplayColumns.map((column) => (
                  <TableHead 
                    key={column} 
                    className="h-10 whitespace-nowrap text-left text-xs font-medium"
                  >
                    {column}
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {enquiriesData?.content?.map((enquiry: Enquiry, index: number) => (
                <TableRow key={enquiry.id} className="hover:bg-muted/25">
                  <TableCell className="h-11 whitespace-nowrap font-medium">
                    {enquiry.taluka}
                  </TableCell>
                  <TableCell>
                    {enquiry.city || '—'}
                  </TableCell>
                  <TableCell>
                    {enquiry.state || '—'}
                  </TableCell>
                  <TableCell>
                    {enquiry.population ? enquiry.population.toLocaleString() : '0'}
                  </TableCell>
                  <TableCell className="max-w-[220px] truncate font-medium" title={enquiry.dealerName}>
                    {enquiry.dealerName}
                  </TableCell>
                  <TableCell>
                    ₹{enquiry.expenses ? enquiry.expenses.toLocaleString() : '0'}
                  </TableCell>
                  <TableCell>
                    {enquiry.contactNumber}
                  </TableCell>
                  {salesMonths.map(month => (
                    <TableCell key={month} className="text-center">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                        (enquiry.sales?.[month] ?? 0) > 0 
                          ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-800 dark:text-emerald-200' 
                          : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-400'
                      }`}>
                        {enquiry.sales?.[month] ?? 0}
                      </span>
                    </TableCell>
                  ))}
                  <TableCell className="font-bold text-blue-600 dark:text-blue-400">
                    ₹{calculateTotalSales(enquiry.sales) ? calculateTotalSales(enquiry.sales).toLocaleString() : '0'}
                  </TableCell>
                </TableRow>
              ))}
              {(!enquiriesData?.content || enquiriesData.content.length === 0) && !isLoading && (
                <TableRow>
                  <TableCell colSpan={tableDisplayColumns.length} className="text-center py-12">
                    <div className="flex flex-col items-center justify-center text-muted-foreground">
                      <Store className="mb-3 h-8 w-8 stroke-[1.5]" />
                      <h3 className="text-sm font-medium text-foreground">No enquiries found</h3>
                      <p className="mt-1 text-xs">Try changing or clearing the filters.</p>
                    </div>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>

        {/* Mobile Card View */}
        <div className="space-y-3 p-3 md:hidden">
          {enquiriesData?.content?.map((enquiry: Enquiry) => (
            <Card key={enquiry.id} className="shadow-none">
              <CardContent className="p-4">
                {/* Header */}
                <div className="mb-3 flex items-start justify-between gap-3">
                  <div className="flex min-w-0 items-center gap-2.5">
                    <Store className="h-4 w-4 shrink-0 text-muted-foreground" />
                    <div className="min-w-0">
                      <h3 className="truncate text-sm font-semibold text-foreground">{enquiry.dealerName}</h3>
                      <p className="text-xs text-muted-foreground">{enquiry.taluka}</p>
                    </div>
                  </div>
                  <Badge variant="secondary" className="shrink-0 text-xs">
                    ₹{calculateTotalSales(enquiry.sales) ? calculateTotalSales(enquiry.sales).toLocaleString() : '0'}
                  </Badge>
                </div>

                {/* Location Details */}
                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div className="flex items-start gap-2">
                    <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                    <div>
                      <span className="font-medium">{enquiry.city || '—'}</span>
                      {enquiry.state && <span className="text-muted-foreground">, {enquiry.state}</span>}
                    </div>
                  </div>
                  
                  <div className="flex items-start gap-2">
                    <Users className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                    <div>
                      <span className="font-medium">Population: </span>
                      <span className="font-semibold">{enquiry.population ? enquiry.population.toLocaleString() : '0'}</span>
                    </div>
                  </div>
                  
                  <div className="flex items-start gap-2">
                    <Phone className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                    <div>
                      <span className="font-medium">Phone: </span>
                      <span className="font-semibold">{enquiry.contactNumber}</span>
                    </div>
                  </div>
                  
                  <div className="flex items-start gap-2">
                    <DollarSign className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                    <div>
                      <span className="font-medium">Expenses: </span>
                      <span className="font-semibold">₹{enquiry.expenses ? enquiry.expenses.toLocaleString() : '0'}</span>
                    </div>
                  </div>
                </div>

                {/* Sales Data */}
                {salesMonths.length > 0 && (
                  <div className="mt-4 pt-4 border-t border-border">
                    <div className="mb-2 flex items-center gap-2">
                      <CalendarIconLucide className="h-3.5 w-3.5 text-muted-foreground" />
                      <h4 className="text-xs font-medium text-foreground">Sales</h4>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      {salesMonths.map(month => (
                        <div key={month} className="flex justify-between items-center py-2 px-3 bg-muted/30 rounded-lg">
                          <span className="text-sm font-medium">{month}</span>
                          <Badge 
                            variant={enquiry.sales?.[month] ? "default" : "secondary"}
                            className="text-xs"
                          >
                            {enquiry.sales?.[month] ?? 0}
                          </Badge>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
          
          {(!enquiriesData?.content || enquiriesData.content.length === 0) && !isLoading && (
            <div className="py-12 text-center">
              <div className="flex flex-col items-center justify-center text-muted-foreground">
                <Store className="mb-3 h-8 w-8 stroke-[1.5]" />
                <h3 className="text-sm font-medium text-foreground">No enquiries found</h3>
                <p className="mt-1 text-xs">Try changing or clearing the filters.</p>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-4 py-4">
      <div className="flex items-center justify-between md:hidden">
        <p className="text-xs text-muted-foreground">
          {enquiriesData?.totalElements ?? enquiriesData?.content?.length ?? 0} enquiries
        </p>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setIsMobileFilterExpanded(true)}
          className="h-9"
        >
          <Filter className="mr-2 h-4 w-4" />
          Filters
        </Button>
      </div>

          <div className="hidden space-y-3 border-b border-border/70 pb-4 md:block">
          <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
            {/* Store Name */}
            <div className="space-y-1.5">
              <Label htmlFor="storeNameFilter" className="text-xs font-medium text-foreground">Store name</Label>
              <Input 
                id="storeNameFilter"
                type="text" 
                placeholder="All stores"
                value={tempStoreNameFilter} 
                onChange={(e) => setTempStoreNameFilter(e.target.value)} 
                className="h-9 w-full text-sm shadow-none"
              />
            </div>

            {/* Taluka */}
            <div className="space-y-1.5">
              <Label htmlFor="talukaFilter" className="text-xs font-medium text-foreground">Taluka</Label>
              <Input 
                id="talukaFilter"
                type="text" 
                placeholder="All talukas"
                value={tempTalukaFilter} 
                onChange={(e) => setTempTalukaFilter(e.target.value)} 
                className="h-9 w-full text-sm shadow-none"
              />
            </div>

            {/* City */}
            <div className="space-y-1.5">
              <Label htmlFor="cityFilter" className="text-xs font-medium text-foreground">City</Label>
              <Input 
                id="cityFilter"
                type="text" 
                placeholder="All cities"
                value={tempCityFilter} 
                onChange={(e) => setTempCityFilter(e.target.value)} 
                className="h-9 w-full text-sm shadow-none"
              />
            </div>

            {/* State */}
            <div className="space-y-1.5">
              <Label htmlFor="stateFilter" className="text-xs font-medium text-foreground">State</Label>
              <Select
                value={tempStateFilter || "all"}
                onValueChange={(value) => setTempStateFilter(value === "all" ? "" : value)}
              >
                <SelectTrigger id="stateFilter" className="h-9 w-full text-sm shadow-none">
                  <SelectValue placeholder="All states" />
                </SelectTrigger>
                <SelectContent className="max-h-56">
                  <SelectItem value="all">All states</SelectItem>
                  {locationStates.map((state) => (
                    <SelectItem key={state.id} value={state.name}>{state.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* From Year */}
            <div className="space-y-1.5">
              <Label htmlFor="fromYearFilter" className="text-xs font-medium text-foreground">From year</Label>
                <Select
                  value={tempStartYear !== undefined ? tempStartYear.toString() : "NONE_VALUE"}
                  onValueChange={(value) => {
                    if (value === "NONE_VALUE") setTempStartYear(undefined);
                    else setTempStartYear(parseInt(value));
                  }}
                >
                  <SelectTrigger id="fromYearFilter" className="h-9 w-[132px] text-sm shadow-none">
                    <SelectValue placeholder="Select year" />
                  </SelectTrigger>
                  <SelectContent className="max-h-48">
                    <SelectItem value="NONE_VALUE">Any year</SelectItem>
                    {years.map(year => (
                      <SelectItem key={year} value={year.toString()}>{year}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

            {/* From Month */}
            <div className="space-y-1.5">
              <Label htmlFor="fromMonthFilter" className="text-xs font-medium text-foreground">From month</Label>
                <Select
                  value={tempStartMonth !== undefined ? tempStartMonth.toString() : "NONE_VALUE"}
                  onValueChange={(value) => {
                    if (value === "NONE_VALUE") setTempStartMonth(undefined);
                    else setTempStartMonth(parseInt(value));
                  }}
                  disabled={typeof tempStartYear !== 'number'}
                >
                  <SelectTrigger id="fromMonthFilter" className="h-9 w-full text-sm shadow-none">
                    <SelectValue placeholder="Select month" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="NONE_VALUE">Any month</SelectItem>
                    {months.map((month, index) => (
                      <SelectItem key={index} value={index.toString()}>{month}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

            {/* To Year */}
            <div className="space-y-1.5">
              <Label htmlFor="toYearFilter" className="text-xs font-medium text-foreground">To year</Label>
                <Select
                  value={tempEndYear !== undefined ? tempEndYear.toString() : "NONE_VALUE"}
                  onValueChange={(value) => {
                    if (value === "NONE_VALUE") setTempEndYear(undefined);
                    else setTempEndYear(parseInt(value));
                  }}
                >
                  <SelectTrigger id="toYearFilter" className="h-9 w-[132px] text-sm shadow-none">
                    <SelectValue placeholder="Select year" />
                  </SelectTrigger>
                  <SelectContent className="max-h-48">
                    <SelectItem value="NONE_VALUE">Any year</SelectItem>
                    {years.map(year => (
                      <SelectItem key={year} value={year.toString()}>{year}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

            {/* To Month */}
            <div className="space-y-1.5">
              <Label htmlFor="toMonthFilter" className="text-xs font-medium text-foreground">To month</Label>
                <Select
                  value={tempEndMonth !== undefined ? tempEndMonth.toString() : "NONE_VALUE"}
                  onValueChange={(value) => {
                    if (value === "NONE_VALUE") setTempEndMonth(undefined);
                    else setTempEndMonth(parseInt(value));
                  }}
                  disabled={typeof tempEndYear !== 'number'}
                >
                  <SelectTrigger id="toMonthFilter" className="h-9 w-full text-sm shadow-none">
                    <SelectValue placeholder="Select month" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="NONE_VALUE">Any month</SelectItem>
                    {months.map((month, index) => (
                      <SelectItem key={index} value={index.toString()}>{month}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DateRangeError fromDate={tempStartDate} toDate={tempEndDate} />
        
          {/* Action Buttons */}
          <div className="flex items-center justify-between gap-3 pt-1">
            <div className="flex items-center gap-2">
              <Switch
                id="sortByStoreCountToggle"
                checked={isSortByStoreCount}
                onCheckedChange={(checked) => {
                  setCurrentPage(0);
                  setIsSortByStoreCount(checked);
                }}
              />
              <Label htmlFor="sortByStoreCountToggle" className="text-xs font-medium text-foreground">
                Sort by store count
              </Label>
            </div>
            
            <div className="flex items-center gap-2">
              <Button 
                variant="ghost"
                onClick={handleClearFilters}
                className="h-9 px-3 text-sm"
              >
                Clear
              </Button>
              <Button 
                onClick={handleApplyFilters}
                disabled={dateRangeInvalid}
                className="h-9 px-4 text-sm font-medium"
              >
                Apply filters
              </Button>
            </div>
          </div>
          </div>

          {/* Mobile Filter Sheet */}
          <Sheet open={isMobileFilterExpanded} onOpenChange={setIsMobileFilterExpanded}>
            <SheetContent className="overflow-y-auto sm:max-w-md">
              <SheetHeader>
                <SheetTitle className="text-base">Enquiry filters</SheetTitle>
              </SheetHeader>
              <div className="grid gap-4 py-5">
                {/* Store Name */}
                <div className="space-y-2">
                  <Label htmlFor="mobileStoreNameFilter" className="text-xs font-medium text-foreground">Store name</Label>
                  <Input 
                    id="mobileStoreNameFilter"
                    type="text" 
                    placeholder="All stores"
                    value={tempStoreNameFilter} 
                    onChange={(e) => setTempStoreNameFilter(e.target.value)} 
                    className="h-9 w-full text-sm"
                  />
                </div>

                {/* Taluka */}
                <div className="space-y-2">
                  <Label htmlFor="mobileTalukaFilter" className="text-xs font-medium text-foreground">Taluka</Label>
                  <Input 
                    id="mobileTalukaFilter"
                    type="text" 
                    placeholder="All talukas"
                    value={tempTalukaFilter} 
                    onChange={(e) => setTempTalukaFilter(e.target.value)} 
                    className="h-9 w-full text-sm"
                  />
                </div>

                {/* City */}
                <div className="space-y-2">
                  <Label htmlFor="mobileCityFilter" className="text-xs font-medium text-foreground">City</Label>
                  <Input 
                    id="mobileCityFilter"
                    type="text" 
                    placeholder="All cities"
                    value={tempCityFilter} 
                    onChange={(e) => setTempCityFilter(e.target.value)} 
                    className="h-9 w-full text-sm"
                  />
                </div>

                {/* State */}
                <div className="space-y-2">
                  <Label htmlFor="mobileStateFilter" className="text-xs font-medium text-foreground">State</Label>
                  <Select
                    value={tempStateFilter || "all"}
                    onValueChange={(value) => setTempStateFilter(value === "all" ? "" : value)}
                  >
                    <SelectTrigger id="mobileStateFilter" className="h-9 w-full text-sm">
                      <SelectValue placeholder="All states" />
                    </SelectTrigger>
                    <SelectContent className="max-h-56">
                      <SelectItem value="all">All states</SelectItem>
                      {locationStates.map((state) => (
                        <SelectItem key={state.id} value={state.name}>{state.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* From Year */}
                <div className="space-y-2">
                  <Label htmlFor="mobileFromYearFilter" className="text-xs font-medium text-foreground">From year</Label>
                  <Select
                    value={tempStartYear !== undefined ? tempStartYear.toString() : "NONE_VALUE"}
                    onValueChange={(value) => {
                      if (value === "NONE_VALUE") setTempStartYear(undefined);
                      else setTempStartYear(parseInt(value));
                    }}
                  >
                    <SelectTrigger id="mobileFromYearFilter" className="h-9 w-full text-sm">
                      <SelectValue placeholder="Select year" />
                    </SelectTrigger>
                    <SelectContent className="max-h-48">
                      <SelectItem value="NONE_VALUE">Any year</SelectItem>
                      {years.map(year => (
                        <SelectItem key={year} value={year.toString()}>{year}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* From Month */}
                <div className="space-y-2">
                  <Label htmlFor="mobileFromMonthFilter" className="text-xs font-medium text-foreground">From month</Label>
                  <Select
                    value={tempStartMonth !== undefined ? tempStartMonth.toString() : "NONE_VALUE"}
                    onValueChange={(value) => {
                      if (value === "NONE_VALUE") setTempStartMonth(undefined);
                      else setTempStartMonth(parseInt(value));
                    }}
                    disabled={typeof tempStartYear !== 'number'}
                  >
                    <SelectTrigger id="mobileFromMonthFilter" className="h-9 w-full text-sm">
                      <SelectValue placeholder="Select month" />
                    </SelectTrigger>
                    <SelectContent className="max-h-48">
                      <SelectItem value="NONE_VALUE">Any month</SelectItem>
                      {months.map((month, index) => (
                        <SelectItem key={index} value={index.toString()}>{month}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* To Year */}
                <div className="space-y-2">
                  <Label htmlFor="mobileToYearFilter" className="text-xs font-medium text-foreground">To year</Label>
                  <Select
                    value={tempEndYear !== undefined ? tempEndYear.toString() : "NONE_VALUE"}
                    onValueChange={(value) => {
                      if (value === "NONE_VALUE") setTempEndYear(undefined);
                      else setTempEndYear(parseInt(value));
                    }}
                  >
                    <SelectTrigger id="mobileToYearFilter" className="h-9 w-full text-sm">
                      <SelectValue placeholder="Select year" />
                    </SelectTrigger>
                    <SelectContent className="max-h-48">
                      <SelectItem value="NONE_VALUE">Any year</SelectItem>
                      {years.map(year => (
                        <SelectItem key={year} value={year.toString()}>{year}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* To Month */}
                <div className="space-y-2">
                  <Label htmlFor="mobileToMonthFilter" className="text-xs font-medium text-foreground">To month</Label>
                  <Select
                    value={tempEndMonth !== undefined ? tempEndMonth.toString() : "NONE_VALUE"}
                    onValueChange={(value) => {
                      if (value === "NONE_VALUE") setTempEndMonth(undefined);
                      else setTempEndMonth(parseInt(value));
                    }}
                    disabled={typeof tempEndYear !== 'number'}
                  >
                    <SelectTrigger id="mobileToMonthFilter" className="h-9 w-full text-sm">
                      <SelectValue placeholder="Select month" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="NONE_VALUE">Any month</SelectItem>
                      {months.map((month, index) => (
                        <SelectItem key={index} value={index.toString()}>{month}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <DateRangeError fromDate={tempStartDate} toDate={tempEndDate} />

                {/* Sort by Store Count */}
                <div className="flex items-center space-x-3 pt-4">
                  <Switch
                    id="mobileSortByStoreCountToggle"
                    checked={isSortByStoreCount}
                    onCheckedChange={(checked) => {
                      setCurrentPage(0);
                      setIsSortByStoreCount(checked);
                    }}
                    className="data-[state=checked]:bg-blue-600"
                  />
                  <Label htmlFor="mobileSortByStoreCountToggle" className="text-sm font-medium text-foreground">
                    Sort by store count
                  </Label>
                </div>
              </div>
              <SheetFooter className="flex gap-3">
                <Button 
                  variant="outline" 
                  onClick={handleClearFilters} 
                  className="h-9 flex-1 text-sm font-medium"
                >
                  Clear
                </Button>
                <Button 
                  onClick={() => {
                    handleApplyFilters();
                    setIsMobileFilterExpanded(false);
                  }}
                  disabled={dateRangeInvalid}
                  className="h-9 flex-1 text-sm font-medium"
                >
                  Apply filters
                </Button>
              </SheetFooter>
            </SheetContent>
          </Sheet>

      {renderMainContent()}
          
          {/* Pagination */}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Label htmlFor="pageSizeSelect" className="text-xs font-medium text-muted-foreground">
                Rows per page:
              </Label>
              <Select
                  value={pageSize.toString()}
                  onValueChange={(value) => {
                      setCurrentPage(0);
                      setPageSize(parseInt(value));
                  }}
              >
                  <SelectTrigger id="pageSizeSelect" className="h-8 w-[72px] text-xs shadow-none">
                      <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                      {[10, 20, 50, 100].map(size => (
                          <SelectItem key={size} value={size.toString()}>{size}</SelectItem>
                      ))}
                  </SelectContent>
              </Select>
            </div>
            
            <div className="flex items-center gap-2">
              <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => setCurrentPage(prev => Math.max(0, prev - 1))}
                  disabled={currentPage === 0 || isLoading}
                  className="h-8 px-2.5 text-xs disabled:opacity-50"
              >
                  <ChevronLeft className="mr-1 h-3.5 w-3.5" />
                  Previous
              </Button>
              <span className="px-1 text-xs text-muted-foreground">
                  Page {currentPage + 1} of {totalPages > 0 ? totalPages : 1}
              </span>
              <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => setCurrentPage(prev => prev + 1)}
                  disabled={isLoading || currentPage >= totalPages - 1}
                  className="h-8 px-2.5 text-xs disabled:opacity-50"
              >
                  Next
                  <ChevronRight className="ml-1 h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
    </div>

  );
}
