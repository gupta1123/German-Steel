'use client';

import { Button } from "@/components/ui/button";
import { 
  Home, 
  Users, 
  Settings,
  LogOut,
  FileText,
  DollarSign,
  Calendar,
  CheckCircle,
  Tag,
  ThumbsUp,
  ClipboardList,
  BarChart,
  User,
  Phone,
  ChevronDown,
  ChevronRight,
  Building,
  ShoppingCart,
  UserCheck,
  FileSearch,
  TrendingUp,
  Target,
  MapPin,
  Handshake,
  PanelLeftClose,
  PanelLeftOpen
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ReactNode, useEffect, useState } from "react";
import Topbar from "@/components/topbar";
import { useRouter } from "next/navigation";
import { CircleUser } from "lucide-react";
import { useAuth } from "@/components/auth-provider";
import { CurrentUserDto, hasManagerPrivileges, normalizeRoleValue } from "@/lib/auth";
import MobileBottomNav from "@/components/mobile-bottom-nav";
import BrandLogo from "@/components/brand-logo";

interface DashboardLayoutProps {
  children: ReactNode;
  heading?: string;
  subheading?: string;
  backHref?: string;
}

// Define sidebar categories and items
const allSidebarCategories = [
  {
    name: "Customers",
    icon: Users,
    items: [
      { name: "Customers", href: "/dashboard/customers", icon: Users },
      { name: "Enquiries", href: "/dashboard/enquiries", icon: Phone },
      { name: "Complaints", href: "/dashboard/complaints", icon: ThumbsUp },
    ]
  },
  {
    name: "Sales",
    icon: Building,
    items: [
      { name: "Visits", href: "/dashboard/visits", icon: Calendar },
      { name: "Meetings", href: "/dashboard/meetings", icon: Handshake },
      { name: "Requirements", href: "/dashboard/requirements", icon: ClipboardList },
      { name: "Pricing", href: "/dashboard/pricing", icon: Tag },
    ]
  },
  {
    name: "Employees",
    icon: UserCheck,
    items: [
      { name: "Employees", href: "/dashboard/employees", icon: User },
      { name: "Attendance", href: "/dashboard/attendance", icon: CheckCircle },
      { name: "Expenses", href: "/dashboard/expenses", icon: DollarSign },
    ]
  },
  {
    name: "Reports",
    icon: TrendingUp,
    items: [
      { name: "Approvals", href: "/dashboard/approvals", icon: FileText },
      { name: "Reports", href: "/dashboard/reports", icon: BarChart },
    ]
  }
];

// Manager allowed pages
const managerAllowedPages = [
  "/dashboard",
  "/dashboard/customers",
  "/dashboard/enquiries", 
  "/dashboard/complaints",
  "/dashboard/visits",
  "/dashboard/meetings",
  "/dashboard/requirements",
  "/dashboard/pricing",
  "/dashboard/approvals"
];

// Function to filter sidebar categories based on user role
const getFilteredSidebarCategories = (userRole: string | null, currentUser: CurrentUserDto | null) => {
  const isManager = hasManagerPrivileges(userRole, currentUser);
  
  if (isManager) {
    // For managers, filter categories to only show allowed pages
    return allSidebarCategories.map(category => ({
      ...category,
      items: category.items.filter(item => managerAllowedPages.includes(item.href))
    })).filter(category => category.items.length > 0); // Remove empty categories
  }
  
  // For admin and other roles, show all categories
  return allSidebarCategories;
};

