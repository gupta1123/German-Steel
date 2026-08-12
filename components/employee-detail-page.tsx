"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { 
  Phone, 
  Mail, 
  MapPin, 
  Calendar, 
  User, 
  Building, 
  Clock, 
  Plus,
  MoreHorizontal,
  Edit,
  Trash2,
  CalendarIcon,
  CheckCircle,
  CreditCard,
  Tag,
  Search
} from "lucide-react";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Heading, Text } from "@/components/ui/typography";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface Employee {
  id: number;
  name: string;
  email: string;
  phone: string;
  position: string;
  department: string;
  hireDate: string;
  status: string;
  avatar: string;
  employeeId: string;
  manager: string;
  location: string;
}

interface Visit {
  id: number;
  date: string;
  customer: string;
  purpose: string;
  outcome: string;
  duration: string;
}

interface Attendance {
  id: number;
  date: string;
  status: "present" | "absent" | "leave" | "holiday";
  checkIn: string;
  checkOut: string;
  hours: string;
}

interface Expense {
  id: number;
  date: string;
  category: string;
  amount: number;
  description: string;
  status: "pending" | "approved" | "rejected";
}

interface Pricing {
  id: number;
  date: string;
  brand: string;
  product: string;
  price: number;
  competitorPrice: number;
  location: string;
}

const mockVisits: Visit[] = [
  {
    id: 1,
    date: "2023-06-15",
    customer: "The Corner Store",
    purpose: "Product Demo",
    outcome: "Positive feedback received",
    duration: "1h 30m"
  },
  {
    id: 2,
    date: "2023-06-10",
    customer: "Main Street Books",
    purpose: "Follow-up meeting",
    outcome: "Scheduled next visit",
    duration: "45m"
  },
  {
    id: 3,
    date: "2023-06-05",
    customer: "Tech Gadgets",
    purpose: "Initial consultation",
    outcome: "Requirements gathered",
    duration: "1h 15m"
  }
];

const mockAttendance: Attendance[] = [
  {
    id: 1,
    date: "2023-06-15",
    status: "present",
    checkIn: "09:00 AM",
    checkOut: "05:30 PM",
    hours: "8.5h"
  },
  {
    id: 2,
    date: "2023-06-14",
    status: "present",
    checkIn: "08:45 AM",
    checkOut: "05:15 PM",
    hours: "8.5h"
  },
  {
    id: 3,
    date: "2023-06-13",
    status: "leave",
    checkIn: "-",
    checkOut: "-",
    hours: "0h"
  },
  {
    id: 4,
    date: "2023-06-12",
    status: "present",
    checkIn: "09:15 AM",
    checkOut: "05:45 PM",
    hours: "8.5h"
  }
];

const mockExpenses: Expense[] = [
  {
    id: 1,
    date: "2023-06-15",
    category: "Travel",
    amount: 45.50,
    description: "Taxi to client meeting",
    status: "approved"
  },
  {
    id: 2,
    date: "2023-06-10",
    category: "Meals",
    amount: 32.75,
    description: "Lunch with client",
    status: "pending"
  },
  {
    id: 3,
    date: "2023-06-05",
    category: "Supplies",
    amount: 15.99,
    description: "Office supplies",
    status: "approved"
  }
];

const mockPricing: Pricing[] = [
  {
    id: 1,
    date: "2023-06-15",
    brand: "Brand A",
    product: "Product X",
    price: 29.99,
    competitorPrice: 32.99,
    location: "New York"
  },
  {
    id: 2,
    date: "2023-06-15",
    brand: "Brand B",
    product: "Product Y",
    price: 45.50,
    competitorPrice: 42.99,
    location: "New York"
  },
  {
    id: 3,
    date: "2023-06-14",
    brand: "Brand A",
    product: "Product Z",
    price: 19.99,
    competitorPrice: 18.99,
    location: "New York"
  }
];

const brands = ["Brand A", "Brand B", "Brand C", "Brand D"];
const products = ["Product X", "Product Y", "Product Z", "Product W"];
const locations = ["New York", "Los Angeles", "Chicago", "Houston"];

