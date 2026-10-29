"use client";

import { useEffect, useRef, useState } from 'react';
import { History, Loader2 } from 'lucide-react';
import { useAuth } from '@/components/auth-provider';
import { adminRemovalsApi, hasAdminRemovalRole, REMOVAL_TYPES, type RemovalEvent, type RemovalType } from '@/lib/admin-removals-api';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

const labels: Record<RemovalType, string> = { VISIT: 'Visit', PRICING: 'Price entry', NOTE: 'Note', PROJECT_SALE: 'Project sale', FILE: 'Attachment', RETAIL_BRAND_USAGE: 'Retail brand', MEETING_ATTENDEE: 'Meeting attendee', MEETING_EXPENSE: 'Meeting expense', MEETING_GIFT: 'Meeting gift' };
type Reference = { type: RemovalType; id: number; name: string };

export function AdminRemovalHistory({ recordType, recordId }: { recordType?: RemovalType; recordId?: number }) {
  const { token, userRole, currentUser, userData } = useAuth();
  const [open, setOpen] = useState(false);
  const [type, setType] = useState<RemovalType>(recordType ?? 'VISIT');
  const [id, setId] = useState(String(recordId ?? ''));
  const [recent, setRecent] = useState<Reference[]>([]);
  const [events, setEvents] = useState<RemovalEvent[] | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const request = useRef<AbortController | null>(null);
  const allowed = hasAdminRemovalRole(userRole, currentUser);
  const key = `admin-removal-references:${userData?.employeeId ?? 'unknown'}`;

  useEffect(() => {
    if (!allowed || recordId != null) return;
    try { setRecent(JSON.parse(sessionStorage.getItem(key) || '[]')); } catch { setRecent([]); }
    const remember = (event: Event) => {
      const value = (event as CustomEvent<Reference>).detail;
      setRecent(previous => {
        const next = [value, ...previous.filter(item => item.type !== value.type || item.id !== value.id)].slice(0, 30);
        try { sessionStorage.setItem(key, JSON.stringify(next)); } catch { /* History remains available by record ID. */ }
        return next;
      });
    };
    window.addEventListener('admin-record-removed', remember);
    return () => window.removeEventListener('admin-record-removed', remember);
  }, [allowed, key, recordId]);
  useEffect(() => () => request.current?.abort(), []);

  if (!allowed) return null;
  const lookup = async (nextType = type, nextId = id) => {
    request.current?.abort();
    const controller = new AbortController(); request.current = controller;
    const numericId = Number(nextId);
    setEvents(null); setError('');
    if (!token || !Number.isSafeInteger(numericId) || numericId < 1) { setError('Enter a valid record ID.'); setLoading(false); return; }
    setLoading(true);
    try { const result = await adminRemovalsApi.history(token, nextType, numericId, controller.signal); if (!controller.signal.aborted) setEvents(result); }
    catch (cause) { if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : 'Unable to load history.'); }
    finally { if (!controller.signal.aborted) setLoading(false); }
  };

  return <>
    <Button variant="outline" size="sm" className="h-8 gap-1.5 text-xs" onClick={() => { setOpen(true); setError(''); setEvents(null); if (recordType && recordId) { setType(recordType); setId(String(recordId)); void lookup(recordType, String(recordId)); } }}><History className="h-3.5 w-3.5" />Removal history</Button>
    <Dialog open={open} onOpenChange={value => { setOpen(value); if (!value) { request.current?.abort(); setLoading(false); } }}>
      <DialogContent className="max-h-[85dvh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader><DialogTitle>Removal history</DialogTitle><DialogDescription>Check who removed a record, when, and why. Recently removed records from this browser are listed below.</DialogDescription></DialogHeader>
        <form className="flex flex-wrap items-end gap-2" onSubmit={event => { event.preventDefault(); void lookup(); }}>
          <div className="min-w-40 flex-1 space-y-1"><Label>Record type</Label><Select value={type} onValueChange={value => { request.current?.abort(); setLoading(false); setType(value as RemovalType); setEvents(null); }}><SelectTrigger aria-label="Record type"><SelectValue /></SelectTrigger><SelectContent>{REMOVAL_TYPES.map(value => <SelectItem key={value} value={value}>{labels[value]}</SelectItem>)}</SelectContent></Select></div>
          <div className="w-28 space-y-1"><Label htmlFor="removal-record-id">Record ID</Label><Input id="removal-record-id" type="number" min="1" step="1" value={id} onChange={event => { request.current?.abort(); setLoading(false); setId(event.target.value); setEvents(null); }} /></div>
          <Button type="submit" disabled={loading}>{loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Check history</Button>
        </form>
        {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
        {events && (events.length ? <ol className="space-y-3">{events.map(event => <li key={event.id} className="rounded-lg border p-3 text-sm"><p className="font-medium">{labels[event.recordType]} #{event.recordId}</p><p className="mt-1 whitespace-pre-wrap break-words">{event.reason}</p><p className="mt-2 text-xs text-muted-foreground">Employee #{event.removedByEmployeeId} · {new Date(/Z$|[+-]\d\d:\d\d$/.test(event.removedAt) ? event.removedAt : `${event.removedAt}Z`).toLocaleString('en-IN')}</p></li>)}</ol> : <p className="text-sm text-muted-foreground">No removal history for this record.</p>)}
        {!recordId && recent.length > 0 && <div className="space-y-2"><h3 className="text-sm font-medium">Recently removed in this browser</h3>{recent.map(item => <button type="button" key={`${item.type}-${item.id}`} className="block w-full rounded-md border p-2 text-left text-sm hover:bg-muted" onClick={() => { setType(item.type); setId(String(item.id)); void lookup(item.type, String(item.id)); }}>{item.name}<span className="block text-xs text-muted-foreground">{labels[item.type]} #{item.id}</span></button>)}</div>}
      </DialogContent>
    </Dialog>
  </>;
}