export default function DashboardLayout({ 
  children, 
  heading,
  subheading,
  backHref
}: DashboardLayoutProps) {
  const { userRole, currentUser } = useAuth();
  const pathname = usePathname();
  const router = useRouter();
  const { logout } = useAuth();
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  
  // Get filtered sidebar categories based on user role
  const sidebarCategories = getFilteredSidebarCategories(userRole, currentUser);
  
  const [openCategories, setOpenCategories] = useState<Record<string, boolean>>(() => {
    const initialState: Record<string, boolean> = {};
    sidebarCategories.forEach(category => {
      initialState[category.name] = true;
    });
    return initialState;
  });

  // Determine display role
  const getDisplayRole = () => {
    const hasAuthority = (target: string) =>
      currentUser?.authorities?.some((auth) => normalizeRoleValue(auth.authority) === target);

    if (hasManagerPrivileges(userRole, currentUser)) {
      return 'Manager';
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

  useEffect(() => {
    const savedState = window.localStorage.getItem("germanSteels-sidebar-collapsed");
    if (savedState) {
      setSidebarCollapsed(savedState === "true");
    }
  }, []);

  useEffect(() => {
    window.localStorage.setItem("germanSteels-sidebar-collapsed", String(sidebarCollapsed));
  }, [sidebarCollapsed]);

  const toggleCategory = (categoryName: string) => {
    setOpenCategories(prev => ({
      ...prev,
      [categoryName]: !prev[categoryName]
    }));
  };

  const isActive = (path: string) => {
    if (path === "/dashboard") {
      return pathname === path;
    }
    return pathname === path || pathname.startsWith(`${path}/`);
  };

  const handleLogout = async () => {
    try {
      await logout();
      router.push("/login");
    } catch (error) {
      console.error('Logout error:', error);
      // Still redirect to login even if logout API fails
      router.push("/login");
    }
  };

  return (
    <div className={`min-h-screen w-full grid ${sidebarCollapsed ? "md:grid-cols-[64px_1fr]" : "md:grid-cols-[220px_1fr] lg:grid-cols-[240px_1fr]"}`}>
      {/* Mobile Bottom Navigation */}
      <MobileBottomNav sidebarCategories={sidebarCategories} isManager={isManager || false} />

      {/* Desktop sidebar */}
      <div className="hidden border-r bg-background md:block sticky top-0 h-screen">
        <div className="flex h-full max-h-screen flex-col">
          <div className={`flex h-10 items-center border-b ${sidebarCollapsed ? "justify-center px-2" : "justify-between px-4 lg:px-4"}`}>
            {!sidebarCollapsed && (
              <Link href="/dashboard" className="flex min-w-0 items-center" aria-label="German Steels dashboard">
                <BrandLogo className="h-7 w-auto max-w-[138px] object-contain" priority />
              </Link>
            )}
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-8 w-8 shrink-0"
              aria-label={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
              title={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
              onClick={() => {
                setUserMenuOpen(false);
                setSidebarCollapsed((collapsed) => !collapsed);
              }}
            >
              {sidebarCollapsed ? <PanelLeftOpen className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
            </Button>
          </div>
          <div className="flex-1 overflow-y-auto py-4">
            <nav className="grid gap-1 px-2">
              {/* Dashboard link (no category) */}
              <Link
                href="/dashboard"
                title="Dashboard"
                className={`flex items-center rounded-lg py-2 transition-all ${
                  sidebarCollapsed ? "justify-center px-2" : "gap-2 px-3"
                } ${
                  pathname === "/dashboard"
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted"
                }`}
              >
                <Home className="h-4 w-4" />
                {!sidebarCollapsed && <span className="text-sm">Dashboard</span>}
              </Link>
              
              {/* Settings link - only show for non-managers */}
              {!isManager && (
                <Link
                  href="/dashboard/settings"
                  title="Settings"
                  className={`flex items-center rounded-lg py-2 transition-all ${
                    sidebarCollapsed ? "justify-center px-2" : "gap-2 px-3"
                  } ${
                    pathname.startsWith("/dashboard/settings")
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:text-foreground hover:bg-muted"
                  }`}
                >
                  <Settings className="h-4 w-4" />
                  {!sidebarCollapsed && <span className="text-sm">Settings</span>}
                </Link>
              )}
              
              {/* Categories */}
              {sidebarCategories.map((category) => {
                const CategoryIcon = category.icon;
                const isOpen = openCategories[category.name];
                
                if (sidebarCollapsed) {
                  return (
                    <div key={category.name} className="mt-1 border-t pt-1">
                      {category.items.map((item) => {
                        const ItemIcon = item.icon;
                        return (
                          <Link
                            key={item.name}
                            href={item.href}
                            title={item.name}
                            aria-label={item.name}
                            className={`flex items-center justify-center rounded-lg px-2 py-2 transition-all ${
                              isActive(item.href)
                                ? "bg-primary text-primary-foreground"
                                : "text-muted-foreground hover:text-foreground hover:bg-muted"
                            }`}
                          >
                            <ItemIcon className="h-4 w-4" />
                          </Link>
                        );
                      })}
                    </div>
                  );
                }

                return (
                  <div key={category.name} className="flex flex-col">
                    <Button
                      variant="ghost"
                      className="justify-between px-3 py-2 h-auto"
                      onClick={() => toggleCategory(category.name)}
                    >
                      <div className="flex items-center gap-2">
                        <CategoryIcon className="h-4 w-4" />
                        <span className="text-sm font-medium">{category.name}</span>
                      </div>
                      {isOpen ? (
                        <ChevronDown className="h-4 w-4" />
                      ) : (
                        <ChevronRight className="h-4 w-4" />
                      )}
                    </Button>
                    
                    {isOpen && (
                      <div className="pl-4 py-1 space-y-1">
                        {category.items.map((item) => {
                          const ItemIcon = item.icon;
                          return (
                            <Link
                              key={item.name}
                              href={item.href}
                              className={`flex items-center gap-2 rounded-lg px-3 py-2 transition-all ${
                                isActive(item.href)
                                  ? "bg-primary text-primary-foreground"
                                  : "text-muted-foreground hover:text-foreground hover:bg-muted"
                              }`}
                            >
                              <ItemIcon className="h-4 w-4" />
                              <span className="text-sm">{item.name}</span>
                            </Link>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </nav>
          </div>
          <div className={`relative border-t ${sidebarCollapsed ? "p-2" : "p-4"}`}>
            <Button
              variant="ghost"
              className={`w-full gap-2 px-2 h-auto ${sidebarCollapsed ? "justify-center py-2" : "justify-start"}`}
              onClick={() => setUserMenuOpen((open) => !open)}
              aria-expanded={userMenuOpen}
              aria-haspopup="menu"
              title={currentUser?.username || "User"}
            >
              <CircleUser className="h-4 w-4" />
              {!sidebarCollapsed && (
                <div className="flex min-w-0 flex-col items-start">
                  <span className="max-w-full truncate font-medium text-xs">{currentUser?.username || "User"}</span>
                  <span className="text-xs text-muted-foreground">{getDisplayRole()}</span>
                </div>
              )}
            </Button>

            {userMenuOpen && (
              <div
                role="menu"
                className={`absolute bottom-[calc(100%-0.5rem)] z-50 rounded-md border bg-popover p-1 text-popover-foreground shadow-md ${
                  sidebarCollapsed ? "left-2 w-48" : "left-4 right-4"
                }`}
              >
                {!isManager && (
                  <button
                    type="button"
                    role="menuitem"
                    className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-sm hover:bg-accent hover:text-accent-foreground"
                    onClick={() => {
                      setUserMenuOpen(false);
                      router.push("/dashboard/settings");
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
      </div>

      {/* Main content area */}
      <div className="flex min-w-0 flex-col">
        {/* Topbar */}
        <Topbar heading={heading} subheading={subheading} backHref={backHref} />
        
        {/* Page content */}
        <main className="flex min-w-0 flex-1 flex-col gap-4 p-3 lg:gap-6 lg:p-4 pb-24 md:pb-6">
          {children}
        </main>
      </div>
    </div>
  );
}
