'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Search, X } from 'lucide-react';
import { toast } from 'sonner';

import { useAuth } from '@/components/auth-provider';
import { getErrorMessage } from '@/lib/api-error';
import { InstitutionsAPI, type Institution } from '@/lib/institutions-api';
import { ProjectsAPI, type Project } from '@/lib/projects-api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';
import { ChevronLeft, ChevronRight, DownloadIcon, Filter, Loader2 } from 'lucide-react';

const humanize = (v: string | null | undefined) => v ? v.replaceAll('_', ' ').toLowerCase().replace(/\b\w/g, (l) => l.toUpperCase()) : '—';
function Ellipsis({ value }: { value: string | number | null | undefined }) {
  const v = value === null || value === undefined || value === '' ? '—' : String(value);
  return <span className="block min-w-0 truncate" title={v}>{v}</span>;
}
const statusClassName = (s: string) => {
  if (s === 'APPROVED' || s === 'SOURCE_APPROVED') return 'bg-emerald-50 text-emerald-700 ring-emerald-600/15';
  if (s === 'REJECTED') return 'bg-rose-50 text-rose-700 ring-rose-600/15';
  if (s === 'NC_RAISED') return 'bg-orange-50 text-orange-700 ring-orange-600/15';
  return 'bg-slate-50 text-slate-700 ring-slate-600/15';
};
const csvCell = (v: unknown) => `"${String(v ?? '').replaceAll('"','""')}"`;