export default function EmployeeDetailPage({ employee }: { employee: Employee }) {
  const [activeTab, setActiveTab] = useState("visits");
  const [brand, setBrand] = useState("");
  const [product, setProduct] = useState("");
  const [price, setPrice] = useState("");
  const [competitorPrice, setCompetitorPrice] = useState("");
  const [location, setLocation] = useState("");
  const [pricingDate, setPricingDate] = useState(format(new Date(), "yyyy-MM-dd"));


  const handleAddPricing = () => {
    // In a real app, this would submit the form data
    alert(`Pricing added for ${brand} - ${product} on ${pricingDate}`);
    // Reset form
    setBrand("");
    setProduct("");
    setPrice("");
    setCompetitorPrice("");
    setLocation("");
  };

  return (
    <div className="flex flex-col h-full pb-20 md:pb-0">
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-3 gap-4 md:gap-6">
        {/* Left Panel - Employee Info and Actions */}
        <div className="lg:col-span-1 space-y-4 md:space-y-6">
          <Card>
            <CardHeader className="pb-3">
              <div className="flex justify-between items-start">
                <div>
                  <Heading as="h2" size="xl" weight="semibold" className="text-lg md:text-xl">
                    Employee Details
                  </Heading>
                  <Text tone="muted" size="sm">
                    Information and actions
                  </Text>
                </div>
                <Button variant="ghost" size="icon">
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-4 md:space-y-6">
              <div className="flex items-start gap-3 md:gap-4">
                <div className="h-12 w-12 md:h-14 md:w-14 rounded-xl border-2 border-dashed bg-muted flex-shrink-0" />
                <div className="flex-1 min-w-0 space-y-2 md:space-y-3">
                <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 space-y-1">
                      <Heading as="h3" size="lg" weight="semibold" className="truncate text-base md:text-lg">
                        {employee.name}
                      </Heading>
                      <Text size="sm" tone="muted" className="truncate text-xs md:text-sm">
                        {employee.position}
                      </Text>
                    </div>
                    <Badge variant="outline" className="flex-shrink-0 text-xs">
                      {employee.status}
                    </Badge>
                  </div>
                  <Text size="xs" tone="muted">
                    Joined {format(new Date(employee.hireDate), "MMM d, yyyy")}
                  </Text>
                </div>
              </div>

              <Separator />

              <div className="space-y-2 md:space-y-3">
                <div className="flex items-center gap-2 md:gap-3">
                  <div className="bg-muted p-1.5 md:p-2 rounded-lg flex-shrink-0">
                    <Building className="h-3.5 w-3.5 md:h-4 md:w-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs md:text-sm font-medium truncate">{employee.employeeId}</p>
                    <p className="text-xs text-muted-foreground">Employee ID</p>
                  </div>
                </div>

                <div className="flex items-center gap-2 md:gap-3">
                  <div className="bg-muted p-1.5 md:p-2 rounded-lg flex-shrink-0">
                    <Mail className="h-3.5 w-3.5 md:h-4 md:w-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs md:text-sm font-medium truncate">{employee.email}</p>
                    <p className="text-xs text-muted-foreground">Email</p>
                  </div>
                </div>

                <div className="flex items-center gap-2 md:gap-3">
                  <div className="bg-muted p-1.5 md:p-2 rounded-lg flex-shrink-0">
                    <Phone className="h-3.5 w-3.5 md:h-4 md:w-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs md:text-sm font-medium truncate">{employee.phone}</p>
                    <p className="text-xs text-muted-foreground">Phone</p>
                  </div>
                </div>

                <div className="flex items-center gap-2 md:gap-3">
                  <div className="bg-muted p-1.5 md:p-2 rounded-lg flex-shrink-0">
                    <MapPin className="h-3.5 w-3.5 md:h-4 md:w-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs md:text-sm font-medium truncate">{employee.location}</p>
                    <p className="text-xs text-muted-foreground">Location</p>
                  </div>
                </div>

                <div className="flex items-center gap-2 md:gap-3">
                  <div className="bg-muted p-1.5 md:p-2 rounded-lg flex-shrink-0">
                    <Calendar className="h-3.5 w-3.5 md:h-4 md:w-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs md:text-sm font-medium truncate">
                      {format(new Date(employee.hireDate), "MMM d, yyyy")}
                    </p>
                    <p className="text-xs text-muted-foreground">Hire Date</p>
                  </div>
                </div>

                <div className="flex items-center gap-2 md:gap-3">
                  <div className="bg-muted p-1.5 md:p-2 rounded-lg flex-shrink-0">
                    <User className="h-3.5 w-3.5 md:h-4 md:w-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs md:text-sm font-medium truncate">{employee.manager}</p>
                    <p className="text-xs text-muted-foreground">Manager</p>
                  </div>
                </div>
              </div>

              <Separator />

              <div className="flex flex-wrap gap-2">
                <Button className="flex-1 min-w-[120px] text-sm">
                  <Edit className="mr-1.5 md:mr-2 h-3.5 w-3.5 md:h-4 md:w-4" />
                  Edit
                </Button>
                <Button variant="outline" className="flex-1 min-w-[120px] text-sm">
                  <Phone className="mr-1.5 md:mr-2 h-3.5 w-3.5 md:h-4 md:w-4" />
                  Call
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card className="hidden md:block">
            <CardHeader>
              <CardTitle className="text-lg">Quick Actions</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <Button variant="outline" className="w-full justify-start">
                <Plus className="mr-2 h-4 w-4" />
                Schedule Visit
              </Button>
              <Button variant="outline" className="w-full justify-start">
                <CreditCard className="mr-2 h-4 w-4" />
                Submit Expense
              </Button>
              <Button variant="outline" className="w-full justify-start">
                <CalendarIcon className="mr-2 h-4 w-4" />
                Log Attendance
              </Button>
              <Button variant="outline" className="w-full justify-start">
                <Tag className="mr-2 h-4 w-4" />
                Add Pricing
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* Right Content - Tabs */}
        <div className="lg:col-span-2">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4 md:space-y-6">
            <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3">
              <div className="overflow-x-auto -mx-4 px-4 md:mx-0 md:px-0">
                <TabsList className="w-max md:w-auto">
                  <TabsTrigger value="visits" className="flex items-center gap-1.5 md:gap-2 text-xs md:text-sm">
                    <User className="h-3.5 w-3.5 md:h-4 md:w-4" />
                    <span className="hidden sm:inline">Visits</span>
                  </TabsTrigger>
                  <TabsTrigger value="attendance" className="flex items-center gap-1.5 md:gap-2 text-xs md:text-sm">
                    <CheckCircle className="h-3.5 w-3.5 md:h-4 md:w-4" />
                    <span className="hidden sm:inline">Attendance</span>
                  </TabsTrigger>
                  <TabsTrigger value="expenses" className="flex items-center gap-1.5 md:gap-2 text-xs md:text-sm">
                    <CreditCard className="h-3.5 w-3.5 md:h-4 md:w-4" />
                    <span className="hidden sm:inline">Expenses</span>
                  </TabsTrigger>
                  <TabsTrigger value="pricing" className="flex items-center gap-1.5 md:gap-2 text-xs md:text-sm">
                    <Tag className="h-3.5 w-3.5 md:h-4 md:w-4" />
                    <span className="hidden sm:inline">Pricing</span>
                  </TabsTrigger>
                </TabsList>
              </div>
              
              <Button size="sm" className="w-full sm:w-auto text-xs md:text-sm">
                <Plus className="mr-1.5 md:mr-2 h-3.5 w-3.5 md:h-4 md:w-4" />
                Add New
              </Button>
            </div>

            <TabsContent value="visits" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-base md:text-lg">
                    <User className="h-4 w-4 md:h-5 md:w-5" />
                    Visit History
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {/* Mobile Card View */}
                  <div className="md:hidden space-y-3">
                    {mockVisits.map((visit) => (
                      <Card key={visit.id} className="border-l-4 border-l-primary">
                        <CardContent className="p-4">
                          <div className="flex justify-between items-start mb-3">
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-1.5">
                                <h4 className="font-semibold text-sm">{visit.customer}</h4>
                                <Badge variant="secondary" className="text-xs">{visit.duration}</Badge>
                              </div>
                              <p className="text-xs text-muted-foreground mb-1">
                                {visit.purpose} on {format(new Date(visit.date), "MMM d, yyyy")}
                              </p>
                              <p className="text-xs">{visit.outcome}</p>
                            </div>
                            <Button variant="ghost" size="icon" className="h-8 w-8">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>

                  {/* Desktop Card View */}
                  <div className="hidden md:block space-y-3 md:space-y-4">
                    {mockVisits.map((visit) => (
                      <div key={visit.id} className="flex items-start gap-2 md:gap-4 p-3 md:p-4 rounded-lg border">
                        <div className="bg-muted p-1.5 md:p-2 rounded-lg flex-shrink-0">
                          <Calendar className="h-3.5 w-3.5 md:h-4 md:w-4" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex flex-col sm:flex-row sm:justify-between gap-1 sm:gap-2">
                            <h4 className="font-medium text-sm md:text-base truncate">{visit.customer}</h4>
                            <Badge variant="secondary" className="text-xs w-fit">{visit.duration}</Badge>
                          </div>
                          <p className="text-xs md:text-sm text-muted-foreground mt-1">
                            {visit.purpose} on {format(new Date(visit.date), "MMM d, yyyy")}
                          </p>
                          <p className="text-xs md:text-sm mt-1 md:mt-2">{visit.outcome}</p>
                        </div>
                        <Button variant="ghost" size="icon" className="flex-shrink-0 h-8 w-8 md:h-10 md:w-10">
                          <MoreHorizontal className="h-3.5 w-3.5 md:h-4 md:w-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="attendance" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-base md:text-lg">
                    <CheckCircle className="h-4 w-4 md:h-5 md:w-5" />
                    Attendance Records
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {/* Mobile Card View */}
                  <div className="md:hidden space-y-3">
                    {mockAttendance.map((record) => (
                      <Card key={record.id} className="border-l-4 border-l-primary">
                        <CardContent className="p-4">
                          <div className="flex justify-between items-start mb-3">
                            <div>
                              <p className="font-semibold text-sm">
                                {format(new Date(record.date), "MMM d, yyyy")}
                              </p>
                              <Badge variant="outline" className="text-xs mt-1.5 capitalize">
                                {record.status}
                              </Badge>
                            </div>
                            <Button variant="ghost" size="icon" className="h-8 w-8">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </div>
                          <div className="grid grid-cols-3 gap-3 text-xs">
                            <div>
                              <p className="text-muted-foreground mb-1">Check In</p>
                              <p className="font-medium">{record.checkIn}</p>
                            </div>
                            <div>
                              <p className="text-muted-foreground mb-1">Check Out</p>
                              <p className="font-medium">{record.checkOut}</p>
                            </div>
                            <div>
                              <p className="text-muted-foreground mb-1">Hours</p>
                              <p className="font-medium">{record.hours}</p>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>

                  {/* Desktop Table View */}
                  <div className="hidden md:block rounded-md border overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="text-xs md:text-sm">Date</TableHead>
                          <TableHead className="text-xs md:text-sm">Status</TableHead>
                          <TableHead className="text-xs md:text-sm">Check In</TableHead>
                          <TableHead className="text-xs md:text-sm">Check Out</TableHead>
                          <TableHead className="text-xs md:text-sm">Hours</TableHead>
                          <TableHead className="text-xs md:text-sm">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {mockAttendance.map((record) => (
                          <TableRow key={record.id}>
                            <TableCell className="font-medium text-xs md:text-sm whitespace-nowrap">
                              {format(new Date(record.date), "MMM d, yyyy")}
                            </TableCell>
                            <TableCell>
                              <Badge variant="outline" className="text-xs whitespace-nowrap capitalize">
                                {record.status}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-xs md:text-sm whitespace-nowrap">{record.checkIn}</TableCell>
                            <TableCell className="text-xs md:text-sm whitespace-nowrap">{record.checkOut}</TableCell>
                            <TableCell className="text-xs md:text-sm whitespace-nowrap">{record.hours}</TableCell>
                            <TableCell>
                              <Button variant="ghost" size="icon" className="h-8 w-8 md:h-10 md:w-10">
                                <MoreHorizontal className="h-3.5 w-3.5 md:h-4 md:w-4" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="expenses" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-base md:text-lg">
                    <CreditCard className="h-4 w-4 md:h-5 md:w-5" />
                    Expense Reports
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {/* Mobile Card View */}
                  <div className="md:hidden space-y-3">
                    {mockExpenses.map((expense) => (
                      <Card key={expense.id} className="border-l-4 border-l-primary">
                        <CardContent className="p-4">
                          <div className="flex justify-between items-start mb-3">
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-1.5">
                                <p className="font-semibold text-sm">{expense.category}</p>
                                <Badge 
                                  className={cn(
                                    "text-xs",
                                    expense.status === "approved" 
                                      ? "bg-green-100 text-green-800 hover:bg-green-100" 
                                      : expense.status === "pending"
                                      ? "bg-yellow-100 text-yellow-800 hover:bg-yellow-100"
                                      : "bg-red-100 text-red-800 hover:bg-red-100"
                                  )}
                                >
                                  {expense.status}
                                </Badge>
                              </div>
                              <p className="text-xs text-muted-foreground">
                                {format(new Date(expense.date), "MMM d, yyyy")}
                              </p>
                            </div>
                            <Button variant="ghost" size="icon" className="h-8 w-8">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </div>
                          <div className="space-y-2 text-xs">
                            <div>
                              <p className="text-muted-foreground mb-0.5">Description</p>
                              <p className="font-medium">{expense.description}</p>
                            </div>
                            <div>
                              <p className="text-muted-foreground mb-0.5">Amount</p>
                              <p className="font-semibold text-base">${expense.amount.toFixed(2)}</p>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>

                  {/* Desktop Table View */}
                  <div className="hidden md:block rounded-md border overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="text-xs md:text-sm">Date</TableHead>
                          <TableHead className="text-xs md:text-sm">Category</TableHead>
                          <TableHead className="text-xs md:text-sm">Description</TableHead>
                          <TableHead className="text-xs md:text-sm">Amount</TableHead>
                          <TableHead className="text-xs md:text-sm">Status</TableHead>
                          <TableHead className="text-xs md:text-sm">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {mockExpenses.map((expense) => (
                          <TableRow key={expense.id}>
                            <TableCell className="font-medium text-xs md:text-sm whitespace-nowrap">
                              {format(new Date(expense.date), "MMM d, yyyy")}
                            </TableCell>
                            <TableCell className="text-xs md:text-sm whitespace-nowrap">{expense.category}</TableCell>
                            <TableCell className="text-xs md:text-sm">{expense.description}</TableCell>
                            <TableCell className="text-xs md:text-sm whitespace-nowrap">${expense.amount.toFixed(2)}</TableCell>
                            <TableCell>
                              <Badge variant="outline" className="text-xs whitespace-nowrap capitalize">
                                {expense.status}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <Button variant="ghost" size="icon" className="h-8 w-8 md:h-10 md:w-10">
                                <MoreHorizontal className="h-3.5 w-3.5 md:h-4 md:w-4" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="pricing" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-base md:text-lg">
                    <Tag className="h-4 w-4 md:h-5 md:w-5" />
                    Daily Pricing Input
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-4 mb-4 md:mb-6">
                    <div className="space-y-1.5 md:space-y-2">
                      <Label htmlFor="date" className="text-xs md:text-sm">Date</Label>
                      <Input
                        id="date"
                        type="date"
                        value={pricingDate}
                        onChange={(e) => setPricingDate(e.target.value)}
                        className="text-xs md:text-sm"
                      />
                    </div>
                    <div className="space-y-1.5 md:space-y-2">
                      <Label htmlFor="brand" className="text-xs md:text-sm">Brand</Label>
                      <Select value={brand} onValueChange={setBrand}>
                        <SelectTrigger className="text-xs md:text-sm">
                          <SelectValue placeholder="Select brand" />
                        </SelectTrigger>
                        <SelectContent>
                          {brands.map((b) => (
                            <SelectItem key={b} value={b} className="text-xs md:text-sm">
                              {b}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1.5 md:space-y-2">
                      <Label htmlFor="product" className="text-xs md:text-sm">Product</Label>
                      <Select value={product} onValueChange={setProduct}>
                        <SelectTrigger className="text-xs md:text-sm">
                          <SelectValue placeholder="Select product" />
                        </SelectTrigger>
                        <SelectContent>
                          {products.map((p) => (
                            <SelectItem key={p} value={p} className="text-xs md:text-sm">
                              {p}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1.5 md:space-y-2">
                      <Label htmlFor="location" className="text-xs md:text-sm">Location</Label>
                      <Select value={location} onValueChange={setLocation}>
                        <SelectTrigger className="text-xs md:text-sm">
                          <SelectValue placeholder="Select location" />
                        </SelectTrigger>
                        <SelectContent>
                          {locations.map((loc) => (
                            <SelectItem key={loc} value={loc} className="text-xs md:text-sm">
                              {loc}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1.5 md:space-y-2">
                      <Label htmlFor="price" className="text-xs md:text-sm">Our Price ($)</Label>
                      <Input
                        id="price"
                        type="number"
                        placeholder="0.00"
                        value={price}
                        onChange={(e) => setPrice(e.target.value)}
                        className="text-xs md:text-sm"
                      />
                    </div>
                    <div className="space-y-1.5 md:space-y-2">
                      <Label htmlFor="competitorPrice" className="text-xs md:text-sm">Competitor Price ($)</Label>
                      <Input
                        id="competitorPrice"
                        type="number"
                        placeholder="0.00"
                        value={competitorPrice}
                        onChange={(e) => setCompetitorPrice(e.target.value)}
                        className="text-xs md:text-sm"
                      />
                    </div>
                  </div>
                  <div className="flex justify-end">
                    <Button onClick={handleAddPricing} className="w-full sm:w-auto text-xs md:text-sm">
                      <Plus className="mr-1.5 md:mr-2 h-3.5 w-3.5 md:h-4 md:w-4" />
                      Add Pricing
                    </Button>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-base md:text-lg">
                    <Tag className="h-4 w-4 md:h-5 md:w-5" />
                    Recent Pricing Entries
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {/* Mobile Card View */}
                  <div className="md:hidden space-y-3">
                    {mockPricing.map((pricing) => (
                      <Card key={pricing.id} className="border-l-4 border-l-primary">
                        <CardContent className="p-4">
                          <div className="flex justify-between items-start mb-3">
                            <div className="flex-1">
                              <p className="font-semibold text-sm mb-1">{pricing.brand}</p>
                              <p className="text-xs text-muted-foreground mb-0.5">{pricing.product}</p>
                              <p className="text-xs text-muted-foreground">
                                {format(new Date(pricing.date), "MMM d, yyyy")}
                              </p>
                            </div>
                            <Button variant="ghost" size="icon" className="h-8 w-8">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </div>
                          <div className="grid grid-cols-3 gap-3 text-xs">
                            <div>
                              <p className="text-muted-foreground mb-1">Our Price</p>
                              <p className="font-semibold text-green-600">${pricing.price.toFixed(2)}</p>
                            </div>
                            <div>
                              <p className="text-muted-foreground mb-1">Competitor</p>
                              <p className="font-semibold text-orange-600">${pricing.competitorPrice.toFixed(2)}</p>
                            </div>
                            <div>
                              <p className="text-muted-foreground mb-1">Location</p>
                              <p className="font-medium">{pricing.location}</p>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>

                  {/* Desktop Table View */}
                  <div className="hidden md:block rounded-md border overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="text-xs md:text-sm">Date</TableHead>
                          <TableHead className="text-xs md:text-sm">Brand</TableHead>
                          <TableHead className="text-xs md:text-sm">Product</TableHead>
                          <TableHead className="text-xs md:text-sm">Our Price</TableHead>
                          <TableHead className="text-xs md:text-sm">Competitor</TableHead>
                          <TableHead className="text-xs md:text-sm">Location</TableHead>
                          <TableHead className="text-xs md:text-sm">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {mockPricing.map((pricing) => (
                          <TableRow key={pricing.id}>
                            <TableCell className="font-medium text-xs md:text-sm whitespace-nowrap">
                              {format(new Date(pricing.date), "MMM d, yyyy")}
                            </TableCell>
                            <TableCell className="text-xs md:text-sm whitespace-nowrap">{pricing.brand}</TableCell>
                            <TableCell className="text-xs md:text-sm whitespace-nowrap">{pricing.product}</TableCell>
                            <TableCell className="text-xs md:text-sm whitespace-nowrap">${pricing.price.toFixed(2)}</TableCell>
                            <TableCell className="text-xs md:text-sm whitespace-nowrap">${pricing.competitorPrice.toFixed(2)}</TableCell>
                            <TableCell className="text-xs md:text-sm whitespace-nowrap">{pricing.location}</TableCell>
                            <TableCell>
                              <Button variant="ghost" size="icon" className="h-8 w-8 md:h-10 md:w-10">
                                <MoreHorizontal className="h-3.5 w-3.5 md:h-4 md:w-4" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
}
