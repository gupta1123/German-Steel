"use client";

import DashboardLayout from "@/components/dashboard-layout";
import { ReactNode } from "react";
import { usePathname } from "next/navigation";

export default function Layout({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  
  // Define headings for each page
  const pageHeadings: Record<string, { heading: string; subheading?: string; backHref?: string }> = {
    "/dashboard": {
      heading: "Dashboard",
      subheading: "Welcome to your sales dashboard"
    },
    "/dashboard/visits": {
      heading: "Visits",
      subheading: "Track and manage all visits"
    },
    "/dashboard/meetings": {
      heading: "Meetings",
      subheading: "Plan, approve, execute, and close meeting workflows"
    },
    "/dashboard/expenses": {
      heading: "Expenses",
      subheading: "Track and manage all expenses"
    },
    "/dashboard/attendance": {
      heading: "Attendance",
      subheading: "Track and manage employee attendance"
    },
    "/dashboard/requirements": {
      heading: "Requirements",
      subheading: "Manage project and client requirements"
    },
    "/dashboard/complaints": {
      heading: "Complaints",
      subheading: "Track and manage customer complaints"
    },
    "/dashboard/pricing": {
      heading: "Pricing",
      subheading: "Manage product and service pricing"
    },
    "/dashboard/reports": {
      heading: "Reports",
      subheading: "View and generate reports"
    },
    "/dashboard/reports/monthly-target": {
      heading: "Monthly Target Report",
      subheading: "Track city-wise targets, achievements, and team member performance"
    },
    "/dashboard/customers": {
      heading: "Customers",
      subheading: "Manage your customer relationships"
    },
    "/dashboard/employees": {
      heading: "Employees",
      subheading: "Manage employee information"
    },
    "/dashboard/enquiries": {
      heading: "Enquiries",
      subheading: "Manage customer enquiries"
    },
    "/dashboard/settings": {
      heading: "Settings",
      subheading: "Manage your organization settings and preferences"
    },
    "/dashboard/settings/target": {
      heading: "Store Targets",
      subheading: "Manage monthly and daily store sales targets and fulfilment"
    },
    "/dashboard/live-locations": {
      heading: "Live Locations",
      subheading: "Track real-time employee locations"
    },
    "/dashboard/approvals": {
      heading: "Approvals",
      subheading: "Manage leave and approval requests"
    }
  };

  // Handle dynamic routes for visit details
  const getDynamicPageHeading = (pathname: string) => {
    // Visit detail page pattern: /dashboard/visits/[id]
    const visitDetailMatch = pathname.match(/^\/dashboard\/visits\/(\d+)$/);
    if (visitDetailMatch) {
      const visitId = visitDetailMatch[1];
      return {
        heading: "Visit Details",
        subheading: `Visit #${visitId} - Detailed information and analysis`
      };
    }

    const meetingDetailMatch = pathname.match(/^\/dashboard\/meetings\/(\d+)$/);
    if (meetingDetailMatch) {
      return {
        heading: "Meeting Details",
        backHref: "/dashboard/meetings"
      };
    }
    
    // Customer detail page pattern: /dashboard/customers/[id]
    const customerDetailMatch = pathname.match(/^\/dashboard\/customers\/(\d+)$/);
    if (customerDetailMatch) {
      const customerId = customerDetailMatch[1];
      return {
        heading: "Customer Details",
        subheading: `Customer #${customerId} - Detailed information and history`
      };
    }
    
    // Employee detail page pattern: /dashboard/employee/[id]
    const employeeDetailMatch = pathname.match(/^\/dashboard\/employee\/(\d+)$/);
    if (employeeDetailMatch) {
      const employeeId = employeeDetailMatch[1];
      return {
        heading: "Employee Details",
        subheading: `Employee #${employeeId} - Performance and activity details`
      };
    }
    
    return null;
  };

  // Get page heading - check dynamic routes first, then static routes
  const dynamicHeading = getDynamicPageHeading(pathname);
  const currentPage = dynamicHeading || pageHeadings[pathname] || pageHeadings["/dashboard"];

  return (
    <DashboardLayout 
      heading={currentPage.heading} 
      subheading={currentPage.subheading}
      backHref={currentPage.backHref}
    >
      {children}
    </DashboardLayout>
  );
}
