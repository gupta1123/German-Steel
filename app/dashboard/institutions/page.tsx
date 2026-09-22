'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { ChevronLeft, ChevronRight, DownloadIcon, Filter, Loader2, Search, X } from 'lucide-react';
import { toast } from 'sonner';

import { useAuth } from '@/components/auth-provider';
import { getErrorMessage } from '@/lib/api-error';
import { InstitutionsAPI, type Institution, type SalesRegion } from '@/lib/institutions-api';
import { RetailAPI, type RetailEmployee } from '@/lib/retail-api';
import AddInstitutionModal from '@/components/AddInstitutionModal';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';

function Ellipsis({ value }: { value: string | number | null | undefined }) {
  const v = value === null || value === undefined || value === '' ? '—' : String(value);
  return <span className="block min-w-0 truncate" title={v}>{v}</span>;
}
const humanize = (value: string | null | undefined) => value ? value.replaceAll('_', ' ').toLowerCase().replace(/\b\w/g, (l) => l.toUpperCase()) : '—';
const formatLastActivity = (value: string | null | undefined): string => {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
};
const statusClassName = (status: Institution['empanelmentStatus']) => {
  if (status === 'APPROVED' || status === 'RENEWAL_DUE') return 'bg-emerald-50 text-emerald-700 ring-emerald-600/15';
  if (status === 'CREDENTIALS_SUBMITTED' || status === 'DOCUMENTS_SUBMITTED' || status === 'UNDER_REVIEW' || status === 'TECHNICAL_VISIT_SCHEDULED' || status === 'NC_CLOSURE_SUBMITTED') return 'bg-amber-50 text-amber-700 ring-amber-600/15';
  if (status === 'NC_RAISED') return 'bg-orange-50 text-orange-700 ring-orange-600/15';
  if (status === 'REJECTED' || status === 'EXPIRED' || status === 'SUSPENDED') return 'bg-rose-50 text-rose-700 ring-rose-600/15';
  return 'bg-slate-50 text-slate-700 ring-slate-600/15';
};

const INSTITUTION_STATUSES: { value: string; label: string }[] = [
  { value: 'ALL', label: 'All Statuses' },
  { value: 'NOT_STARTED', label: 'Not Started' },
  { value: 'CREDENTIALS_SUBMITTED', label: 'Credentials Submitted' },
  { value: 'DOCUMENTS_SUBMITTED', label: 'Documents Submitted' },
  { value: 'UNDER_REVIEW', label: 'Under Review' },
  { value: 'TECHNICAL_VISIT_SCHEDULED', label: 'Technical Visit Scheduled' },
  { value: 'NC_RAISED', label: 'NC Raised' },
  { value: 'NC_CLOSURE_SUBMITTED', label: 'NC Closure Submitted' },
  { value: 'APPROVED', label: 'Approved' },
  { value: 'RENEWAL_DUE', label: 'Renewal Due' },
  { value: 'EXPIRED', label: 'Expired' },
  { value: 'REJECTED', label: 'Rejected' },
  { value: 'SUSPENDED', label: 'Suspended' },
];
const INSTITUTION_TYPES: { value: string; label: string }[] = [
  { value: 'ALL', label: 'All Types' },
  { value: 'GOVERNMENT_DEPARTMENT', label: 'Government Department' },
  { value: 'PUBLIC_SECTOR_UNDERTAKING', label: 'Public Sector Undertaking' },
  { value: 'CORPORATE_INSTITUTE', label: 'Corporate Institute' },
  { value: 'AUTONOMOUS_BODY', label: 'Autonomous Body' },
];

const emptyPage = { content: [] as Institution[], number: 0, size: 10, totalElements: 0, totalPages: 1 };

