"use client";

import { AlertCircle, Calendar, ClipboardList, MapPin, Store, User, ImageIcon } from 'lucide-react';
import { format, isValid, parseISO } from 'date-fns';
import type { Task } from '@/lib/api';
import { formatCityLabel } from '@/lib/city-options';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

function displayDate(value?: string) {
  if (!value) return null;
  const date = parseISO(value);
  return isValid(date) ? format(date, 'MMM dd, yyyy') : null;
}

const priorityStyles: Record<string, string> = {
  low: 'border-slate-200 bg-slate-50 text-slate-600 dark:border-slate-700 dark:bg-slate-800/40 dark:text-slate-300',
  medium: 'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-300',
  high: 'border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-300',
};

function statusStyle(status: string) {
  const key = status.toLowerCase().replace(/[_-]/g, ' ');
  if (['completed', 'resolved', 'closed'].includes(key)) return 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-300';
  if (['in progress', 'ongoing'].includes(key)) return 'border-sky-200 bg-sky-50 text-sky-700 dark:border-sky-900 dark:bg-sky-950/30 dark:text-sky-300';
  return 'border-border bg-muted/50 text-muted-foreground';
}

export default function VisitTasksTab({ tasks, type, priority, onPriorityChange, loading, error }: {
  tasks: Task[];
  type: 'requirement' | 'complaint';
  priority: string;
  onPriorityChange: (value: string) => void;
  loading: boolean;
  error: string | null;
}) {
  const filtered = tasks.filter(task => priority === 'all' || task.priority.trim().toLowerCase() === priority);
  const Icon = type === 'requirement' ? ClipboardList : AlertCircle;

  return (
    <section className="min-w-0 space-y-3" aria-label={`${type}s for this visit`} aria-busy={loading}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-muted-foreground">
          {loading ? 'Loading records…' : `${filtered.length} of ${tasks.length} ${tasks.length === 1 ? type : `${type}s`}`}
        </p>
        <Select value={priority} onValueChange={onPriorityChange}>
          <SelectTrigger aria-label="Filter by priority" className="h-8 w-[152px] bg-background text-xs shadow-none">
            <SelectValue placeholder="All priorities" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All priorities</SelectItem>
            <SelectItem value="low">Low</SelectItem>
            <SelectItem value="medium">Medium</SelectItem>
            <SelectItem value="high">High</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {error ? (
        <p role="alert" className="rounded-lg border border-destructive/25 bg-destructive/5 p-4 text-sm text-destructive">{error}</p>
      ) : loading ? (
        <div className="rounded-lg border bg-card p-4 text-xs text-muted-foreground">Loading {type}s for this visit…</div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center rounded-lg border border-dashed px-4 py-8 text-center">
          <Icon className="mb-2 h-5 w-5 text-muted-foreground" />
          <p className="text-sm font-medium">{tasks.length ? `No ${priority}-priority ${type}s` : `No ${type}s recorded`}</p>
          <p className="mt-1 text-xs text-muted-foreground">{tasks.length ? 'Choose another priority to see more records.' : `No ${type} has been linked to this visit yet.`}</p>
        </div>
      ) : filtered.map(task => {
        const due = displayDate(task.dueDate);
        const created = displayDate(task.createdAt);
        const updated = displayDate(task.updatedAt);
        const priorityLabel = task.priority ? `${task.priority.charAt(0).toUpperCase()}${task.priority.slice(1)}` : 'Priority not set';
        const statusLabel = task.status ? task.status.replace(/[_-]/g, ' ').toLowerCase().replace(/^./, c => c.toUpperCase()) : 'Status not set';
        return (
          <article key={task.id} className="overflow-hidden rounded-lg border bg-card">
            <div className="space-y-3 p-4">
              <div className="flex items-start gap-2.5">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground"><Icon className="h-4 w-4" /></div>
                <div className="min-w-0 flex-1">
                  <h3 className="break-words text-sm font-semibold leading-5">{task.title || `${type === 'requirement' ? 'Requirement' : 'Complaint'} #${task.id}`}</h3>
                  <p className="mt-0.5 text-[11px] text-muted-foreground">#{task.id}{created ? ` · Created ${created}` : ''}</p>
                </div>
              </div>

              <p className={`whitespace-pre-wrap break-words text-sm leading-5 ${task.description ? 'text-foreground/85' : 'text-muted-foreground'}`}>
                {task.description || 'No description provided.'}
              </p>

              {(task.storeName || task.storeCity) && (
                <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
                  {task.storeName && <span className="flex min-w-0 items-center gap-1.5"><Store className="h-3.5 w-3.5 shrink-0" /><span className="break-words">{task.storeName}</span></span>}
                  {task.storeCity && <span className="flex items-center gap-1.5"><MapPin className="h-3.5 w-3.5 shrink-0" />{formatCityLabel(task.storeCity)}</span>}
                </div>
              )}

              <div className="flex flex-wrap gap-1.5">
                <Badge variant="outline" className={`px-2 py-0.5 text-[11px] font-medium ${priorityStyles[task.priority] || 'bg-muted text-muted-foreground'}`}>{priorityLabel}{task.priority ? ' priority' : ''}</Badge>
                <Badge variant="outline" className={`px-2 py-0.5 text-[11px] font-medium ${statusStyle(task.status)}`}>{statusLabel}</Badge>
                {!!task.imageCount && <span className="inline-flex items-center gap-1 px-1 text-[11px] text-muted-foreground"><ImageIcon className="h-3 w-3" />{task.imageCount} images</span>}
              </div>
            </div>

            <div className="grid grid-cols-1 gap-3 border-t bg-muted/20 px-4 py-3 sm:grid-cols-2">
              <div className="min-w-0">
                <p className="mb-1 text-[11px] text-muted-foreground">Assigned employee</p>
                <p className="flex items-start gap-1.5 text-xs font-medium"><User className="h-3.5 w-3.5 shrink-0" /><span className="break-words">{task.assignedTo || (task.assignedToId ? `Employee #${task.assignedToId} (name unavailable)` : 'Not assigned')}</span></p>
              </div>
              <div>
                <p className="mb-1 text-[11px] text-muted-foreground">Due date</p>
                <p className="flex items-center gap-1.5 text-xs font-medium"><Calendar className="h-3.5 w-3.5 shrink-0" />{due || 'Not specified'}</p>
              </div>
            </div>
            {(task.assignedBy || (updated && updated !== created)) && <div className="flex flex-wrap justify-between gap-1 px-4 py-2 text-[11px] text-muted-foreground">
              {task.assignedBy && <span>Assigned by {task.assignedBy}</span>}
              {updated && updated !== created && <span>Updated {updated}</span>}
            </div>}
          </article>
        );
      })}
    </section>
  );
}
