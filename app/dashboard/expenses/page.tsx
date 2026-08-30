"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import { toast } from 'sonner';
import { expenseApprovalPayload, localExpenseDate } from '@/lib/expense-review';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2, Grid3X3, Table as TableIcon, CheckCircle, XCircle, Download } from "lucide-react";
import EmployeeExpenseCard from "@/components/employee-expense-card";
import { SearchableSelect, type SearchableOption } from "@/components/ui/searchable-select2";
import { Text } from "@/components/ui/typography";
import { API, apiService, type EmployeeUserDto, type ExpenseDto } from "@/lib/api";
import { getEmployeeRoleCategory, getEmployeeRoleLabel } from "@/lib/employee-role";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { useAuth } from "@/components/auth-provider";
import { Skeleton } from "@/components/ui/skeleton";

interface Expense {
  id: number;
  date: string;
  category: string;
  amount: number;
  description: string;
  status: "approved" | "pending" | "rejected";
}

interface Employee {
  id: number;
  name: string;
  position: string;
  avatar: string;
  totalExpenses: number;
  approved: number;
  pending: number;
  rejected: number;
  expenses: Expense[];
}

// Mock data for employees and their expenses (fallback)

// Mock data for filters
const months = [
  { value: "all", label: "All Months" },
  { value: "01", label: "January" },
  { value: "02", label: "February" },
  { value: "03", label: "March" },
  { value: "04", label: "April" },
  { value: "05", label: "May" },
  { value: "06", label: "June" },
  { value: "07", label: "July" },
  { value: "08", label: "August" },
  { value: "09", label: "September" },
  { value: "10", label: "October" },
  { value: "11", label: "November" },
  { value: "12", label: "December" },
];

const currentYear = new Date().getFullYear();
const years = Array.from({ length: 2030 - currentYear + 6 }, (_, i) => currentYear - 5 + i);

const today = new Date();
const defaultMonth = (today.getMonth() + 1).toString().padStart(2, "0");
const defaultYear = today.getFullYear().toString();

