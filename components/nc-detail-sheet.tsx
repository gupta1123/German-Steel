'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Download, FileText, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { getErrorMessage } from '@/lib/api-error';
import { type CombinedNcRegister, INSTITUTIONS_API_BASE_URL } from '@/lib/institutions-api';

type NcDetail = CombinedNcRegister & { parentName: string; parentTypeLabel: 'Institution' | 'Project'; parentId: number };
type Evidence = { id: number; fileName?: string; fileAttached?: boolean; documentType?: string };
type ClosureEvent = { id: number; eventType: string; correctiveActionText?: string; submittedAt?: string; closureMethod?: string; acceptanceDate?: string; acceptingOfficialText?: string; evidenceDocumentId?: number; witnessedVisitId?: number; recordedAt?: string };
const date = (value?: string | null) => value ? new Date(value.length === 10 ? `${value}T00:00:00` : value).toLocaleDateString('en-IN', { dateStyle: 'medium' }) : '—';
const label = (value?: string | null) => value ? value.replaceAll('_', ' ').toLowerCase().replace(/\b\w/g, letter => letter.toUpperCase()).replace(/\bNc\b/g, 'NC') : '—';

export function NcDetailSheet({ nc, token, onClose, onSubmit, onAccept }: { nc: NcDetail | null; token: string | null; onClose: () => void; onSubmit: (nc: NcDetail) => void; onAccept: (nc: NcDetail) => void }) {
  const [evidence, setEvidence] = useState<Evidence[]>([]);
  const [events, setEvents] = useState<ClosureEvent[]>([]);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);
  const [retry, setRetry] = useState(0);
  const [downloading, setDownloading] = useState<number | null>(null);

  useEffect(() => {
    if (!nc || !token) return;
    let cancelled = false;
    setEvidence([]); setEvents([]); setErrors([]); setLoading(true);
    const headers = { Authorization: `Bearer ${token}` };
    const readPages = async <T,>(path: string): Promise<T[]> => {
      const items: T[] = [];
      for (let page = 0; ; page++) {
        const response = await fetch(`${INSTITUTIONS_API_BASE_URL}${path}?page=${page}&size=100`, { headers });
        if (!response.ok) throw new Error('Unable to load this section.');
        const result = await response.json();
        const content = Array.isArray(result) ? result : result.content || [];
        items.push(...content);
        if (cancelled || Array.isArray(result) || result.last === true || page + 1 >= result.totalPages || content.length < 100) return items;
      }
    };
    void Promise.allSettled([
      readPages<Evidence>(`/api/common/nc/${nc.id}/documents`),
      readPages<ClosureEvent>(`/api/${nc.parentType === 'PROJECT' ? 'projects' : 'empanelment'}/nc/${nc.id}/closure-events`),
    ]).then(([documents, history]) => {
      if (cancelled) return;
      if (documents.status === 'fulfilled') setEvidence(documents.value);
      if (history.status === 'fulfilled') setEvents(history.value.sort((a, b) => (b.recordedAt || b.submittedAt || b.acceptanceDate || '').localeCompare(a.recordedAt || a.submittedAt || a.acceptanceDate || '') || b.id - a.id));
      setErrors([...(documents.status === 'rejected' ? ['Evidence could not be loaded.'] : []), ...(history.status === 'rejected' ? ['Closure history could not be loaded.'] : [])]);
      setLoading(false);
    });
    return () => { cancelled = true; };
  }, [nc, token, retry]);

  const download = async (document: Evidence) => {
    if (!token) return;
    setDownloading(document.id);
    try {
      const headers = { Authorization: `Bearer ${token}` };
      const listing = await fetch(`${INSTITUTIONS_API_BASE_URL}/api/hr/files?parentType=DOCUMENT_DEPOSITORY&parentId=${document.id}&page=0&size=5`, { headers });
      if (!listing.ok) throw new Error('Unable to locate the evidence file.');
      const files = await listing.json();
      const fileId = files.content?.[0]?.id;
      if (!fileId) throw new Error('No uploaded file is available for this evidence.');
      const response = await fetch(`${INSTITUTIONS_API_BASE_URL}/api/hr/files/${fileId}/download`, { headers });
      if (!response.ok) throw new Error('Unable to download the evidence file.');
      const url = URL.createObjectURL(await response.blob());
      const anchor = window.document.createElement('a');
      anchor.href = url; anchor.download = document.fileName || `nc-evidence-${document.id}`; anchor.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (error) { toast.error(getErrorMessage(error, 'Unable to download evidence.')); }
    finally { setDownloading(null); }
  };

  const overdue = nc && nc.status !== 'CLOSED' && (nc.overdue || !!(nc.targetClosureDate && nc.targetClosureDate < new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 10)));
  const statusColor = nc?.status === 'CLOSED' ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300' : nc?.status === 'SUBMITTED' ? 'bg-amber-500/10 text-amber-700 dark:text-amber-300' : 'bg-rose-500/10 text-rose-700 dark:text-rose-300';
  return <Sheet open={!!nc} onOpenChange={open => { if (!open) onClose(); }}>
    <SheetContent className="flex w-full flex-col gap-0 p-0 sm:max-w-xl">
      <SheetHeader className="border-b px-6 py-5 text-left">
        <SheetTitle>NC #{nc?.id}</SheetTitle>
        <SheetDescription className="break-words pr-6">{nc?.parentTypeLabel} · {nc?.parentName}</SheetDescription>
      </SheetHeader>
      {nc && <>
        <div className="min-h-0 flex-1 space-y-6 overflow-y-auto px-6 py-5">
          <section>
            <div className="mb-3 flex flex-wrap gap-2"><span className={`rounded-full px-2.5 py-1 text-xs font-medium ${statusColor}`}>{nc.status === 'SUBMITTED' ? 'Closure submitted' : label(nc.status)}</span>{overdue && <span className="rounded-full bg-orange-500/10 px-2.5 py-1 text-xs font-medium text-orange-700 dark:text-orange-300">Overdue</span>}</div>
            <h3 className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">Issue</h3>
            <p className="whitespace-pre-wrap break-words text-sm leading-6">{nc.description || 'No description provided.'}</p>
          </section>
          <dl className="grid grid-cols-2 gap-x-5 gap-y-4 border-y py-5 text-sm">
            {([['Raised on', date(nc.raisedDate)], ['Target closure', date(nc.targetClosureDate)], ['Raised by', nc.raisedByOfficialText || '—'], ['Responsible', nc.responsibleEmployeeName || (nc.responsibleEmployeeId ? `Employee #${nc.responsibleEmployeeId}` : 'Unassigned')], ...(nc.closureDate ? [['Closed on', date(nc.closureDate)]] : []), ...(nc.closureMethod ? [['Closure method', label(nc.closureMethod)]] : [])]).map(([name, value]) => <div key={name} className="min-w-0"><dt className="mb-1 text-xs text-muted-foreground">{name}</dt><dd className="break-words font-medium">{value}</dd></div>)}
          </dl>
          {errors.length > 0 && <div role="alert" className="rounded-lg border border-destructive/30 p-3 text-sm"><p>{errors.join(' ')}</p><Button variant="outline" size="sm" className="mt-2" onClick={() => setRetry(value => value + 1)}>Retry</Button></div>}
          <section><h3 className="mb-3 text-sm font-semibold">Closure history</h3>
            {loading ? <p role="status" className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" />Loading NC details…</p> : events.length ? <ol className="space-y-4">{events.map(event => <li key={event.id} className="border-l-2 border-border pl-4 text-sm"><div className="flex flex-wrap items-center justify-between gap-1"><p className="font-medium">{label(event.eventType)}</p><span className="text-xs text-muted-foreground">{date(event.acceptanceDate || event.submittedAt || event.recordedAt)}</span></div>{event.correctiveActionText && <p className="mt-2 whitespace-pre-wrap break-words leading-6">{event.correctiveActionText}</p>}{event.closureMethod && <p className="mt-1 text-xs text-muted-foreground">{label(event.closureMethod)}</p>}{event.acceptingOfficialText && <p className="mt-1 break-words text-xs text-muted-foreground">Accepted by {event.acceptingOfficialText}</p>}{event.evidenceDocumentId && <p className="mt-1 text-xs text-muted-foreground">Evidence #{event.evidenceDocumentId}</p>}{event.witnessedVisitId && <p className="mt-1 text-xs text-muted-foreground">Witnessing visit #{event.witnessedVisitId}</p>}</li>)}</ol> : !errors.some(error => error.startsWith('Closure')) && <p className="text-sm text-muted-foreground">No closure events recorded.</p>}
          </section>
          <section><h3 className="mb-3 text-sm font-semibold">Evidence{!loading && ` (${evidence.length})`}</h3>
            {!loading && evidence.map(document => <div key={document.id} className="flex items-center gap-3 border-b py-3 last:border-0"><FileText className="h-4 w-4 shrink-0 text-muted-foreground" /><div className="min-w-0 flex-1"><p className="break-words text-sm font-medium">{document.fileName || `Document #${document.id}`}</p><p className="mt-1 text-xs text-muted-foreground">{label(document.documentType)}{document.fileAttached === false && ' · No file attached'}</p></div><Button variant="ghost" size="icon" disabled={document.fileAttached === false || downloading !== null} onClick={() => void download(document)} aria-label={`Download ${document.fileName || 'evidence'}`}>{downloading === document.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}</Button></div>)}
            {!loading && !evidence.length && !errors.some(error => error.startsWith('Evidence')) && <p className="text-sm text-muted-foreground">No evidence uploaded.</p>}
          </section>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-2 border-t px-6 py-4">
          <Button variant="outline" size="sm" asChild><Link href={`/dashboard/${nc.parentType === 'PROJECT' ? 'projects' : 'institutions'}/${nc.parentId}`}>Open {nc.parentTypeLabel.toLowerCase()}</Link></Button>
          {nc.status === 'OPEN' && <Button size="sm" onClick={() => { onClose(); onSubmit(nc); }}>Submit closure</Button>}
          {nc.status === 'SUBMITTED' && <Button size="sm" onClick={() => { onClose(); onAccept(nc); }}>Accept closure</Button>}
        </div>
      </>}
    </SheetContent>
  </Sheet>;
}
