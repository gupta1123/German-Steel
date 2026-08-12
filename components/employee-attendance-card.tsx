import { useState, useCallback, useMemo } from "react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { 
  Calendar,
  Sun,
  CloudSun,
  XCircle
} from "lucide-react";
import { format, parseISO } from "date-fns";
import { Heading, Text } from "@/components/ui/typography";
import CustomCalendar from "./custom-calendar";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

interface Visit {
  id: number;
  customer: string;
  time: string;
  purpose: string;
}

interface AttendanceRecord {
  date: string;
  status: "present" | "half" | "absent";
  visits: Visit[];
}

interface Employee {
  id: number;
  name: string;
  position: string;
  avatar: string;
  fullDays: number;
  halfDays: number;
  absent: number;
  attendance: AttendanceRecord[];
}

type NormalizedStatus = 'full day' | 'half day' | 'absent' | 'paid' | 'activity';

interface EmployeeAttendanceEntry {
  id: number;
  employeeId: number;
  employeeName: string;
  attendanceStatus: NormalizedStatus;
  checkinDate: string;
  checkoutDate: string;
  rawStatus?: string;
  date?: string;
}

interface EmployeeAttendanceCardProps {
  employee: Employee;
  selectedMonth: number;
  selectedYear: number;
  attendanceData: EmployeeAttendanceEntry[];
  onDateClick?: (date: string, employeeName: string) => void;
}

export default function EmployeeAttendanceCard({ employee, selectedMonth, selectedYear, attendanceData, onDateClick }: EmployeeAttendanceCardProps) {
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [summary, setSummary] = useState({
    fullDays: employee.fullDays,
    halfDays: employee.halfDays,
    absentDays: employee.absent
  });
  // Removed Full Days Breakdown modal per requirement

  const handleDayClick = useCallback((date: string) => {
    if (onDateClick) {
      onDateClick(date, employee.name);
      return;
    }
    const record = employee.attendance.find(record => record.date === date);
    if (record) {
      setSelectedDate(date);
      setIsDialogOpen(true);
    }
  }, [onDateClick, employee.name, employee.attendance]);

  const handleSummaryChange = useCallback((newSummary: { fullDays: number; halfDays: number; absentDays: number }) => {
    setSummary(prev => {
      if (prev.fullDays === newSummary.fullDays && prev.halfDays === newSummary.halfDays && prev.absentDays === newSummary.absentDays) {
        return prev; // avoid unnecessary re-render loops
      }
      return newSummary;
    });
  }, []);

  const getStatusColor = (status: string) => {
    switch (status) {
      case "present": return "bg-green-500 dark:bg-green-600";
      case "half": return "bg-yellow-500 dark:bg-yellow-600";
      case "absent": return "bg-red-500 dark:bg-red-600";
      default: return "bg-gray-100 dark:bg-gray-700";
    }
  };

  const getInitials = (name: string) => {
    if (!name) return "";
    const parts = name.trim().split(/\s+/).slice(0, 2);
    return parts.map(p => p[0]?.toUpperCase() ?? "").join("");
  };


  // Get visits for the selected date
  const selectedDateVisits = selectedDate 
    ? employee.attendance.find(record => record.date === selectedDate)?.visits || []
    : [];

  // Breakdown counts for full days (based on rawStatus coming from parent list)
  const breakdown = useMemo(() => {
    const monthStart = new Date(selectedYear, selectedMonth, 1);
    const monthEnd = new Date(selectedYear, selectedMonth + 1, 0);
    let sundays = 0;
    let paidLeaves = 0;
    let activities = 0;
    let fullDays = 0;

    for (const r of attendanceData) {
      const d = new Date(r.checkinDate);
      if (d < monthStart || d > monthEnd) continue;
      const raw = r.rawStatus as string | undefined;
      const norm = r.attendanceStatus as string | undefined;
      if (norm === 'full day') fullDays++;
      if (raw === 'Paid Leave') paidLeaves++;
      if (raw === 'Activity') activities++;
      if (d.getDay() === 0 && norm === 'full day') sundays++;
    }

    return { sundays, paidLeaves, activities, fullDays };
  }, [attendanceData, selectedMonth, selectedYear]);

  return (
    <>
      <Card className="w-full hover:shadow-md transition-shadow bg-card">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Avatar className="h-10 w-10">
                <AvatarImage src={employee.avatar} alt={employee.name} />
                <AvatarFallback className="bg-primary/10 text-primary font-semibold">
                  {getInitials(employee.name)}
                </AvatarFallback>
              </Avatar>
              <div>
                <Heading as="h3" size="lg" weight="semibold" className="text-foreground dark:text-gray-200">
                  {employee.name}
                </Heading>
                <Text size="sm" tone="muted" className="dark:text-gray-400">
                  {employee.position}
                </Text>
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 gap-2 mb-4">
            <div className="bg-green-50 dark:bg-green-900/30 p-3 rounded-lg text-center w-full">
              <div className="flex items-center justify-center mb-1">
                <Sun className="h-4 w-4 text-green-600 dark:text-green-400" />
              </div>
              <Heading as="p" size="lg" weight="semibold" className="text-green-800 dark:text-green-300">
                {summary.fullDays}
              </Heading>
              <Text size="xs" tone="muted" className="text-green-700 dark:text-green-400">
                Full Days
              </Text>            </div>
            <div className="bg-yellow-50 dark:bg-yellow-900/30 p-3 rounded-lg text-center">
              <div className="flex items-center justify-center mb-1">
                <CloudSun className="h-4 w-4 text-yellow-600 dark:text-yellow-400" />
              </div>
              <Heading as="p" size="lg" weight="semibold" className="text-yellow-800 dark:text-yellow-300">
                {summary.halfDays}
              </Heading>
              <Text size="xs" tone="muted" className="text-yellow-700 dark:text-yellow-400">
                Half Days
              </Text>
            </div>
            <div className="bg-red-50 dark:bg-red-900/30 p-3 rounded-lg text-center">
              <div className="flex items-center justify-center mb-1">
                <XCircle className="h-4 w-4 text-red-600 dark:text-red-400" />
              </div>
              <Heading as="p" size="lg" weight="semibold" className="text-red-800 dark:text-red-300">
                {summary.absentDays}
              </Heading>
              <Text size="xs" tone="muted" className="text-red-700 dark:text-red-400">
                Absent
              </Text>
            </div>
          </div>
          
          <div className="mt-4">
            <CustomCalendar
              month={selectedMonth}
              year={selectedYear}
              attendanceData={attendanceData}
              onSummaryChange={handleSummaryChange}
              onDateClick={handleDayClick}
              employeeName={employee.name}
            />
          </div>
        </CardContent>
      </Card>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              Visits on {selectedDate ? format(parseISO(selectedDate), "MMMM d, yyyy") : ""}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 max-h-96 overflow-y-auto">
            {selectedDateVisits.length > 0 ? (
              selectedDateVisits.map((visit) => (
                <div key={visit.id} className="border rounded-lg p-3 dark:border-gray-700">
                  <div className="flex justify-between">
                    <Heading as="h4" size="md" weight="semibold" className="dark:text-gray-200">
                      {visit.customer}
                    </Heading>
                    <Badge variant="secondary" className="dark:bg-gray-700 dark:text-gray-300">
                      {visit.time}
                    </Badge>
                  </div>
                  <Text size="sm" tone="muted" className="mt-1 dark:text-gray-400">
                    {visit.purpose}
                  </Text>
                </div>
              ))
            ) : (
              <Text size="sm" tone="muted" className="py-4 text-center dark:text-gray-400">
                No visits recorded for this day
              </Text>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
