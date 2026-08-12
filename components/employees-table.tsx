"use client";

import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DownloadIcon, MoreHorizontal } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import Link from "next/link";
import { API, type EmployeeDto } from "@/lib/api";
import { Skeleton } from "@/components/ui/skeleton";

type Row = {
  id: number;
  name: string;
  role?: string;
  userName?: string | null;
  phone?: string | number;
  city?: string;
  state?: string;
};

export default function EmployeesTable() {
  const [name, setName] = useState("");
  const [selectedRole, setSelectedRole] = useState("all");
  const [selectedCity, setSelectedCity] = useState("all");
  const [selectedState, setSelectedState] = useState("all");
  const [rows, setRows] = useState<Row[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const roles = useMemo(() => {
    const set = new Set<string>();
    rows.forEach(r => { if (r.role) set.add(r.role); });
    return Array.from(set);
  }, [rows]);

  const cities = useMemo(() => {
    const set = new Set<string>();
    rows.forEach(r => { if (r.city) set.add(r.city!); });
    return Array.from(set);
  }, [rows]);

  const states = useMemo(() => {
    const set = new Set<string>();
    rows.forEach(r => { if (r.state) set.add(r.state!); });
    return Array.from(set);
  }, [rows]);

  useEffect(() => {
    const run = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const data = await API.getEmployees();
        const mapped: Row[] = data.map((e) => ({
          id: e.id,
          name: [e.firstName, e.lastName].filter(Boolean).join(' ') || e.userDto?.username || String(e.id),
          role: e.role || undefined,
          userName: e.userDto?.username ?? null,
          phone: e.primaryContact,
          city: e.city,
          state: e.state,
        }));
        setRows(mapped);
      } catch (err) {
        setError((err as Error)?.message || 'Failed to load employees');
      } finally {
        setIsLoading(false);
      }
    };
    run();
  }, []);

  const filteredEmployees = rows.filter(employee => {
    if (name && !employee.name.toLowerCase().includes(name.toLowerCase())) return false;
    if (selectedRole !== "all" && employee.role !== selectedRole) return false;
    if (selectedCity !== "all" && employee.city !== selectedCity) return false;
    if (selectedState !== "all" && employee.state !== selectedState) return false;
    return true;
  });

  const handleExport = () => {
    // In a real app, this would export the filtered data to CSV
    alert("Export to CSV functionality would be implemented here");
  };

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle>Employees</CardTitle>
      </CardHeader>
      <CardContent className="w-full">
        {error && (
          <div className="mb-4 text-sm text-red-700 bg-red-50 border border-red-200 rounded p-3">{error}</div>
        )}
        {/* Filters */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 mb-6">
          <div className="space-y-2">
            <Label>Name</Label>
            <Input
              placeholder="Search name"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label>Role</Label>
            <Select value={selectedRole} onValueChange={setSelectedRole}>
              <SelectTrigger>
                <SelectValue placeholder="Select role" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Roles</SelectItem>
                {roles.map((role) => (
                  <SelectItem key={role} value={role}>
                    {role}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>City</Label>
            <Select value={selectedCity} onValueChange={setSelectedCity}>
              <SelectTrigger>
                <SelectValue placeholder="Select city" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Cities</SelectItem>
                {cities.map((city) => (
                  <SelectItem key={city} value={city}>
                    {city}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>State</Label>
            <Select value={selectedState} onValueChange={setSelectedState}>
              <SelectTrigger>
                <SelectValue placeholder="Select state" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All States</SelectItem>
                {states.map((state) => (
                  <SelectItem key={state} value={state}>
                    {state}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-end">
            <Button onClick={handleExport} className="w-full">
              <DownloadIcon className="mr-2 h-4 w-4" />
              Export CSV
            </Button>
          </div>
        </div>

        {/* Table Container */}
        <div className="rounded-md border overflow-hidden w-full">
          <div className="overflow-x-auto w-full">
            <Table className="min-w-full">
              <TableHeader>
                <TableRow>
                  <TableHead className="whitespace-nowrap">Name</TableHead>
                  <TableHead className="whitespace-nowrap">Role</TableHead>
                  <TableHead className="whitespace-nowrap">User Name</TableHead>
                  <TableHead className="whitespace-nowrap">Phone</TableHead>
                  <TableHead className="whitespace-nowrap">City</TableHead>
                  <TableHead className="whitespace-nowrap">State</TableHead>
                  <TableHead className="whitespace-nowrap">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  [...Array(6)].map((_, i) => (
                    <TableRow key={i}>
                      <TableCell className="whitespace-nowrap"><Skeleton className="h-4 w-40" /></TableCell>
                      <TableCell className="whitespace-nowrap"><Skeleton className="h-4 w-24" /></TableCell>
                      <TableCell className="whitespace-nowrap"><Skeleton className="h-4 w-28" /></TableCell>
                      <TableCell className="whitespace-nowrap"><Skeleton className="h-4 w-28" /></TableCell>
                      <TableCell className="whitespace-nowrap"><Skeleton className="h-4 w-24" /></TableCell>
                      <TableCell className="whitespace-nowrap"><Skeleton className="h-4 w-20" /></TableCell>
                      <TableCell className="whitespace-nowrap"><Skeleton className="h-8 w-8 rounded" /></TableCell>
                    </TableRow>
                  ))
                ) : filteredEmployees.length > 0 ? (
                  filteredEmployees.map((employee) => (
                    <TableRow key={employee.id}>
                      <TableCell className="font-medium whitespace-nowrap">
                        <Link href={`/dashboard/employees/${employee.id}`} className="text-blue-600 hover:underline">
                          {employee.name}
                        </Link>
                      </TableCell>
                      <TableCell className="whitespace-nowrap">{employee.role}</TableCell>
                      <TableCell className="whitespace-nowrap">{employee.userName ?? '-'}</TableCell>
                      <TableCell className="whitespace-nowrap">{employee.phone ?? '-'}</TableCell>
                      <TableCell className="whitespace-nowrap">{employee.city ?? '-'}</TableCell>
                      <TableCell className="whitespace-nowrap">{employee.state ?? '-'}</TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" className="h-8 w-8 p-0">
                              <span className="sr-only">Open menu</span>
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuLabel>Actions</DropdownMenuLabel>
                            <DropdownMenuItem asChild>
                              <Link href={`/dashboard/employees/${employee.id}`}>View employee</Link>
                            </DropdownMenuItem>
                            <DropdownMenuItem>Edit employee</DropdownMenuItem>
                            <DropdownMenuItem>Delete employee</DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={7} className="h-24 text-center">
                      No employees found matching the selected filters
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
