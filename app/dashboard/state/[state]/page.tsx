"use client";

import { use } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ArrowLeft } from "lucide-react";
import { useRouter } from "next/navigation";
import EmployeeCard from "@/components/employee-card";

// Mock data for employees
const mockEmployees = [
  {
    id: 1,
    name: "Alice Smith",
    position: "Field Officer",
    avatar: "/placeholder.svg?height=40&width=40",
    lastUpdated: "2023-06-20T14:30:00Z",
    status: "active",
    location: "Mumbai, Maharashtra",
    totalVisits: 24
  },
  {
    id: 2,
    name: "Bob Johnson",
    position: "Field Officer",
    avatar: "/placeholder.svg?height=40&width=40",
    lastUpdated: "2023-06-20T13:45:00Z",
    status: "active",
    location: "Pune, Maharashtra",
    totalVisits: 18
  },
  {
    id: 3,
    name: "Charlie Brown",
    position: "Sales Manager",
    avatar: "/placeholder.svg?height=40&width=40",
    lastUpdated: "2023-06-20T12:15:00Z",
    status: "active",
    location: "Nagpur, Maharashtra",
    totalVisits: 32
  },
];

export default function StateDetailPage({ params }: { params: Promise<{ state: string }> }) {
  const router = useRouter();
  const resolvedParams = use(params);
  
  // Decode the state name from URL parameter
  const stateName = decodeURIComponent(resolvedParams.state);

  const handleEmployeeSelect = (employee: Record<string, unknown>) => {
    router.push(`/dashboard/employee/${employee.id}`);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="outline" onClick={() => router.back()} className="flex items-center gap-2">
          <ArrowLeft className="h-4 w-4" />
          Back
        </Button>
        <h1 className="text-2xl font-bold">{stateName} - Employee Details</h1>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {mockEmployees
          .sort((a, b) => a.name.localeCompare(b.name))
          .map((employee) => (
            <EmployeeCard 
              key={employee.id} 
              employee={employee} 
              onClick={() => handleEmployeeSelect(employee)}
            />
          ))}
      </div>
    </div>
  );
}