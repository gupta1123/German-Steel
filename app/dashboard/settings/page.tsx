"use client";

import { useState, useEffect, Suspense } from "react";
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

  // Update active tab when URL parameter changes
  useEffect(() => {
    if (tabParam && validTabs.includes(tabParam)) {
      setActiveTab(tabParam);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tabParam]);

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
    <div className="space-y-6">
      <Tabs value={activeTab} onValueChange={handleTabChange} className="space-y-6">
        <div className="overflow-x-auto -mx-4 px-4 md:mx-0 md:px-0">
        <TabsList className="w-max md:w-full md:grid md:grid-cols-7 gap-2">
          <TabsTrigger value="employeeSummary" className="flex items-center gap-2 text-lg md:text-base px-5 py-3 md:px-4 md:py-2.5 whitespace-nowrap font-medium">
            <BarChart3 className="h-6 w-6 md:h-5 md:w-5" />
            Employee Summary
          </TabsTrigger>
          <TabsTrigger value="allowance" className="flex items-center gap-2 text-lg md:text-base px-5 py-3 md:px-4 md:py-2.5 whitespace-nowrap font-medium">
            <CreditCard className="h-6 w-6 md:h-5 md:w-5" />
            Allowance
          </TabsTrigger>
          <TabsTrigger value="working-days" className="flex items-center gap-2 text-lg md:text-base px-5 py-3 md:px-4 md:py-2.5 whitespace-nowrap font-medium">
            <Calendar className="h-6 w-6 md:h-5 md:w-5" />
            Working Days
          </TabsTrigger>
          <TabsTrigger value="team" className="flex items-center gap-2 text-lg md:text-base px-5 py-3 md:px-4 md:py-2.5 whitespace-nowrap font-medium">
            <Users className="h-6 w-6 md:h-5 md:w-5" />
            Team
          </TabsTrigger>
          <TabsTrigger value="targets" className="flex items-center gap-2 text-lg md:text-base px-5 py-3 md:px-4 md:py-2.5 whitespace-nowrap font-medium">
            <Target className="h-6 w-6 md:h-5 md:w-5" />
            Targets
          </TabsTrigger>
          <TabsTrigger value="dailyBreakdown" className="flex items-center gap-2 text-lg md:text-base px-5 py-3 md:px-4 md:py-2.5 whitespace-nowrap font-medium">
            <BarChart3 className="h-6 w-6 md:h-5 md:w-5" />
            Daily Breakdown
          </TabsTrigger>
          <TabsTrigger value="distanceRecalculation" className="flex items-center gap-2 text-lg md:text-base px-5 py-3 md:px-4 md:py-2.5 whitespace-nowrap font-medium">
            <Route className="h-6 w-6 md:h-5 md:w-5" />
            Distance Recalculation
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
