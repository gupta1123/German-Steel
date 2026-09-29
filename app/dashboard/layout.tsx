import type { ReactNode } from "react";
import DashboardSegmentLayout from "@/components/dashboard-segment-layout";

// Dashboard pages render request-time values (e.g. `new Date()` in filter
// defaults) and are all auth-gated with client-side data fetching, so static
// prerendering only bakes stale build-time HTML that mismatches on hydration
// (React #418). Render this subtree on demand instead.
export const dynamic = 'force-dynamic';

export default function Layout({ children }: { children: ReactNode }) {
  return <DashboardSegmentLayout>{children}</DashboardSegmentLayout>;
}