export default function ExpensesPage() {
  const [selectedEmployeeId, setSelectedEmployeeId] = useState("");
  const [selectedMonth, setSelectedMonth] = useState(defaultMonth);
  const [selectedYear, setSelectedYear] = useState(defaultYear);
  const [expandedCardId, setExpandedCardId] = useState<number | null>(null);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [employeeDirectory, setEmployeeDirectory] = useState<EmployeeUserDto[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<"card" | "table">("card");
  const { token } = useAuth();
  const reviewLock = useRef(false);
  const [reviewBusy, setReviewBusy] = useState(false);
  const [rejectionIds, setRejectionIds] = useState<number[]>([]);
  const [rejectionReason, setRejectionReason] = useState('');

  const employeeOptions = useMemo<SearchableOption[]>(() => employeeDirectory
    .map((employee) => ({
      value: String(employee.id),
      label: `${employee.firstName} ${employee.lastName}`.trim(),
      description: getEmployeeRoleLabel(employee.role),
    }))
    .sort((a, b) => a.label.localeCompare(b.label)), [employeeDirectory]);

  useEffect(() => {
    const loadEmployeeDirectory = async () => {
      try {
        const directory = await API.getAllEmployees<EmployeeUserDto>();
        setEmployeeDirectory(directory.filter((employee) => {
          const category = getEmployeeRoleCategory(employee.role);
          return category === "field-officer" || category === "regional-manager";
        }));
      } catch (directoryError) {
        console.error("Error loading employee directory:", directoryError);
      }
    };

    loadEmployeeDirectory();
  }, []);

  // Transform API data to match component interface
  const transformExpenseData = (expenses: ExpenseDto[]): Employee[] => {
    const employeeMap = new Map<string, Employee>();

    expenses.forEach(expense => {
      const employeeName = expense.employeeName;
      
      if (!employeeMap.has(employeeName)) {
        employeeMap.set(employeeName, {
          id: expense.employeeId,
          name: employeeName,
          position: "Field Officer", 
          avatar: "/placeholder.svg?height=40&width=40",
          totalExpenses: 0,
          approved: 0,
          pending: 0,
          rejected: 0,
          expenses: []
        });
      }

      const employee = employeeMap.get(employeeName)!;
      const status = expense.approvalStatus.toLowerCase();
      const validStatus = (status === "approved" || status === "pending" || status === "rejected") 
        ? status as "approved" | "pending" | "rejected"
        : "pending" as "approved" | "pending" | "rejected";

      const transformedExpense: Expense = {
        id: expense.id,
        date: expense.expenseDate,
        category: expense.subType ? `${expense.type} - ${expense.subType}` : expense.type,
        amount: expense.amount,
        description: expense.description,
        status: validStatus
      };

      employee.expenses.push(transformedExpense);
      employee.totalExpenses += expense.amount;
      
      if (expense.approvalStatus.toLowerCase() === "approved") {
        employee.approved += expense.amount;
      } else if (expense.approvalStatus.toLowerCase() === "pending") {
        employee.pending += expense.amount;
      } else if (expense.approvalStatus.toLowerCase() === "rejected") {
        employee.rejected += expense.amount;
      }
    });

    return Array.from(employeeMap.values());
  };

  // Keep card/table state authoritative: only update after a successful API response.
  const reviewExpenses = async (ids: number[], action: 'approved' | 'rejected', reason = '') => {
    if (reviewLock.current || !token) return;
    const uniqueIds = [...new Set(ids)];
    const records = employees.flatMap(employee => employee.expenses).filter(expense => uniqueIds.includes(expense.id));
    if (!records.length || records.length !== uniqueIds.length || records.some(expense => expense.status !== 'pending')) {
      toast.error('Select pending expenses only.', { duration: 3000 });
      return;
    }
    if (action === 'rejected' && !reason.trim()) return;
    reviewLock.current = true;
    setReviewBusy(true);
    try {
      const payloads = records.map(expense => action === 'approved'
        ? { id: expense.id, ...expenseApprovalPayload(Number(expense.amount)) }
        : { id: expense.id, approvalStatus: 'Rejected', approvalDate: localExpenseDate(), rejectionReason: reason.trim() });
      const single = records.length === 1;
      const route = single
        ? `${action === 'approved' ? 'updateApproval' : 'reject'}?id=${records[0].id}`
        : action === 'approved' ? 'approveMultiple' : 'rejectMultiple';
      const response = await fetch(`http://ec2-18-211-58-135.compute-1.amazonaws.com:8081/expense/${route}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(single ? payloads[0] : payloads),
      });
      if (!response.ok) throw new Error(`Unable to ${action === 'approved' ? 'approve' : 'reject'} expense (HTTP ${response.status}).`);
      setEmployees(previous => previous.map(employee => ({
        ...employee,
        expenses: employee.expenses.map(expense => uniqueIds.includes(expense.id) ? { ...expense, status: action } : expense),
      })));
      setRejectionIds([]);
      setRejectionReason('');
      toast.success(`${records.length === 1 ? 'Expense' : 'Expenses'} ${action}.`, { duration: 3000 });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Expense update failed. Please try again.', { duration: 3000 });
    } finally {
      reviewLock.current = false;
      setReviewBusy(false);
    }
  };
  const handleApprove = (_name: string, id: number) => reviewExpenses([id], 'approved');
  const handleApproveMultiple = (_name: string, ids: number[]) => reviewExpenses(ids, 'approved');
  const handleReject = (_name: string, id: number) => { setRejectionReason(''); setRejectionIds([id]); };
  const handleRejectMultiple = (_name: string, ids: number[]) => { setRejectionReason(''); setRejectionIds(ids); };

  // Load expenses data
  const loadExpenses = async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      // Calculate date range based on selected month and year
      let startDate: string;
      let endDate: string;
      
      if (selectedMonth === "all") {
        // Get all expenses for the selected year
        startDate = `${selectedYear}-01-01`;
        endDate = `${selectedYear}-12-31`;
      } else {
        // Get expenses for specific month and year
        const month = selectedMonth.padStart(2, '0');
        startDate = `${selectedYear}-${month}-01`;
        const lastDay = new Date(parseInt(selectedYear), parseInt(selectedMonth), 0).getDate();
        endDate = `${selectedYear}-${month}-${lastDay.toString().padStart(2, '0')}`;
      }

      const expenses = await apiService.getExpensesByDateRange(startDate, endDate);
      const transformedEmployees = transformExpenseData(expenses);
      setEmployees(transformedEmployees);
    } catch (err) {
      console.error('Error loading expenses:', err);
      setError('Failed to load expenses. Please try again.');
      setEmployees([]);
    } finally {
      setIsLoading(false);
    }
  };

  // Load data on component mount and when filters change
  useEffect(() => {
    loadExpenses();
  }, [selectedMonth, selectedYear]);

  const filteredEmployees = employees.filter((employee) =>
    !selectedEmployeeId || String(employee.id) === selectedEmployeeId
  );

  const toggleCardExpansion = (id: number) => {
    setExpandedCardId(expandedCardId === id ? null : id);
  };

  // Get status badge for table view
  const getStatusBadge = (status: string) => {
    switch (status.toLowerCase()) {
      case "approved":
        return <Badge className="bg-green-100 text-green-800 hover:bg-green-100 text-xs">Approved</Badge>;
      case "pending":
        return <Badge className="bg-yellow-100 text-yellow-800 hover:bg-yellow-100 text-xs">Pending</Badge>;
      case "rejected":
        return <Badge className="bg-red-100 text-red-800 hover:bg-red-100 text-xs">Rejected</Badge>;
      default:
        return <Badge className="text-xs">{status}</Badge>;
    }
  };

  // Flatten expenses for table view
  const allExpenses = employees.flatMap(employee => 
    employee.expenses.map(expense => ({
      ...expense,
      employeeId: employee.id,
      employeeName: employee.name,
      employeePosition: employee.position
    }))
  );
  const filteredTableExpenses = allExpenses.filter((expense) =>
    !selectedEmployeeId || String(expense.employeeId) === selectedEmployeeId
  );

  const handleExport = () => {
    if (filteredTableExpenses.length === 0) return;

    const headers = ["Employee", "Position", "Date", "Category", "Description", "Amount", "Status"];
    const rows = filteredTableExpenses.map((expense) => [
      expense.employeeName,
      expense.employeePosition,
      format(new Date(expense.date), "MMM dd, yyyy"),
      expense.category,
      expense.description ?? "",
      `₹${(expense.amount || 0).toFixed(2)}`,
      expense.status.charAt(0).toUpperCase() + expense.status.slice(1),
    ]);

    const escapeCsvValue = (value: string | number | null | undefined) => {
      if (value === null || value === undefined) return "\"\"";
      const stringValue = String(value);
      return `"${stringValue.replace(/"/g, '""')}"`;
    };

    const csvContent = [headers, ...rows]
      .map(row => row.map(value => escapeCsvValue(value)).join(","))
      .join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    const monthSegment = selectedMonth === "all" ? "all" : selectedMonth;
    link.href = url;
    link.download = `expenses_${selectedYear}_${monthSegment}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="mx-auto w-full max-w-none py-4">
      <div className="mb-4 flex flex-col gap-2.5 lg:flex-row lg:items-center lg:justify-between">
        <div className="grid gap-2 sm:grid-cols-[240px_140px_104px]">
          <div className="min-w-0">
            <Label className="sr-only">Employee</Label>
            <SearchableSelect
              options={employeeOptions}
              value={selectedEmployeeId}
              onSelect={(option) => setSelectedEmployeeId(option?.value ?? "")}
              placeholder="All employees"
              searchPlaceholder="Search employees..."
              emptyMessage="No employees available"
              noResultsMessage="No matching employees"
              allowClear
              triggerClassName="h-8 w-full bg-background text-xs shadow-none"
              contentClassName="w-[var(--radix-popover-trigger-width)]"
            />
          </div>

          <Select value={selectedMonth} onValueChange={setSelectedMonth}>
            <SelectTrigger className="h-8 w-full bg-background text-xs shadow-none" aria-label="Filter by month">
              <SelectValue placeholder="Month">
                {months.find(month => month.value === selectedMonth)?.label || "Month"}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              {months.map((month) => (
                <SelectItem key={month.value} value={month.value}>{month.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={selectedYear} onValueChange={setSelectedYear}>
            <SelectTrigger className="h-8 w-full bg-background text-xs shadow-none" aria-label="Filter by year">
              <SelectValue placeholder="Year" />
            </SelectTrigger>
            <SelectContent>
              {years.map((year) => (
                <SelectItem key={year} value={year.toString()}>{year}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex flex-wrap items-center gap-2 lg:justify-end">
          <div className="flex overflow-hidden rounded-md border border-border">
            <Button
              variant={viewMode === "card" ? "default" : "ghost"}
              size="sm"
              onClick={() => setViewMode("card")}
              className="rounded-r-none"
            >
              <Grid3X3 className="mr-2 h-4 w-4" />
              Cards
            </Button>
            <Button
              variant={viewMode === "table" ? "default" : "ghost"}
              size="sm"
              onClick={() => setViewMode("table")}
              className="rounded-l-none"
            >
              <TableIcon className="mr-2 h-4 w-4" />
              Table
            </Button>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={handleExport}
            disabled={filteredTableExpenses.length === 0 || isLoading}
            className="flex items-center gap-2"
          >
            <Download className="h-4 w-4" />
            Export CSV
          </Button>
        </div>
      </div>

      {error && (
        <Card className="border-red-200 bg-red-50">
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 text-red-800">
              <Text size="sm">{error}</Text>
            </div>
          </CardContent>
        </Card>
      )}

      {isLoading ? (
        <div className="space-y-6">
          <div className="flex items-center justify-center py-12">
            <div className="flex items-center gap-2">
              <Loader2 className="h-6 w-6 animate-spin" />
              <Text>Loading expenses...</Text>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {Array.from({ length: 6 }).map((_, i) => (
              <Card key={i}>
                <CardHeader>
                  <div className="flex items-center gap-3">
                    <Skeleton className="h-10 w-10 rounded-xl" />
                    <div className="space-y-2">
                      <Skeleton className="h-4 w-24" />
                      <Skeleton className="h-3 w-16" />
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-3 gap-2 mb-4">
                    <Skeleton className="h-12 w-full" />
                    <Skeleton className="h-12 w-full" />
                    <Skeleton className="h-12 w-full" />
                  </div>
                  <Skeleton className="h-9 w-full" />
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      ) : viewMode === "card" ? (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredEmployees.length === 0 ? (
            <div className="col-span-full text-center py-12">
              <Text tone="muted">No expenses found for the selected period.</Text>
            </div>
          ) : (
            filteredEmployees.map((employee) => (
          <EmployeeExpenseCard 
            key={employee.id} 
            employee={employee} 
            showExpenses={expandedCardId === employee.id}
            onToggleExpenses={() => toggleCardExpansion(employee.id)}
                onApprove={handleApprove}
                busy={reviewBusy}
                onReject={handleReject}
                onApproveMultiple={handleApproveMultiple}
                onRejectMultiple={handleRejectMultiple}
              />
            ))
          )}
        </div>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Expenses Table</CardTitle>
            <Text tone="muted" size="sm">
              Detailed view of all expenses for the selected period
            </Text>
          </CardHeader>
          <CardContent>
            <div className="rounded-md border overflow-hidden w-full">
              <div className="overflow-x-auto w-full">
                <Table className="min-w-full">
                  <TableHeader>
                    <TableRow>
                      <TableHead className="whitespace-nowrap">Employee</TableHead>
                      <TableHead className="whitespace-nowrap">Position</TableHead>
                      <TableHead className="whitespace-nowrap">Date</TableHead>
                      <TableHead className="whitespace-nowrap">Category</TableHead>
                      <TableHead className="whitespace-nowrap">Description</TableHead>
                      <TableHead className="whitespace-nowrap">Amount</TableHead>
                      <TableHead className="whitespace-nowrap">Status</TableHead>
                      <TableHead className="whitespace-nowrap">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredTableExpenses.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={8} className="h-24 text-center text-gray-500">
                          No expenses found for the selected period
                        </TableCell>
                      </TableRow>
                    ) : (
                      filteredTableExpenses
                        .map((expense) => (
                          <TableRow key={expense.id}>
                            <TableCell className="font-medium whitespace-nowrap">
                              {expense.employeeName}
                            </TableCell>
                            <TableCell className="whitespace-nowrap">
                              {expense.employeePosition}
                            </TableCell>
                            <TableCell className="whitespace-nowrap">
                              {format(new Date(expense.date), "MMM dd, yyyy")}
                            </TableCell>
                            <TableCell className="whitespace-nowrap">
                              {expense.category}
                            </TableCell>
                            <TableCell className="max-w-xs truncate">
                              {expense.description}
                            </TableCell>
                            <TableCell className="whitespace-nowrap font-medium">
                              ₹{(expense.amount || 0).toFixed(2)}
                            </TableCell>
                            <TableCell className="whitespace-nowrap">
                              {getStatusBadge(expense.status)}
                            </TableCell>
                            <TableCell className="whitespace-nowrap">
                              <div className="flex gap-2">
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => handleApprove(expense.employeeName, expense.id)}
                                  disabled={reviewBusy || expense.status !== 'pending'}
                                  aria-label="Approve expense"
                                  className={`h-8 w-8 p-0 ${
                                    expense.status === "approved" 
                                      ? "bg-green-100 border-green-300 text-green-700 hover:bg-green-200" 
                                      : "hover:bg-green-50 hover:border-green-300"
                                  }`}
                                >
                                  <CheckCircle className="h-4 w-4" />
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => handleReject(expense.employeeName, expense.id)}
                                  disabled={reviewBusy || expense.status !== 'pending'}
                                  aria-label="Reject expense"
                                  className={`h-8 w-8 p-0 ${
                                    expense.status === "rejected" 
                                      ? "bg-red-100 border-red-300 text-red-700 hover:bg-red-200" 
                                      : "hover:bg-red-50 hover:border-red-300"
                                  }`}
                                >
                                  <XCircle className="h-4 w-4" />
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))
                    )}
                  </TableBody>
                </Table>
              </div>
      </div>
          </CardContent>
        </Card>
      )}
      <Dialog open={rejectionIds.length > 0} onOpenChange={open => { if (!open && !reviewBusy) setRejectionIds([]); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reject {rejectionIds.length > 1 ? 'expenses' : 'expense'}</DialogTitle>
            <DialogDescription>Explain why this claim cannot be approved.</DialogDescription>
          </DialogHeader>
          <Label htmlFor="expense-rejection-reason">Reason</Label>
          <textarea id="expense-rejection-reason" className="min-h-24 w-full rounded-md border bg-background p-3 text-sm" value={rejectionReason} onChange={event => setRejectionReason(event.target.value)} maxLength={500} disabled={reviewBusy} />
          <DialogFooter>
            <Button variant="outline" disabled={reviewBusy} onClick={() => setRejectionIds([])}>Cancel</Button>
            <Button variant="destructive" disabled={reviewBusy || !rejectionReason.trim()} onClick={() => void reviewExpenses(rejectionIds, 'rejected', rejectionReason)}>{reviewBusy ? 'Saving…' : 'Reject'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
