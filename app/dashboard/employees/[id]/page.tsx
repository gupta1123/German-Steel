"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import EmployeeDetailPage from "@/components/employee-detail-page";
import { API, type EmployeeUserDto } from "@/lib/api";
import { useAuth } from "@/components/auth-provider";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardHeader } from "@/components/ui/card";

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

export default function EmployeeDetail() {
  const params = useParams();
  const { token } = useAuth();
  const [employeeData, setEmployeeData] = useState<Employee | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchEmployeeData = async () => {
      if (!token || !params.id) return;

      try {
        setIsLoading(true);
        const employeeId = Number(params.id);
        
        // Fetch employee data using the API
        const data: EmployeeUserDto = await API.getEmployeeById(employeeId);
        
        // Transform the API data to match the component's expected format
        const transformedData = {
          id: data.id,
          name: `${data.firstName} ${data.lastName}`,
          email: data.email || "N/A",
          phone: data.primaryContact ? `+${data.primaryContact}` : "N/A",
          position: data.role || "Sales Executive",
          department: data.departmentName || "Sales",
          hireDate: data.dateOfJoining || "N/A",
          status: "Active", // Default status since it's not in the API response
          avatar: "/placeholder.svg?height=100&width=100",
          employeeId: data.userDto?.employeeId ? `EMP-${data.userDto.employeeId}` : `EMP-${data.id}`,
          manager: "N/A", // This would need to be fetched separately if needed
          location: `${data.city || ""}, ${data.state || ""}`.replace(/^,\s*|,\s*$/g, '') || "N/A",
        };

        setEmployeeData(transformedData);
      } catch (err) {
        console.error('Error fetching employee data:', err);
        setError((err as Error)?.message || 'Failed to load employee data');
      } finally {
        setIsLoading(false);
      }
    };

    fetchEmployeeData();
  }, [token, params.id]);

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 md:gap-6 pb-20 md:pb-0">
        {/* Left panel skeleton */}
        <div className="space-y-4 md:space-y-6">
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between">
                <div>
                  <Skeleton className="h-6 w-40" />
                  <Skeleton className="h-4 w-28 mt-2" />
                </div>
                <Skeleton className="h-8 w-16" />
              </div>
            </CardHeader>
            <CardContent className="space-y-4 md:space-y-6">
              <div className="flex items-start gap-3 md:gap-4">
                <Skeleton className="h-14 w-14 rounded-xl" />
                <div className="flex-1 min-w-0">
                  <Skeleton className="h-5 w-40" />
                  <Skeleton className="h-4 w-32 mt-2" />
                </div>
              </div>
              <div className="space-y-3">
                {[...Array(4)].map((_, i) => (
                  <div key={i} className="flex items-center gap-3">
                    <Skeleton className="h-8 w-8 rounded-lg" />
                    <div className="flex-1">
                      <Skeleton className="h-4 w-48" />
                      <Skeleton className="h-3 w-32 mt-1" />
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right content skeleton */}
        <div className="lg:col-span-2 space-y-4 md:space-y-6">
          <Skeleton className="h-10 w-64" />
          <Card>
            <CardHeader>
              <Skeleton className="h-6 w-56" />
            </CardHeader>
            <CardContent>
              {[...Array(4)].map((_, i) => (
                <div key={i} className="flex items-center justify-between gap-4 p-3 border rounded mb-3">
                  <div className="flex-1 min-w-0">
                    <Skeleton className="h-4 w-40" />
                    <Skeleton className="h-3 w-56 mt-2" />
                  </div>
                  <Skeleton className="h-5 w-16" />
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="text-center">
          <p className="text-red-500 mb-2">Error loading employee data</p>
          <p className="text-sm text-muted-foreground">{error}</p>
        </div>
      </div>
    );
  }

  if (!employeeData) {
    return (
      <div className="flex justify-center items-center h-64">
        <p className="text-muted-foreground">Employee not found</p>
      </div>
    );
  }

  return <EmployeeDetailPage employee={employeeData} />;
}
