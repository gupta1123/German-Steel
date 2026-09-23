'use client';

import * as React from 'react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';
import {
  Building2,
  CalendarCheck,
  Navigation,
  Receipt,
  Target,
  Wallet,
  ClipboardList,
  MessageSquareWarning,
  Tag,
  FileText,
  Handshake,
  IndianRupee,
  LayoutDashboard,
  ListChecks,
  MapPin,
  StickyNote,
  Users,
  Workflow,
  type LucideIcon,
} from 'lucide-react';

// Shared detail-page shell foundation for Institution / Project / Retail (Phase 1).
// - Standardizes visible tab order: Overview, Process or Relationship, Contacts, Visits, Documents, Tasks, Notes
// - Retail uses Relationship/Network, not approval Process
// - Institution/Project Process sections keep existing real backend statuses (no invented allowedActions)
// - Provides reusable status summary area (current status, meaning, pending context, existing actions only)

export type DetailTabValue =
  | 'overview'
  | 'process'
  | 'relationship'
  | 'parties'
  | 'contacts'
  | 'visits'
  | 'brands'
  | 'requirements'
  | 'complaints'
  | 'documents'
  | 'sales'
  | 'tasks'
  | 'notes'
  | 'attendance'
  | 'expenses'
  | 'salary'
  | 'targets'
  | 'tracking';

export interface DetailTab {
  value: DetailTabValue;
  label: string;
  count?: number;
  content: React.ReactNode;
}

const FLAT_TAB_SECTION_CLASS = '[&>[data-slot=card]]:gap-4 [&>[data-slot=card]]:rounded-none [&>[data-slot=card]]:border-0 [&>[data-slot=card]]:bg-transparent [&>[data-slot=card]]:py-0 [&>[data-slot=card]]:shadow-none [&>[data-slot=card]>[data-slot=card-header]]:px-0 [&>[data-slot=card]>[data-slot=card-content]]:px-0';

const TAB_ORDER: DetailTabValue[] = ['overview', 'process', 'relationship', 'parties', 'contacts', 'visits', 'brands', 'requirements', 'complaints', 'documents', 'sales', 'tasks', 'notes', 'attendance', 'expenses', 'salary', 'targets', 'tracking'];

const TAB_ICONS: Record<DetailTabValue, LucideIcon> = {
  overview: LayoutDashboard,
  process: Workflow,
  relationship: Handshake,
  parties: Building2,
  contacts: Users,
  visits: MapPin,
  brands: Tag,
  requirements: ClipboardList,
  complaints: MessageSquareWarning,
  documents: FileText,
  sales: IndianRupee,
  tasks: ListChecks,
  notes: StickyNote,
  attendance: CalendarCheck,
  expenses: Receipt,
  salary: Wallet,
  targets: Target,
  tracking: Navigation,
};

