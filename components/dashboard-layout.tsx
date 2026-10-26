'use client';

import { Button } from "@/components/ui/button";
import { 
  Home, 
  Users, 
  Settings,
  LogOut,
  FileText,
  CheckCircle,
  Tag,
  ThumbsUp,
  ClipboardList,
  User,
  Building,
  UserCheck,
  TrendingUp,
  Landmark,
  HardHat,
  AlertTriangle,
  FolderOpen,
  CalendarCheck,
  Receipt,
  ChartNoAxesCombined,
  Target
} from "lucide-react";
import Link from "@/components/guarded-link";
import { usePathname } from "next/navigation";
import { ReactNode, useEffect, useState } from "react";
import Topbar from "@/components/topbar";
import { useRouter } from "next/navigation";
import { CircleUser } from "lucide-react";
import { useAuth } from "@/components/auth-provider";
import { CurrentUserDto, hasManagerPrivileges, normalizeRoleValue } from "@/lib/auth";
import MobileBottomNav from "@/components/mobile-bottom-nav";
import BrandLogo from "@/components/brand-logo";
import { useNavigationGuard } from "@/components/unsaved-changes-provider";
import { isAdminEmployeeRole } from "@/lib/employee-role";

interface DashboardLayoutProps {
  children: ReactNode;
  heading?: string;
  subheading?: string;
  backHref?: string;
  onBack?: () => void;
}

// Define sidebar categories and items
const allSidebarCategories = [
  {
    name: "Main",
    icon: Home,
    items: [
      { name: "Home", href: "/dashboard", icon: Home },
    ]
  },
  {
    name: "Customers & Projects",
    icon: Building,
    items: [
      { name: "Retail Customers", href: "/dashboard/customers", icon: Users },
      { name: "Institutions", href: "/dashboard/institutions", icon: Landmark },
      { name: "Projects", href: "/dashboard/projects", icon: HardHat },
      { name: "Customer Groups", href: "/dashboard/groups", icon: Building },
    ]
  },
  {
    name: "Field Work",
    icon: CalendarCheck,
    items: [
      { name: "Visits", href: "/dashboard/visits", icon: CalendarCheck },
      { name: "Compliance Issues", href: "/dashboard/nc-register", icon: AlertTriangle },
      { name: "Documents", href: "/dashboard/documents", icon: FolderOpen, disabled: false },
    ]
  },
  {
    name: "Team",
    icon: UserCheck,
    items: [
      { name: "Employees & Teams", href: "/dashboard/employees", icon: User },
      { name: "Targets", href: "/dashboard/settings/target", icon: Target },
      { name: "Attendance", href: "/dashboard/attendance", icon: CheckCircle },
      { name: "Expenses", href: "/dashboard/expenses", icon: Receipt },
    ]
  },
  {
    name: "Reports & Prices",
    icon: TrendingUp,
    items: [
      { name: "Reports", href: "/dashboard/reports", icon: ChartNoAxesCombined },
      { name: "Pricing", href: "/dashboard/pricing", icon: Tag },
    ]
  },
  {
    name: "Office",
    icon: Settings,
    items: [
      { name: "Settings", href: "/dashboard/settings", icon: Settings },
      { name: "Attendance Requests", href: "/dashboard/approvals", icon: FileText },
      { name: "Complaints", href: "/dashboard/complaints", icon: ThumbsUp },
      { name: "Requirements", href: "/dashboard/requirements", icon: ClipboardList },
    ]
  }
];

// Manager allowed pages
const managerAllowedPages = [
  "/dashboard",
  "/dashboard/customers",
  "/dashboard/groups",
  "/dashboard/institutions",
  "/dashboard/projects",
  "/dashboard/complaints",
  "/dashboard/visits",
  "/dashboard/meetings",
  "/dashboard/requirements",
  "/dashboard/pricing",
  "/dashboard/approvals",
  "/dashboard/settings/target"
];

