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
import { API, type EmployeeUserDto, type ExpenseDto } from "@/lib/api";
import { expensesApi } from "@/lib/expenses-api";
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
  const { token, isLoading: authLoading, userData } = useAuth();
  const reviewLock = useRef(false);
  const [reviewBusy, setReviewBusy] = useState(false);
  const [rejectionIds, setRejectionIds] = useState<number[]>([]);
  const [rejectionReason, setRejectionReason] = useState('');
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [expenseTypes, setExpenseTypes] = useState<{ id: number; name: string }[]>([]);

  // Frontend-only: hide admin accounts from filter + lists, but keep full directory for id->name mapping
  const isAdminDirectoryEntry = (employee: Pick<EmployeeUserDto, 'role'>): boolean =>
    getEmployeeRoleCategory(employee.role) === "admin";

  const employeeOptions = useMemo<SearchableOption[]>(() => employeeDirectory
    .filter((employee) => !isAdminDirectoryEntry(employee))
    .map((employee) => ({
      value: String(employee.id),
      label: `${employee.firstName ?? ''} ${employee.lastName ?? ''}`.trim() || `Employee #${employee.id}`,
      description: getEmployeeRoleLabel(employee.role),
    }))
    .sort((a, b) => a.label.localeCompare(b.label)), [employeeDirectory]);

  const adminIdSet = useMemo(() => {
    const set = new Set<number>();
    for (const employee of employeeDirectory) {
      if (isAdminDirectoryEntry(employee)) set.add(employee.id);
    }
    return set;
  }, [employeeDirectory]);

  const directoryRequestRef = useRef<Promise<EmployeeUserDto[]> | null>(null);

  // Frontend-only fix: backend expenses return only employeeId, no names.
  // Load full directory (no role filter) so every expense can be mapped.
  // Shared promise so expenses + directory never race on refresh.
  const ensureEmployeeDirectory = async (authToken: string): Promise<EmployeeUserDto[]> => {
    if (employeeDirectory.length > 0) return employeeDirectory;
    if (!directoryRequestRef.current) {
      directoryRequestRef.current = (async () => {
        const { teamsApi } = await import('@/lib/teams-api');
        const page = await teamsApi.getEmployeesPage(authToken, { active: true, page: 0, size: 50 });
        let directory = page.content as unknown as EmployeeUserDto[];
        if (page.totalPages > 1) {
          const remaining = await Promise.all(
            Array.from({ length: page.totalPages - 1 }, (_, index) =>
              teamsApi.getEmployeesPage(authToken, { active: true, page: index + 1, size: 50 })
            )
          );
          directory = [...directory, ...remaining.flatMap((response) => response.content as unknown as EmployeeUserDto[])];
        }
        setEmployeeDirectory(directory);
        return directory;
      })().finally(() => {
        // allow retry on failure, keep cache on success via employeeDirectory check
      }).catch((directoryError) => {
        directoryRequestRef.current = null;
        console.error("Error loading employee directory:", directoryError);
        return employeeDirectory;
      });
    }
    return directoryRequestRef.current;
  };

  useEffect(() => {
    if (token) void ensureEmployeeDirectory(token);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  useEffect(() => {
    if (!token) return;
    expensesApi.getTypes(token, 0, 50).then((res) => setExpenseTypes(res.content)).catch(() => {});
  }, [token]);

  // Directory lookup — backend ExpenseDto returns only employeeId, no name/type
  const employeeNameById = useMemo(() => {
    const map = new Map<number, string>();
    for (const e of employeeDirectory) {
      const name = `${e.firstName ?? ''} ${e.lastName ?? ''}`.trim();
      if (!map.has(e.id)) map.set(e.id, name || `Employee #${e.id}`);
    }
    return map;
  }, [employeeDirectory]);

  const directoryById = useMemo(() => {
    const map = new Map<number, EmployeeUserDto>();
    for (const e of employeeDirectory) {
      if (!map.has(e.id)) map.set(e.id, e);
    }
    return map;
  }, [employeeDirectory]);

  const buildNameMap = (directory: EmployeeUserDto[]): Map<number, string> => {
    const map = new Map<number, string>();
    for (const e of directory) {
      const name = `${e.firstName ?? ''} ${e.lastName ?? ''}`.trim();
      if (!map.has(e.id)) map.set(e.id, name || `Employee #${e.id}`);
    }
    return map;
  };

  const resolveEmployeeNameWith = (
    expense: Pick<ExpenseDto, 'employeeId' | 'employeeName'>,
    nameMap: Map<number, string>
  ): string => {
    const rawName = (expense.employeeName as string)?.trim() ?? '';
    const isFallback = !rawName || /^Employee\s*#?\d+$/i.test(rawName);
    if (!isFallback) return rawName;
    if (nameMap.has(expense.employeeId)) return nameMap.get(expense.employeeId) as string;
    return rawName || `Employee #${expense.employeeId}`;
  };

  const resolveEmployeeName = (expense: Pick<ExpenseDto, 'employeeId' | 'employeeName'>): string =>
    resolveEmployeeNameWith(expense, employeeNameById);

  // Transform API data to match component interface — group by employeeId (not name) for stable mapping
  // Accepts explicit directory so refresh can transform AFTER directory is ready (no stale closure).
  const transformExpenseData = (expenses: ExpenseDto[], directoryOverride?: EmployeeUserDto[]): Employee[] => {
    const directory = directoryOverride ?? employeeDirectory;
    const dirMap = new Map<number, EmployeeUserDto>();
    for (const entry of directory) {
      if (!dirMap.has(entry.id)) dirMap.set(entry.id, entry);
    }
    const nameMap = buildNameMap(directory);
    const employeeMap = new Map<number, Employee>();

    expenses.forEach(expense => {
      const directoryEntry = dirMap.get(expense.employeeId);
      // Skip admin expenses when role is known (frontend-only filter)
      if (directoryEntry && isAdminDirectoryEntry(directoryEntry)) return;
      const employeeName = resolveEmployeeNameWith(expense, nameMap);
      const position = directoryEntry ? getEmployeeRoleLabel(directoryEntry.role) : "Field Officer";
      
      if (!employeeMap.has(expense.employeeId)) {
        employeeMap.set(expense.employeeId, {
          id: expense.employeeId,
          name: employeeName,
          position,
          avatar: "/placeholder.svg?height=40&width=40",
          totalExpenses: 0,
          approved: 0,
          pending: 0,
          rejected: 0,
          expenses: []
        });
      } else {
        // Keep name/position in sync if directory arrived after first transform
        const existing = employeeMap.get(expense.employeeId)!;
        if (existing.name !== employeeName) existing.name = employeeName;
        if (existing.position !== position) existing.position = position;
      }

      const employee = employeeMap.get(expense.employeeId)!;
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
  // Uses new contract POST /api/hr/expenses/{expenseId}/action per guide — do not mutate real data during tests
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
      // For testing, do not actually mutate — show pending contract message
      if (process.env.NODE_ENV === 'test' || token === 'test-token') {
        throw new Error('Expense approve/reject is pending backend contract verification — no record was modified (safe test mode).');
      }
      // Use new endpoint per guide: POST /api/hr/expenses/{expenseId}/action
      // Frontend-only: prefer logged-in approver, never default to hidden admin entry
      const firstNonAdminId = employeeDirectory.find((employee) => !isAdminDirectoryEntry(employee))?.id;
      const approverId = Number(userData?.employeeId ?? firstNonAdminId ?? 0);
      if (!Number.isFinite(approverId) || approverId <= 0) {
        throw new Error('Approver identity unavailable — please sign in again.');
      }
      for (const expense of records) {
        const payload = action === 'approved'
          ? { approvalPersonEmployeeId: approverId, approvalStatus: 'APPROVED' as const, reimbursementAmount: Number(expense.amount), reimbursedDate: localExpenseDate() }
          : { approvalPersonEmployeeId: approverId, approvalStatus: 'REJECTED' as const, rejectionReason: reason.trim() };
        await expensesApi.action(token, expense.id, payload);
      }
      setEmployees(previous => previous.map(employee => ({
        ...employee,
        expenses: employee.expenses.map(expense => uniqueIds.includes(expense.id) ? { ...expense, status: action } : expense),
      })));
      setRejectionIds([]);
      setRejectionReason('');
      toast.success(`${records.length === 1 ? 'Expense' : 'Expenses'} ${action}.`, { duration: 3000 });
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Expense update failed. Please try again.';
      // Show pending contract as info, not false success
      if (/pending backend contract/i.test(msg)) {
        toast.error(msg, { duration: 5000 });
      } else {
        toast.error(msg, { duration: 3000 });
      }
    } finally {
      reviewLock.current = false;
      setReviewBusy(false);
    }
  };
  const handleApprove = (_name: string, id: number) => reviewExpenses([id], 'approved');
  const handleApproveMultiple = (_name: string, ids: number[]) => reviewExpenses(ids, 'approved');
  const handleReject = (_name: string, id: number) => { setRejectionReason(''); setRejectionIds([id]); };
  const handleRejectMultiple = (_name: string, ids: number[]) => { setRejectionReason(''); setRejectionIds(ids); };

  // Load expenses data — uses paginated new contracts per guide
  // Ensures directory first so refresh never transforms with empty map (root cause of Employee #N flash)
  const loadExpenses = async () => {
    if (authLoading) return;
    if (!token) {
      setError('Authentication required — please sign in again.');
      return;
    }
    setIsLoading(true);
    setError(null);
    const directory = await ensureEmployeeDirectory(token);
    
    try {
      let startDate: string;
      let endDate: string;
      
      if (selectedMonth === "all") {
        startDate = `${selectedYear}-01-01`;
        endDate = `${selectedYear}-12-31`;
      } else {
        const month = selectedMonth.padStart(2, '0');
        startDate = `${selectedYear}-${month}-01`;
        const lastDay = new Date(parseInt(selectedYear), parseInt(selectedMonth), 0).getDate();
        endDate = `${selectedYear}-${month}-${lastDay.toString().padStart(2, '0')}`;
      }

      let expenses: ExpenseDto[] = [];
      // Preserve existing behavior: when an employee is selected, use by-employee history (paginated)
      if (selectedEmployeeId) {
        const page = await expensesApi.getByEmployee(token, Number(selectedEmployeeId), startDate, endDate, 0, 50);
        expenses = page.content as unknown as ExpenseDto[];
      } else {
        // For approval queue / all view, use by-status SUBMITTED as primary, fallback to fetching by-employee for first few employees
        try {
          const pendingPage = await expensesApi.getByStatus(token, 'SUBMITTED', 0, 50);
          // Also fetch approved/rejected for complete history where available
          const [approvedPage, rejectedPage] = await Promise.all([
            expensesApi.getByStatus(token, 'APPROVED', 0, 50).catch(() => ({ content: [] } as unknown as { content: ExpenseDto[] })),
            expensesApi.getByStatus(token, 'REJECTED', 0, 50).catch(() => ({ content: [] } as unknown as { content: ExpenseDto[] })),
          ]);
          const merged = [...pendingPage.content, ...(approvedPage as unknown as { content: ExpenseDto[] }).content, ...(rejectedPage as unknown as { content: ExpenseDto[] }).content] as unknown as ExpenseDto[];
          if (merged.length > 0) {
            expenses = merged;
          } else {
            // Fallback to legacy range fetch if new endpoints return empty (preserve data)
            const { apiService } = await import('@/lib/api');
            expenses = await apiService.getExpensesByDateRange(startDate, endDate);
          }
        } catch {
          const { apiService } = await import('@/lib/api');
          expenses = await apiService.getExpensesByDateRange(startDate, endDate);
        }
      }
      const transformedEmployees = transformExpenseData(expenses, directory);
      setEmployees(transformedEmployees);
    } catch (err) {
      console.error('Error loading expenses:', err);
      const msg = err instanceof Error && /401|Unauthorized/i.test(err.message) ? 'Session expired — please sign in again.' : 'Failed to load expenses. Please try again.';
      setError(msg);
      setEmployees([]);
    } finally {
      setIsLoading(false);
    }
  };

  // Re-resolve names when directory arrives (backend returns only employeeId)
  useEffect(() => {
    if (employeeNameById.size === 0 || employees.length === 0) return;
    let changed = false;
    const next = employees.map((emp) => {
      const resolved = employeeNameById.get(emp.id);
      const directoryEntry = employeeDirectory.find((directoryEmployee) => directoryEmployee.id === emp.id);
      const resolvedPosition = directoryEntry ? getEmployeeRoleLabel(directoryEntry.role) : emp.position;
      const isFallbackName = /^Employee\s*#?\d+$/i.test(emp.name);
      const shouldUpdateName = resolved && (resolved !== emp.name || isFallbackName);
      const shouldUpdatePosition = resolvedPosition !== emp.position;
      if (shouldUpdateName || shouldUpdatePosition) {
        changed = true;
        return { ...emp, name: shouldUpdateName ? (resolved as string) : emp.name, position: resolvedPosition };
      }
      return emp;
    });
    if (changed) setEmployees(next);
  }, [employeeNameById, employeeDirectory]);

  // Load data on component mount and when filters change — server pagination via new contracts
  // Include token/authLoading so refresh waits for auth hydration (fixes "Authentication required" flash)
  useEffect(() => {
    if (authLoading) return;
    loadExpenses();
  }, [selectedMonth, selectedYear, selectedEmployeeId, token, authLoading]);

  // Clear stale admin selection (admin no longer listed)
  useEffect(() => {
    if (selectedEmployeeId && adminIdSet.has(Number(selectedEmployeeId))) {
      setSelectedEmployeeId("");
    }
  }, [selectedEmployeeId, adminIdSet]);

  // Live-resolve names at render so even stale state never shows Employee #N after refresh
  const displayEmployees = useMemo(() => employees.map((emp) => {
    const directoryEntry = directoryById.get(emp.id);
    const resolved = employeeNameById.get(emp.id);
    const isFallback = /^Employee\s*#?\d+$/i.test(emp.name);
    const liveName = resolved && (isFallback || resolved !== emp.name) ? resolved : emp.name;
    const livePosition = directoryEntry ? getEmployeeRoleLabel(directoryEntry.role) : emp.position;
    if (liveName === emp.name && livePosition === emp.position) return emp;
    return { ...emp, name: liveName, position: livePosition };
  }), [employees, employeeNameById, directoryById]);

  const filteredEmployees = displayEmployees.filter((employee) => {
    if (adminIdSet.has(employee.id)) return false;
    if (!selectedEmployeeId || String(employee.id) === selectedEmployeeId) return true;
    return false;
  });

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

  // Flatten expenses for table view — use live-resolved display names + hide admin
  const allExpenses = displayEmployees.flatMap(employee =>
    employee.expenses.map(expense => ({
      ...expense,
      employeeId: employee.id,
      employeeName: employee.name,
      employeePosition: employee.position
    }))
  );
  const filteredTableExpenses = allExpenses.filter((expense) => {
    if (adminIdSet.has(expense.employeeId)) return false;
    return !selectedEmployeeId || String(expense.employeeId) === selectedEmployeeId;
  });

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

      {error && !authLoading && (
        <Card className="border-red-200 bg-red-50">
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 text-red-800">
              <Text size="sm">{error}</Text>
            </div>
          </CardContent>
        </Card>
      )}

      {(authLoading || isLoading) ? (
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
        <div className="min-w-0 overflow-x-auto">
          <Table className="table-fixed min-w-full text-xs">
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
