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
  CalendarIcon,
  User, 
  Building, 
  Plus,
  MoreHorizontal,
  Edit,
  CheckCircle,
  CreditCard,
  Tag,
} from "lucide-react";
import { format } from "date-fns";
import { Heading, Text } from "@/components/ui/typography";

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
  assignedCity: string[];
  secondaryPhone: string;
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

export default function EmployeeDetailPage({ employee }: { employee: Employee }) {
  const [activeTab, setActiveTab] = useState("visits");

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
                    Joined {format(new Date(employee.hireDate), "MMM dd, yyyy")}
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

                {employee.secondaryPhone && (
                  <div className="flex items-center gap-2 md:gap-3">
                    <div className="bg-muted p-1.5 md:p-2 rounded-lg flex-shrink-0">
                      <Phone className="h-3.5 w-3.5 md:h-4 md:w-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs md:text-sm font-medium truncate">{employee.secondaryPhone}</p>
                      <p className="text-xs text-muted-foreground">Secondary Phone</p>
                    </div>
                  </div>
                )}

                <div className="flex items-center gap-2 md:gap-3">
                  <div className="bg-muted p-1.5 md:p-2 rounded-lg flex-shrink-0">
                    <MapPin className="h-3.5 w-3.5 md:h-4 md:w-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs md:text-sm font-medium truncate">{employee.location}</p>
                    <p className="text-xs text-muted-foreground">Location</p>
                  </div>
                </div>

                {Array.isArray(employee.assignedCity) && employee.assignedCity.length > 0 && (
                  <div className="flex items-center gap-2 md:gap-3">
                    <div className="bg-muted p-1.5 md:p-2 rounded-lg flex-shrink-0">
                      <MapPin className="h-3.5 w-3.5 md:h-4 md:w-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs md:text-sm font-medium truncate">{employee.assignedCity.join(', ')}</p>
                      <p className="text-xs text-muted-foreground">Assigned Cities</p>
                    </div>
                  </div>
                )}

                <div className="flex items-center gap-2 md:gap-3">
                  <div className="bg-muted p-1.5 md:p-2 rounded-lg flex-shrink-0">
                    <Calendar className="h-3.5 w-3.5 md:h-4 md:w-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs md:text-sm font-medium truncate">
                      {format(new Date(employee.hireDate), "MMM dd, yyyy")}
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

        {/* Right Content - Tabs — smoke-tested: mock data removed, documented APIs only; see guide 5.7a */}
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
                  <div className="rounded-lg border bg-muted/30 p-5 text-center text-sm text-muted-foreground">
                    No visits to display. Visits are loaded via <code className="rounded bg-muted px-1 py-0.5 text-xs">GET /api/common/visits?assignedEmployeeId={'{id}'}&amp;from=&amp;to=&amp;page=&amp;size=</code> per guide 5.7a. Use the full detail view at <code className="text-xs">/dashboard/employee/{'{id}'}</code> for live data.
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
                  <div className="rounded-lg border bg-muted/30 p-5 text-center text-sm text-muted-foreground">
                    No attendance records to display. Loaded via <code className="rounded bg-muted px-1 py-0.5 text-xs">GET /api/hr/attendance/logs/by-employee/{'{id}'}?from=&amp;to=&amp;page=</code> per guide 5.7a. Use <code className="text-xs">/dashboard/employee/{'{id}'}</code> for live data.
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
                  <div className="rounded-lg border bg-muted/30 p-5 text-center text-sm text-muted-foreground">
                    No expense reports to display. Loaded via <code className="rounded bg-muted px-1 py-0.5 text-xs">GET /api/hr/expenses/by-employee/{'{id}'}?from=&amp;to=&amp;page=</code> per guide 5.7a. Use <code className="text-xs">/dashboard/employee/{'{id}'}</code> for live data.
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="pricing" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-base md:text-lg">
                    <Tag className="h-4 w-4 md:h-5 md:w-5" />
                    Pricing
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
                    <strong>Backend contract required:</strong> No replacement pricing contract is supplied in the migration guide (see §5.27). Pricing Intelligence is blocked until the backend provides competitor brand master, price observation, and average-price endpoints. This tab is intentionally disabled — no invented endpoint is used.
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
