'use client';

import { Fragment, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { 
  Home, 
  Users, 
  Calendar,
  ClipboardList,
  ThumbsUp,
  Tag,
  FileText,
  Phone,
  User,
  CheckCircle,
  DollarSign,
  BarChart,
  Settings,
  X,
  MoreHorizontal
} from "lucide-react";
import { useAuth } from "@/components/auth-provider";

interface MoreNavSheetProps {
  isOpen: boolean;
  onClose: () => void;
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
  visibleItems: Array<{
    name: string;
    href: string;
    icon: React.ComponentType<{className?: string}>;
  }>;
}

export default function MoreNavSheet({ 
  isOpen, 
  onClose, 
  sidebarCategories, 
  isManager, 
  visibleItems 
}: MoreNavSheetProps) {
  const pathname = usePathname();
  const { currentUser } = useAuth();

  // Prevent body scroll when sheet is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isOpen]);

  // Get all available navigation items
  const getAllNavItems = () => {
    const items: Array<{
      name: string;
      href: string;
      icon: React.ComponentType<{className?: string}>;
    }> = [
      { name: "Dashboard", href: "/dashboard", icon: Home }
    ];

    // Add Settings for non-managers
    if (!isManager) {
      items.push({ name: "Settings", href: "/dashboard/settings", icon: Settings });
    }

    // Add items from categories
    sidebarCategories.forEach(category => {
      category.items.forEach(item => {
        items.push(item);
      });
    });

    return items;
  };

  const allItems = getAllNavItems();
  
  // Filter out items that are already visible in the bottom nav
  const hiddenItems = allItems.filter(item => 
    !visibleItems.some(visible => visible.href === item.href)
  );

  const isActive = (path: string) => {
    return pathname === path;
  };

  if (!isOpen) return null;

  return (
    <Fragment>
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-black/50 z-50 md:hidden backdrop-enter"
        onClick={onClose}
      />
      
      {/* Bottom Sheet */}
      <div className="fixed bottom-0 left-0 right-0 z-50 md:hidden bottom-sheet-enter">
        <div className="bg-background/95 backdrop-blur-sm rounded-t-3xl shadow-2xl border-t border-border max-h-[80vh] overflow-hidden">
          {/* Handle */}
          <div className="flex justify-center pt-3 pb-2 cursor-pointer" onClick={onClose}>
            <div className="w-12 h-1.5 bg-muted-foreground/30 rounded-full hover:bg-muted-foreground/50 transition-colors" />
          </div>
          
          {/* Header */}
          <div className="px-6 pb-4">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-semibold">More Pages</h2>
              <button
                onClick={onClose}
                className="p-2 rounded-full hover:bg-muted transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
          </div>
          
          {/* Content */}
          <div className="overflow-y-auto px-6 pb-6 max-h-[60vh] safe-area-pb">
            <div className="grid grid-cols-2 gap-4">
              {hiddenItems.map((item) => {
                const ItemIcon = item.icon;
                const active = isActive(item.href);
                
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={onClose}
                    className={`flex flex-col items-center justify-center p-5 rounded-xl border-2 transition-all duration-200 ${
                      active
                        ? "text-primary bg-primary/10 border-primary/30 scale-105 shadow-md"
                        : "text-muted-foreground hover:text-foreground hover:bg-muted/50 border-border hover:border-muted-foreground/30 hover:scale-105"
                    }`}
                  >
                    <ItemIcon className={`h-7 w-7 mb-3 ${active ? 'drop-shadow-sm' : ''}`} />
                    <span className={`text-sm font-medium text-center leading-tight ${active ? 'font-semibold' : ''}`}>
                      {item.name}
                    </span>
                  </Link>
                );
              })}
            </div>
            
            {hiddenItems.length === 0 && (
              <div className="text-center py-12 text-muted-foreground">
                <MoreHorizontal className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p className="text-lg font-medium">All pages are already visible</p>
                <p className="text-sm mt-1">Check the bottom navigation bar</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </Fragment>
  );
}
