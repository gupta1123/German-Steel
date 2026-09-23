'use client';

import * as React from 'react';
import { AlertCircle, ArrowLeft, ArrowRight, CalendarDays, CheckCircle2, ChevronRight, Circle, CircleDot, Edit3, Inbox, Loader2, Paperclip, Trash2, Upload, User, XCircle, type LucideIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

// Shared building blocks for the Retail / Institution / Project detail pages so
// every detail screen uses the same hero, panels, tones and list density.

export type Tone = 'neutral' | 'info' | 'success' | 'warning' | 'danger';

export const TONE_CLASSES: Record<Tone, string> = {
  neutral: 'bg-muted text-muted-foreground',
  info: 'bg-sky-50 text-sky-700 dark:bg-sky-500/15 dark:text-sky-300',
  success: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300',
  warning: 'bg-amber-50 text-amber-800 dark:bg-amber-500/15 dark:text-amber-300',
  danger: 'bg-red-50 text-red-700 dark:bg-red-500/15 dark:text-red-300',
};

export const PRIORITY_TONE: Record<string, Tone> = { LOW: 'neutral', MEDIUM: 'info', HIGH: 'warning', URGENT: 'danger' };

export const VISIT_PURPOSES = [
  { value: 'ROUTINE_VISIT', label: 'Routine Visit' },
  { value: 'TECHNICAL_DISCUSSION', label: 'Technical Discussion' },
  { value: 'NC_FOLLOW_UP', label: 'NC Follow-up' },
  { value: 'RELATIONSHIP_MEETING', label: 'Relationship Meeting' },
  { value: 'ORDER_FOLLOW_UP', label: 'Order Follow-up' },
  { value: 'PAYMENT_FOLLOW_UP', label: 'Payment Follow-up' },
  { value: 'OTHER', label: 'Other' },
] as const;

const titleCase = (value: string | null | undefined) => value ? value.replaceAll('_', ' ').toLowerCase().replace(/\b\w/g, (letter) => letter.toUpperCase()) : '—';

export const today = () => new Date().toISOString().slice(0, 10);
export const dayKey = (value: string | null | undefined) => (value || '').slice(0, 10);
export const shortTime = (value: string | null | undefined) => (value || '').slice(0, 5);
export const formatDay = (value: string | null | undefined) => {
  if (!value) return '—';
  const date = new Date(value.length === 10 ? `${value}T00:00:00` : value);
  return Number.isNaN(date.getTime()) ? '—' : date.toLocaleDateString('en-IN', { dateStyle: 'medium' });
};
/** "919876543210" → "+91 98765 43210"; 10-digit numbers get +91; anything else is shown with a leading +. */
export const formatPhone = (raw?: string | number | null): string | null => {
  const digits = String(raw ?? '').replace(/\D/g, '');
  if (!digits) return null;
  if (digits.length === 12 && digits.startsWith('91')) return `+91 ${digits.slice(2, 7)} ${digits.slice(7)}`;
  if (digits.length === 10) return `+91 ${digits.slice(0, 5)} ${digits.slice(5)}`;
  return `+${digits}`;
};
export const initials = (name: string) => name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join('').toUpperCase() || '?';
export const dateParts = (value: string | null | undefined) => {
  if (!value) return null;
  const date = new Date(value.length === 10 ? `${value}T00:00:00` : value);
  if (Number.isNaN(date.getTime())) return null;
  return { day: date.toLocaleDateString('en-IN', { day: '2-digit' }), month: date.toLocaleDateString('en-IN', { month: 'short' }), weekday: date.toLocaleDateString('en-IN', { weekday: 'short' }) };
};
export const purposeLabel = (purpose: string | null | undefined) => VISIT_PURPOSES.find((option) => option.value === purpose)?.label ?? (purpose || 'No purpose');
export const isOpenTask = (task: { status: string }) => task.status === 'OPEN' || task.status === 'IN_PROGRESS';
export const isOverdue = (task: { status: string; dueDate?: string | null }) => isOpenTask(task) && Boolean(task.dueDate) && dayKey(task.dueDate) < today();
export const visitStatus = (visit: { outcome?: string | null; actualCheckinAt?: string | null; actualCheckoutAt?: string | null }): { label: string; tone: Tone } => {
  if (visit.outcome) return { label: titleCase(visit.outcome), tone: 'success' };
  if (visit.actualCheckoutAt) return { label: 'Completed', tone: 'success' };
  if (visit.actualCheckinAt) return { label: 'Checked in', tone: 'info' };
  return { label: 'Planned', tone: 'neutral' };
};

export function Pill({ tone = 'neutral', className, children }: { tone?: Tone; className?: string; children: React.ReactNode }) {
  return <span className={cn('inline-flex shrink-0 items-center gap-1 whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-medium leading-4', TONE_CLASSES[tone], className)}>{children}</span>;
}

export function Initials({ name, className }: { name: string; className?: string }) {
  return <span className={cn('flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary', className)} aria-hidden>{initials(name)}</span>;
}

/** Bordered panel. With a title it renders a compact header; without one, `description` + `action` form a slim toolbar. */
export function Section({ icon: Icon, title, description, action, bodyClassName, className, children }: { icon?: LucideIcon; title?: string; description?: React.ReactNode; action?: React.ReactNode; bodyClassName?: string; className?: string; children: React.ReactNode }) {
  return (
    <section className={cn('flex min-w-0 flex-col overflow-hidden rounded-xl border bg-card', className)}>
      {(title || description || action) && (
        <header className={cn('flex min-h-11 flex-wrap items-center justify-between gap-x-3 gap-y-2 border-b px-4', title ? 'border-border/60 py-2' : 'bg-muted/30 py-2')}>
          <div className="flex min-w-0 items-center gap-2">
            {Icon && title && <Icon className="h-4 w-4 shrink-0 text-muted-foreground" />}
            <div className="min-w-0">
              {title && <h3 className="truncate text-sm font-semibold leading-tight">{title}</h3>}
              {description && <p className={cn('truncate text-xs text-muted-foreground', title && 'mt-0.5')}>{description}</p>}
            </div>
          </div>
          {action && <div className="flex shrink-0 items-center gap-2">{action}</div>}
        </header>
      )}
      <div className={cn('flex-1', bodyClassName ?? 'p-4')}>{children}</div>
    </section>
  );
}

export function EmptyState({ icon: Icon = Inbox, title, text, action, compact }: { icon?: LucideIcon; title: string; text?: string; action?: React.ReactNode; compact?: boolean }) {
  if (compact) return <p className="px-4 py-4 text-center text-xs text-muted-foreground">{title}</p>;
  return (
    <div className="flex flex-col items-center justify-center gap-1.5 px-4 py-10 text-center">
      <span className="mb-1 flex h-10 w-10 items-center justify-center rounded-full bg-muted text-muted-foreground"><Icon className="h-5 w-5" /></span>
      <p className="text-sm font-medium">{title}</p>
      {text && <p className="max-w-xs text-xs text-muted-foreground">{text}</p>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}

export function Info({ label, value, className }: { label: string; value: React.ReactNode; className?: string }) {
  return <div className={cn('min-w-0', className)}><dt className="text-xs text-muted-foreground">{label}</dt><dd className="mt-1 break-words text-sm font-medium leading-5">{value || '—'}</dd></div>;
}

export function KpiCell({ icon: Icon, label, value, hint, action, tone }: { icon: LucideIcon; label: string; value: React.ReactNode; hint?: React.ReactNode; action?: React.ReactNode; tone?: 'danger' | 'warning' }) {
  return (
    <div className="min-w-0 bg-card px-4 py-2.5">
      <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground"><Icon className="h-3.5 w-3.5 shrink-0" /><span className="truncate">{label}</span>{action && <span className="ml-auto shrink-0">{action}</span>}</div>
      <div className="mt-0.5 flex min-w-0 flex-wrap items-baseline gap-x-2">
        <span className={cn('max-w-full truncate whitespace-nowrap text-base font-semibold tabular-nums leading-6', tone === 'danger' && 'text-red-600 dark:text-red-400', tone === 'warning' && 'text-amber-700 dark:text-amber-400')}>{value}</span>
        {hint && <span className="min-w-0 max-w-full truncate text-[11px] text-muted-foreground" title={typeof hint === 'string' ? hint : undefined}>{hint}</span>}
      </div>
    </div>
  );
}

export interface ActivityItem { key: string; date: string; icon: LucideIcon; title: string; meta: string; alert?: boolean; onClick?: () => void }

export function ActivityList({ items, empty }: { items: ActivityItem[]; empty: string }) {
  if (items.length === 0) return <EmptyState compact title={empty} />;
  return (
    <ul className="divide-y">
      {items.map((item) => {
        const Icon = item.icon;
        const body = (
          <>
            <Icon className="h-4 w-4 shrink-0 text-muted-foreground" />
            <span className="min-w-0 flex-1 leading-tight">
              <span className="block truncate text-sm font-medium">{item.title}</span>
              <span className="block truncate text-[11px] text-muted-foreground" title={item.meta}>{item.meta}</span>
            </span>
            <span className={cn('shrink-0 text-[11px] tabular-nums', item.alert ? 'font-medium text-red-600 dark:text-red-400' : 'text-muted-foreground')}>{item.alert ? 'Overdue · ' : ''}{formatDay(dayKey(item.date))}</span>
          </>
        );
        return (
          <li key={item.key}>
            {item.onClick
              ? <button type="button" onClick={item.onClick} className="flex w-full items-center gap-3 px-4 py-2.5 text-left transition-colors hover:bg-muted/40 focus-visible:bg-muted/40 focus-visible:outline-none">{body}</button>
              : <div className="flex items-center gap-3 px-4 py-2.5">{body}</div>}
          </li>
        );
      })}
    </ul>
  );
}

/** Relative label for an upcoming date: "Today", "Tomorrow", "In 3 days", "2d overdue". */
export const relativeDue = (value: string | null | undefined): { label: string; overdue: boolean; soon: boolean } => {
  const key = dayKey(value);
  if (!key) return { label: '—', overdue: false, soon: false };
  const diff = Math.round((new Date(`${key}T00:00:00`).getTime() - new Date(`${today()}T00:00:00`).getTime()) / 86400000);
  if (diff < 0) return { label: `${-diff}d overdue`, overdue: true, soon: false };
  if (diff === 0) return { label: 'Today', overdue: false, soon: true };
  if (diff === 1) return { label: 'Tomorrow', overdue: false, soon: true };
  if (diff < 7) return { label: `In ${diff} days`, overdue: false, soon: false };
  return { label: formatDay(key), overdue: false, soon: false };
};

function TimelineRow({ item, upcoming }: { item: ActivityItem; upcoming?: boolean }) {
  const Icon = item.icon;
  const due = upcoming ? relativeDue(item.date) : null;
  const body = (
    <>
      <Icon className={cn('h-4 w-4 shrink-0', due?.overdue ? 'text-red-500' : 'text-muted-foreground')} />
      <span className="min-w-0 flex-1 leading-tight">
        <span className="block truncate text-sm font-medium">{item.title}</span>
        <span className="block truncate text-[11px] text-muted-foreground" title={item.meta}>{item.meta}</span>
      </span>
      {due
        ? <span className={cn('shrink-0 text-[11px] font-medium tabular-nums', due.overdue ? 'text-red-600 dark:text-red-400' : due.soon ? 'text-amber-700 dark:text-amber-400' : 'text-muted-foreground')}>{due.label}</span>
        : <span className="shrink-0 text-[11px] tabular-nums text-muted-foreground">{formatDay(dayKey(item.date))}</span>}
    </>
  );
  return (
    <li>
      {item.onClick
        ? <button type="button" onClick={item.onClick} className="flex w-full items-center gap-3 px-4 py-2 text-left transition-colors hover:bg-muted/40 focus-visible:bg-muted/40 focus-visible:outline-none">{body}</button>
        : <div className="flex items-center gap-3 px-4 py-2">{body}</div>}
    </li>
  );
}

/**
 * Single activity timeline: "Upcoming" (overdue first, relative due dates) pinned above "Recent".
 * Replaces a separate Up next widget so the page has one place to look for what happened and what's due.
 */
export function ActivityTimeline({ upcoming, recent, upcomingLimit = 3, viewAllHref, emptyRecent = 'No activity recorded yet.' }: { upcoming: ActivityItem[]; recent: ActivityItem[]; upcomingLimit?: number; viewAllHref?: string; emptyRecent?: string }) {
  const overdueCount = upcoming.filter((item) => relativeDue(item.date).overdue).length;
  const groupLabel = 'flex items-center justify-between gap-2 bg-muted/30 px-4 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground';
  return (
    <div>
      {upcoming.length > 0 && (
        <>
          <div className={groupLabel}>
            <span>Upcoming · {upcoming.length}{overdueCount > 0 && <span className="ml-1.5 normal-case tracking-normal text-red-600 dark:text-red-400">{overdueCount} overdue</span>}</span>
            {upcoming.length > upcomingLimit && viewAllHref && <a href={viewAllHref} className="normal-case tracking-normal text-foreground hover:underline">View all</a>}
          </div>
          <ul className="divide-y border-b">{upcoming.slice(0, upcomingLimit).map((item) => <TimelineRow key={item.key} item={item} upcoming />)}</ul>
        </>
      )}
      <div className={groupLabel}><span>Recent</span></div>
      {recent.length === 0 ? <EmptyState compact title={emptyRecent} /> : <ul className="divide-y">{recent.map((item) => <TimelineRow key={item.key} item={item} />)}</ul>}
    </div>
  );
}

export interface FeedNote { id: number; text: string; author: string; date: string; edited?: boolean }

/** Notes as a responsive grid of soft tiles with a slim inline composer; long notes clamp to five lines. */
export function NotesFeed({ notes, onAdd, onEdit, placeholder = 'Write a note…' }: { notes: FeedNote[]; onAdd: (text: string) => Promise<boolean>; onEdit?: (id: number) => void; placeholder?: string }) {
  const [draft, setDraft] = React.useState('');
  const [focused, setFocused] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [expanded, setExpanded] = React.useState<Set<number>>(new Set());
  const open = focused || draft.length > 0;
  const submit = async () => {
    if (!draft.trim() || saving) return;
    setSaving(true);
    try { if (await onAdd(draft.trim())) { setDraft(''); setFocused(false); } } finally { setSaving(false); }
  };
  const toggle = (id: number) => setExpanded((current) => { const next = new Set(current); if (next.has(id)) next.delete(id); else next.add(id); return next; });
  return (
    <div className="space-y-3">
      <div className={cn('rounded-xl border bg-card px-3.5 py-2 transition-shadow', open && 'ring-2 ring-ring/15')}>
        <textarea
          value={draft}
          rows={open ? 3 : 1}
          onChange={(event) => setDraft(event.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          onKeyDown={(event) => { if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) { event.preventDefault(); void submit(); } }}
          placeholder={placeholder}
          className="block w-full resize-none bg-transparent text-sm leading-6 outline-none placeholder:text-muted-foreground"
          aria-label="New note"
        />
        {draft.trim() && (
          <div className="mt-1.5 flex items-center justify-between gap-2">
            <span className="text-[11px] text-muted-foreground">Ctrl / ⌘ + Enter to save</span>
            <div className="flex gap-2">
              <Button size="sm" variant="ghost" className="h-7 px-2.5 text-xs" onMouseDown={(event) => event.preventDefault()} onClick={() => setDraft('')} disabled={saving}>Discard</Button>
              <Button size="sm" className="h-7 px-2.5 text-xs" onMouseDown={(event) => event.preventDefault()} onClick={() => void submit()} disabled={saving}>{saving && <Loader2 className="mr-1.5 h-3 w-3 animate-spin" />}Add note</Button>
            </div>
          </div>
        )}
      </div>
      {notes.length === 0 ? <p className="px-1 text-xs text-muted-foreground">No notes yet. Notes you add are shared with the whole team.</p> : (
        <div className="grid items-start gap-2.5 sm:grid-cols-2 xl:grid-cols-3">
          {notes.map((note) => {
            const long = note.text.length > 260 || note.text.split('\n').length > 5;
            const isOpen = expanded.has(note.id);
            return (
              <article key={note.id} className="group flex min-w-0 flex-col rounded-lg bg-muted/50 px-3 py-2.5 transition-colors hover:bg-muted/80">
                <p className={cn('whitespace-pre-wrap break-words text-sm leading-relaxed', long && !isOpen && 'line-clamp-5')}>{note.text}</p>
                {long && <button type="button" onClick={() => toggle(note.id)} className="mt-0.5 self-start text-[11px] font-medium text-muted-foreground hover:text-foreground">{isOpen ? 'Show less' : 'Show more'}</button>}
                <footer className="mt-2 flex items-center justify-between gap-2 text-[11px] text-muted-foreground">
                  <span className="min-w-0 truncate" title={`${note.author} · ${formatDay(note.date)}`}><span className="font-medium text-foreground/80">{note.author}</span> · {formatDay(note.date)}{note.edited ? ' · edited' : ''}</span>
                  {onEdit && <button type="button" onClick={() => onEdit(note.id)} className="shrink-0 font-medium hover:text-foreground md:opacity-0 md:focus-visible:opacity-100 md:group-hover:opacity-100">Edit</button>}
                </footer>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}

export interface HeroMeta { icon: LucideIcon; label: React.ReactNode; title?: string; mono?: boolean }
export interface HeroNextStep { text: React.ReactNode; done: boolean; tone?: 'warning' | 'danger'; action?: React.ReactNode }

/** Detail-page header card: identity, meta line, actions, KPI strip and a next-step bar. */
export function DetailHero({ name, onBack, backLabel, badges, meta, description, actions, kpis, nextStep }: { name: string; onBack: () => void; backLabel: string; badges?: React.ReactNode; meta?: HeroMeta[]; description?: React.ReactNode; actions?: React.ReactNode; kpis?: React.ReactNode; nextStep?: HeroNextStep | null }) {
  const stepTone = nextStep?.done ? 'success' : nextStep?.tone ?? 'warning';
  return (
    <section className="overflow-hidden rounded-2xl border bg-card">
      <div className="flex flex-col gap-3 px-4 py-3.5 lg:flex-row lg:items-start lg:justify-between">
        <div className="flex min-w-0 items-start gap-3 sm:gap-4">
          <Button size="icon" variant="ghost" className="-ml-2 h-8 w-8 shrink-0 text-muted-foreground" onClick={onBack} aria-label={backLabel}><ArrowLeft className="h-4 w-4" /></Button>
          <span className="hidden h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary text-sm font-semibold text-primary-foreground sm:flex" aria-hidden>{initials(name)}</span>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="min-w-0 break-words text-xl font-semibold leading-tight tracking-tight">{name}</h1>
              {badges}
            </div>
            {meta && meta.length > 0 && (
              <p className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                {meta.map((item, index) => {
                  const Icon = item.icon;
                  return <span key={index} className={cn('inline-flex items-center gap-1.5', item.mono && 'font-mono tracking-tight')} title={item.title} data-preserve-case={item.mono ? 'true' : undefined}><Icon className="h-3.5 w-3.5 shrink-0" />{item.label}</span>;
                })}
              </p>
            )}
            {description && <p className="mt-1.5 line-clamp-2 max-w-3xl text-xs text-muted-foreground" title={typeof description === 'string' ? description : undefined}>{description}</p>}
          </div>
        </div>
        {actions && <div className="flex shrink-0 items-center gap-2 pl-9 sm:pl-0">{actions}</div>}
      </div>
      {kpis && <div className="grid grid-cols-2 gap-px border-t bg-border lg:grid-cols-4">{kpis}</div>}
      {nextStep && (
        <div className={cn('flex flex-col gap-2 border-t px-4 py-2 sm:flex-row sm:items-center sm:justify-between', stepTone === 'success' ? 'bg-emerald-50/60 dark:bg-emerald-500/5' : stepTone === 'danger' ? 'bg-red-50/60 dark:bg-red-500/5' : 'bg-amber-50/60 dark:bg-amber-500/5')}>
          <div className="flex min-w-0 items-center gap-2.5">
            {nextStep.done
              ? <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
              : <AlertCircle className={cn('h-4 w-4 shrink-0', stepTone === 'danger' ? 'text-red-600 dark:text-red-400' : 'text-amber-600 dark:text-amber-400')} />}
            <p className="min-w-0 text-[13px]"><span className="font-semibold">{nextStep.done ? 'All good' : 'Next step'}</span><span className="text-muted-foreground"> · </span>{nextStep.text}</p>
          </div>
          {nextStep.action && <div className="shrink-0 pl-6 sm:pl-0 [&_button]:h-7">{nextStep.action}</div>}
        </div>
      )}
    </section>
  );
}

export function DetailSkeleton() {
  return (
    <div className="space-y-4">
      <Skeleton className="h-[190px] w-full rounded-2xl" />
      <Skeleton className="h-9 w-full max-w-xl" />
      <div className="grid gap-4 lg:grid-cols-2"><Skeleton className="h-64 rounded-xl" /><Skeleton className="h-64 rounded-xl" /></div>
    </div>
  );
}

export function WarningBanner({ children }: { children: React.ReactNode }) {
  return <div className="flex gap-2 rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200"><AlertCircle className="mt-0.5 h-4 w-4 shrink-0" /><div>{children}</div></div>;
}

/* ---------- Side-panel forms ---------- */

/** Right-hand side panel for create/edit forms: icon header, scrolling grouped body, pinned footer. */
export function FormSheet({ open, onOpenChange, title, description, icon: Icon, wide, children, errors, footerNote, onSubmit, submitLabel, submitting, submitDisabled, submitTitle }: {
  open: boolean; onOpenChange: (open: boolean) => void; title: React.ReactNode; description?: React.ReactNode; icon?: LucideIcon; wide?: boolean;
  children: React.ReactNode; errors?: string[]; footerNote?: React.ReactNode;
  onSubmit?: () => void; submitLabel?: React.ReactNode; submitting?: boolean; submitDisabled?: boolean; submitTitle?: string;
}) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className={cn('detail-page flex w-full flex-col gap-0 p-0', wide ? 'sm:max-w-2xl' : 'sm:max-w-lg')}>
        <SheetHeader className="space-y-0 border-b px-6 py-4 text-left">
          <div className="flex items-start gap-3 pr-8">
            {Icon && <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary"><Icon className="h-4 w-4" /></span>}
            <div className="min-w-0">
              <SheetTitle className="text-base leading-tight">{title}</SheetTitle>
              {description ? <SheetDescription className="mt-1 text-xs">{description}</SheetDescription> : <SheetDescription className="sr-only">{title}</SheetDescription>}
            </div>
          </div>
        </SheetHeader>
        <div className="min-h-0 flex-1 space-y-6 overflow-y-auto px-6 py-5">
          {children}
          {errors && errors.length > 0 && (
            <div role="alert" className="rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-xs text-destructive">
              <p className="font-semibold">Please fix the following</p>
              <ul className="mt-1 list-disc space-y-0.5 pl-4">{errors.map((error) => <li key={error}>{error}</li>)}</ul>
            </div>
          )}
        </div>
        <SheetFooter className="flex-row items-center justify-between gap-3 space-x-0 border-t bg-muted/30 px-6 py-3 sm:justify-between sm:space-x-0">
          <p className="min-w-0 text-[11px] leading-snug text-muted-foreground">{footerNote}</p>
          <div className="flex shrink-0 items-center gap-2">
            {onSubmit ? <>
              <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={submitting}>Cancel</Button>
              <span title={submitTitle}><Button onClick={onSubmit} disabled={submitting || submitDisabled}>{submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}{submitLabel}</Button></span>
            </> : <Button variant="outline" onClick={() => onOpenChange(false)}>Done</Button>}
          </div>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

/** Titled group of fields inside a FormSheet. */
export function FormGroup({ title, description, columns = 2, children }: { title?: string; description?: React.ReactNode; columns?: 1 | 2; children: React.ReactNode }) {
  return (
    <section className="space-y-3">
      {title && (
        <div>
          <h4 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{title}</h4>
          {description && <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>}
        </div>
      )}
      <div className={cn('grid gap-x-4 gap-y-3.5', columns === 2 && 'sm:grid-cols-2')}>{children}</div>
    </section>
  );
}

export function FormField({ label, required, hint, className, children }: { label: string; required?: boolean; hint?: React.ReactNode; className?: string; children: React.ReactNode }) {
  return (
    <div className={cn('min-w-0 space-y-1.5', className)}>
      <Label className="text-xs font-medium">{label}{required && <span className="ml-0.5 text-destructive">*</span>}</Label>
      {children}
      {hint && <p className="text-[11px] leading-snug text-muted-foreground">{hint}</p>}
    </div>
  );
}

/** Checkbox rendered as a selectable row with a label and helper text. */
export function FormCheck({ checked, onCheckedChange, label, description, className }: { checked: boolean; onCheckedChange: (checked: boolean) => void; label: string; description?: string; className?: string }) {
  return (
    <label className={cn('flex cursor-pointer items-start gap-3 rounded-lg border px-3 py-2.5 transition-colors hover:bg-muted/40 has-[[data-state=checked]]:border-primary/40 has-[[data-state=checked]]:bg-primary/[0.03]', className)}>
      <Checkbox checked={checked} onCheckedChange={(value) => onCheckedChange(value === true)} className="mt-0.5" />
      <span className="min-w-0">
        <span className="block text-sm font-medium leading-tight">{label}</span>
        {description && <span className="mt-0.5 block text-xs text-muted-foreground">{description}</span>}
      </span>
    </label>
  );
}

/** File picker styled as a dashed drop row showing the chosen file. */
export function FilePicker({ file, onChange, accept, hint }: { file?: File | null; onChange: (file: File | null) => void; accept?: string; hint?: string }) {
  const id = React.useId();
  const [picked, setPicked] = React.useState<File | null>(null);
  const shown = file !== undefined ? file : picked;
  return (
    <label htmlFor={id} className={cn('flex cursor-pointer items-center gap-3 rounded-lg border border-dashed px-3 py-2.5 transition-colors hover:bg-muted/40', shown && 'border-solid border-primary/40 bg-primary/[0.03]')}>
      <Upload className="h-4 w-4 shrink-0 text-muted-foreground" />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-medium">{shown ? shown.name : 'Choose a file'}</span>
        <span className="block text-[11px] text-muted-foreground">{shown ? `${Math.max(1, Math.round(shown.size / 1024)).toLocaleString('en-IN')} KB · click to replace` : hint ?? 'PDF, image or office document'}</span>
      </span>
      <input id={id} type="file" accept={accept} className="sr-only" onChange={(event) => { const next = event.target.files?.[0] ?? null; setPicked(next); onChange(next); }} />
    </label>
  );
}

/** Read-only context block at the top of a form (e.g. the NC being closed). */
export function FormContext({ children }: { children: React.ReactNode }) {
  return <div className="rounded-lg bg-muted/50 px-3.5 py-3 text-xs">{children}</div>;
}

/* ---------- Shared tab content ---------- */

export interface VisitLike {
  id: number; scheduledVisitDate: string; scheduledStartTime?: string | null; scheduledEndTime?: string | null; purpose?: string | null;
  description?: string | null; discussionSummary?: string | null; nextActionText?: string | null; nextActionDate?: string | null;
  outcome?: string | null; actualCheckinAt?: string | null; actualCheckoutAt?: string | null;
}

const VISIT_GRID = 'md:grid-cols-[92px_minmax(0,1fr)_104px_minmax(0,160px)_112px_16px]';

/** Newest-first visit table: date · purpose · time · assignee · status. */
export function VisitList<T extends VisitLike>({ visits, assignee, onOpen }: { visits: T[]; assignee: (visit: T) => string; onOpen: (visit: T) => void }) {
  const sorted = [...visits].sort((left, right) => `${right.scheduledVisitDate}${right.scheduledStartTime ?? ''}`.localeCompare(`${left.scheduledVisitDate}${left.scheduledStartTime ?? ''}`));
  return (
    <div>
      <div className={cn('hidden gap-x-4 border-b bg-muted/40 px-4 py-2 text-[11px] font-medium text-muted-foreground md:grid', VISIT_GRID)}>
        <span>Date</span><span>Purpose</span><span>Time</span><span>Assigned to</span><span>Status</span><span />
      </div>
      <ul className="divide-y">
        {sorted.map((visit) => {
          const parts = dateParts(visit.scheduledVisitDate);
          const state = visitStatus(visit);
          const time = [shortTime(visit.scheduledStartTime), shortTime(visit.scheduledEndTime)].filter(Boolean).join('–');
          const who = assignee(visit);
          const detail = visit.nextActionText ? `Next: ${visit.nextActionText}${visit.nextActionDate ? ` · ${formatDay(visit.nextActionDate)}` : ''}` : visit.discussionSummary || visit.description;
          return (
            <li key={visit.id}>
              <button type="button" onClick={() => onOpen(visit)} className={cn('group grid w-full grid-cols-[72px_minmax(0,1fr)_auto] items-center gap-x-3 px-4 py-2 text-left transition-colors hover:bg-muted/40 focus-visible:bg-muted/40 focus-visible:outline-none md:gap-x-4', VISIT_GRID)}>
                <div className="leading-tight">
                  <p className="text-sm font-medium tabular-nums">{parts ? `${parts.day} ${parts.month}` : '—'}</p>
                  <p className="text-[11px] text-muted-foreground">{parts?.weekday}<span className="md:hidden">{time ? ` · ${shortTime(visit.scheduledStartTime)}` : ''}</span></p>
                </div>
                <div className="min-w-0 leading-tight">
                  <p className="truncate text-sm font-medium">{purposeLabel(visit.purpose)}</p>
                  <p className="truncate text-[11px] text-muted-foreground" title={detail || undefined}><span className="md:hidden">{who}{detail ? ' · ' : ''}</span>{detail}</p>
                </div>
                <span className="hidden text-xs tabular-nums text-muted-foreground md:block">{time || '—'}</span>
                <span className="hidden truncate text-xs md:block" title={who}>{who}</span>
                <span><Pill tone={state.tone}>{state.label}</Pill></span>
                <ChevronRight className="hidden h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-0.5 md:block" />
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

export interface TaskLike { id: number; title: string; description?: string | null; status: string; priority: string; dueDate: string }

/** Tasks grouped into Open and Completed/Cancelled with status icon, priority and due date. */
export function TaskList<T extends TaskLike>({ tasks, assignee, onEdit, onDelete, busy }: { tasks: T[]; assignee: (task: T) => string; onEdit: (task: T) => void; onDelete: (task: T) => void; busy?: boolean }) {
  const open = tasks.filter(isOpenTask).sort((left, right) => String(left.dueDate).localeCompare(String(right.dueDate)));
  const closed = tasks.filter((task) => !isOpenTask(task)).sort((left, right) => String(right.dueDate).localeCompare(String(left.dueDate)));
  return (
    <>
      {[{ key: 'open', title: 'Open', items: open }, { key: 'closed', title: 'Completed and cancelled', items: closed }].filter((group) => group.items.length > 0).map((group) => (
        <div key={group.key}>
          <p className="border-b bg-muted/20 px-4 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{group.title} · {group.items.length}</p>
          <ul className="divide-y">
            {group.items.map((task) => {
              const overdue = isOverdue(task);
              const StatusIcon = task.status === 'COMPLETED' ? CheckCircle2 : task.status === 'CANCELLED' ? XCircle : task.status === 'IN_PROGRESS' ? CircleDot : Circle;
              return (
                <li key={task.id} className="flex items-start gap-3 px-4 py-2.5">
                  <StatusIcon className={cn('mt-0.5 h-4 w-4 shrink-0', task.status === 'COMPLETED' ? 'text-emerald-600' : task.status === 'IN_PROGRESS' ? 'text-sky-600' : 'text-muted-foreground')} aria-label={titleCase(task.status)} />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className={cn('text-sm font-medium', !isOpenTask(task) && 'text-muted-foreground line-through')}>{task.title || `Task #${task.id}`}</p>
                      <Pill tone={PRIORITY_TONE[task.priority] ?? 'neutral'}>{titleCase(task.priority)}</Pill>
                      {task.status === 'IN_PROGRESS' && <Pill tone="info">In progress</Pill>}
                    </div>
                    {task.description && <p className="mt-1 line-clamp-2 text-xs text-foreground/80">{task.description}</p>}
                    <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                      <span className={cn('inline-flex items-center gap-1', overdue && 'font-medium text-red-600 dark:text-red-400')}><CalendarDays className="h-3 w-3" />{overdue ? 'Overdue · ' : 'Due '}{formatDay(task.dueDate)}</span>
                      <span className="inline-flex items-center gap-1"><User className="h-3 w-3" />{assignee(task)}</span>
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-0.5">
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-foreground" onClick={() => onEdit(task)} aria-label="Edit task" title="Edit task"><Edit3 className="h-3.5 w-3.5" /></Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive" onClick={() => onDelete(task)} disabled={busy} aria-label="Delete task" title="Delete task"><Trash2 className="h-3.5 w-3.5" /></Button>
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </>
  );
}

export const taskSummary = (tasks: TaskLike[]) => {
  const open = tasks.filter(isOpenTask);
  const overdue = open.filter(isOverdue).length;
  return `${open.length} open · ${tasks.length - open.length} closed${overdue ? ` · ${overdue} overdue` : ''}`;
};

export interface SaleLike { id: number; saleDate: string; quantityMt: number; invoiceReference: string; sourceSystem?: string | null }

export const salesSummary = (sales: SaleLike[]): React.ReactNode => {
  if (!sales.length) return 'No purchase orders yet';
  const total = sales.reduce((sum, sale) => sum + (sale.quantityMt || 0), 0);
  const last = [...sales].sort((left, right) => String(right.saleDate).localeCompare(String(left.saleDate)))[0];
  return <><span className="font-medium text-foreground">{total.toLocaleString('en-IN')} MT</span> total · {sales.length} {sales.length === 1 ? 'order' : 'orders'} · avg {(total / sales.length).toLocaleString('en-IN', { maximumFractionDigits: 2 })} MT · last PO {formatDay(last.saleDate)}</>;
};

/** PO table, newest first, quantity right-aligned. */
export function SalesTable({ sales }: { sales: SaleLike[] }) {
  const sorted = [...sales].sort((left, right) => String(right.saleDate).localeCompare(String(left.saleDate)));
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[480px] text-sm">
        <thead className="bg-muted/40 text-xs text-muted-foreground">
          <tr><th className="px-4 py-2 text-left font-medium">PO date</th><th className="px-4 py-2 text-left font-medium">PO number</th><th className="px-4 py-2 text-right font-medium">Quantity</th><th className="px-4 py-2 text-left font-medium">Source</th></tr>
        </thead>
        <tbody className="divide-y">
          {sorted.map((sale) => (
            <tr key={sale.id} className="transition-colors hover:bg-muted/30">
              <td className="whitespace-nowrap px-4 py-2">{formatDay(sale.saleDate)}</td>
              <td className="px-4 py-2 font-medium">{sale.invoiceReference || '—'}</td>
              <td className="whitespace-nowrap px-4 py-2 text-right font-semibold tabular-nums">{sale.quantityMt.toLocaleString('en-IN')} MT</td>
              <td className="px-4 py-2"><Pill>{titleCase(sale.sourceSystem || 'Manual')}</Pill></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** Horizontal stepper for a lifecycle's main path; `index` -1 means the record is off-path (e.g. rejected). */
export function StageStepper({ steps, index, offPath }: { steps: readonly { key: string; label: string }[]; index: number; offPath?: React.ReactNode }) {
  const last = steps.length - 1;
  return (
    <ol className="flex items-center gap-1 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      {steps.map((step, position) => {
        const done = index > position || (index === position && position === last);
        const current = index === position && position !== last;
        return (
          <li key={step.key} className="flex shrink-0 items-center gap-1">
            {position > 0 && <span className={cn('h-px w-4 sm:w-6', index >= position ? 'bg-emerald-500' : 'bg-border')} />}
            <span className={cn('inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-medium', done ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300' : current ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground')}>
              {done ? <CheckCircle2 className="h-3.5 w-3.5" /> : <span className={cn('flex h-3.5 w-3.5 items-center justify-center rounded-full border text-[9px]', current ? 'border-primary-foreground' : 'border-muted-foreground/50')}>{position + 1}</span>}
              {step.label}
            </span>
          </li>
        );
      })}
      {index === -1 && offPath && <li className="ml-2 shrink-0">{offPath}</li>}
    </ol>
  );
}

/** One row of stage history: from → to, remarks, date and who. */
export function StageHistoryRow({ from, to, remarks, date, by, current }: { from?: string | null; to: string; remarks?: string | null; date: string | null | undefined; by: string; current?: boolean }) {
  return (
    <li className="flex items-start gap-3 px-4 py-2.5">
      <span className={cn('mt-1.5 h-2 w-2 shrink-0 rounded-full', current ? 'bg-primary ring-4 ring-primary/15' : 'bg-muted-foreground/40')} />
      <div className="min-w-0 flex-1 leading-tight">
        <div className="flex min-w-0 flex-wrap items-center gap-1.5 text-sm">
          {from && <><span className="text-muted-foreground">{titleCase(from)}</span><ArrowRight className="h-3 w-3 shrink-0 text-muted-foreground" /></>}
          <span className="font-medium">{titleCase(to)}</span>
          {current && <Pill tone="info">Current</Pill>}
        </div>
        {remarks && remarks !== '—' && <p className="mt-0.5 truncate text-[11px] text-muted-foreground" title={remarks}>{remarks}</p>}
      </div>
      <div className="shrink-0 text-right leading-tight">
        <p className="text-[11px] font-medium tabular-nums">{formatDay(date)}</p>
        <p className="mt-0.5 max-w-[120px] truncate text-[11px] text-muted-foreground">{by}</p>
      </div>
    </li>
  );
}

export interface NcLike { id: number; status: string; description: string; raisedDate: string; raisedByOfficialText?: string | null; targetClosureDate?: string | null; responsibleEmployeeName?: string | null; closureMethod?: string | null; closureDate?: string | null }

/** Compact NC row with a status rail, dates, closure summary, evidence and the actions valid for its status. */
export function NcRow({ nc, evidence = [], busy, onSubmitClosure, onAddEvidence, onAccept }: { nc: NcLike; evidence?: { fileName: string }[]; busy?: boolean; onSubmitClosure: () => void; onAddEvidence: () => void; onAccept: () => void }) {
  const overdue = Boolean(nc.targetClosureDate && nc.status !== 'CLOSED' && dayKey(nc.targetClosureDate) < today());
  const extra = nc as NcLike & { acceptingOfficialText?: string; acceptanceDate?: string };
  const closure = (nc.status === 'SUBMITTED' || nc.status === 'CLOSED') ? [nc.closureMethod ? titleCase(nc.closureMethod) : null, extra.acceptingOfficialText, extra.acceptanceDate || nc.closureDate].filter(Boolean).join(' · ') : '';
  return (
    <li className={cn('border-l-2 px-4 py-2.5', nc.status === 'OPEN' ? 'border-l-red-500' : nc.status === 'SUBMITTED' ? 'border-l-amber-500' : 'border-l-emerald-500')}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-[11px] font-semibold text-muted-foreground">NC #{nc.id}</span>
            <Pill tone={nc.status === 'OPEN' ? 'danger' : nc.status === 'SUBMITTED' ? 'warning' : 'success'}>{titleCase(nc.status)}</Pill>
            {overdue && <Pill tone="danger">Overdue</Pill>}
          </div>
          <p className="mt-1 line-clamp-2 text-sm font-medium leading-snug" title={nc.description}>{nc.description}</p>
          <p className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-[11px] text-muted-foreground">
            <span>Raised {formatDay(nc.raisedDate)}{nc.raisedByOfficialText ? ` · ${nc.raisedByOfficialText}` : ''}</span>
            <span className={cn(overdue && 'font-medium text-red-600 dark:text-red-400')}>Target {formatDay(nc.targetClosureDate)}</span>
            <span>{nc.responsibleEmployeeName || 'Not assigned'}</span>
          </p>
          {closure && <p className="mt-1 flex items-center gap-1 text-[11px] text-emerald-700 dark:text-emerald-400"><CheckCircle2 className="h-3 w-3 shrink-0" /><span className="truncate">{closure}</span></p>}
          {evidence.length > 0 && <p className="mt-1 flex items-center gap-1 text-[11px] text-muted-foreground"><Paperclip className="h-3 w-3 shrink-0" /><span className="truncate" title={evidence.map((file) => file.fileName).join(', ')}>{evidence.length} evidence · {evidence.map((file) => file.fileName).join(', ')}</span></p>}
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1">
          {nc.status === 'OPEN' && <>
            <Button variant="outline" size="sm" className="h-7 px-2 text-xs" onClick={onSubmitClosure} disabled={busy}>{busy && <Loader2 className="mr-1 h-3 w-3 animate-spin" />}Submit closure</Button>
            <Button variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={onAddEvidence} disabled={busy}><Paperclip className="mr-1 h-3 w-3" />Evidence</Button>
          </>}
          {nc.status === 'SUBMITTED' && <Button variant="outline" size="sm" className="h-7 px-2 text-xs" onClick={onAccept} disabled={busy}>{busy && <Loader2 className="mr-1 h-3 w-3 animate-spin" />}Accept & close</Button>}
        </div>
      </div>
    </li>
  );
}

/** Opens a native file picker and hands the chosen file to `onFile`. */
export const pickFile = (onFile: (file: File) => void) => {
  const input = document.createElement('input');
  input.type = 'file';
  input.onchange = () => { const file = input.files?.[0]; if (file) onFile(file); };
  input.click();
};

/** Pick-one list of options rendered as selectable rows with a description each. */
export function OptionCards<T extends string>({ value, onChange, options }: { value: T; onChange: (value: T) => void; options: { value: T; label: string; description?: string }[] }) {
  return (
    <div role="radiogroup" className="grid gap-2">
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <button key={option.value} type="button" role="radio" aria-checked={selected} onClick={() => onChange(option.value)} className={cn('flex items-start gap-3 rounded-lg border px-3 py-2.5 text-left transition-colors hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring', selected && 'border-primary/50 bg-primary/[0.03]')}>
            <span className={cn('mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border', selected ? 'border-primary' : 'border-muted-foreground/40')}>{selected && <span className="h-2 w-2 rounded-full bg-primary" />}</span>
            <span className="min-w-0">
              <span className="block text-sm font-medium leading-tight">{option.label}</span>
              {option.description && <span className="mt-0.5 block text-xs text-muted-foreground">{option.description}</span>}
            </span>
          </button>
        );
      })}
    </div>
  );
}