export function DetailShell({
  defaultValue = 'overview',
  tabs,
  value,
  onValueChange,
}: {
  defaultValue?: DetailTabValue;
  tabs: DetailTab[];
  /** Controlled mode: the page owns the active tab (e.g. syncs it to ?tab=); hash syncing is skipped. */
  value?: DetailTabValue;
  onValueChange?: (value: DetailTabValue) => void;
}) {
  const controlled = value !== undefined;
  const sorted = React.useMemo(() => {
    const map = new Map(tabs.map((t) => [t.value, t]));
    return TAB_ORDER.filter((v) => map.has(v)).map((v) => map.get(v)!) as DetailTab[];
  }, [tabs]);

  const resolvedDefault = sorted.find((t) => t.value === defaultValue)?.value ?? sorted[0]?.value ?? 'overview';
  const [uncontrolledActive, setActive] = React.useState<string>(resolvedDefault);
  const active = controlled ? value : uncontrolledActive;
  const listRef = React.useRef<HTMLDivElement>(null);

  // Restore the tab from the URL hash so refresh / back keeps the user's place.
  React.useEffect(() => {
    if (controlled) return;
    const syncFromHash = () => {
      const fromHash = window.location.hash.replace('#', '');
      if (sorted.some((t) => t.value === fromHash)) setActive(fromHash);
    };
    syncFromHash();
    window.addEventListener('hashchange', syncFromHash);
    return () => window.removeEventListener('hashchange', syncFromHash);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const changeTab = (next: string) => {
    if (controlled) { onValueChange?.(next as DetailTabValue); return; }
    setActive(next);
    window.history.replaceState(window.history.state, '', `${window.location.pathname}${window.location.search}#${next}`);
  };

  // Keep the active tab visible when the bar scrolls horizontally on small screens.
  React.useEffect(() => {
    const el = listRef.current?.querySelector<HTMLElement>('[data-state="active"]');
    el?.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: 'smooth' });
  }, [active]);

  return (
    <Tabs value={active} onValueChange={changeTab} className="space-y-3">
      <div className="relative border-b border-border">
        <TabsList
          ref={listRef}
          className="flex h-auto w-full justify-start gap-1 overflow-x-auto rounded-none bg-transparent p-0 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
          {sorted.map((tab) => {
            const Icon = TAB_ICONS[tab.value];
            return (
              <TabsTrigger
                key={tab.value}
                value={tab.value}
                className="group relative -mb-px shrink-0 gap-2 rounded-none border-b-2 border-transparent bg-transparent px-3 pb-2.5 pt-2 text-[13px] font-medium text-muted-foreground shadow-none transition-colors hover:text-foreground focus-visible:ring-offset-0 data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:text-foreground data-[state=active]:shadow-none"
              >
                <Icon className="h-4 w-4 opacity-70 group-data-[state=active]:opacity-100" aria-hidden />
                <span>{tab.label}</span>
                {typeof tab.count === 'number' && (
                  <span className="min-w-[1.25rem] rounded-full bg-muted px-1.5 py-0.5 text-center text-[11px] font-semibold tabular-nums leading-none text-muted-foreground transition-colors group-data-[state=active]:bg-primary group-data-[state=active]:text-primary-foreground">
                    {tab.count}
                  </span>
                )}
              </TabsTrigger>
            );
          })}
        </TabsList>
      </div>
      {sorted.map((tab) => (
        <TabsContent
          key={tab.value}
          value={tab.value}
          className={cn('mt-0', tab.value === 'overview' ? undefined : FLAT_TAB_SECTION_CLASS)}
        >
          {tab.content}
        </TabsContent>
      ))}
    </Tabs>
  );
}

export interface StatusSummaryAction {
  label: string;
  onClick?: () => void;
  disabled?: boolean;
  variant?: 'default' | 'outline' | 'secondary' | 'destructive';
  element?: React.ReactNode;
}

