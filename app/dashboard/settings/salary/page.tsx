"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select";
import { useState } from "react";
import { DollarSign, Calendar, User, Filter } from "lucide-react";

// Mock data for field officers
const fieldOfficers = [
  "All Field Officers",
  "Alice Smith",
  "Bob Johnson",
  "Charlie Brown",
  "Diana Prince",
  "Bruce Wayne",
  "Clark Kent",
  "Peter Parker",
  "Tony Stark",
  "Steve Rogers"
];

// Mock data for months
const months = [
  { value: "0", label: "January" },
  { value: "1", label: "February" },
  { value: "2", label: "March" },
  { value: "3", label: "April" },
  { value: "4", label: "May" },
  { value: "5", label: "June" },
  { value: "6", label: "July" },
  { value: "7", label: "August" },
  { value: "8", label: "September" },
  { value: "9", label: "October" },
  { value: "10", label: "November" },
  { value: "11", label: "December" }
];

// Mock data for years
const years = [
  "2023",
  "2024",
  "2025"
];

// Mock salary data
const mockSalaryData = [
  {
    id: 1,
    employeeName: "Alice Smith",
    fullDays: 22,
    halfDays: 4,
    baseSalary: 25000,
    ta: 3000,
    da: 1500,
    expense: 5000,
    totalSalary: 34500
  },
  {
    id: 2,
    employeeName: "Bob Johnson",
    fullDays: 20,
    halfDays: 6,
    baseSalary: 25000,
    ta: 3000,
    da: 1500,
    expense: 4200,
    totalSalary: 33700
  },
  {
    id: 3,
    employeeName: "Charlie Brown",
    fullDays: 24,
    halfDays: 2,
    baseSalary: 25000,
    ta: 3000,
    da: 1500,
    expense: 5800,
    totalSalary: 35300
  },
  {
    id: 4,
    employeeName: "Diana Prince",
    fullDays: 21,
    halfDays: 5,
    baseSalary: 25000,
    ta: 3000,
    da: 1500,
    expense: 4700,
    totalSalary: 34200
  },
  {
    id: 5,
    employeeName: "Bruce Wayne",
    fullDays: 23,
    halfDays: 3,
    baseSalary: 25000,
    ta: 3000,
    da: 1500,
    expense: 5200,
    totalSalary: 34700
  },
  {
    id: 6,
    employeeName: "Clark Kent",
    fullDays: 19,
    halfDays: 7,
    baseSalary: 25000,
    ta: 3000,
    da: 1500,
    expense: 3900,
    totalSalary: 33400
  },
  {
    id: 7,
    employeeName: "Peter Parker",
    fullDays: 22,
    halfDays: 4,
    baseSalary: 25000,
    ta: 3000,
    da: 1500,
    expense: 5100,
    totalSalary: 34600
  },
  {
    id: 8,
    employeeName: "Tony Stark",
    fullDays: 25,
    halfDays: 1,
    baseSalary: 45000,
    ta: 5000,
    da: 2000,
    expense: 7500,
    totalSalary: 59500
  },
  {
    id: 9,
    employeeName: "Steve Rogers",
    fullDays: 20,
    halfDays: 6,
    baseSalary: 45000,
    ta: 5000,
    da: 2000,
    expense: 6800,
    totalSalary: 58800
  }
];

export default function SalarySettings() {
  const [selectedOfficer, setSelectedOfficer] = useState("All Field Officers");
  const [selectedMonth, setSelectedMonth] = useState("7"); // August
  const [selectedYear, setSelectedYear] = useState("2023");

  const filteredSalaryData = selectedOfficer === "All Field Officers" 
    ? mockSalaryData 
    : mockSalaryData.filter(employee => employee.employeeName === selectedOfficer);

  const totalBaseSalary = filteredSalaryData.reduce((sum, employee) => sum + employee.baseSalary, 0);
  const totalTA = filteredSalaryData.reduce((sum, employee) => sum + employee.ta, 0);
  const totalDA = filteredSalaryData.reduce((sum, employee) => sum + employee.da, 0);
  const totalExpense = filteredSalaryData.reduce((sum, employee) => sum + employee.expense, 0);
  const totalSalary = filteredSalaryData.reduce((sum, employee) => sum + employee.totalSalary, 0);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4">
        <h1 className="text-3xl font-bold">Salary Management</h1>
        <p className="text-muted-foreground">
          View and manage employee salaries with detailed breakdowns
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-5 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Base Salary</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">₹{totalBaseSalary.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">Total base salaries</p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">TA</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">₹{totalTA.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">Total travel allowance</p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">DA</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">₹{totalDA.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">Total dearness allowance</p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Expenses</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">₹{totalExpense.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">Total reimbursed expenses</p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Salary</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">₹{totalSalary.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">Overall payroll cost</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Filter className="h-5 w-5" />
            Filters
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="space-y-2">
              <Label>Field Officer</Label>
              <Select value={selectedOfficer} onValueChange={setSelectedOfficer}>
                <SelectTrigger>
                  <SelectValue placeholder="Select officer" />
                </SelectTrigger>
                <SelectContent>
                  {fieldOfficers.map((officer) => (
                    <SelectItem key={officer} value={officer}>
                      {officer}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            <div className="space-y-2">
              <Label>Month</Label>
              <Select value={selectedMonth} onValueChange={setSelectedMonth}>
                <SelectTrigger>
                  <SelectValue placeholder="Select month" />
                </SelectTrigger>
                <SelectContent>
                  {months.map((month) => (
                    <SelectItem key={month.value} value={month.value}>
                      {month.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            <div className="space-y-2">
              <Label>Year</Label>
              <Select value={selectedYear} onValueChange={setSelectedYear}>
                <SelectTrigger>
                  <SelectValue placeholder="Select year" />
                </SelectTrigger>
                <SelectContent>
                  {years.map((year) => (
                    <SelectItem key={year} value={year}>
                      {year}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            <div className="flex items-end">
              <Button className="w-full">
                <Calendar className="mr-2 h-4 w-4" />
                Apply Filters
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <User className="h-5 w-5" />
            Salary Details
          </CardTitle>
          <CardDescription>
            Detailed salary breakdown for {selectedMonth !== "7" ? months.find(m => m.value === selectedMonth)?.label : "August"} {selectedYear}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Employee Name</TableHead>
                  <TableHead className="text-center">Full Days</TableHead>
                  <TableHead className="text-center">Half Days</TableHead>
                  <TableHead>Base Salary</TableHead>
                  <TableHead>TA</TableHead>
                  <TableHead>DA</TableHead>
                  <TableHead>Expense</TableHead>
                  <TableHead className="text-right">Total Salary</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredSalaryData.map((employee) => (
                  <TableRow key={employee.id}>
                    <TableCell className="font-medium">{employee.employeeName}</TableCell>
                    <TableCell className="text-center">
                      <Badge variant="default">{employee.fullDays}</Badge>
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge variant="secondary">{employee.halfDays}</Badge>
                    </TableCell>
                    <TableCell>₹{employee.baseSalary.toLocaleString()}</TableCell>
                    <TableCell>₹{employee.ta.toLocaleString()}</TableCell>
                    <TableCell>₹{employee.da.toLocaleString()}</TableCell>
                    <TableCell>₹{employee.expense.toLocaleString()}</TableCell>
                    <TableCell className="text-right font-semibold">₹{employee.totalSalary.toLocaleString()}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}