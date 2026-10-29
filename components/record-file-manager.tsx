"use client";

import { useEffect, useState } from 'react';
import { Loader2, Paperclip } from 'lucide-react';
import { useAuth } from '@/components/auth-provider';
import { AdminRemovalAction } from '@/components/admin-removal-action';
import { adminRemovalPaths, hasAdminRemovalRole } from '@/lib/admin-removals-api';
import { getApiErrorMessage } from '@/lib/api-error';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';

type FileRow = { id: number; originalFileName?: string; fileName?: string; active?: boolean };
const API_BASE = 'http://ec2-18-211-58-135.compute-1.amazonaws.com:8081';

export function RecordFileManager({ parentType, parentId, onFilesChanged }: { parentType: 'VISIT_ACTIVITY' | 'DOCUMENT_DEPOSITORY' | 'RECORD_NOTE'; parentId: number; onFilesChanged?: () => void | Promise<unknown> }) {
  const { token, userRole, currentUser } = useAuth();
  const [open, setOpen] = useState(false);
  const [version, setVersion] = useState(0);
  const [files, setFiles] = useState<FileRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const allowed = hasAdminRemovalRole(userRole, currentUser);
  useEffect(() => {
    if (!open || !token || !allowed) return;
    const controller = new AbortController();
    setLoading(true); setError(''); setFiles([]);
    (async () => {
      const items: FileRow[] = [];
      let page = 0, pages = 1;
      do {
        const response = await fetch(`${API_BASE}/api/hr/files?parentType=${parentType}&parentId=${parentId}&page=${page}&size=50`, { headers: { Authorization: `Bearer ${token}` }, signal: controller.signal });
        if (!response.ok) throw new Error(await getApiErrorMessage(response, 'Unable to load attachments.'));
        const body = await response.json();
        items.push(...(Array.isArray(body) ? body : body.content ?? []));
        pages = Math.max(1, Number(body.totalPages) || 1); page++;
      } while (page < pages);
      if (!controller.signal.aborted) setFiles(items.filter(item => item.active !== false && Number.isSafeInteger(item.id) && item.id > 0));
    })().catch(cause => { if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : 'Unable to load attachments.'); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [open, token, allowed, parentType, parentId, version]);
  if (!allowed) return null;
  return <>
    <Button variant="outline" size="sm" className="h-8 gap-1 text-xs" onClick={() => setOpen(true)}><Paperclip className="h-3.5 w-3.5" />Manage attachments</Button>
    <Dialog open={open} onOpenChange={setOpen}><DialogContent className="max-h-[85dvh] overflow-y-auto"><DialogHeader><DialogTitle>Manage attachments</DialogTitle><DialogDescription>Remove one uploaded file. The stored file is kept for audit. Accepted approval evidence is protected.</DialogDescription></DialogHeader>
      {loading ? <p role="status" className="flex items-center gap-2 text-sm"><Loader2 className="h-4 w-4 animate-spin" />Loading files…</p> : error ? <div><p role="alert" className="text-sm text-destructive">{error}</p><Button variant="outline" onClick={() => setVersion(value => value + 1)}>Try again</Button></div> : files.length ? <ul className="divide-y">{files.map(file => <li key={file.id} className="flex items-center justify-between gap-2 py-2"><span className="min-w-0 break-words text-sm">{file.originalFileName || file.fileName || `File #${file.id}`}</span><AdminRemovalAction endpoint={adminRemovalPaths.file(file.id)} label="Remove file" name={file.originalFileName || file.fileName || `File #${file.id}`} description={parentType === 'DOCUMENT_DEPOSITORY' ? 'Remove this file. If it is the last active file, the document version will also become inactive. Accepted evidence cannot be removed.' : 'Remove this attachment from the record. Its stored file and removal history will be kept.'} onRemoved={async () => { setVersion(value => value + 1); await onFilesChanged?.(); }} /></li>)}</ul> : <p className="text-sm text-muted-foreground">No active attachments.</p>}
    </DialogContent></Dialog>
  </>;
}
