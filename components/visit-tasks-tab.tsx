"use client";

import { AlertCircle, Calendar, ClipboardList, User, ImageIcon } from 'lucide-react';
import { format, isValid, parseISO } from 'date-fns';
import type { Task } from '@/lib/api';
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

  const noun = type === 'requirement' ? 'requirement' : 'complaint';

  return (
    <section className="flex min-w-0 flex-col overflow-hidden rounded-xl border bg-card" aria-label={`${noun}s for this visit`} aria-busy={loading}>
      <header className="flex flex-wrap items-center justify-between gap-2 border-b bg-muted/30 px-4 py-2">
        <p className="text-xs text-muted-foreground">
          {loading ? 'Loading records…' : priority === 'all' ? `${tasks.length} ${tasks.length === 1 ? noun : `${noun}s`} linked to this visit` : `${filtered.length} of ${tasks.length} ${tasks.length === 1 ? noun : `${noun}s`}`}
        </p>
        <Select value={priority} onValueChange={onPriorityChange}>
          <SelectTrigger aria-label="Filter by priority" className="h-7 w-[140px] bg-background text-xs shadow-none">
            <SelectValue placeholder="All priorities" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All priorities</SelectItem>
            <SelectItem value="low">Low</SelectItem>
            <SelectItem value="medium">Medium</SelectItem>
            <SelectItem value="high">High</SelectItem>
          </SelectContent>
        </Select>
      </header>

      {error ? (
        <p role="alert" className="px-4 py-4 text-center text-xs text-destructive">{error}</p>
      ) : loading ? (
        <p className="px-4 py-4 text-center text-xs text-muted-foreground">Loading {noun}s for this visit…</p>
      ) : filtered.length === 0 ? (
        <p className="px-4 py-4 text-center text-xs text-muted-foreground">{tasks.length ? `No ${priority}-priority ${noun}s. Choose another priority.` : `No ${noun} has been linked to this visit yet.`}</p>
      ) : (
        <ul className="divide-y">
          {filtered.map((task) => {
            const due = displayDate(task.dueDate);
            const created = displayDate(task.createdAt);
            const priorityLabel = task.priority ? `${task.priority.charAt(0).toUpperCase()}${task.priority.slice(1)}` : 'No priority';
            const statusLabel = task.status ? task.status.replace(/[_-]/g, ' ').toLowerCase().replace(/^./, (c) => c.toUpperCase()) : 'No status';
            const assignee = task.assignedTo || (task.assignedToId ? `Employee #${task.assignedToId}` : 'Not assigned');
            return (
              <li key={task.id} className="flex items-start gap-3 px-4 py-2.5">
                <Icon className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <p className="text-sm font-medium">{task.title || `${type === 'requirement' ? 'Requirement' : 'Complaint'} #${task.id}`}</p>
                    <span className={`inline-flex items-center rounded-full border px-2 py-0 text-[11px] font-medium leading-5 ${priorityStyles[task.priority] || 'border-border bg-muted text-muted-foreground'}`}>{priorityLabel}</span>
                    <span className={`inline-flex items-center rounded-full border px-2 py-0 text-[11px] font-medium leading-5 ${statusStyle(task.status || '')}`}>{statusLabel}</span>
                  </div>
                  {task.description && <p className="mt-0.5 line-clamp-2 whitespace-pre-wrap break-words text-xs text-foreground/80" title={task.description}>{task.description}</p>}
                  <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[11px] text-muted-foreground">
                    <span className="inline-flex items-center gap-1"><Calendar className="h-3 w-3" />Due {due || 'not set'}</span>
                    <span className="inline-flex items-center gap-1"><User className="h-3 w-3" />{assignee}</span>
                    {task.assignedBy && <span>by {task.assignedBy}</span>}
                    {!!task.imageCount && <span className="inline-flex items-center gap-1"><ImageIcon className="h-3 w-3" />{task.imageCount}</span>}
                    <span>#{task.id}{created ? ` · ${created}` : ''}</span>
                  </p>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
