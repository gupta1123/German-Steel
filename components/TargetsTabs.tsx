'use client';

import OfficerTargets from "@/components/OfficerTargets";

// Single entry for target management so /dashboard/settings (Targets tab) and
// /dashboard/settings/target always show the same screen.
export default function TargetsTabs() {
  return <OfficerTargets />;
}
