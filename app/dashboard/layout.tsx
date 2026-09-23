"use client";

import DashboardLayout from "@/components/dashboard-layout";
import { ReactNode, useCallback, useState } from "react";
import { usePathname } from "next/navigation";
import {
  DashboardHeaderConfig,
  DashboardHeaderOverrideProvider,
} from "@/components/dashboard-header-context";

export default function Layout({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const [headerOverride, setHeaderOverrideState] = useState<DashboardHeaderConfig | null>(null);
  const setHeaderOverride = useCallback((config: DashboardHeaderConfig | null) => {
    setHeaderOverrideState(config);
  }, []);
  
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
      heading: "Retail Accounts",
      subheading: "Track and manage dealer and distributor accounts"
    },
    "/dashboard/groups": {
      heading: "Client Groups",
      subheading: "Group master — link branches of the same family or corporate group"
    },
    "/dashboard/regions": {
      heading: "Sales Regions",
      subheading: "Zones and PIN → region mappings for territory assignment"
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
      heading: "Attendance correction",
      subheading: "Review and manage attendance correction requests"
    },
    "/dashboard/projects": {
      heading: "Projects",
      subheading: "Manage project portfolio and lifecycle"
    },
    "/dashboard/institutions": {
      heading: "Institutions",
      subheading: "Manage institution portfolio and empanelment"
    },
    "/dashboard/approval-pipeline": {
      heading: "Approval Pipeline",
      subheading: "Review and advance stage approvals"
    },
    "/dashboard/nc-register": {
      heading: "NC Register",
      subheading: "Track non-conformities and closures"
    }
  };

  // Handle dynamic routes for visit details
  const getDynamicPageHeading = (pathname: string) => {
    // Visit detail page pattern: /dashboard/visits/[id]
    const visitDetailMatch = pathname.match(/^\/dashboard\/visits\/(\d+)$/);
    if (visitDetailMatch) {
      const visitId = visitDetailMatch[1];
      return {
        heading: `Visit #${visitId}`,
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

    // Client group detail pattern: /dashboard/groups/[id]
    const groupDetailMatch = pathname.match(/^\/dashboard\/groups\/(\d+)$/);
    if (groupDetailMatch) {
      return {
        heading: "Group Details",
        subheading: `Group #${groupDetailMatch[1]} - Branches and roll-up`
      };
    }
    
    // Employee detail page pattern: /dashboard/employee/[id] and /dashboard/employees/[id] (plural)
    const employeeDetailMatch = pathname.match(/^\/dashboard\/employees?\/(\d+)$/);
    if (employeeDetailMatch) {
      const employeeId = employeeDetailMatch[1];
      return {
        heading: "Employee Details",
        subheading: `Employee #${employeeId} - Performance and activity details`
      };
    }

    // Project detail pattern: /dashboard/projects/[id]
    const projectDetailMatch = pathname.match(/^\/dashboard\/projects\/(\d+)$/);
    if (projectDetailMatch) {
      return {
        heading: "Project Details",
        subheading: `Project #${projectDetailMatch[1]} - Overview and lifecycle`
      };
    }

    // Institution detail pattern: /dashboard/institutions/[id]
    const institutionDetailMatch = pathname.match(/^\/dashboard\/institutions\/(\d+)$/);
    if (institutionDetailMatch) {
      return {
        heading: "Institution Details",
        subheading: `Institution #${institutionDetailMatch[1]} - Profile and empanelment`
      };
    }

    // Settings subpages: keep Settings heading with specific subheading
    if (pathname.startsWith("/dashboard/settings/")) {
      const sub = pathname.replace("/dashboard/settings/", "");
      const label = sub.charAt(0).toUpperCase() + sub.slice(1).replace(/-/g, ' ');
      return {
        heading: "Settings",
        subheading: `${label} — Manage your organization settings and preferences`
      };
    }
    
    return null;
  };

  // Get page heading - check dynamic routes first, then static routes
  const dynamicHeading = getDynamicPageHeading(pathname);
  const basePage = dynamicHeading || pageHeadings[pathname] || pageHeadings["/dashboard"];

  return (
    <DashboardHeaderOverrideProvider setHeader={setHeaderOverride}>
      <DashboardLayout
        heading={headerOverride?.heading || basePage.heading}
        subheading={headerOverride?.subheading ?? basePage.subheading}
        backHref={headerOverride ? undefined : basePage.backHref}
        onBack={headerOverride?.onBack}
      >
        {children}
      </DashboardLayout>
    </DashboardHeaderOverrideProvider>
  );
}
