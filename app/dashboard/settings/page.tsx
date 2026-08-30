"use client";

import { useState, useEffect, useRef, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { useNavigationGuard } from "@/components/unsaved-changes-provider";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  CreditCard, 
  Calendar, 
  Users,
  BarChart3,
  Route,
  Target
} from "lucide-react";

// Import all the setting components
import EmployeeSummary from "@/components/EmployeeSummary";
import Allowance from "@/components/Allowance";
import WorkingDays from "@/components/WorkingDays";
import Teams from "@/components/Teams";
import DailyBreakdown from "@/components/DailyBreakdown";
import DistanceRecalculation from "@/components/DistanceRecalculation";
import StoreTargets from "@/components/StoreTargets";

function SettingsContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { requestNavigation } = useNavigationGuard();
  const tabParam = searchParams.get('tab');
  
  // Valid tab values
  const validTabs = ['employeeSummary', 'allowance', 'working-days', 'team', 'targets', 'dailyBreakdown', 'distanceRecalculation'];
  const initialTab = tabParam && validTabs.includes(tabParam) ? tabParam : 'employeeSummary';
  
  const [activeTab, setActiveTab] = useState(initialTab);
  const tabScrollerRef = useRef<HTMLDivElement>(null);

  // Update active tab when URL parameter changes
  useEffect(() => {
    if (tabParam && validTabs.includes(tabParam)) {
      setActiveTab(tabParam);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tabParam]);

  useEffect(() => {
    const scroller = tabScrollerRef.current;
    if (!scroller) return;

    const frame = window.requestAnimationFrame(() => {
      const activeTrigger = scroller.querySelector<HTMLElement>('[role="tab"][data-state="active"]');
      if (!activeTrigger) return;

      const targetLeft = activeTrigger.offsetLeft
        - (scroller.clientWidth - activeTrigger.offsetWidth) / 2;
      const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

      scroller.scrollTo({
        left: Math.max(0, targetLeft),
        behavior: prefersReducedMotion ? 'auto' : 'smooth',
      });
    });

    return () => window.cancelAnimationFrame(frame);
  }, [activeTab]);

  // Update URL when tab changes (optional, for better UX)
  const handleTabChange = (value: string) => {
    requestNavigation(() => {
      setActiveTab(value);
      const nextParams = new URLSearchParams(searchParams.toString());
      nextParams.set("tab", value);
      router.push(`/dashboard/settings?${nextParams.toString()}`, { scroll: false });
    });
  };

  return (
    <div className="space-y-4 py-4">
      <Tabs value={activeTab} onValueChange={handleTabChange} className="space-y-4">
        <div ref={tabScrollerRef} className="-mx-1 overflow-x-auto px-1 pb-1">
        <TabsList className="h-auto w-max justify-start gap-1 rounded-lg border border-border/70 bg-card p-1 shadow-sm">
          <TabsTrigger value="employeeSummary" className="h-9 gap-1.5 rounded-md px-3 text-xs font-medium whitespace-nowrap data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
            <BarChart3 className="h-3.5 w-3.5" />
            Salary Summary
          </TabsTrigger>
          <TabsTrigger value="allowance" className="h-9 gap-1.5 rounded-md px-3 text-xs font-medium whitespace-nowrap data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
            <CreditCard className="h-3.5 w-3.5" />
            Allowances
          </TabsTrigger>
          <TabsTrigger value="working-days" className="h-9 gap-1.5 rounded-md px-3 text-xs font-medium whitespace-nowrap data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
            <Calendar className="h-3.5 w-3.5" />
            Working Days
          </TabsTrigger>
          <TabsTrigger value="team" className="h-9 gap-1.5 rounded-md px-3 text-xs font-medium whitespace-nowrap data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
            <Users className="h-3.5 w-3.5" />
            Teams
          </TabsTrigger>
          <TabsTrigger value="targets" className="h-9 gap-1.5 rounded-md px-3 text-xs font-medium whitespace-nowrap data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
            <Target className="h-3.5 w-3.5" />
            Targets
          </TabsTrigger>
          <TabsTrigger value="dailyBreakdown" className="h-9 gap-1.5 rounded-md px-3 text-xs font-medium whitespace-nowrap data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
            <BarChart3 className="h-3.5 w-3.5" />
            Daily Breakdown
          </TabsTrigger>
          <TabsTrigger value="distanceRecalculation" className="h-9 gap-1.5 rounded-md px-3 text-xs font-medium whitespace-nowrap data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
            <Route className="h-3.5 w-3.5" />
            Distance
          </TabsTrigger>
        </TabsList>
        </div>
        
        <TabsContent value="employeeSummary">
          <EmployeeSummary />
        </TabsContent>
        
        <TabsContent value="allowance">
          <Allowance />
        </TabsContent>
        
        <TabsContent value="working-days">
          <WorkingDays />
        </TabsContent>
        
        <TabsContent value="team">
          <Teams />
        </TabsContent>

        <TabsContent value="targets">
          <StoreTargets />
        </TabsContent>
        
        <TabsContent value="dailyBreakdown">
          <DailyBreakdown />
        </TabsContent>

        <TabsContent value="distanceRecalculation">
          <DistanceRecalculation />
        </TabsContent>
      </Tabs>
    </div>
  );
}

export default function SettingsPage() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <SettingsContent />
    </Suspense>
  );
}
