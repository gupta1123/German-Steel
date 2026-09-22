'use client';

import { Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { ChevronLeft, ChevronRight, DownloadIcon, Filter, Loader2, Plus, Search, Trash2, X } from 'lucide-react';
import { toast } from 'sonner';

import AddCustomerModal from '@/components/AddCustomerModal';
import { useAuth } from '@/components/auth-provider';
import { getErrorMessage } from '@/lib/api-error';
import { RetailAPI, type ApiPage, type RetailAccount } from '@/lib/retail-api';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';

const emptyPage: ApiPage<RetailAccount> = { content: [], number: 0, size: 10, totalElements: 0, totalPages: 1 };

function Ellipsis({ value }: { value: string | number | null | undefined }) {
  const displayValue = value === null || value === undefined || value === '' ? '—' : String(value);
  return <span className="block min-w-0 truncate" title={displayValue}>{displayValue}</span>;
}

const humanize = (value: string | null | undefined) =>
  value ? value.replaceAll('_', ' ').toLowerCase().replace(/\b\w/g, (l) => l.toUpperCase()) : '—';

const formatLastActivity = (value: string | null | undefined): string => {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
};

const statusClassName = (status: RetailAccount['accountStatus']) => {
  if (status === 'ACTIVE') return 'bg-emerald-50 text-emerald-700 ring-emerald-600/15';
  if (status === 'PROSPECT') return 'bg-sky-50 text-sky-700 ring-sky-600/15';
  if (status === 'DORMANT') return 'bg-amber-50 text-amber-700 ring-amber-600/15';
  return 'bg-rose-50 text-rose-700 ring-rose-600/15';
};

const csvCell = (value: unknown) => `"${String(value ?? '').replaceAll('"', '""')}"`;

function CustomersPageContent() {
  const { token, userData, userRole } = useAuth();
  const searchParams = useSearchParams();
  const presetGroupId = searchParams?.get('groupId') ?? '';
  const [pageData, setPageData] = useState<ApiPage<RetailAccount>>(emptyPage);
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(10);
  const [hasUserChosenPageSize, setHasUserChosenPageSize] = useState(false);

  // Default to 10 rows per page as requested — no viewport auto-fill.
  useEffect(() => {
    if (hasUserChosenPageSize) return;
    const calc = () => {
      setPageSize(10);
      return;
      const h = window.innerHeight;
      const w = window.innerWidth;
      // Approximate: header+filters+pagination ~ 320px, row ~ 36px inc. borders
      const available = h - 320;
      const byHeight = Math.floor(available / 36);
      let target = 10;
      if (w >= 1536) target = Math.max(target, 20);
      else if (w >= 1280) target = Math.max(target, 15);
      if (byHeight >= 18) target = Math.max(target, 20);
      else if (byHeight >= 14) target = Math.max(target, 15);
      else if (byHeight >= 10) target = Math.max(target, 12);
      target = Math.min(100, Math.max(5, target));
      // Snap to nearest offered size to keep selector in sync (10/15/20 map to 10/25/50 buckets)
      const snap = target <= 10 ? 10 : target <= 12 ? 12 : target <= 15 ? 15 : target <= 20 ? 20 : 25;
      // Only use sizes the UI offers (10,25,50,100) unless snapped intermediate — allow intermediate for auto fill
      setPageSize((prev) => (prev === snap ? prev : snap));
    };
    calc();
    window.addEventListener('resize', calc);
    return () => window.removeEventListener('resize', calc);
  }, [hasUserChosenPageSize]);
  const [queryInput, setQueryInput] = useState('');
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState('ALL');
  const [clientType, setClientType] = useState('ALL');
  const [activeFilter, setActiveFilter] = useState('ACTIVE');
  const [areFiltersVisible, setAreFiltersVisible] = useState(true);
  const [isLoading, setIsLoading] = useState(true);
  const [isExporting, setIsExporting] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<RetailAccount | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [employees, setEmployees] = useState<{ id: number; firstName: string; lastName: string }[]>([]);

  useEffect(() => {
    if (searchParams?.get('create') === '1') setAddOpen(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setPage(0);
      setQuery(queryInput.trim());
    }, 350);
    return () => window.clearTimeout(timer);
  }, [queryInput]);

  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    RetailAPI.getEmployees(token).then((list) => {
      if (!cancelled) setEmployees(list.map((e) => ({ id: e.id, firstName: e.firstName, lastName: e.lastName })));
    }).catch(() => {});
    return () => { cancelled = true; };
  }, [token]);

  const ownerNameById = useMemo(() => {
    const map = new Map<number, string>();
    for (const e of employees) {
      const name = [e.firstName, e.lastName].filter(Boolean).join(' ').trim();
      if (!map.has(e.id)) map.set(e.id, name || `Employee #${e.id}`);
    }
    return map;
  }, [employees]);
  const resolveOwnerName = (r: Pick<RetailAccount, 'ownerEmployeeName' | 'ownerEmployeeId'>): string => {
    if (r.ownerEmployeeName && r.ownerEmployeeName.trim() && r.ownerEmployeeName !== '—') return r.ownerEmployeeName;
    if (r.ownerEmployeeId != null && ownerNameById.has(r.ownerEmployeeId)) return ownerNameById.get(r.ownerEmployeeId) as string;
    return r.ownerEmployeeId ? `Employee #${r.ownerEmployeeId}` : '—';
  };

  const loadAccounts = useCallback(async () => {
    if (!token) return;
    setIsLoading(true);
    setError(null);
    try {
      const result = await RetailAPI.getAccounts(token, {
        page,
        size: pageSize,
        q: query || undefined,
        active: activeFilter === 'ALL' ? undefined : activeFilter === 'ACTIVE',
        accountStatus: status === 'ALL' ? undefined : status,
        clientType: clientType === 'ALL' ? undefined : clientType,
      });
      setPageData(result);
    } catch (err) {
      setPageData(emptyPage);
      const msg = getErrorMessage(err, 'Unable to load retailers.');
      setError(msg);
      toast.error(msg);
    } finally {
      setIsLoading(false);
    }
  }, [token, page, pageSize, query, activeFilter, status, clientType]);

  useEffect(() => { void loadAccounts(); }, [loadAccounts]);

  const confirmDelete = async () => {
    if (!token || !deleteTarget) return;
    setIsDeleting(true);
    try {
      await RetailAPI.deleteAccount(deleteTarget.id, token);
      toast.success(`${deleteTarget.accountName} deactivated.`);
      setDeleteTarget(null);
      await loadAccounts();
    } catch (err) {
      toast.error(getErrorMessage(err, 'Unable to deactivate retailer.'));
    } finally {
      setIsDeleting(false);
    }
  };

  const exportCustomers = async () => {
    if (!token) return;
    if (pageData.totalElements > 2000) {
      toast.error('Too many records to export — narrow the filters first.');
      return;
    }
    setIsExporting(true);
    try {
      const first = await RetailAPI.getAccounts(token, {
        page: 0, size: 500,
        q: query || undefined,
        active: activeFilter === 'ALL' ? undefined : activeFilter === 'ACTIVE',
        accountStatus: status === 'ALL' ? undefined : status,
        clientType: clientType === 'ALL' ? undefined : clientType,
      });
      const all = [...first.content];
      for (let i = 1; i < first.totalPages; i += 1) {
        const next = await RetailAPI.getAccounts(token, {
          page: i, size: first.size,
          q: query || undefined,
          active: activeFilter === 'ALL' ? undefined : activeFilter === 'ACTIVE',
          accountStatus: status === 'ALL' ? undefined : status,
          clientType: clientType === 'ALL' ? undefined : clientType,
        });
        all.push(...next.content);
      }
      const rows = [
        ['Retailer', 'Location', 'Retailer Type', 'Owner', 'Status', 'Tier', 'Monthly Sales', 'Last Activity'],
        ...all.map((a) => [
          a.accountName,
          [humanize(a.addressCity), humanize(a.addressState)].filter((v) => v && v !== '—').join(', '),
          humanize(a.clientType), resolveOwnerName(a),
          humanize(a.accountStatus), a.clientTier ?? '', a.declaredMonthlySalesMt ?? '', formatLastActivity(a.updatedAt || a.createdAt),
        ]),
      ];
      const blob = new Blob([rows.map((r) => r.map(csvCell).join(',')).join('\n')], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'retailers.csv';
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      toast.success(`Exported ${all.length} retailers.`);
    } catch (err) {
      toast.error(getErrorMessage(err, 'Unable to export retailers.'));
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="mx-auto w-full max-w-none py-4">
      {areFiltersVisible ? (
        <>
          <div className="mb-3 flex flex-col gap-2 lg:flex-row lg:items-center">
            <div className="min-w-0 flex-1">
              <Label htmlFor="retailer-search" className="sr-only">Search retailers</Label>
              <div className="relative">
                <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="retailer-search"
                  type="search"
                  autoComplete="off"
                  placeholder="Search retailer, GSTIN, location…"
                  value={queryInput}
                  onChange={(e) => setQueryInput(e.target.value)}
                  className="h-8 bg-background pl-8 pr-8 text-xs shadow-none"
                />
                {queryInput && (
                  <button
                    type="button"
                    onClick={() => { setQueryInput(''); setQuery(''); setPage(0); }}
                    className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded p-1 text-muted-foreground hover:bg-muted"
                    aria-label="Clear search"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            </div>

            <div className="min-w-0 flex-1">
              <Label className="sr-only">Status</Label>
              <Select value={status} onValueChange={(v) => { setPage(0); setStatus(v); }}>
                <SelectTrigger className="h-8 w-full bg-background text-xs shadow-none"><SelectValue placeholder="Status" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">All Statuses</SelectItem>
                  <SelectItem value="PROSPECT">Prospect</SelectItem>
                  <SelectItem value="ACTIVE">Active</SelectItem>
                  <SelectItem value="DORMANT">Dormant</SelectItem>
                  <SelectItem value="LOST">Lost</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="min-w-0 flex-1">
              <Label className="sr-only">Retailer type</Label>
              <Select value={clientType} onValueChange={(v) => { setPage(0); setClientType(v); }}>
                <SelectTrigger className="h-8 w-full bg-background text-xs shadow-none"><SelectValue placeholder="Retailer type" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">All Types</SelectItem>
                  <SelectItem value="DEALER">Dealer</SelectItem>
                  <SelectItem value="DISTRIBUTOR">Distributor</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="min-w-0 flex-1">
              <Label className="sr-only">Record state</Label>
              <Select value={activeFilter} onValueChange={(v) => { setPage(0); setActiveFilter(v); }}>
                <SelectTrigger className="h-8 w-full bg-background text-xs shadow-none"><SelectValue placeholder="Record state" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="ACTIVE">Active</SelectItem>
                  <SelectItem value="INACTIVE">Inactive</SelectItem>
                  <SelectItem value="ALL">All Records</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <span className="hidden text-xs text-muted-foreground xl:inline">{pageData.totalElements} retailers</span>
              <Button variant="outline" size="icon" className="h-8 w-8 shadow-none" onClick={() => setAreFiltersVisible(false)} aria-label="Hide filters" title="Hide filters">
                <Filter className="h-4 w-4" />
              </Button>
              <Button variant="outline" size="icon" className="h-8 w-8 shadow-none" onClick={() => void exportCustomers()} disabled={isExporting} aria-label="Export retailers" title="Export retailers">
                {isExporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <DownloadIcon className="h-4 w-4" />}
              </Button>
              <Button size="sm" className="h-8 text-xs" onClick={() => setAddOpen(true)}>
                <Plus className="mr-2 h-4 w-4" />Create Retailer
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
          <Button variant="outline" size="icon" className="h-8 w-8 shadow-none" onClick={() => void exportCustomers()} disabled={isExporting} aria-label="Export retailers" title="Export retailers">
            {isExporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <DownloadIcon className="h-4 w-4" />}
          </Button>
          <Button size="sm" className="h-8 text-xs" onClick={() => setAddOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />Create Retailer
          </Button>
        </div>
      )}

      {error && <div className="mb-3 rounded-md border border-red-200 bg-red-50 p-2.5 text-sm text-red-700" role="alert">{error}</div>}

      <div className="overflow-x-auto">
        <Table className="table-fixed text-xs">
          <colgroup>
            <col className="w-[16%]" />
            <col className="w-[13%]" />
            <col className="w-[9%]" />
            <col className="w-[13%]" />
            <col className="w-[11%]" />
            <col className="w-[7%]" />
            <col className="w-[9%]" />
            <col className="w-[10%]" />
            <col className="w-[12%]" />
          </colgroup>
          <TableHeader>
            <TableRow>
              {['Retailer', 'Location', 'Retailer Type', 'Owner', 'Status', 'Tier', 'Monthly Sales', 'Last Activity', 'Actions'].map((h) => (
                <TableHead key={h} className={`overflow-hidden text-ellipsis whitespace-nowrap ${h === 'Actions' ? 'text-right' : h === 'Last Activity' ? 'pl-3' : ''}`} title={h}>{h}</TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              Array.from({ length: pageSize }, (_, i) => (
                <TableRow key={`sk-${i}`}>{Array.from({ length: 9 }, (_, c) => <TableCell key={c}><Skeleton className="h-4 w-full max-w-24" /></TableCell>)}</TableRow>
              ))
            ) : pageData.content.length === 0 ? (
              <TableRow>
                <TableCell colSpan={9} className="h-24 text-center text-muted-foreground">
                  No retailers match the selected filters
                </TableCell>
              </TableRow>
            ) : (
              pageData.content.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="font-medium"><Ellipsis value={r.accountName} /></TableCell>
                  <TableCell>
                    <Ellipsis value={humanize(r.addressCity) || '—'} />
                    <span className="block truncate text-[11px] text-muted-foreground" title={humanize(r.addressState) || ''}>
                      {humanize(r.addressState) || '—'}
                    </span>
                  </TableCell>
                  <TableCell><Ellipsis value={humanize(r.clientType)} /></TableCell>
                  <TableCell><Ellipsis value={resolveOwnerName(r)} /></TableCell>
                  <TableCell>
                    <span className={`inline-flex max-w-full truncate rounded-full px-2 py-0.5 text-[11px] font-medium ring-1 ring-inset ${statusClassName(r.accountStatus)}`}>
                      {humanize(r.accountStatus)}
                    </span>
                    {!r.active && <span className="mt-1 block text-[11px] text-muted-foreground">Inactive</span>}
                  </TableCell>
                  <TableCell className="text-center"><Ellipsis value={r.clientTier || '—'} /></TableCell>
                  <TableCell><Ellipsis value={r.declaredMonthlySalesMt != null ? `${r.declaredMonthlySalesMt} MT` : '—'} /></TableCell>
                  <TableCell className="pl-3"><Ellipsis value={formatLastActivity(r.updatedAt || r.createdAt)} /></TableCell>
                  <TableCell>
                    <div className="flex items-center justify-end gap-1">
                      <Button variant="ghost" size="sm" className="h-7 px-2 text-xs" asChild>
                        <Link href={`/dashboard/customers/${r.id}`}>View</Link>
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive"
                        aria-label={`Deactivate ${r.accountName}`}
                        disabled={!r.active}
                        onClick={() => setDeleteTarget(r)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
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
          <Label htmlFor="retailer-page-size" className="text-xs">Rows per page:</Label>
          <Select value={String(pageSize)} onValueChange={(v) => { setHasUserChosenPageSize(true); setPage(0); setPageSize(Number(v)); }}>
            <SelectTrigger id="retailer-page-size" className="h-8 w-20 text-xs"><SelectValue /></SelectTrigger>
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
        <AddCustomerModal
          key={presetGroupId || 'no-group'}
          isOpen={addOpen}
          onClose={() => setAddOpen(false)}
          token={token}
          employeeId={userData?.employeeId ?? null}
          userRole={userRole ?? undefined}
          userData={userData ? { ...userData } as Record<string, unknown> : undefined}
          initialGroupId={presetGroupId || undefined}
          onCustomerAdded={() => { setAddOpen(false); setPage(0); void loadAccounts(); }}
        />
      )}

      <Dialog open={Boolean(deleteTarget)} onOpenChange={(open) => !open && !isDeleting && setDeleteTarget(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Deactivate retailer?</DialogTitle><DialogDescription>This will mark the retailer as inactive. The record remains in history and can be reactivated.</DialogDescription></DialogHeader>
          {deleteTarget && (
            <div className="rounded-md border bg-muted/30 px-3 py-2 text-sm">
              <span className="font-medium">{deleteTarget.accountName}</span>
              <span className="text-muted-foreground"> · #{deleteTarget.id}</span>
              {deleteTarget.gstNumber && <span className="text-muted-foreground"> · {deleteTarget.gstNumber}</span>}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)} disabled={isDeleting}>Cancel</Button>
            <Button variant="destructive" onClick={() => void confirmDelete()} disabled={isDeleting}>
              {isDeleting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Deactivate
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default function CustomersPage() {
  return (
    <Suspense fallback={<div className="flex min-h-[320px] items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>}>
      <CustomersPageContent />
    </Suspense>
  );
}
