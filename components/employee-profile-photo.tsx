"use client";

import { useEffect, useRef, useState } from 'react';
import { Loader2, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/components/auth-provider';
import { employeePhotoApi } from '@/lib/employee-photo-api';
import { EmployeePhotoPicker } from '@/components/employee-photo-picker';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useUnsavedChanges } from '@/components/unsaved-changes-provider';

const cache = new Map<string, { until: number; promise: Promise<Blob | null> }>();
const photoEvent = 'employee-profile-photo-changed';

export function invalidateEmployeePhoto(employeeId: number) {
  for (const key of cache.keys()) if (key.startsWith(`${employeeId}:`)) cache.delete(key);
  window.dispatchEvent(new CustomEvent(photoEvent, { detail: employeeId }));
}

function useEmployeePhoto(employeeId: number) {
  const { token } = useAuth();
  const [version, setVersion] = useState(0);
  const [url, setUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    const listener = (event: Event) => { if ((event as CustomEvent<number>).detail === employeeId) setVersion(value => value + 1); };
    window.addEventListener(photoEvent, listener);
    return () => window.removeEventListener(photoEvent, listener);
  }, [employeeId]);
  useEffect(() => {
    let cancelled = false;
    let objectUrl: string | null = null;
    setUrl(null); setError(null); setLoading(true);
    if (!token) { setLoading(false); return; }
    const key = `${employeeId}:${token}`;
    let entry = cache.get(key);
    if (!entry || entry.until < Date.now()) {
      const promise = employeePhotoApi.get(employeeId, token).catch(cause => { cache.delete(key); throw cause; });
      entry = { promise, until: Date.now() + 30_000 }; cache.set(key, entry);
      if (cache.size > 64) cache.delete(cache.keys().next().value!);
    }
    entry.promise.then(blob => { if (!cancelled) { objectUrl = blob ? URL.createObjectURL(blob) : null; setUrl(objectUrl); } })
      .catch(cause => { if (!cancelled) setError(cause instanceof Error ? cause.message : 'Unable to load the profile picture.'); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; if (objectUrl) URL.revokeObjectURL(objectUrl); };
  }, [employeeId, token, version]);
  return { url, loading, error, refresh: () => invalidateEmployeePhoto(employeeId) };
}

export function EmployeePhotoAvatar({ employeeId, name, initials, className = 'h-9 w-9' }: { employeeId: number; name: string; initials: string; className?: string }) {
  const photo = useEmployeePhoto(employeeId);
  return <Avatar className={`shrink-0 ${className}`} title={photo.error || name}>
    {photo.url && <AvatarImage src={photo.url} alt={`${name}'s profile picture`} className="object-cover" />}
    <AvatarFallback className="bg-muted text-xs font-semibold">{initials}</AvatarFallback>
  </Avatar>;
}

export function EmployeeProfilePhotoEditor({ employeeId, name, disabled, onBusyChange }: {
  employeeId: number; name: string; disabled?: boolean; onBusyChange: (busy: boolean) => void;
}) {
  const { token } = useAuth();
  const photo = useEmployeePhoto(employeeId);
  const [file, setFile] = useState<File | null>(null);
  const [validating, setValidating] = useState(false);
  const [busy, setBusy] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const lock = useRef(false);
  const { markSaved } = useUnsavedChanges(file !== null || validating);
  const pending = busy || validating;
  useEffect(() => { onBusyChange(pending); return () => onBusyChange(false); }, [pending, onBusyChange]);
  const save = async () => {
    if (!token || !file || lock.current || disabled || photo.loading || photo.error || validating) return;
    lock.current = true; setBusy(true); setError(null);
    try {
      await employeePhotoApi.save(employeeId, token, file, photo.url ? 'replace' : 'add');
      setFile(null); markSaved(); invalidateEmployeePhoto(employeeId);
      toast.success('Profile picture saved.');
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Unable to save the profile picture.'); }
    finally { lock.current = false; setBusy(false); }
  };
  const remove = async () => {
    if (!token || !photo.url || lock.current || disabled) return;
    lock.current = true; setBusy(true); setError(null);
    try {
      await employeePhotoApi.remove(employeeId, token);
      setFile(null); markSaved(); invalidateEmployeePhoto(employeeId);
      setConfirmDelete(false); toast.success('Profile picture deleted.');
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Unable to delete the profile picture.'); }
    finally { lock.current = false; setBusy(false); }
  };
  return <div className="space-y-4">
    {photo.loading ? <p role="status" className="flex items-center gap-2 text-sm"><Loader2 className="h-4 w-4 animate-spin" />Loading profile picture…</p> : photo.error ? <div className="space-y-2"><p role="alert" className="text-sm text-destructive">{photo.error}</p><Button type="button" variant="outline" onClick={photo.refresh}>Try again</Button></div> : <>
      {photo.url && <div className="flex flex-wrap items-center gap-4">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={photo.url} alt={`${name}'s profile picture`} className="h-28 w-28 rounded-full border object-cover" />
        <Button type="button" variant="outline" disabled={disabled || pending} onClick={() => { setError(null); setConfirmDelete(true); }}><Trash2 className="mr-2 h-4 w-4" />Delete profile picture</Button>
      </div>}
      <p className="text-sm font-medium">{photo.url ? 'Replace profile picture' : 'Add profile picture'}</p>
      <EmployeePhotoPicker file={file} onChange={setFile} disabled={disabled || busy} onValidatingChange={setValidating} />
      {file && <Button type="button" disabled={disabled || pending} onClick={() => void save()}>{busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Save picture</Button>}
    </>}
    {error && !confirmDelete && <p role="alert" className="text-sm text-destructive">{error}</p>}
    <Dialog open={confirmDelete} onOpenChange={open => { if (!busy) setConfirmDelete(open); }}><DialogContent className="sm:max-w-md">
      <DialogHeader><DialogTitle>Delete profile picture?</DialogTitle><DialogDescription>Only {name}&apos;s picture will be removed. The employee record will stay unchanged.</DialogDescription></DialogHeader>
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
      <DialogFooter><Button type="button" variant="outline" disabled={busy} onClick={() => setConfirmDelete(false)}>Keep picture</Button><Button type="button" variant="destructive" disabled={busy || disabled || !photo.url} onClick={() => void remove()}>{busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Delete picture</Button></DialogFooter>
    </DialogContent></Dialog>
  </div>;
}
