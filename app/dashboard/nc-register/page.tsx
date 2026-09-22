'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { AlertCircle, ChevronLeft, ChevronRight, DownloadIcon, Filter, Loader2, Search, X } from 'lucide-react';
import { toast } from 'sonner';

import { useAuth } from '@/components/auth-provider';
import { getErrorMessage } from '@/lib/api-error';
import { InstitutionsAPI, type CombinedNcRegister } from '@/lib/institutions-api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardAction, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Sheet, SheetContent, SheetFooter, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Textarea } from '@/components/ui/textarea';
import { Skeleton } from '@/components/ui/skeleton';

const humanize = (v: string | null | undefined) => v ? v.replaceAll('_', ' ').toLowerCase().replace(/\b\w/g, (l) => l.toUpperCase()) : '—';
const showDate = (v: string | null | undefined) => v ? new Date(v.length === 10 ? `${v}T00:00:00` : v).toLocaleDateString('en-IN', { dateStyle: 'medium' }) : '—';

type GlobalNc = CombinedNcRegister & { parentName: string; parentTypeLabel: 'Institution' | 'Project'; parentId: number };

export default function NcRegisterPage() {
  const { token } = useAuth();
  const [globalNc, setGlobalNc] = useState<GlobalNc[]>([]);
  const [totalElements, setTotalElements] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  const [queryInput, setQueryInput] = useState('');
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [parentFilter, setParentFilter] = useState<'ALL' | 'Institution' | 'Project'>('ALL');
  const [overdueOnly, setOverdueOnly] = useState(false);
  const [areFiltersVisible, setAreFiltersVisible] = useState(true);
  const [isExporting, setIsExporting] = useState(false);
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(15);
  const [hasUserChosenPageSize, setHasUserChosenPageSize] = useState(false);

  useEffect(() => {
    if (hasUserChosenPageSize) return;
    const calc = () => {
      const h = window.innerHeight;
      const available = h - 320;
      const byHeight = Math.floor(available / 36);
      let target = 15;
      if (byHeight >= 18) target = 20;
      else if (byHeight >= 14) target = 15;
      else target = 10;
      target = Math.min(50, Math.max(10, target));
      const snap = target <= 10 ? 10 : target <= 15 ? 15 : 20;
      setPageSize((prev) => (prev === snap ? prev : snap));
    };
    calc();
    window.addEventListener('resize', calc);
    return () => window.removeEventListener('resize', calc);
  }, [hasUserChosenPageSize]);

  // Submit/Accept sheets
  const [submitNc, setSubmitNc] = useState<GlobalNc | null>(null);
  const [submitText, setSubmitText] = useState('');
  const [submitFile, setSubmitFile] = useState<File | null>(null);
  const [submitDocs, setSubmitDocs] = useState<any[]>([]);
  const [submitEvidenceId, setSubmitEvidenceId] = useState('');
  const [acceptNc, setAcceptNc] = useState<GlobalNc | null>(null);
  const [acceptForm, setAcceptForm] = useState({ closureMethod: 'DOCUMENTARY_EVIDENCE_ONLY', acceptanceDate: new Date().toISOString().slice(0,10), acceptingOfficialText: '', evidenceDocumentId: '', witnessedVisitId: '' });
  const [ncBusyId, setNcBusyId] = useState<number | null>(null);
  const [visitsForAccept, setVisitsForAccept] = useState<any[]>([]);

  useEffect(() => { const t = setTimeout(() => { setPage(0); setQuery(queryInput.trim()); }, 350); return () => clearTimeout(t); }, [queryInput]);
  useEffect(() => { setPage(0); }, [statusFilter, parentFilter, overdueOnly]);

  const loadGlobal = useCallback(async () => {
    if (!token) return;
    setIsLoading(true);
    try {
      const result = await InstitutionsAPI.getCombinedNcRegister(token, {
        page,
        size: pageSize,
        q: query || undefined,
        status: statusFilter === 'ALL' ? undefined : statusFilter as 'OPEN' | 'SUBMITTED' | 'CLOSED',
        parentType: parentFilter === 'ALL' ? undefined : parentFilter.toUpperCase() as 'INSTITUTION' | 'PROJECT',
        overdue: overdueOnly ? true : undefined,
      });
      setGlobalNc(result.content.map((nc) => ({
        ...nc,
        parentName: nc.parentType === 'INSTITUTION' ? nc.institutionName || `Institution #${nc.institutionId}` : nc.projectName || `Project #${nc.projectId}`,
        parentTypeLabel: nc.parentType === 'INSTITUTION' ? 'Institution' : 'Project',
        parentId: (nc.parentType === 'INSTITUTION' ? nc.institutionId : nc.projectId) || 0,
      })));
      setTotalElements(result.totalElements);
      setTotalPages(Math.max(1, result.totalPages));
    } catch (e) {
      toast.error(getErrorMessage(e, 'Unable to load NC records.'));
    } finally { setIsLoading(false); }
  }, [token, page, pageSize, query, statusFilter, parentFilter, overdueOnly]);

  useEffect(() => { void loadGlobal(); }, [loadGlobal]);

  const safePage = Math.min(page, totalPages - 1);
  const pageContent = globalNc;

  const csvCell = (v: unknown) => `"${String(v ?? '').replaceAll('"','""')}"`;
  const exportCsv = async () => {
    setIsExporting(true);
    try {
      const rows = [['NC ID','Parent','Parent Type','Description','Status','Raised','Target','Responsible'], ...globalNc.map(nc => [String(nc.id), nc.parentName, nc.parentTypeLabel, nc.description, nc.status, nc.raisedDate || '', nc.targetClosureDate || '', nc.responsibleEmployeeName || ''])];
      const blob = new Blob([rows.map(r=>r.map(csvCell).join(',')).join('\n')], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob); const a=document.createElement('a'); a.href=url; a.download='nc-register.csv'; document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
      toast.success(`Exported ${globalNc.length} NCs from this page.`);
    } catch (e) { toast.error(getErrorMessage(e,'Unable to export.')); } finally { setIsExporting(false); }
  };

  const statusClassName = (status: string) => {
    if (status === 'CLOSED') return 'bg-emerald-50 text-emerald-700 ring-emerald-600/15';
    if (status === 'SUBMITTED') return 'bg-amber-50 text-amber-700 ring-amber-600/15';
    return 'bg-rose-50 text-rose-700 ring-rose-600/15';
  };
  function Ellipsis({ value }: { value: string | number | null | undefined }) {
    const v = value === null || value === undefined || value === '' ? '—' : String(value);
    return <span className="block min-w-0 truncate" title={v}>{v}</span>;
  }

  const openSubmit = async (nc: GlobalNc) => {
    setSubmitNc(nc); setSubmitText(''); setSubmitFile(null); setSubmitDocs([]); setSubmitEvidenceId('');
    if (!token) return;
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_BASE_URL || 'http://ec2-18-211-58-135.compute-1.amazonaws.com:8081'}/api/common/nc/${nc.id}/documents?page=0&size=50`, { headers: { Authorization: `Bearer ${token}` } });
      if (res.ok) { const j = await res.json(); const arr = Array.isArray(j) ? j : j.content || []; setSubmitDocs(arr); const valid = arr.filter((d:any)=> d.fileAttached !== false); const latest = valid.length ? String(valid[valid.length-1].id) : arr.length ? String(arr[0].id) : ''; if (latest) setSubmitEvidenceId(latest); }
    } catch { setSubmitDocs([]); }
  };
  const doSubmit = async () => {
    if (!token || !submitNc) return;
    if (!submitText.trim()) { toast.error('Corrective action required.'); return; }
    const hasExistingChoice = !!submitEvidenceId && submitEvidenceId !== '__none';
    if (!submitFile && !hasExistingChoice) { toast.error('Attach evidence file or select an existing evidence document.'); return; }
    setNcBusyId(submitNc.id);
    try {
      let evidenceId: number | null = null;
      if (submitFile) {
        // create NC closure evidence doc
        const createRes = await fetch(`${process.env.NEXT_PUBLIC_API_BASE_URL || 'http://ec2-18-211-58-135.compute-1.amazonaws.com:8081'}/api/common/documents`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify({ documentType: 'NC_CLOSURE_EVIDENCE', parentType: 'NC_REGISTER', ncRegisterId: submitNc.id, fileName: submitFile.name, active: true }) });
        if (!createRes.ok) throw new Error('Create doc failed');
        const created = await createRes.json();
        const docId = created.id || created.documentId;
        const form = new FormData(); form.append('file', submitFile);
        const up = await fetch(`${process.env.NEXT_PUBLIC_API_BASE_URL || 'http://ec2-18-211-58-135.compute-1.amazonaws.com:8081'}/api/common/documents/${docId}/file`, { method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: form });
        if (!up.ok) throw new Error('Upload failed');
        evidenceId = docId;
      } else if (hasExistingChoice) {
        evidenceId = Number(submitEvidenceId);
      } else if (submitDocs.length) {
        const valid = submitDocs.filter((d:any)=> d.fileAttached !== false);
        evidenceId = valid.length ? valid[valid.length-1].id : submitDocs[0].id;
      }
      const path = submitNc.parentType === 'INSTITUTION' ? `/api/empanelment/nc/${submitNc.id}/submit-closure` : `/api/projects/nc/${submitNc.id}/submit-closure`;
      const r = await fetch(`${process.env.NEXT_PUBLIC_API_BASE_URL || 'http://ec2-18-211-58-135.compute-1.amazonaws.com:8081'}${path}`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify({ correctiveActionText: submitText.trim(), evidenceDocumentId: evidenceId, witnessedVisitId: null }) });
      if (!r.ok) throw new Error(await r.text());
      toast.success('Closure submitted.'); setSubmitNc(null); await loadGlobal();
    } catch (e) { toast.error(getErrorMessage(e, 'Unable to submit closure.')); } finally { setNcBusyId(null); }
  };

  const openAccept = async (nc: GlobalNc) => {
    setAcceptNc(nc);
    setAcceptForm({ closureMethod: 'DOCUMENTARY_EVIDENCE_ONLY', acceptanceDate: new Date().toISOString().slice(0,10), acceptingOfficialText: '', evidenceDocumentId: '', witnessedVisitId: '' });
    if (!token) return;
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_BASE_URL || 'http://ec2-18-211-58-135.compute-1.amazonaws.com:8081'}/api/common/nc/${nc.id}/documents?page=0&size=50`, { headers: { Authorization: `Bearer ${token}` } });
      if (res.ok) { const j = await res.json(); const arr = Array.isArray(j) ? j : j.content || []; setSubmitDocs(arr); const valid = arr.filter((d:any)=> d.fileAttached !== false); const latest = valid.length ? String(valid[valid.length-1].id) : arr.length ? String(arr[0].id) : ''; if (latest) setAcceptForm(prev => ({ ...prev, evidenceDocumentId: latest })); }
      // load visits for re-visit picker
      const vr = await fetch(`${process.env.NEXT_PUBLIC_API_BASE_URL || 'http://ec2-18-211-58-135.compute-1.amazonaws.com:8081'}/api/common/visits?page=0&size=50`, { headers: { Authorization: `Bearer ${token}` } });
      if (vr.ok) { const vj = await vr.json(); const vc = Array.isArray(vj.content) ? vj.content : []; setVisitsForAccept(vc.filter((v:any)=>v.actualCheckoutAt)); }
    } catch { setSubmitDocs([]); }
  };
  const doAccept = async () => {
    if (!token || !acceptNc) return;
    if (!acceptForm.acceptingOfficialText.trim()) { toast.error('Accepting official required.'); return; }
    if (acceptForm.closureMethod === 'DOCUMENTARY_EVIDENCE_ONLY' && !acceptForm.evidenceDocumentId) { toast.error('Select an evidence document — upload one via Evidence first.'); return; }
    if (acceptForm.closureMethod === 'RE_VISIT_WITNESSED' && !acceptForm.witnessedVisitId) { toast.error('Choose witnessing visit.'); return; }
    setNcBusyId(acceptNc.id);
    try {
      const path = acceptNc.parentType === 'INSTITUTION' ? `/api/empanelment/nc/${acceptNc.id}/accept-closure` : `/api/projects/nc/${acceptNc.id}/accept-closure`;
      const body: any = {
        closureMethod: acceptForm.closureMethod,
        acceptanceDate: acceptForm.acceptanceDate,
        acceptingOfficialText: acceptForm.acceptingOfficialText.trim(),
        evidenceDocumentId: acceptForm.closureMethod === 'DOCUMENTARY_EVIDENCE_ONLY' && acceptForm.evidenceDocumentId && acceptForm.evidenceDocumentId !== '__none' ? Number(acceptForm.evidenceDocumentId) : null,
        witnessedVisitId: acceptForm.witnessedVisitId ? Number(acceptForm.witnessedVisitId) : null,
      };
      const r = await fetch(`${process.env.NEXT_PUBLIC_API_BASE_URL || 'http://ec2-18-211-58-135.compute-1.amazonaws.com:8081'}${path}`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify(body) });
      if (!r.ok) throw new Error(await r.text());
      toast.success('NC closed.'); setAcceptNc(null); await loadGlobal();
    } catch (e) { toast.error(getErrorMessage(e, 'Unable to close NC. Manager required.')); } finally { setNcBusyId(null); }
  };

  return (
    <div className="mx-auto w-full max-w-none py-4">
      {areFiltersVisible ? (
        <>
          <div className="mb-3 flex flex-col gap-2 lg:flex-row lg:items-center">
            <div className="min-w-0 flex-1">
              <Label htmlFor="nc-search" className="sr-only">Search NCs</Label>
              <div className="relative">
                <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                <Input id="nc-search" type="search" autoComplete="off" placeholder="Search description, parent, official…" value={queryInput} onChange={e=>setQueryInput(e.target.value)} className="h-8 bg-background pl-8 pr-8 text-xs shadow-none" />
                {queryInput && <button type="button" onClick={()=>{setQueryInput(''); setQuery('');}} className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded p-1 text-muted-foreground hover:bg-muted"><X className="h-3.5 w-3.5" /></button>}
              </div>
            </div>
            <div className="min-w-0 flex-1">
              <Label className="sr-only">Status</Label>
              <Select value={statusFilter} onValueChange={(v)=>{setPage(0); setStatusFilter(v);}}><SelectTrigger className="h-8 w-full bg-background text-xs shadow-none"><SelectValue placeholder="Status" /></SelectTrigger><SelectContent><SelectItem value="ALL">All Statuses</SelectItem><SelectItem value="OPEN">Open</SelectItem><SelectItem value="SUBMITTED">Submitted</SelectItem><SelectItem value="CLOSED">Closed</SelectItem></SelectContent></Select>
            </div>
            <div className="min-w-0 flex-1">
              <Label className="sr-only">Parent</Label>
              <Select value={parentFilter} onValueChange={(v)=>{setPage(0); setParentFilter(v as any);}}><SelectTrigger className="h-8 w-full bg-background text-xs shadow-none"><SelectValue placeholder="Parent" /></SelectTrigger><SelectContent><SelectItem value="ALL">All Parents</SelectItem><SelectItem value="Institution">Institution</SelectItem><SelectItem value="Project">Project</SelectItem></SelectContent></Select>
            </div>
            <div className="min-w-0 flex-1">
              <Label className="sr-only">Overdue</Label>
              <Select value={overdueOnly ? 'OVERDUE' : 'ALL'} onValueChange={(v)=>{setPage(0); setOverdueOnly(v==='OVERDUE');}}><SelectTrigger className="h-8 w-full bg-background text-xs shadow-none"><SelectValue placeholder="All" /></SelectTrigger><SelectContent><SelectItem value="ALL">All NCs</SelectItem><SelectItem value="OVERDUE">Overdue only</SelectItem></SelectContent></Select>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <span className="hidden text-xs text-muted-foreground xl:inline">{totalElements} NCs</span>
              <Button variant="outline" size="icon" className="h-8 w-8 shadow-none" onClick={()=>setAreFiltersVisible(false)} aria-label="Hide filters" title="Hide filters"><Filter className="h-4 w-4" /></Button>
              <Button variant="outline" size="icon" className="h-8 w-8 shadow-none" onClick={()=>void exportCsv()} disabled={isExporting} aria-label="Export NCs" title="Export NCs">{isExporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <DownloadIcon className="h-4 w-4" />}</Button>
            </div>
          </div>
          <hr className="mb-4 border-border" />
        </>
      ) : (
        <div className="mb-4 flex items-center justify-end gap-2">
          <Button variant="outline" size="icon" className="h-8 w-8 shadow-none" onClick={()=>setAreFiltersVisible(true)} aria-label="Show filters" title="Show filters"><Filter className="h-4 w-4" /></Button>
          <Button variant="outline" size="icon" className="h-8 w-8 shadow-none" onClick={()=>void exportCsv()} disabled={isExporting} aria-label="Export NCs" title="Export NCs">{isExporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <DownloadIcon className="h-4 w-4" />}</Button>
        </div>
      )}

      <div className="overflow-x-auto">
        <Table className="table-fixed text-xs">
          <colgroup><col className="w-[10%]" /><col className="w-[18%]" /><col className="w-[27%]" /><col className="w-[10%]" /><col className="w-[12%]" /><col className="w-[23%]" /></colgroup>
          <TableHeader><TableRow>{['Status','Parent','Description','Target','Responsible','Actions'].map(h=><TableHead key={h} className={`overflow-hidden text-ellipsis whitespace-nowrap ${h==='Actions'?'text-right':''}`} title={h}>{h}</TableHead>)}</TableRow></TableHeader>
          <TableBody>
            {isLoading ? (
              Array.from({length: pageSize},(_,i)=><TableRow key={`sk-${i}`}>{Array.from({length:6},(_,c)=><TableCell key={c}><Skeleton className="h-4 w-full max-w-24" /></TableCell>)}</TableRow>)
            ) : globalNc.length===0 ? (
              <TableRow><TableCell colSpan={6} className="h-24 text-center text-muted-foreground">No NCs match the selected filters.</TableCell></TableRow>
            ) : (
              pageContent.map(nc=>{
                const isOverdue = nc.targetClosureDate && nc.status !== 'CLOSED' && nc.targetClosureDate < new Date().toISOString().slice(0,10);
                return (
                  <TableRow key={nc.id} className={isOverdue ? 'bg-orange-50/50' : ''}>
                    <TableCell className="align-middle">
                      <div className="flex min-w-0 flex-col items-start gap-0.5">
                        <span className={`inline-flex max-w-full shrink-0 whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-medium leading-4 ring-1 ring-inset ${statusClassName(nc.status)}`}>{nc.status}</span>
                        {isOverdue && <span className="whitespace-nowrap text-[10px] leading-4 text-orange-600">Overdue</span>}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="truncate font-medium" title={nc.parentName}><Ellipsis value={nc.parentName} /></div>
                          <div className="truncate text-[11px] text-muted-foreground">
                            <Link href={nc.parentType==='INSTITUTION' ? `/dashboard/institutions/${nc.parentId}` : `/dashboard/projects/${nc.parentId}`} className="hover:underline">{nc.parentTypeLabel} #{nc.parentId}</Link> · NC #{nc.id}
                          </div>
                        </TableCell>
                        <TableCell><div className="truncate" title={nc.description}>{nc.description}</div><div className="text-[11px] text-muted-foreground">Raised {showDate(nc.raisedDate)} by {nc.raisedByOfficialText||'—'}</div></TableCell>
                        <TableCell><Ellipsis value={showDate(nc.targetClosureDate)} /></TableCell>
                        <TableCell><Ellipsis value={nc.responsibleEmployeeName || (nc.responsibleEmployeeId ? `Emp #${nc.responsibleEmployeeId}` : '—')} /></TableCell>
                        <TableCell>
                          <div className="flex items-center justify-end gap-1">
                            {nc.status==='OPEN' && <Button size="sm" variant="ghost" className="h-7 px-2 text-xs" disabled={ncBusyId===nc.id} onClick={()=>void openSubmit(nc)}>{ncBusyId===nc.id ? <Loader2 className="mr-1 h-3 w-3 animate-spin" /> : null}Submit</Button>}
                            {nc.status==='SUBMITTED' && <Button size="sm" variant="ghost" className="h-7 px-2 text-xs" disabled={ncBusyId===nc.id} onClick={()=>void openAccept(nc)}>{ncBusyId===nc.id ? <Loader2 className="mr-1 h-3 w-3 animate-spin" /> : null}Accept</Button>}
                            <Button size="sm" variant="ghost" className="h-7 px-2 text-xs" asChild><Link href={nc.parentType==='INSTITUTION' ? `/dashboard/institutions/${nc.parentId}` : `/dashboard/projects/${nc.parentId}`}>View</Link></Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-xs">
          <Label htmlFor="nc-page-size" className="text-xs">Rows per page:</Label>
          <Select value={String(pageSize)} onValueChange={(v)=>{setHasUserChosenPageSize(true); setPage(0); setPageSize(Number(v));}}><SelectTrigger id="nc-page-size" className="h-8 w-20 text-xs"><SelectValue /></SelectTrigger><SelectContent>{[10,15,25,50].map(n=><SelectItem key={n} value={String(n)}>{String(n)}</SelectItem>)}</SelectContent></Select>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" className="h-8" onClick={()=>setPage(p=>Math.max(0,p-1))} disabled={safePage<=0 || isLoading}><ChevronLeft className="h-4 w-4" /><span className="hidden sm:inline">Previous</span></Button>
          <span className="text-xs text-muted-foreground">Page {safePage+1} of {totalPages}</span>
          <Button variant="outline" size="sm" className="h-8" onClick={()=>setPage(p=>p+1)} disabled={safePage+1>=totalPages || isLoading}><span className="hidden sm:inline">Next</span><ChevronRight className="h-4 w-4" /></Button>
        </div>
      </div>

      <Sheet open={!!submitNc} onOpenChange={(o)=>!o && setSubmitNc(null)}>
        <SheetContent className="flex w-full flex-col sm:max-w-lg">
          <SheetHeader className="border-b pb-4"><SheetTitle>Submit NC #{submitNc?.id} closure</SheetTitle></SheetHeader>
          <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-1 py-4">
            {submitNc && <div className="rounded-lg border bg-muted/30 p-3"><p className="text-sm font-medium">NC #{submitNc.id} · {submitNc.parentName}</p><p className="mt-1 text-sm">{submitNc.description}</p></div>}
            <div className="space-y-1.5"><Label>Corrective action *</Label><Textarea value={submitText} onChange={e=>setSubmitText(e.target.value)} placeholder="What was fixed" /></div>
            <div className="space-y-1.5"><Label>Existing evidence (pick one)</Label><Select value={submitEvidenceId} onValueChange={v=>setSubmitEvidenceId(v)}><SelectTrigger><SelectValue placeholder={submitDocs.length ? 'Choose existing evidence' : 'No existing evidence — upload below'} /></SelectTrigger><SelectContent><SelectItem value="__none">None — upload new file</SelectItem>{submitDocs.map((d:any)=><SelectItem key={d.id} value={String(d.id)}>{d.fileName}{d.fileAttached===false?' (no file)':''}</SelectItem>)}</SelectContent></Select>{!submitDocs.length && <p className="text-xs text-muted-foreground">No evidence yet for this NC.</p>}</div>
            <div className="space-y-1.5"><Label>Or upload new evidence file</Label><Input type="file" onChange={e=>setSubmitFile(e.target.files?.[0] ?? null)} /><p className="text-xs text-muted-foreground">If you upload a file it will be used as evidence (overrides selection).</p></div>
          </div>
          <div className="flex justify-end gap-2 border-t p-4"><Button variant="outline" onClick={()=>setSubmitNc(null)}>Cancel</Button><Button onClick={()=>void doSubmit()} disabled={ncBusyId===submitNc?.id}>{ncBusyId===submitNc?.id && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Submit</Button></div>
        </SheetContent>
      </Sheet>

      <Sheet open={!!acceptNc} onOpenChange={(o)=>!o && setAcceptNc(null)}>
        <SheetContent className="flex w-full flex-col sm:max-w-lg">
          <SheetHeader className="border-b pb-4"><SheetTitle>Accept NC #{acceptNc?.id} closure</SheetTitle></SheetHeader>
          <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-1 py-4">
            {acceptNc && <div className="rounded-lg border bg-muted/30 p-3"><p className="text-sm font-medium">NC #{acceptNc.id} · {acceptNc.parentName}</p><p className="mt-1 text-sm">{acceptNc.description}</p></div>}
            <div className="space-y-1.5"><Label>Closure method *</Label><Select value={acceptForm.closureMethod} onValueChange={v=>setAcceptForm({...acceptForm, closureMethod: v})}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="DOCUMENTARY_EVIDENCE_ONLY">Documentary evidence only</SelectItem><SelectItem value="RE_VISIT_WITNESSED">Re-visit witnessed</SelectItem></SelectContent></Select></div>
            {acceptForm.closureMethod==='DOCUMENTARY_EVIDENCE_ONLY' && <div className="space-y-1.5"><Label>Evidence document *</Label><Select value={acceptForm.evidenceDocumentId} onValueChange={v=>setAcceptForm({...acceptForm, evidenceDocumentId: v === '__none' ? '' : v})}><SelectTrigger><SelectValue placeholder={submitDocs.length ? 'Choose evidence' : 'No evidence — upload via institution page first'} /></SelectTrigger><SelectContent><SelectItem value="__none">None</SelectItem>{submitDocs.map((d:any)=><SelectItem key={d.id} value={String(d.id)}>{d.fileName}{d.fileAttached===false?' (no file)':''}</SelectItem>)}</SelectContent></Select>{!submitDocs.length && <p className="text-xs text-destructive">Upload evidence for this NC before accepting.</p>}</div>}
            <div className="space-y-1.5"><Label>Acceptance date *</Label><Input type="date" value={acceptForm.acceptanceDate} onChange={e=>setAcceptForm({...acceptForm, acceptanceDate: e.target.value})} /></div>
            <div className="space-y-1.5"><Label>Accepting official *</Label><Input value={acceptForm.acceptingOfficialText} onChange={e=>setAcceptForm({...acceptForm, acceptingOfficialText: e.target.value})} /></div>
            {acceptForm.closureMethod==='RE_VISIT_WITNESSED' && <div className="space-y-1.5"><Label>Witnessing visit *</Label><Select value={acceptForm.witnessedVisitId} onValueChange={v=>setAcceptForm({...acceptForm, witnessedVisitId: v})}><SelectTrigger><SelectValue placeholder="Choose completed visit" /></SelectTrigger><SelectContent>{visitsForAccept.map((v:any)=><SelectItem key={v.id} value={String(v.id)}>Visit #{v.id} · {showDate(v.scheduledVisitDate)}</SelectItem>)}</SelectContent></Select></div>}
          </div>
          <div className="flex justify-end gap-2 border-t p-4"><Button variant="outline" onClick={()=>setAcceptNc(null)}>Cancel</Button><Button onClick={()=>void doAccept()} disabled={ncBusyId===acceptNc?.id}>{ncBusyId===acceptNc?.id && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Close NC</Button></div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