export function DetailStatusSummary({
  currentStatus,
  statusVariant = 'outline',
  meaning,
  pendingContext = [],
  actions,
  details,
  badgeLabel,
  title = 'Status summary',
  isTerminal = null,
  authorityNote,
}: {
  currentStatus: string;
  statusVariant?: 'default' | 'secondary' | 'destructive' | 'outline';
  meaning?: string;
  pendingContext?: (string | React.ReactNode)[];
  actions?: React.ReactNode;
  details?: React.ReactNode;
  badgeLabel?: string;
  title?: string;
  isTerminal?: boolean | null;
  authorityNote?: React.ReactNode;
}) {
  const humanize = (v: string) => v.replaceAll('_', ' ').toLowerCase().replace(/\b\w/g, (l) => l.toUpperCase());

  return (
    <Card className="border-2">
      <CardHeader className="pb-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <CardTitle className="text-base">{title}</CardTitle>
            <CardDescription className="mt-1">
              Current status and what it means — pending context and only existing supported actions.
            </CardDescription>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant={statusVariant}>{badgeLabel ?? humanize(currentStatus)}</Badge>
            {isTerminal !== null && (
              <Badge variant={isTerminal ? 'secondary' : 'outline'}>{isTerminal ? 'Terminal' : 'Active flow'}</Badge>
            )}
          </div>
        </div>
        {authorityNote && <p className="mt-2 text-xs text-muted-foreground">{authorityNote}</p>}
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <p className="text-xs capitalize tracking-wide text-muted-foreground">Current status</p>
            <p className="mt-1 text-sm font-medium">{humanize(currentStatus)}</p>
            {meaning && <p className="mt-1 text-sm text-muted-foreground">{meaning}</p>}
          </div>
          <div>
            <p className="text-xs capitalize tracking-wide text-muted-foreground">Meaning</p>
            <p className="mt-1 text-sm text-muted-foreground">{meaning || 'No additional meaning documented for this status.'}</p>
          </div>
        </div>
        {details && <div className="rounded-lg border bg-muted/30 p-3 text-sm">{details}</div>}
        {pendingContext.length > 0 && (
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-3">
            <p className="text-xs font-medium capitalize tracking-wide text-amber-900">Pending context</p>
            <ul className="mt-1.5 list-disc pl-5 text-sm text-amber-900">
              {pendingContext.map((item, idx) => (
                <li key={idx}>{item}</li>
              ))}
            </ul>
          </div>
        )}
        {pendingContext.length === 0 && (
          <p className="text-sm text-muted-foreground">No blocking pending items for this status.</p>
        )}
        {actions && <div className="flex flex-wrap gap-2 pt-1">{actions}</div>}
      </CardContent>
    </Card>
  );
}

export const INSTITUTION_STATUS_MEANING: Record<string, string> = {
  NOT_STARTED: 'Not started — application ready to begin; next is credentials or documents submission.',
  CREDENTIALS_SUBMITTED: 'Credentials submitted — awaiting review.',
  DOCUMENTS_SUBMITTED: 'Documents submitted — awaiting review.',
  UNDER_REVIEW: 'Under review — decision pending; may schedule technical visit, raise NC, approve or reject.',
  TECHNICAL_VISIT_SCHEDULED: 'Technical visit scheduled — site verification pending before decision.',
  NC_RAISED: 'NC raised — non-conformity must be closed (NC_CLOSURE_SUBMITTED) before approval.',
  NC_CLOSURE_SUBMITTED: 'NC closure submitted — under re-review for approval.',
  APPROVED: 'Approved — active empanelment; monitor renewal lead days.',
  RENEWAL_DUE: 'Renewal due — action required before expiry.',
  EXPIRED: 'Expired — renewal or restart required.',
  REJECTED: 'Rejected — may restart at NOT_STARTED.',
  SUSPENDED: 'Suspended — inactive until reactivated.',
};

export const PROJECT_STATUS_MEANING: Record<string, string> = {
  NOT_STARTED: 'Not started — ready to submit credentials or forward to consultant.',
  CREDENTIALS_SUBMITTED_TO_CONTRACTOR: 'Credentials submitted to contractor — awaiting forward or review.',
  FORWARDED_TO_CONSULTANT: 'Forwarded to consultant — awaiting review.',
  UNDER_REVIEW: 'Under review — decision pending; may schedule technical visit, raise NC, approve or reject.',
  TECHNICAL_VISIT_SCHEDULED: 'Technical visit scheduled — site verification pending.',
  NC_RAISED: 'NC raised — must close via NC_CLOSURE_SUBMITTED before approval.',
  NC_CLOSURE_SUBMITTED: 'NC closure submitted — under re-review.',
  SOURCE_APPROVED: 'Source approved — eligible for project completion.',
  PROJECT_COMPLETED: 'Project completed — terminal state.',
  REJECTED: 'Rejected — may restart at NOT_STARTED.',
};

export const RETAIL_STATUS_MEANING: Record<string, string> = {
  PROSPECT: 'Prospect — initial engagement, not yet active.',
  ACTIVE: 'Active — ongoing customer with regular business.',
  DORMANT: 'Dormant — no recent activity.',
  LOST: 'Lost — inactive, no expected business.',
};
