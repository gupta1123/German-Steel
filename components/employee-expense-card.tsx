import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { 
  CheckCircle, 
  Clock, 
  XCircle,
  Check,
  X,
  Calendar
} from "lucide-react";
import { format } from "date-fns";
import { Heading, Text } from "@/components/ui/typography";
import { Separator } from "@/components/ui/separator";

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

interface EmployeeExpenseCardProps {
  employee: Employee;
  showExpenses: boolean;
  onToggleExpenses: () => void;
  onApprove?: (employeeName: string, expenseId: number) => void;
  onReject?: (employeeName: string, expenseId: number) => void;
  onApproveMultiple?: (employeeName: string, expenseIds: number[]) => void;
  onRejectMultiple?: (employeeName: string, expenseIds: number[]) => void;
}

export default function EmployeeExpenseCard({ employee, showExpenses, onToggleExpenses, onApprove, onReject, onApproveMultiple, onRejectMultiple }: EmployeeExpenseCardProps) {
  const [expenses, setExpenses] = useState(employee.expenses);
  const [selectedExpenseIds, setSelectedExpenseIds] = useState<number[]>([]);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "approved":
        return <Badge className="bg-green-100 text-green-800 hover:bg-green-100 text-xs py-0.5"><CheckCircle className="mr-1 h-2.5 w-2.5" />Approved</Badge>;
      case "pending":
        return <Badge className="bg-yellow-100 text-yellow-800 hover:bg-yellow-100 text-xs py-0.5"><Clock className="mr-1 h-2.5 w-2.5" />Pending</Badge>;
      case "rejected":
        return <Badge className="bg-red-100 text-red-800 hover:bg-red-100 text-xs py-0.5"><XCircle className="mr-1 h-2.5 w-2.5" />Rejected</Badge>;
      default:
        return <Badge className="text-xs py-0.5">{status}</Badge>;
    }
  };

  const updateExpenseStatus = (id: number | number[], newStatus: "approved" | "rejected") => {
    setExpenses(prevExpenses => 
      prevExpenses.map(expense => 
        Array.isArray(id) 
          ? (id.includes(expense.id) ? { ...expense, status: newStatus } : expense)
          : (expense.id === id ? { ...expense, status: newStatus } : expense)
      )
    );
  };

  const updateAllExpensesStatus = (newStatus: "approved" | "rejected") => {
    setExpenses(prevExpenses => 
      prevExpenses.map(expense => 
        expense.status === "pending" ? { ...expense, status: newStatus } : expense
      )
    );
  };

  // Calculate totals and counts
  const calculateTotals = () => {
    return expenses.reduce((acc, expense) => {
      const amount = expense.amount || 0;
      acc.total += amount;
      if (expense.status === "approved") {
        acc.approved += amount;
        acc.approvedCount += 1;
      }
      if (expense.status === "pending") {
        acc.pending += amount;
        acc.pendingCount += 1;
      }
      if (expense.status === "rejected") {
        acc.rejected += amount;
        acc.rejectedCount += 1;
      }
      return acc;
    }, {
      total: 0,
      approved: 0,
      pending: 0,
      rejected: 0,
      approvedCount: 0,
      pendingCount: 0,
      rejectedCount: 0
    });
  };

  const totals = calculateTotals();

  return (
    <Card className="w-full hover:shadow-md transition-shadow">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="bg-gray-200 border-2 border-dashed rounded-xl w-10 h-10 flex items-center justify-center">
              <span className="text-gray-600 font-medium text-sm">
                {employee.name.split(' ').map(n => n[0]).join('').toUpperCase()}
              </span>
            </div>
            <div>
              <Heading as="h3" size="lg" weight="semibold">
                {employee.name}
              </Heading>
              <Text size="sm" tone="muted">
                {employee.position}
              </Text>
            </div>
          </div>
          <div className="text-right">
            <Heading as="p" size="md" weight="semibold">
              ₹{totals.total.toFixed(2)}
            </Heading>
            <Text size="xs" tone="muted">
              Total Expenses
            </Text>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-3 gap-2 mb-4">
          <div className="bg-green-50 p-2 rounded text-center">
            <Heading as="p" size="md" weight="semibold" className="text-green-800">
              ₹{totals.approved.toFixed(2)}
            </Heading>
            <Text size="xs" tone="muted" className="text-green-700">
              Approved
            </Text>
          </div>
          <div className="bg-yellow-50 p-2 rounded text-center">
            <Heading as="p" size="md" weight="semibold" className="text-yellow-800">
              ₹{totals.pending.toFixed(2)}
            </Heading>
            <Text size="xs" tone="muted" className="text-yellow-700">
              Pending
            </Text>
          </div>
          <div className="bg-red-50 p-2 rounded text-center">
            <Heading as="p" size="md" weight="semibold" className="text-red-800">
              ₹{totals.rejected.toFixed(2)}
            </Heading>
            <Text size="xs" tone="muted" className="text-red-700">
              Rejected
            </Text>
          </div>
        </div>
        
        <Button 
          variant="outline" 
          className="w-full"
          onClick={onToggleExpenses}
        >
          {showExpenses ? "Hide Expenses" : "Show Expenses"}
        </Button>
        
        {showExpenses && (
          <div className="space-y-3 mt-4 pt-4">
            <Separator />
            <div className="space-y-2 max-h-60 overflow-y-auto">
              {expenses.map((expense) => (
                <div key={expense.id} className="flex items-center justify-between p-2 hover:bg-muted rounded">
                  <div className="flex items-center gap-2 min-w-0 flex-1">
                    <Checkbox
                      checked={selectedExpenseIds.includes(expense.id)}
                      onCheckedChange={(checked: boolean) => {
                        if (checked) {
                          setSelectedExpenseIds(prev => [...prev, expense.id]);
                        } else {
                          setSelectedExpenseIds(prev => prev.filter(id => id !== expense.id));
                        }
                      }}
                    />
                    <div>
                      <Heading as="p" size="sm" weight="medium" className="truncate">
                        {expense.category}
                      </Heading>
                      <div className="flex items-center gap-1">
                        <Calendar className="h-3 w-3 text-muted-foreground" />
                        <Text size="xs" tone="muted">
                          {format(new Date(expense.date), "MMM d, yyyy")}
                        </Text>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <Heading as="p" size="sm" weight="medium" className="mr-2">
                      ₹{(expense.amount || 0).toFixed(2)}
                    </Heading>
                    {expense.status === "pending" ? (
                      <>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-8 w-8"
                          onClick={() => {
                            updateExpenseStatus(expense.id, "approved");
                            onApprove?.(employee.name, expense.id);
                          }}
                        >
                          <Check className="h-4 w-4 text-green-600" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-8 w-8"
                          onClick={() => {
                            updateExpenseStatus(expense.id, "rejected");
                            onReject?.(employee.name, expense.id);
                          }}
                        >
                          <X className="h-4 w-4 text-red-600" />
                        </Button>
                      </>
                    ) : (
                      getStatusBadge(expense.status)
                    )}
                  </div>
                </div>
              ))}
            </div>
            
            {expenses.some(expense => expense.status === "pending") && (
              <div className="flex gap-2 pt-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="flex-1"
                  onClick={() => {
                    const pendingExpenseIds = expenses
                      .filter(expense => expense.status === "pending")
                      .map(expense => expense.id);
                    updateAllExpensesStatus("approved");
                    onApproveMultiple?.(employee.name, pendingExpenseIds);
                    setSelectedExpenseIds([]);
                  }}
                >
                  Approve All
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="flex-1"
                  onClick={() => {
                    const pendingExpenseIds = expenses
                      .filter(expense => expense.status === "pending")
                      .map(expense => expense.id);
                    updateAllExpensesStatus("rejected");
                    onRejectMultiple?.(employee.name, pendingExpenseIds);
                    setSelectedExpenseIds([]);
                  }}
                >
                  Reject All
                </Button>
              </div>
            )}
            
            {selectedExpenseIds.length > 0 && (
              <div className="flex gap-2 pt-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="flex-1"
                  onClick={() => {
                    updateExpenseStatus(selectedExpenseIds, "approved");
                    onApproveMultiple?.(employee.name, selectedExpenseIds);
                    setSelectedExpenseIds([]);
                  }}
                >
                  Approve Selected ({selectedExpenseIds.length})
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="flex-1"
                  onClick={() => {
                    updateExpenseStatus(selectedExpenseIds, "rejected");
                    onRejectMultiple?.(employee.name, selectedExpenseIds);
                    setSelectedExpenseIds([]);
                  }}
                >
                  Reject Selected ({selectedExpenseIds.length})
                </Button>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