export default function InstitutionsPage() {
  const { token } = useAuth();
  const [pageData, setPageData] = useState(emptyPage);
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(10);
  const [hasUserChosenPageSize, setHasUserChosenPageSize] = useState(false);

  useEffect(() => {
    if (hasUserChosenPageSize) return;
    const calc = () => {
      setPageSize(10);
    };
    calc();
    window.addEventListener('resize', calc);
    return () => window.removeEventListener('resize', calc);
  }, [hasUserChosenPageSize]);
  const [queryInput, setQueryInput] = useState('');
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState('ALL');
  const [typeFilter, setTypeFilter] = useState('ALL');
  const [ownerFilter, setOwnerFilter] = useState('ALL');
  const [areFiltersVisible, setAreFiltersVisible] = useState(true);
  const [isLoading, setIsLoading] = useState(true);
  const [isExporting, setIsExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [employees, setEmployees] = useState<RetailEmployee[]>([]);
  const [regions, setRegions] = useState<SalesRegion[]>([]);
  const [addOpen, setAddOpen] = useState(false);

  useEffect(() => {
    const t = window.setTimeout(() => { setPage(0); setQuery(queryInput.trim()); }, 350);
    return () => window.clearTimeout(t);
  }, [queryInput]);

  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    RetailAPI.getEmployees(token).then((list: RetailEmployee[]) => { if (!cancelled) setEmployees(list); }).catch(() => {});
    InstitutionsAPI.getRegions(token).then((list) => { if (!cancelled) setRegions(list); }).catch(() => {});
    return () => { cancelled = true; };
  }, [token]);

  // Directory lookups — list APIs return IDs only (no names), so resolve client-side.
  const ownerNameById = useMemo(() => {
    const map = new Map<number, string>();
    for (const e of employees) {
      const name = [e.firstName, e.lastName].filter(Boolean).join(' ').trim();
      if (!map.has(e.id)) map.set(e.id, name || `Employee #${e.id}`);
    }
    return map;
  }, [employees]);
  const regionNameById = useMemo(() => {
    const map = new Map<number, string>();
    for (const r of regions) if (!map.has(r.id)) map.set(r.id, r.name);
    return map;
  }, [regions]);
  const resolveOwnerName = (inst: Pick<Institution, 'assignedEmployeeName' | 'assignedEmployeeId'>): string => {
    if (inst.assignedEmployeeName && inst.assignedEmployeeName !== '—') return inst.assignedEmployeeName;
    if (inst.assignedEmployeeId != null && ownerNameById.has(inst.assignedEmployeeId)) {
      return ownerNameById.get(inst.assignedEmployeeId) as string;
    }
    return inst.assignedEmployeeId != null ? `Employee #${inst.assignedEmployeeId}` : '—';
  };
  const resolveRegionName = (inst: Pick<Institution, 'regionId' | 'regionName'>): string => {
    if (inst.regionId != null && regionNameById.has(inst.regionId)) {
      return regionNameById.get(inst.regionId) as string;
    }
    return inst.regionName && inst.regionName !== '—' ? inst.regionName : '—';
  };

  const load = useCallback(async () => {
    if (!token) return;
    setIsLoading(true); setError(null);
    try {
      const res = await InstitutionsAPI.getInstitutions(token, {
        page, size: pageSize,
        q: query || undefined,
        status: status === 'ALL' ? undefined : status,
        institutionType: typeFilter === 'ALL' ? undefined : typeFilter,
        assignedEmployeeId: ownerFilter === 'ALL' ? undefined : Number(ownerFilter),
      });
      setPageData(res);
    } catch (err) {
      setPageData(emptyPage);
      const msg = getErrorMessage(err, 'Unable to load institutions.');
      setError(msg); toast.error(msg);
    } finally { setIsLoading(false); }
  }, [token, page, pageSize, query, status, typeFilter, ownerFilter]);

  useEffect(() => { void load(); }, [load]);

  const exportInstitutions = async () => {
    if (!token) return;
    if (pageData.totalElements > 2000) { toast.error('Too many records to export — narrow the filters first.'); return; }
    setIsExporting(true);
    try {
      const first = await InstitutionsAPI.getInstitutions(token, { page: 0, size: 500, q: query || undefined, status: status === 'ALL' ? undefined : status, institutionType: typeFilter === 'ALL' ? undefined : typeFilter, assignedEmployeeId: ownerFilter === 'ALL' ? undefined : Number(ownerFilter) });
      const all = [...first.content];
      for (let i = 1; i < first.totalPages; i += 1) {
        const next = await InstitutionsAPI.getInstitutions(token, { page: i, size: first.size, q: query || undefined, status: status === 'ALL' ? undefined : status, institutionType: typeFilter === 'ALL' ? undefined : typeFilter, assignedEmployeeId: ownerFilter === 'ALL' ? undefined : Number(ownerFilter) });
        all.push(...next.content);
      }
      const csvCell = (v: unknown) => `"${String(v ?? '').replaceAll('"', '""')}"`;
      const rows = [
        ['Institution', 'Location', 'Type', 'Owner', 'Status', 'Applied On'],
        ...all.map((a) => [a.institutionName, `${humanize(a.jurisdiction)}, ${humanize(a.state)}`, humanize(a.institutionType), resolveOwnerName(a), a.empanelmentStatus, a.applicationDate ?? '']),
      ];
      const blob = new Blob([rows.map((r) => r.map(csvCell).join(',')).join('\n')], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob); const anchor = document.createElement('a'); anchor.href = url; anchor.download = 'institutions.csv'; document.body.appendChild(anchor); anchor.click(); anchor.remove(); URL.revokeObjectURL(url);
      toast.success(`Exported ${all.length} institutions.`);
    } catch (err) { toast.error(getErrorMessage(err, 'Unable to export institutions.')); } finally { setIsExporting(false); }
  };

  return (
    <div className="mx-auto w-full max-w-none py-4">
      {areFiltersVisible ? (
        <>
          <div className="mb-3 flex flex-col gap-2 lg:flex-row lg:items-center">
            <div className="min-w-0 flex-1">
              <Label htmlFor="institution-search" className="sr-only">Search institutions</Label>
              <div className="relative">
                <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                <Input id="institution-search" type="search" autoComplete="off" placeholder="Search institution, jurisdiction…" value={queryInput} onChange={(e) => setQueryInput(e.target.value)} className="h-8 bg-background pl-8 pr-8 text-xs shadow-none" />
                {queryInput && (
                  <button type="button" onClick={() => { setQueryInput(''); setQuery(''); setPage(0); }} className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded p-1 text-muted-foreground hover:bg-muted" aria-label="Clear search"><X className="h-3.5 w-3.5" /></button>
                )}
              </div>
            </div>
            <div className="min-w-0 flex-1">
              <Label className="sr-only">Status</Label>
              <Select value={status} onValueChange={(v) => { setPage(0); setStatus(v); }}>
                <SelectTrigger className="h-8 w-full bg-background text-xs shadow-none"><SelectValue placeholder="Status" /></SelectTrigger>
                <SelectContent>{INSTITUTION_STATUSES.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="min-w-0 flex-1">
              <Label className="sr-only">Type</Label>
              <Select value={typeFilter} onValueChange={(v) => { setPage(0); setTypeFilter(v); }}>
                <SelectTrigger className="h-8 w-full bg-background text-xs shadow-none"><SelectValue placeholder="Type" /></SelectTrigger>
                <SelectContent>{INSTITUTION_TYPES.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="min-w-0 flex-1">
              <Label className="sr-only">Owner</Label>
              <Select value={ownerFilter} onValueChange={(v) => { setPage(0); setOwnerFilter(v); }}>
                <SelectTrigger className="h-8 w-full bg-background text-xs shadow-none"><SelectValue placeholder="Owner" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">All Owners</SelectItem>
                  {employees.slice(0, 80).map((e) => (
                    <SelectItem key={e.id} value={String(e.id)}>{[e.firstName, e.lastName].filter(Boolean).join(' ') || `Employee #${e.id}`}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <span className="hidden text-xs text-muted-foreground xl:inline">{pageData.totalElements} institutions</span>
              <Button variant="outline" size="icon" className="h-8 w-8 shadow-none" onClick={() => setAreFiltersVisible(false)} aria-label="Hide filters" title="Hide filters">
                <Filter className="h-4 w-4" />
              </Button>
              <Button variant="outline" size="icon" className="h-8 w-8 shadow-none" onClick={() => void exportInstitutions()} disabled={isExporting} aria-label="Export institutions" title="Export institutions">
                {isExporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <DownloadIcon className="h-4 w-4" />}
              </Button>
              <Button size="sm" className="h-8 text-xs" onClick={() => setAddOpen(true)}>
                Create Institution
              </Button>
            </div>
          </div>
          <hr className="mb-4 border-border" />
        </>
      ) : (
        <div className="mb-4 flex items-center justify-end gap-2">
          <Button variant="outline" size="icon" className="h-8 w-8 shadow-none" onClick={() => setAreFiltersVisible(true)} aria-label="Show filters" title="Show filters">
            <Filter className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="icon" className="h-8 w-8 shadow-none" onClick={() => void exportInstitutions()} disabled={isExporting} aria-label="Export institutions" title="Export institutions">
            {isExporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <DownloadIcon className="h-4 w-4" />}
          </Button>
          <Button size="sm" className="h-8 text-xs" onClick={() => setAddOpen(true)}>
            Create Institution
          </Button>
        </div>
      )}

      {error && <div className="mb-3 rounded-md border border-red-200 bg-red-50 p-2.5 text-sm text-red-700" role="alert">{error}</div>}

      <div className="overflow-x-auto">
        <Table className="table-fixed text-xs">
          <colgroup>
            <col className="w-[23%]" />
            <col className="w-[14%]" />
            <col className="w-[20%]" />
            <col className="w-[12%]" />
            <col className="w-[12%]" />
            <col className="w-[11%]" />
            <col className="w-[8%]" />
          </colgroup>
          <TableHeader>
            <TableRow>
              {['Institution', 'Location', 'Type', 'Owner', 'Approval Status', 'Applied On', 'Actions'].map((h) => (
                <TableHead key={h} className="overflow-hidden text-ellipsis whitespace-nowrap" title={h}>{h}</TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              Array.from({ length: pageSize }, (_, i) => (
                <TableRow key={`sk-${i}`}>{Array.from({ length: 7 }, (_, c) => <TableCell key={c}><Skeleton className="h-4 w-full max-w-24" /></TableCell>)}</TableRow>
              ))
            ) : pageData.content.length === 0 ? (
              <TableRow><TableCell colSpan={7} className="h-24 text-center text-muted-foreground">No institutions match the selected filters</TableCell></TableRow>
            ) : (
              pageData.content.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="font-medium"><Ellipsis value={r.institutionName} /></TableCell>
                  <TableCell>
                    <Ellipsis value={humanize(r.jurisdiction)} />
                    <span className="block truncate text-[11px] text-muted-foreground" title={`${humanize(r.state)} · ${resolveRegionName(r)}`}>{humanize(r.state)} · {resolveRegionName(r)}</span>
                  </TableCell>
                  <TableCell><Ellipsis value={humanize(r.institutionType)} /></TableCell>
                  <TableCell><Ellipsis value={resolveOwnerName(r)} /></TableCell>
                  <TableCell>
                    <span className={`inline-flex max-w-full truncate rounded-full px-2 py-0.5 text-[11px] font-medium ring-1 ring-inset ${statusClassName(r.empanelmentStatus)}`}>
                      {humanize(r.empanelmentStatus)}
                    </span>
                    {!r.active && <span className="mt-1 block text-[11px] text-muted-foreground">Inactive</span>}
                  </TableCell>
                  <TableCell><Ellipsis value={formatLastActivity(r.applicationDate)} /></TableCell>
                  <TableCell>
                    <div className="flex items-center justify-end">
                      <Button variant="ghost" size="sm" className="h-7 px-2 text-xs" asChild>
                        <Link href={`/dashboard/institutions/${r.id}`}>View</Link>
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-xs">
          <Label htmlFor="institution-page-size" className="text-xs">Rows per page:</Label>
          <Select value={String(pageSize)} onValueChange={(v) => { setHasUserChosenPageSize(true); setPage(0); setPageSize(Number(v)); }}>
            <SelectTrigger id="institution-page-size" className="h-8 w-20 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>{[10, 12, 15, 20, 25, 50, 100].map((n) => <SelectItem key={n} value={String(n)}>{String(n)}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" className="h-8" onClick={() => setPage((p) => Math.max(0, p - 1))} disabled={page <= 0 || isLoading}>
            <ChevronLeft className="h-4 w-4" /><span className="hidden sm:inline">Previous</span>
          </Button>
          <span className="text-xs text-muted-foreground">Page {pageData.number + 1} of {Math.max(1, pageData.totalPages)}</span>
          <Button variant="outline" size="sm" className="h-8" onClick={() => setPage((p) => p + 1)} disabled={page + 1 >= pageData.totalPages || isLoading}>
            <span className="hidden sm:inline">Next</span><ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {token && (
        <AddInstitutionModal
          isOpen={addOpen}
          onClose={() => setAddOpen(false)}
          token={token}
          onCreated={() => { setAddOpen(false); setPage(0); void load(); }}
        />
      )}
    </div>
  );
}
