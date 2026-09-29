'use client';

import StoreTargets from "@/components/StoreTargets";
import EmployeeKpiTargets from "@/components/EmployeeKpiTargets";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export default function TargetSettingsPage() {
  return (
    <Tabs defaultValue="stores" className="space-y-4">
      <TabsList>
        <TabsTrigger value="stores">Store targets</TabsTrigger>
        <TabsTrigger value="employee-kpis">Employee KPIs</TabsTrigger>
      </TabsList>
      <TabsContent value="stores" className="m-0">
        <StoreTargets />
      </TabsContent>
      <TabsContent value="employee-kpis" className="m-0">
        <EmployeeKpiTargets />
      </TabsContent>
    </Tabs>
  );
}
