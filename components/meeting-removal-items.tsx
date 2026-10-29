"use client";

import { useEffect, useState } from 'react';
import { useAuth } from '@/components/auth-provider';
import { AdminRemovalAction } from '@/components/admin-removal-action';
import { AdminRemovalHistory } from '@/components/admin-removal-history';
import { adminRemovalPaths, adminRemovalsApi, hasAdminRemovalRole, type MeetingItemsHistory, type RemovalType } from '@/lib/admin-removals-api';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';

export function MeetingRemovalItems({ meetingId, onChanged, disabled }: { meetingId: number; onChanged: () => void | Promise<unknown>; disabled?: boolean }) {
  const { token, userRole, currentUser } = useAuth();
  const [open, setOpen] = useState(false);
  const [data, setData] = useState<MeetingItemsHistory | null>(null);
  const [version, setVersion] = useState(0);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const allowed = hasAdminRemovalRole(userRole, currentUser);
  useEffect(() => {
    if (!open || !token || !allowed) return;
    const controller = new AbortController(); setLoading(true); setError(''); setData(null);
    adminRemovalsApi.meetingItems(token, meetingId, controller.signal)
      .then(result => { if (!controller.signal.aborted) setData(result); })
      .catch(cause => { if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : 'Unable to load meeting items.'); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [open, token, allowed, meetingId, version]);
  if (!allowed) return null;
  return <>
    <Button variant="outline" size="sm" disabled={disabled} title={disabled ? 'Save or discard your meeting edits first.' : undefined} onClick={() => setOpen(true)}>Manage meeting items</Button>
    <Dialog open={open} onOpenChange={setOpen}><DialogContent className="max-h-[85dvh] overflow-y-auto sm:max-w-3xl"><DialogHeader><DialogTitle>Meeting items and history</DialogTitle><DialogDescription>Remove one attendee, expense, or gift with a reason. Inactive items stay here for history. Remove an attendee’s gifts before removing the attendee.</DialogDescription></DialogHeader>
      {loading ? <p role="status" className="text-sm">Loading meeting items…</p> : error ? <div><p role="alert" className="text-sm text-destructive">{error}</p><Button variant="outline" onClick={() => setVersion(value => value + 1)}>Try again</Button></div> : data && (['attendees', 'expenses', 'gifts'] as const).map(kind => {
        const recordType: RemovalType = kind === 'attendees' ? 'MEETING_ATTENDEE' : kind === 'expenses' ? 'MEETING_EXPENSE' : 'MEETING_GIFT';
        return <section key={kind} className="space-y-2"><h3 className="font-medium capitalize">{kind}</h3>{data[kind].length ? <ul className="divide-y rounded-md border px-3">{data[kind].map(item => {
          const name = item.attendeeName || item.name || item.expenseHead || item.giftItem || `${kind} #${item.id}`;
          const blocked = kind === 'attendees' && data.gifts.some(gift => gift.active !== false && gift.attendeeId === item.id);
          const endpoint = kind === 'attendees' ? adminRemovalPaths.meetingAttendee(meetingId, item.id) : kind === 'expenses' ? adminRemovalPaths.meetingExpense(meetingId, item.id) : adminRemovalPaths.meetingGift(meetingId, item.id);
          return <li key={item.id} className="flex flex-wrap items-center justify-between gap-2 py-3"><div className="min-w-0"><p className="break-words text-sm font-medium">{name}</p><p className="text-xs text-muted-foreground">#{item.id} · {item.active === false ? 'Inactive' : 'Active'}{item.amount != null && ` · ₹${item.amount}`}{item.quantity != null && ` · Quantity ${item.quantity}`}{blocked && ' · Remove assigned gifts first'}</p></div><div className="flex flex-wrap items-center gap-1">{item.active !== false && <AdminRemovalAction endpoint={endpoint} label="Remove item" name={name} disabled={blocked} description={kind === 'attendees' ? 'Remove this attendee. Their assigned gifts must be removed first. The attendee count will be updated.' : `Remove this ${kind === 'expenses' ? 'expense' : 'gift'}. The meeting totals will be updated.`} onRemoved={async () => { setVersion(value => value + 1); await onChanged(); }} />}<AdminRemovalHistory recordType={recordType} recordId={item.id} /></div></li>;
        })}</ul> : <p className="text-sm text-muted-foreground">No {kind}.</p>}</section>;
      })}
    </DialogContent></Dialog>
  </>;
}
