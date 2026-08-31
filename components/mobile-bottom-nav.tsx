'use client';

import Link from "@/components/guarded-link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { 
  Home, 
  Users, 
  Calendar,
  ClipboardList,
  ThumbsUp,
  Tag,
  FileText,
  User,
  CheckCircle,
  DollarSign,
  BarChart,
  Settings,
  MoreHorizontal
} from "lucide-react";
import { useAuth } from "@/components/auth-provider";
import MoreNavSheet from "@/components/more-nav-sheet";

interface MobileBottomNavProps {
  sidebarCategories: Array<{
    name: string;
    icon: React.ComponentType<{className?: string}>;
    items: Array<{
      name: string;
      href: string;
      icon: React.ComponentType<{className?: string}>;
    }>;
  }>;
  isManager: boolean;
}

export default function MobileBottomNav({ sidebarCategories, isManager }: MobileBottomNavProps) {
  const pathname = usePathname();
  const { currentUser } = useAuth();
  const [isMoreSheetOpen, setIsMoreSheetOpen] = useState(false);

  // Get mobile navigation items - prioritize most important ones
  const getMobileNavItems = () => {
    const items = [
      { name: "Dashboard", href: "/dashboard", icon: Home }
    ];

    // Add most important pages first
    const importantPages = [
      { name: "Visits", href: "/dashboard/visits", icon: Calendar },
      { name: "Customers", href: "/dashboard/customers", icon: Users },
      { name: "Requirements", href: "/dashboard/requirements", icon: ClipboardList },
      { name: "Complaints", href: "/dashboard/complaints", icon: ThumbsUp },
      { name: "Pricing", href: "/dashboard/pricing", icon: Tag },
      { name: "Approvals", href: "/dashboard/approvals", icon: FileText },
    ];

    // Add important pages that are allowed for the current role
    importantPages.forEach(page => {
      const isAllowed = sidebarCategories.some(category => 
        category.items.some(item => item.href === page.href)
      );
      if (isAllowed) {
        items.push(page);
      }
    });

    // Add Settings for non-managers
    if (!isManager) {
      items.push({ name: "Settings", href: "/dashboard/settings", icon: Settings });
    }

    return items;
  };

  const mobileNavItems = getMobileNavItems();

  // For mobile, we'll show only 4 items + More button
  const visibleItems = mobileNavItems.slice(0, 4);

  const isActive = (path: string) => {
    return pathname === path;
  };

  return (
    <>
      <div className="fixed bottom-0 left-0 right-0 bg-background/95 backdrop-blur-sm border-t border-border md:hidden z-50 shadow-lg">
        <div className="flex items-center justify-around py-3 px-1 safe-area-pb">
          {visibleItems.map((item) => {
            const ItemIcon = item.icon;
            const active = isActive(item.href);
            
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex flex-col items-center justify-center p-2 rounded-lg transition-all min-w-0 flex-1 mx-0.5 ${
                  active
                    ? "text-primary bg-primary/10 scale-105"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                }`}
              >
                <ItemIcon className={`h-5 w-5 mb-1 ${active ? 'drop-shadow-sm' : ''}`} />
                <span className={`text-xs font-medium text-center leading-tight ${active ? 'font-semibold' : ''}`} style={{wordBreak: 'break-word', lineHeight: '1.2'}}>
                  {item.name}
                </span>
              </Link>
            );
          })}
          
          {/* More button */}
          <button
            onClick={() => setIsMoreSheetOpen(true)}
            className="flex flex-col items-center justify-center p-2 rounded-lg transition-all min-w-0 flex-1 mx-0.5 text-muted-foreground hover:text-foreground hover:bg-muted/50 active:scale-95"
          >
            <div className="relative">
              <MoreHorizontal className="h-5 w-5 mb-1" />
              {mobileNavItems.length > 4 && (
                <div className="absolute -top-1 -right-1 h-4 w-4 bg-primary rounded-full flex items-center justify-center">
                  <span className="text-xs text-primary-foreground font-bold">
                    {mobileNavItems.length - 4}
                  </span>
                </div>
              )}
            </div>
            <span className="text-xs font-medium text-center leading-tight" style={{wordBreak: 'break-word', lineHeight: '1.2'}}>
              More
            </span>
          </button>
        </div>
      </div>
      
      {/* More Navigation Sheet */}
      <MoreNavSheet
        isOpen={isMoreSheetOpen}
        onClose={() => setIsMoreSheetOpen(false)}
        sidebarCategories={sidebarCategories}
        isManager={isManager}
        visibleItems={visibleItems}
      />
    </>
  );
}