// Function to filter sidebar categories based on user role
const getFilteredSidebarCategories = (userRole: string | null, currentUser: CurrentUserDto | null) => {
  const isManager = hasManagerPrivileges(userRole, currentUser);
  
  // Managers use the direct Targets link; administrators access it in Settings.
  return allSidebarCategories.map(category => ({
    ...category,
    items: category.items.filter(item => isManager
      ? item.disabled || managerAllowedPages.includes(item.href)
      : item.href !== "/dashboard/settings/target"
    )
  })).filter(category => category.items.length > 0);
};

export default function DashboardLayout({ 
  children, 
  heading,
  subheading,
  backHref,
  onBack,
}: DashboardLayoutProps) {
  const { userRole, currentUser, isLoading: isAuthLoading } = useAuth();
  const pathname = usePathname();
  const router = useRouter();
  const { requestNavigation } = useNavigationGuard();
  const { logout } = useAuth();
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  
  // Get filtered sidebar categories based on user role
  const sidebarCategories = getFilteredSidebarCategories(userRole, currentUser);
  

  // Determine display role
  const getDisplayRole = () => {
    const hasAuthority = (target: string) =>
      currentUser?.authorities?.some((auth) => normalizeRoleValue(auth.authority) === target);

    if (hasManagerPrivileges(userRole, currentUser)) {
      return 'Supervisor';
    }
    if (normalizeRoleValue(userRole) === 'ADMIN' || hasAuthority('ROLE_ADMIN')) {
      return 'Admin';
    }
    if (normalizeRoleValue(userRole) === 'FIELD OFFICER' || hasAuthority('ROLE_FIELD OFFICER')) {
      return 'Field Officer';
    }
    return 'User';
  };

  // Check if user is manager
  const isManager = hasManagerPrivileges(userRole, currentUser);
  const viewRole = isAuthLoading ? undefined : isManager ? 'manager' :
    (isAdminEmployeeRole(userRole) || currentUser?.authorities?.some(auth => isAdminEmployeeRole(auth.authority))) ? 'admin' : undefined;

  useEffect(() => {
    if (!isManager) return;

    const isAllowedManagerPath = managerAllowedPages.some((allowedPath) => {
      if (allowedPath === "/dashboard") {
        return pathname === allowedPath;
      }
      return pathname === allowedPath || pathname.startsWith(`${allowedPath}/`);
    });

    if (!isAllowedManagerPath) {
      router.replace("/dashboard");
    }
  }, [isManager, pathname, router]);

  const isActive = (path: string) => {
    if (path === "/dashboard") {
      return pathname === path;
    }
    return pathname === path || pathname.startsWith(`${path}/`);
  };

  const handleLogout = () => {
    requestNavigation(async () => {
      try {
        await logout();
        router.push("/login");
      } catch (error) {
        console.error('Logout error:', error);
        // Still redirect to login even if logout API fails
        router.push("/login");
      }
    });
  };

  return (
    <div className="min-h-screen w-full bg-background md:grid md:grid-cols-[232px_minmax(0,1fr)] lg:grid-cols-[240px_minmax(0,1fr)] xl:grid-cols-[248px_minmax(0,1fr)]">
      {/* Mobile Bottom Navigation */}
      <MobileBottomNav sidebarCategories={sidebarCategories} isManager={isManager || false} />

      {/* Desktop sidebar */}
      <aside className="sticky top-0 hidden h-screen min-w-0 border-r border-border bg-card md:block">
        <div className="flex h-full max-h-screen flex-col">
          <div className="shrink-0 px-4 py-4">
            <Link href="/dashboard" className="flex w-full min-w-0 items-center" aria-label="German Steels home">
              <BrandLogo className="h-auto w-full rounded-sm object-contain" priority />
            </Link>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto px-3 pb-3 pt-1 [scrollbar-color:#c8c8cc_transparent] [scrollbar-width:thin]">
            <nav className="space-y-4" aria-label="Management navigation">
              {sidebarCategories.map((category) => {
                return (
                  <section key={category.name}>
                    <div className="px-3 pb-1.5 text-xs font-medium leading-4 text-muted-foreground">{category.name}</div>
                    <div className="space-y-px">
                      {category.items.map((item) => {
                        const ItemIcon = item.icon;
                        if (item.disabled) {
                          return (
                            <button
                              key={item.name}
                              type="button"
                              disabled
                              title={`${item.name} — Coming soon`}
                              className="flex min-h-9 w-full cursor-not-allowed items-center gap-2.5 rounded-md px-3 py-2 text-left text-sm font-medium leading-5 text-muted-foreground"
                            >
                              <ItemIcon className="h-[18px] w-[18px] shrink-0 stroke-[1.7]" />
                              <span className="min-w-0 flex-1">{item.name}</span>
                            </button>
                          );
                        }
                        return (
                            <Link
                              key={item.name}
                              href={item.href}
                              className={`flex min-h-9 items-center gap-2.5 rounded-md px-3 py-2 text-sm font-medium leading-5 transition-colors ${
                                isActive(item.href)
                                  ? "crm-sidebar-active"
                                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
                              }`}
                            >
                              <ItemIcon className="h-[18px] w-[18px] shrink-0 stroke-[1.7]" />
                              <span className="min-w-0 truncate">{item.name}</span>
                            </Link>
                        );
                      })}
                    </div>
                  </section>
                );
              })}
            </nav>
          </div>
          <div className="relative border-t border-border bg-card p-3">
            <Button
              variant="ghost"
              className="h-auto w-full justify-start gap-3 rounded-md px-2 py-2.5 hover:bg-muted"
              onClick={() => setUserMenuOpen((open) => !open)}
              aria-expanded={userMenuOpen}
              aria-haspopup="menu"
              title={currentUser?.username || "User"}
            >
              <CircleUser className="h-8 w-8 shrink-0 text-foreground/75" />
              <div className="min-w-0 flex-1 text-left">
                <span className="block truncate text-sm font-semibold leading-5 text-foreground">{currentUser?.username || "User"}</span>
                <span className="block truncate text-xs leading-4 text-muted-foreground">{getDisplayRole()}</span>
              </div>
            </Button>

            {userMenuOpen && (
              <div
                role="menu"
                className={`absolute bottom-[calc(100%-0.5rem)] z-50 rounded-md border bg-popover p-1 text-popover-foreground shadow-md ${
                  "left-4 right-4"
                }`}
              >
                {!isManager && (
                  <button
                    type="button"
                    role="menuitem"
                    className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-sm hover:bg-accent hover:text-accent-foreground"
                    onClick={() => {
                      requestNavigation(() => {
                        setUserMenuOpen(false);
                        router.push("/dashboard/settings");
                      });
                    }}
                  >
                    <Settings className="h-4 w-4" />
                    <span>Settings</span>
                  </button>
                )}
                {!isManager && <div className="-mx-1 my-1 h-px bg-border" />}
                <button
                  type="button"
                  role="menuitem"
                  className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-sm hover:bg-accent hover:text-accent-foreground"
                  onClick={() => {
                    setUserMenuOpen(false);
                    handleLogout();
                  }}
                >
                  <LogOut className="h-4 w-4" />
                  <span>Logout</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </aside>

      {/* Main content area */}
      <div className="flex min-w-0 flex-col">
        {/* Topbar */}
        <Topbar heading={heading} subheading={subheading} backHref={backHref} onBack={onBack} viewRole={viewRole} />
        
        {/* Page content */}
        {/* pb-32 on mobile: clears the fixed bottom nav (~73px base, ~107px+ with
            wrapped labels + home-indicator safe area) so page-bottom controls
            (e.g. Employees pagination, Approvals approve/reject) stay tappable. */}
        <main className="flex min-w-0 flex-1 flex-col gap-4 p-3 lg:gap-6 lg:p-4 pb-32 md:pb-6">
          {children}
        </main>
      </div>
    </div>
  );
}
