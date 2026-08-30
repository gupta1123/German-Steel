"use client";

import { createContext, useContext, useEffect } from "react";

export interface DashboardHeaderConfig {
  heading: string;
  subheading?: string;
  onBack?: () => void;
}

const DashboardHeaderContext = createContext<
  ((config: DashboardHeaderConfig | null) => void) | null
>(null);

export function DashboardHeaderOverrideProvider({
  children,
  setHeader,
}: {
  children: React.ReactNode;
  setHeader: (config: DashboardHeaderConfig | null) => void;
}) {
  return (
    <DashboardHeaderContext.Provider value={setHeader}>
      {children}
    </DashboardHeaderContext.Provider>
  );
}

export function useDashboardHeader({ heading, subheading, onBack }: DashboardHeaderConfig) {
  const setHeader = useContext(DashboardHeaderContext);

  useEffect(() => {
    if (!setHeader) return;
    setHeader({ heading, subheading, onBack });
    return () => setHeader(null);
  }, [heading, subheading, onBack, setHeader]);
}