export default function ApprovalPipelinePage() {
  const { token } = useAuth();
  const [instQuery, setInstQuery] = useState('');
  const [instQInput, setInstQInput] = useState('');
  const [projQuery, setProjQuery] = useState('');
  const [projQInput, setProjQInput] = useState('');
  const [insts, setInsts] = useState<Institution[]>([]);
  const [projs, setProjs] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { const t=setTimeout(()=>setInstQuery(instQInput.trim()),350); return()=>clearTimeout(t); }, [instQInput]);
  useEffect(() => { const t=setTimeout(()=>setProjQuery(projQInput.trim()),350); return()=>clearTimeout(t); }, [projQInput]);

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const [ir, pr] = await Promise.all([
        InstitutionsAPI.getInstitutions(token, { page: 0, size: 50, q: instQuery || undefined }),
        ProjectsAPI.getProjects(token, { page: 0, size: 50, q: projQuery || undefined }),
      ]);
      setInsts(ir.content);
      setProjs(pr.content);
    } catch (e) { toast.error(getErrorMessage(e, 'Unable to load pipeline.')); }
    finally { setLoading(false); }
  }, [token, instQuery, projQuery]);

  useEffect(() => { void load(); }, [load]);

  const instCounts = useMemo(() => {
    const m = new Map<string, number>();
    insts.forEach(i => m.set(i.empanelmentStatus, (m.get(i.empanelmentStatus) || 0) + 1));
    return Array.from(m.entries()).sort((a,b)=>b[1]-a[1]);
  }, [insts]);

  const projCounts = useMemo(() => {
    const m = new Map<string, number>();
    projs.forEach(p => m.set(p.sourceApprovalStatus, (m.get(p.sourceApprovalStatus) || 0) + 1));
    return Array.from(m.entries()).sort((a,b)=>b[1]-a[1]);
  }, [projs]);

  const [areFiltersVisible, setAreFiltersVisible] = useState(true);
  const [isExporting, setIsExporting] = useState(false);

  const exportInstitutions = () => {
    if (insts.length > 2000) { toast.error('Too many to export — filter first.'); return; }
    setIsExporting(true);
    try {
      const rows = [['Institution','Type','Status','Owner','Jurisdiction'], ...insts.map(i=>[i.institutionName, humanize(i.institutionType), humanize(i.empanelmentStatus), i.assignedEmployeeName || '', i.jurisdiction || ''])];
      const blob = new Blob([rows.map(r=>r.map(csvCell).join(',')).join('\n')], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob); const a=document.createElement('a'); a.href=url; a.download='institutions.csv'; document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
      toast.success(`Exported ${insts.length} institutions.`);
    } catch (e) { toast.error(getErrorMessage(e,'Unable to export.')); } finally { setIsExporting(false); }
  };
  const exportProjects = () => {
    if (projs.length > 2000) { toast.error('Too many to export — filter first.'); return; }
    setIsExporting(true);
    try {
      const rows = [['Project','Type','Status','Owner','Location'], ...projs.map(p=>[p.projectName, humanize(p.projectType), humanize(p.sourceApprovalStatus), p.assignedEmployeeName || '', p.locationText || ''])];
      const blob = new Blob([rows.map(r=>r.map(csvCell).join(',')).join('\n')], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob); const a=document.createElement('a'); a.href=url; a.download='projects.csv'; document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
      toast.success(`Exported ${projs.length} projects.`);
    } catch (e) { toast.error(getErrorMessage(e,'Unable to export.')); } finally { setIsExporting(false); }
  };

  const [activeTab, setActiveTab] = useState<'institutions' | 'projects'>('institutions');

  if (loading) return <div className="space-y-2">{Array.from({length:4}).map((_,i)=><Skeleton key={i} className="h-20 w-full" />)}</div>;

  return (
    <div className="mx-auto w-full max-w-none space-y-4 py-4">
      <Tabs value={activeTab} onValueChange={(v)=>setActiveTab(v as any)}>
        <TabsList>
          <TabsTrigger value="institutions">Institutions ({insts.length})</TabsTrigger>
          <TabsTrigger value="projects">Projects ({projs.length})</TabsTrigger>
        </TabsList>
        <TabsContent value="institutions" className="space-y-4">
          {areFiltersVisible ? (
            <>
              <div className="mt-3 flex flex-col gap-2 lg:flex-row lg:items-center">
                <div className="min-w-0 flex-1">
                  <Label htmlFor="inst-search" className="sr-only">Search institution</Label>
                  <div className="relative">
                    <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                    <Input id="inst-search" type="search" autoComplete="off" placeholder="Search institution…" value={instQInput} onChange={e=>setInstQInput(e.target.value)} className="h-8 bg-background pl-8 pr-8 text-xs shadow-none" />
                    {instQInput && <button type="button" onClick={()=>{setInstQInput(''); setInstQuery('');}} className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded p-1 text-muted-foreground hover:bg-muted"><X className="h-3.5 w-3.5" /></button>}
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <Button variant="outline" size="icon" className="h-8 w-8 shadow-none" onClick={()=>setAreFiltersVisible(false)} aria-label="Hide filters"><Filter className="h-4 w-4" /></Button>
                  <Button variant="outline" size="icon" className="h-8 w-8 shadow-none" onClick={()=>void exportInstitutions()} disabled={isExporting} aria-label="Export institutions">{isExporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <DownloadIcon className="h-4 w-4" />}</Button>
                </div>
              </div>
              <hr className="my-3 border-border" />
            </>
          ) : (
            <div className="mt-3 flex items-center justify-end gap-2">
              <Button variant="outline" size="icon" className="h-8 w-8 shadow-none" onClick={()=>setAreFiltersVisible(true)} aria-label="Show filters"><Filter className="h-4 w-4" /></Button>
              <Button variant="outline" size="icon" className="h-8 w-8 shadow-none" onClick={()=>void exportInstitutions()} disabled={isExporting} aria-label="Export institutions">{isExporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <DownloadIcon className="h-4 w-4" />}</Button>
            </div>
          )}
          <div className="overflow-x-auto">
            <Table className="table-fixed text-xs">
              <colgroup><col className="w-[30%]" /><col className="w-[18%]" /><col className="w-[18%]" /><col className="w-[18%]" /><col className="w-[16%]" /></colgroup>
              <TableHeader><TableRow>{['Institution','Type','Status','Owner','Actions'].map(h=><TableHead key={h} className={`overflow-hidden text-ellipsis whitespace-nowrap ${h==='Actions'?'text-right':''}`}>{h}</TableHead>)}</TableRow></TableHeader>
              <TableBody>
                {insts.length===0 ? <TableRow><TableCell colSpan={5} className="h-24 text-center text-muted-foreground">No institutions for this status</TableCell></TableRow> :
                  insts.slice(0,10).map(inst=>(
                    <TableRow key={inst.id}>
                      <TableCell className="font-medium"><Ellipsis value={inst.institutionName} /></TableCell>
                      <TableCell><Ellipsis value={humanize(inst.institutionType)} /></TableCell>
                      <TableCell><span className={`inline-flex max-w-full truncate rounded-full px-2 py-0.5 text-[11px] font-medium ring-1 ring-inset ${statusClassName(inst.empanelmentStatus)}`}>{humanize(inst.empanelmentStatus)}</span></TableCell>
                      <TableCell><Ellipsis value={inst.assignedEmployeeName || `Emp #${inst.assignedEmployeeId}`} /></TableCell>
                      <TableCell><div className="flex justify-end"><Button size="sm" variant="ghost" className="h-7 px-2 text-xs" asChild><Link href={`/dashboard/institutions/${inst.id}`}>View</Link></Button></div></TableCell>
                    </TableRow>
                  ))}
              </TableBody>
            </Table>
          </div>
          {insts.length>10 && <p className="pt-2 text-xs text-muted-foreground">Showing 10 of {insts.length} — search to narrow.</p>}
        </TabsContent>
        <TabsContent value="projects" className="space-y-4">
          {areFiltersVisible ? (
            <>
              <div className="mt-3 flex flex-col gap-2 lg:flex-row lg:items-center">
                <div className="min-w-0 flex-1">
                  <Label htmlFor="proj-search" className="sr-only">Search project</Label>
                  <div className="relative">
                    <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                    <Input id="proj-search" type="search" autoComplete="off" placeholder="Search project…" value={projQInput} onChange={e=>setProjQInput(e.target.value)} className="h-8 bg-background pl-8 pr-8 text-xs shadow-none" />
                    {projQInput && <button type="button" onClick={()=>{setProjQInput(''); setProjQuery('');}} className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded p-1 text-muted-foreground hover:bg-muted"><X className="h-3.5 w-3.5" /></button>}
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <Button variant="outline" size="icon" className="h-8 w-8 shadow-none" onClick={()=>setAreFiltersVisible(false)} aria-label="Hide filters"><Filter className="h-4 w-4" /></Button>
                  <Button variant="outline" size="icon" className="h-8 w-8 shadow-none" onClick={()=>void exportProjects()} disabled={isExporting} aria-label="Export projects">{isExporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <DownloadIcon className="h-4 w-4" />}</Button>
                </div>
              </div>
              <hr className="my-3 border-border" />
            </>
          ) : (
            <div className="mt-3 flex items-center justify-end gap-2">
              <Button variant="outline" size="icon" className="h-8 w-8 shadow-none" onClick={()=>setAreFiltersVisible(true)} aria-label="Show filters"><Filter className="h-4 w-4" /></Button>
              <Button variant="outline" size="icon" className="h-8 w-8 shadow-none" onClick={()=>void exportProjects()} disabled={isExporting} aria-label="Export projects">{isExporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <DownloadIcon className="h-4 w-4" />}</Button>
            </div>
          )}
          <div className="overflow-x-auto">
            <Table className="table-fixed text-xs">
              <colgroup><col className="w-[30%]" /><col className="w-[18%]" /><col className="w-[18%]" /><col className="w-[18%]" /><col className="w-[16%]" /></colgroup>
              <TableHeader><TableRow>{['Project','Type','Status','Owner','Actions'].map(h=><TableHead key={h} className={`overflow-hidden text-ellipsis whitespace-nowrap ${h==='Actions'?'text-right':''}`}>{h}</TableHead>)}</TableRow></TableHeader>
              <TableBody>
                {projs.length===0 ? <TableRow><TableCell colSpan={5} className="h-24 text-center text-muted-foreground">No projects for this status</TableCell></TableRow> :
                  projs.slice(0,10).map(proj=>(
                    <TableRow key={proj.id}>
                      <TableCell className="font-medium"><Ellipsis value={proj.projectName} /></TableCell>
                      <TableCell><Ellipsis value={humanize(proj.projectType)} /></TableCell>
                      <TableCell><span className={`inline-flex max-w-full truncate rounded-full px-2 py-0.5 text-[11px] font-medium ring-1 ring-inset ${statusClassName(proj.sourceApprovalStatus)}`}>{humanize(proj.sourceApprovalStatus)}</span></TableCell>
                      <TableCell><Ellipsis value={proj.assignedEmployeeName || `Emp #${proj.assignedEmployeeId}`} /></TableCell>
                      <TableCell><div className="flex justify-end"><Button size="sm" variant="ghost" className="h-7 px-2 text-xs" asChild><Link href={`/dashboard/projects/${proj.id}`}>View</Link></Button></div></TableCell>
                    </TableRow>
                  ))}
              </TableBody>
            </Table>
          </div>
          {projs.length>10 && <p className="pt-2 text-xs text-muted-foreground">Showing 10 of {projs.length} — search to narrow.</p>}
        </TabsContent>
      </Tabs>

      <p className="text-xs text-muted-foreground">Stage changes happen in detail pages (gated Advance). This overview shows where the business is stuck.</p>
    </div>
  );
}
