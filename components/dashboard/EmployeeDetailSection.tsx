"use client";

import EmployeeDetailCard from "@/components/employee-detail-card";

interface Employee {
  id: number;
  name: string;
  position: string;
  avatar: string;
  lastUpdated: string;
  status: string;
  location: string;
}

export interface EmployeeDetailSectionProps {
  employee: Record<string, unknown>;
  dateRange: { start: Date; end: Date };
}

export default function EmployeeDetailSection({ employee, dateRange }: EmployeeDetailSectionProps) {
  return <EmployeeDetailCard employee={employee as unknown as Employee} dateRange={dateRange} />;
}


