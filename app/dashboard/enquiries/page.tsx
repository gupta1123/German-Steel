"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Calendar as CalendarComponent } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { CalendarIcon as CalendarIconLucide } from 'lucide-react';
import { format } from 'date-fns';
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
  TableCaption,
} from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetFooter } from '@/components/ui/sheet';
import { MapPin, Store, Phone, DollarSign, Users, Filter } from 'lucide-react';

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
  const [isClient, setIsClient] = useState(false);

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

  const [tempStoreNameFilter, setTempStoreNameFilter] = useState<string>('');
  const [tempTalukaFilter, setTempTalukaFilter] = useState<string>('');
  const [tempCityFilter, setTempCityFilter] = useState<string>('');
  const [tempStateFilter, setTempStateFilter] = useState<string>('');
  
  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: currentYear - 2000 + 1 }, (_, index) => currentYear - index);
  const months = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"
  ];

  // Pagination and Sorting State
  const [currentPage, setCurrentPage] = useState<number>(0);
  const [pageSize, setPageSize] = useState<number>(10);
  const [totalPages, setTotalPages] = useState<number>(0);
  const [sortColumn, setSortColumn] = useState<string>('dealerName');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  const [isSortByStoreCount, setIsSortByStoreCount] = useState<boolean>(false);

  // Filter expansion state
  const [isDesktopFilterExpanded, setIsDesktopFilterExpanded] = useState<boolean>(false);
  const [isMobileFilterExpanded, setIsMobileFilterExpanded] = useState<boolean>(false);

  // Data state
  const [enquiriesData, setEnquiriesData] = useState<PaginatedEnquiryResponse | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Handle client-side hydration
  useEffect(() => {
    setIsClient(true);
    setToken(localStorage.getItem('authToken'));
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
    setSortColumn('dealerName');
    setSortDirection('asc');
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
        <div className="rounded-lg border bg-card p-8">
          <div className="text-center">
            <div className="text-6xl mb-4">🔒</div>
            <h3 className="text-xl font-semibold text-foreground mb-2">Authentication Required</h3>
            <p className="text-muted-foreground">Please log in to view enquiries data.</p>
          </div>
        </div>
      );
    }
    if (isLoading) return (
      <div className="rounded-lg border bg-card p-8">
        <div className="flex items-center justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mr-3"></div>
          <span className="text-foreground font-medium">Loading enquiries from API...</span>
        </div>
      </div>
    );
    if (error) return (
      <div className="rounded-lg border bg-card p-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center">
            <div className="text-2xl mr-3">❌</div>
            <div>
              <h3 className="text-lg font-semibold text-destructive mb-1">Error Loading Data</h3>
              <p className="text-muted-foreground">{error}</p>
            </div>
          </div>
          <Button
            variant="outline"
            onClick={() => fetchEnquiries()}
            className="text-destructive hover:bg-destructive/10"
          >
            🔄 Refresh
          </Button>
        </div>
      </div>
    );
    return (
      <div className="rounded-lg border bg-card">
        
        {/* Desktop Table View */}
        <div className="hidden md:block overflow-x-auto">
          <Table>
            <TableCaption>List of enquiries</TableCaption>
            <TableHeader>
              <TableRow>
                {tableDisplayColumns.map((column) => (
                  <TableHead 
                    key={column} 
                    className="text-left"
                  >
                    {column}
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {enquiriesData?.content?.map((enquiry: Enquiry, index: number) => (
                <TableRow key={enquiry.id}>
                  <TableCell className="font-medium">
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
                  <TableCell className="font-medium">
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
                      <div className="text-4xl mb-4">📭</div>
                      <h3 className="text-lg font-medium mb-2">No enquiries found</h3>
                      <p className="text-sm">Try adjusting your filters or upload new data</p>
                    </div>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>

        {/* Mobile Card View */}
        <div className="md:hidden space-y-4 p-4">
          {enquiriesData?.content?.map((enquiry: Enquiry) => (
            <Card key={enquiry.id} className="border-l-4 border-l-primary shadow-md">
              <CardContent className="p-6">
                {/* Header */}
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center space-x-3">
                    <Store className="h-6 w-6 text-foreground" />
                    <div>
                      <h3 className="text-xl font-bold text-foreground">{enquiry.dealerName}</h3>
                      <p className="text-lg text-muted-foreground">{enquiry.taluka}</p>
                    </div>
                  </div>
                  <Badge variant="secondary" className="text-lg px-4 py-2">
                    ₹{calculateTotalSales(enquiry.sales) ? calculateTotalSales(enquiry.sales).toLocaleString() : '0'}
                  </Badge>
                </div>

                {/* Location Details */}
                <div className="space-y-3 mb-4">
                  <div className="flex items-center space-x-3">
                    <MapPin className="h-5 w-5 text-foreground" />
                    <div className="text-lg">
                      <span className="font-medium">{enquiry.city || '—'}</span>
                      {enquiry.state && <span className="text-muted-foreground">, {enquiry.state}</span>}
                    </div>
                  </div>
                  
                  <div className="flex items-center space-x-3">
                    <Users className="h-5 w-5 text-foreground" />
                    <div className="text-lg">
                      <span className="font-medium">Population: </span>
                      <span className="font-semibold">{enquiry.population ? enquiry.population.toLocaleString() : '0'}</span>
                    </div>
                  </div>
                  
                  <div className="flex items-center space-x-3">
                    <Phone className="h-5 w-5 text-foreground" />
                    <div className="text-lg">
                      <span className="font-medium">Phone: </span>
                      <span className="font-semibold">{enquiry.contactNumber}</span>
                    </div>
                  </div>
                  
                  <div className="flex items-center space-x-3">
                    <DollarSign className="h-5 w-5 text-foreground" />
                    <div className="text-lg">
                      <span className="font-medium">Expenses: </span>
                      <span className="font-semibold">₹{enquiry.expenses ? enquiry.expenses.toLocaleString() : '0'}</span>
                    </div>
                  </div>
                </div>

                {/* Sales Data */}
                {salesMonths.length > 0 && (
                  <div className="mt-4 pt-4 border-t border-border">
                    <div className="flex items-center space-x-2 mb-3">
                      <CalendarIconLucide className="h-5 w-5 text-foreground" />
                      <h4 className="text-lg font-medium text-foreground">Sales Data</h4>
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
            <div className="text-center py-12">
              <div className="flex flex-col items-center justify-center text-muted-foreground">
                <div className="text-6xl mb-4">📭</div>
                <h3 className="text-2xl font-medium mb-2">No enquiries found</h3>
                <p className="text-lg">Try adjusting your filters or upload new data</p>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <Card className="border-0 shadow-sm">
        <CardHeader className="pb-4">
          <div className="flex items-center justify-end">
            <div className="flex gap-3">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsDesktopFilterExpanded(!isDesktopFilterExpanded)}
                className="hidden md:inline-flex h-14 text-lg md:h-10 md:text-sm"
              >
                <Filter className="mr-2 h-5 w-5 md:h-4 md:w-4" />
                {isDesktopFilterExpanded ? 'Hide Filters' : 'Show Filters'}
              </Button>
              <Button
                variant="outline"
                size="icon"
                onClick={() => setIsMobileFilterExpanded(true)}
                className="md:hidden h-14 w-14"
              >
                <Filter className="h-6 w-6" />
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">

          {/* Desktop Filters Section */}
          {isDesktopFilterExpanded && (
          <div className="hidden md:block">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6 p-6 bg-muted/30 rounded-lg">
            {/* Store Name */}
            <div className="space-y-3">
              <Label htmlFor="storeNameFilter" className="text-lg md:text-sm font-medium text-foreground">Store Name</Label>
              <Input 
                id="storeNameFilter"
                type="text" 
                placeholder="Enter store name"
                value={tempStoreNameFilter} 
                onChange={(e) => setTempStoreNameFilter(e.target.value)} 
                className="w-full h-14 text-lg md:h-10 md:text-sm"
              />
            </div>

            {/* Taluka */}
            <div className="space-y-3">
              <Label htmlFor="talukaFilter" className="text-lg md:text-sm font-medium text-foreground">Taluka</Label>
              <Input 
                id="talukaFilter"
                type="text" 
                placeholder="Enter taluka"
                value={tempTalukaFilter} 
                onChange={(e) => setTempTalukaFilter(e.target.value)} 
                className="w-full h-14 text-lg md:h-10 md:text-sm"
              />
            </div>

            {/* City */}
            <div className="space-y-3">
              <Label htmlFor="cityFilter" className="text-lg md:text-sm font-medium text-foreground">City</Label>
              <Input 
                id="cityFilter"
                type="text" 
                placeholder="Enter city"
                value={tempCityFilter} 
                onChange={(e) => setTempCityFilter(e.target.value)} 
                className="w-full h-14 text-lg md:h-10 md:text-sm"
              />
            </div>

            {/* State */}
            <div className="space-y-3">
              <Label htmlFor="stateFilter" className="text-lg md:text-sm font-medium text-foreground">State</Label>
              <Input 
                id="stateFilter"
                type="text" 
                placeholder="Enter state"
                value={tempStateFilter} 
                onChange={(e) => setTempStateFilter(e.target.value)} 
                className="w-full h-14 text-lg md:h-10 md:text-sm"
              />
            </div>

            {/* From Year */}
            <div className="space-y-3">
              <Label htmlFor="fromYearFilter" className="text-lg md:text-sm font-medium text-foreground">From Year</Label>
                <Select
                  value={tempStartYear !== undefined ? tempStartYear.toString() : "NONE_VALUE"}
                  onValueChange={(value) => {
                    if (value === "NONE_VALUE") setTempStartYear(undefined);
                    else setTempStartYear(parseInt(value));
                  }}
                >
                  <SelectTrigger className="w-full h-14 md:h-10 text-lg md:text-sm">
                    <SelectValue placeholder="Select year" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="NONE_VALUE"><em>None</em></SelectItem>
                    {years.map(year => (
                      <SelectItem key={year} value={year.toString()}>{year}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

            {/* From Month */}
            <div className="space-y-3">
              <Label htmlFor="fromMonthFilter" className="text-lg md:text-sm font-medium text-foreground">From Month</Label>
                <Select
                  value={tempStartMonth !== undefined ? tempStartMonth.toString() : "NONE_VALUE"}
                  onValueChange={(value) => {
                    if (value === "NONE_VALUE") setTempStartMonth(undefined);
                    else setTempStartMonth(parseInt(value));
                  }}
                  disabled={typeof tempStartYear !== 'number'}
                >
                  <SelectTrigger className="w-full h-14 md:h-10 text-lg md:text-sm">
                    <SelectValue placeholder="Select month" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="NONE_VALUE"><em>None</em></SelectItem>
                    {months.map((month, index) => (
                      <SelectItem key={index} value={index.toString()}>{month}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

            {/* To Year */}
            <div className="space-y-3">
              <Label htmlFor="toYearFilter" className="text-lg md:text-sm font-medium text-foreground">To Year</Label>
                <Select
                  value={tempEndYear !== undefined ? tempEndYear.toString() : "NONE_VALUE"}
                  onValueChange={(value) => {
                    if (value === "NONE_VALUE") setTempEndYear(undefined);
                    else setTempEndYear(parseInt(value));
                  }}
                  disabled={typeof tempStartYear !== 'number' || typeof tempStartMonth !== 'number'}
                >
                  <SelectTrigger className="w-full h-14 md:h-10 text-lg md:text-sm">
                    <SelectValue placeholder="Select year" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="NONE_VALUE"><em>None</em></SelectItem>
                    {years.map(year => (
                      <SelectItem key={year} value={year.toString()}>{year}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

            {/* To Month */}
            <div className="space-y-3">
              <Label htmlFor="toMonthFilter" className="text-lg md:text-sm font-medium text-foreground">To Month</Label>
                <Select
                  value={tempEndMonth !== undefined ? tempEndMonth.toString() : "NONE_VALUE"}
                  onValueChange={(value) => {
                    if (value === "NONE_VALUE") setTempEndMonth(undefined);
                    else setTempEndMonth(parseInt(value));
                  }}
                  disabled={typeof tempEndYear !== 'number'}
                >
                  <SelectTrigger className="w-full h-14 md:h-10 text-lg md:text-sm">
                    <SelectValue placeholder="Select month" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="NONE_VALUE"><em>None</em></SelectItem>
                    {months.map((month, index) => (
                      <SelectItem key={index} value={index.toString()}>{month}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
        
          {/* Action Buttons */}
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-6 mt-8 pt-6 border-t border-border">
            <div className="flex items-center space-x-3">
              <Switch
                id="sortByStoreCountToggle"
                checked={isSortByStoreCount}
                onCheckedChange={(checked) => {
                  setCurrentPage(0);
                  setIsSortByStoreCount(checked);
                }}
                className="data-[state=checked]:bg-blue-600"
              />
              <Label htmlFor="sortByStoreCountToggle" className="text-lg md:text-sm font-medium text-foreground">
                Sort by Store Count
              </Label>
            </div>
            
            <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
              <Button 
                onClick={handleApplyFilters} 
                className="flex-1 sm:flex-none sm:px-6 h-14 text-lg md:h-10 md:text-sm font-medium"
              >
                Apply Filters
              </Button>
              <Button 
                variant="outline" 
                onClick={handleClearFilters} 
                className="flex-1 sm:flex-none sm:px-6 h-14 text-lg md:h-10 md:text-sm font-medium"
              >
                Clear All
              </Button>
            </div>
          </div>
          </div>
          )}

          {/* Mobile Filter Sheet */}
          <Sheet open={isMobileFilterExpanded} onOpenChange={setIsMobileFilterExpanded}>
            <SheetContent>
              <SheetHeader>
                <SheetTitle className="text-2xl">Enquiry Filters</SheetTitle>
              </SheetHeader>
              <div className="py-6 space-y-5">
                {/* Store Name */}
                <div className="space-y-2">
                  <Label htmlFor="mobileStoreNameFilter" className="text-lg font-medium text-foreground">Store Name</Label>
                  <Input 
                    id="mobileStoreNameFilter"
                    type="text" 
                    placeholder="Enter store name"
                    value={tempStoreNameFilter} 
                    onChange={(e) => setTempStoreNameFilter(e.target.value)} 
                    className="w-full h-14 text-lg"
                  />
                </div>

                {/* Taluka */}
                <div className="space-y-2">
                  <Label htmlFor="mobileTalukaFilter" className="text-lg font-medium text-foreground">Taluka</Label>
                  <Input 
                    id="mobileTalukaFilter"
                    type="text" 
                    placeholder="Enter taluka"
                    value={tempTalukaFilter} 
                    onChange={(e) => setTempTalukaFilter(e.target.value)} 
                    className="w-full h-14 text-lg"
                  />
                </div>

                {/* City */}
                <div className="space-y-2">
                  <Label htmlFor="mobileCityFilter" className="text-lg font-medium text-foreground">City</Label>
                  <Input 
                    id="mobileCityFilter"
                    type="text" 
                    placeholder="Enter city"
                    value={tempCityFilter} 
                    onChange={(e) => setTempCityFilter(e.target.value)} 
                    className="w-full h-14 text-lg"
                  />
                </div>

                {/* State */}
                <div className="space-y-2">
                  <Label htmlFor="mobileStateFilter" className="text-lg font-medium text-foreground">State</Label>
                  <Input 
                    id="mobileStateFilter"
                    type="text" 
                    placeholder="Enter state"
                    value={tempStateFilter} 
                    onChange={(e) => setTempStateFilter(e.target.value)} 
                    className="w-full h-14 text-lg"
                  />
                </div>

                {/* From Year */}
                <div className="space-y-2">
                  <Label htmlFor="mobileFromYearFilter" className="text-lg font-medium text-foreground">From Year</Label>
                  <Select
                    value={tempStartYear !== undefined ? tempStartYear.toString() : "NONE_VALUE"}
                    onValueChange={(value) => {
                      if (value === "NONE_VALUE") setTempStartYear(undefined);
                      else setTempStartYear(parseInt(value));
                    }}
                  >
                    <SelectTrigger className="w-full h-14 text-lg">
                      <SelectValue placeholder="Select year" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="NONE_VALUE"><em>None</em></SelectItem>
                      {years.map(year => (
                        <SelectItem key={year} value={year.toString()}>{year}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* From Month */}
                <div className="space-y-2">
                  <Label htmlFor="mobileFromMonthFilter" className="text-lg font-medium text-foreground">From Month</Label>
                  <Select
                    value={tempStartMonth !== undefined ? tempStartMonth.toString() : "NONE_VALUE"}
                    onValueChange={(value) => {
                      if (value === "NONE_VALUE") setTempStartMonth(undefined);
                      else setTempStartMonth(parseInt(value));
                    }}
                    disabled={typeof tempStartYear !== 'number'}
                  >
                    <SelectTrigger className="w-full h-14 text-lg">
                      <SelectValue placeholder="Select month" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="NONE_VALUE"><em>None</em></SelectItem>
                      {months.map((month, index) => (
                        <SelectItem key={index} value={index.toString()}>{month}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* To Year */}
                <div className="space-y-2">
                  <Label htmlFor="mobileToYearFilter" className="text-lg font-medium text-foreground">To Year</Label>
                  <Select
                    value={tempEndYear !== undefined ? tempEndYear.toString() : "NONE_VALUE"}
                    onValueChange={(value) => {
                      if (value === "NONE_VALUE") setTempEndYear(undefined);
                      else setTempEndYear(parseInt(value));
                    }}
                    disabled={typeof tempStartYear !== 'number' || typeof tempStartMonth !== 'number'}
                  >
                    <SelectTrigger className="w-full h-14 text-lg">
                      <SelectValue placeholder="Select year" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="NONE_VALUE"><em>None</em></SelectItem>
                      {years.map(year => (
                        <SelectItem key={year} value={year.toString()}>{year}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* To Month */}
                <div className="space-y-2">
                  <Label htmlFor="mobileToMonthFilter" className="text-lg font-medium text-foreground">To Month</Label>
                  <Select
                    value={tempEndMonth !== undefined ? tempEndMonth.toString() : "NONE_VALUE"}
                    onValueChange={(value) => {
                      if (value === "NONE_VALUE") setTempEndMonth(undefined);
                      else setTempEndMonth(parseInt(value));
                    }}
                    disabled={typeof tempEndYear !== 'number'}
                  >
                    <SelectTrigger className="w-full h-14 text-lg">
                      <SelectValue placeholder="Select month" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="NONE_VALUE"><em>None</em></SelectItem>
                      {months.map((month, index) => (
                        <SelectItem key={index} value={index.toString()}>{month}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

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
                  <Label htmlFor="mobileSortByStoreCountToggle" className="text-lg font-medium text-foreground">
                    Sort by Store Count
                  </Label>
                </div>
              </div>
              <SheetFooter className="flex gap-3">
                <Button 
                  variant="outline" 
                  onClick={handleClearFilters} 
                  className="flex-1 h-14 text-lg font-medium"
                >
                  Clear All
                </Button>
                <Button 
                  onClick={() => {
                    handleApplyFilters();
                    setIsMobileFilterExpanded(false);
                  }}
                  className="flex-1 h-14 text-lg font-medium"
                >
                  Apply Filters
                </Button>
              </SheetFooter>
            </SheetContent>
          </Sheet>

          {/* Main Content */}
          {renderMainContent()}
          
          {/* Pagination */}
          <div className="flex flex-col sm:flex-row justify-between items-center gap-6 p-6 bg-card rounded-lg border">
            <div className="flex items-center gap-3">
              <Label htmlFor="pageSizeSelect" className="text-lg md:text-sm font-medium text-foreground">
                Rows per page:
              </Label>
              <Select
                  value={pageSize.toString()}
                  onValueChange={(value) => {
                      setCurrentPage(0);
                      setPageSize(parseInt(value));
                  }}
              >
                  <SelectTrigger id="pageSizeSelect" className="w-[80px] h-14 md:h-10 text-lg md:text-sm">
                      <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                      {[10, 20, 50, 100].map(size => (
                          <SelectItem key={size} value={size.toString()}>{size}</SelectItem>
                      ))}
                  </SelectContent>
              </Select>
            </div>
            
            <div className="flex items-center gap-3">
              <Button 
                  variant="outline" 
                  onClick={() => setCurrentPage(prev => Math.max(0, prev - 1))}
                  disabled={currentPage === 0 || isLoading}
                  className="h-14 md:h-10 px-4 text-lg md:text-sm disabled:opacity-50"
              >
                  ← Previous
              </Button>
              <span className="text-lg md:text-sm font-medium text-foreground px-4 py-2 bg-muted rounded-lg">
                  Page {currentPage + 1} of {totalPages > 0 ? totalPages : 1}
              </span>
              <Button 
                  variant="outline" 
                  onClick={() => setCurrentPage(prev => prev + 1)}
                  disabled={isLoading || currentPage >= totalPages - 1}
                  className="h-14 md:h-10 px-4 text-lg md:text-sm disabled:opacity-50"
              >
                  Next →
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>

  );
}