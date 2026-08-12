"use client";

import { Button } from "@/components/ui/button";
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
import { format } from "date-fns";

interface Customer {
  id: number | string;
  shopName: string;
  ownerName: string;
  city: string;
  state: string;
  phone: string;
  monthlySales: number | string;
  intentLevel: number;
  fieldOfficer: string;
  clientType: string;
  lastVisitDate: string;
  totalVisits: number;
}

interface CustomersTableProps {
  customers: Customer[];
}

export default function CustomersTable({ customers }: CustomersTableProps) {
  const handleExport = () => {
    // In a real app, this would export the filtered data to CSV
    alert("Export to CSV functionality would be implemented here");
  };

  const getIntentTextColor = (level: number) => {
    if (level > 7) return "text-green-600";
    if (level > 4) return "text-yellow-600";
    return "text-red-600";
  };

  return (
    <Card className="w-full">
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Customers</CardTitle>
        <Button onClick={handleExport} size="sm" variant="outline">
          <DownloadIcon className="mr-2 h-4 w-4" />
          Export CSV
        </Button>
      </CardHeader>
      <CardContent className="w-full">
        <div className="rounded-md border overflow-hidden w-full">
          <div className="overflow-x-auto w-full">
            <Table className="min-w-full">
              <TableHeader>
                <TableRow>
                  <TableHead>Shop Name</TableHead>
                  <TableHead>Owner Name</TableHead>
                  <TableHead>City</TableHead>
                  <TableHead>State</TableHead>
                  <TableHead>Phone</TableHead>
                  <TableHead>Monthly Sales</TableHead>
                  <TableHead>Intent</TableHead>
                  <TableHead>Field Officer</TableHead>
                  <TableHead>Client Type</TableHead>
                  <TableHead>Last Visit (Total)</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {customers.length > 0 ? (
                  customers.map((customer) => (
                    <TableRow key={customer.id}>
                      <TableCell className="font-medium break-words">
                        <Link href={`/dashboard/customers/${customer.id}`} className="text-blue-600 hover:underline">
                          {customer.shopName}
                        </Link>
                      </TableCell>
                      <TableCell className="break-words">{customer.ownerName}</TableCell>
                      <TableCell className="break-words">{customer.city}</TableCell>
                      <TableCell className="break-words">{customer.state}</TableCell>
                      <TableCell className="break-words">{customer.phone}</TableCell>
                      <TableCell className="break-words">{customer.monthlySales}</TableCell>
                      <TableCell className="break-words">
                        <span className={`font-medium ${getIntentTextColor(customer.intentLevel)}`}>
                          {customer.intentLevel}/10
                        </span>
                      </TableCell>
                      <TableCell className="break-words">{customer.fieldOfficer}</TableCell>
                      <TableCell className="break-words">{customer.clientType}</TableCell>
                      <TableCell className="break-words">
                        {`${format(new Date(customer.lastVisitDate), "d MMM")} (${customer.totalVisits})`}
                      </TableCell>
                      <TableCell className="break-words">
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
                              <Link href={`/dashboard/customers/${customer.id}`}>View customer</Link>
                            </DropdownMenuItem>
                            <DropdownMenuItem>Edit customer</DropdownMenuItem>
                            <DropdownMenuItem>Delete customer</DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={11} className="h-24 text-center">
                      No customers found matching the selected filters
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
