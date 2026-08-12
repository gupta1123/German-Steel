"use client";

import { Heading } from "@/components/ui/typography";
import { Card } from "@/components/ui/card";
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

export default function StateSection({ selectedState, stateEmployees, onEmployeeDetailSelect }: StateSectionProps) {
  return (
    <div className="space-y-6">
      <Heading as="h2" size="2xl" weight="bold">
        {selectedState.name} - Employee Details
      </Heading>
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
        {stateEmployees.map((employee) => (
          <EmployeeCard
            key={String(employee.id)}
            employee={employee as unknown as Employee}
            onClick={() => onEmployeeDetailSelect(employee)}
          />
        ))}
      </div>
    </div>
  );
}


