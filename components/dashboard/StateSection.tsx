"use client";

import EmployeeCard from "@/components/employee-card";

interface Employee {
  id: number;
  name: string;
  position: string;
  avatar: string;
  lastUpdated: string;
  status: string;
  location: string;
  totalVisits?: number;
}

export interface StateSectionProps {
  selectedState: { id: number; name: string };
  stateEmployees: Record<string, unknown>[];
  onEmployeeDetailSelect: (employee: Record<string, unknown>) => void;
}

export default function StateSection({ stateEmployees, onEmployeeDetailSelect }: StateSectionProps) {
  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
      {stateEmployees.map((employee) => (
        <EmployeeCard
          key={String(employee.id)}
          employee={employee as unknown as Employee}
          onClick={() => onEmployeeDetailSelect(employee)}
        />
      ))}
    </div>
  );
}


