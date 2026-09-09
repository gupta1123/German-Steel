'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Download, Eye, Loader2, Plus, RefreshCw, Search, Trash2, Users } from 'lucide-react';
import { toast } from 'sonner';

import AddCustomerModal from '@/components/AddCustomerModal';
import { useAuth } from '@/components/auth-provider';
import { getErrorMessage } from '@/lib/api-error';
import { RetailAPI, type ApiPage, type RetailAccount } from '@/lib/retail-api';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

const PAGE_SIZE = 20;
const emptyPage: ApiPage<RetailAccount> = { content: [], number: 0, size: PAGE_SIZE, totalElements: 0, totalPages: 1 };

const humanize = (value: string | null | undefined) => value ? value.replaceAll('_', ' ').toLowerCase().replace(/\b\w/g, (letter) => letter.toUpperCase()) : '—';
const money = (value: number) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(value || 0);

const statusClass = (status: RetailAccount['accountStatus']) => ({
  ACTIVE: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  PROSPECT: 'border-blue-200 bg-blue-50 text-blue-700',
  DORMANT: 'border-amber-200 bg-amber-50 text-amber-700',
  LOST: 'border-rose-200 bg-rose-50 text-rose-700',
}[status]);

const csvCell = (value: unknown) => `"${String(value ?? '').replaceAll('"', '""')}"`;

export default function CustomersPage() {
  const router = useRouter();
  const { token, userData, userRole } = useAuth();
  const [pageData, setPageData] = useState<ApiPage<RetailAccount>>(emptyPage);
  const [page, setPage] = useState(0);
  const [queryInput, setQueryInput] = useState('');
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState('ALL');
  const [clientType, setClientType] = useState('ALL');
  const [activeFilter, setActiveFilter] = useState('ACTIVE');
  const [isLoading, setIsLoading] = useState(true);
  const [isExporting, setIsExporting] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<RetailAccount | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setPage(0);
      setQuery(queryInput.trim());
    }, 350);
    return () => window.clearTimeout(timer);
  }, [queryInput]);

  const loadAccounts = useCallback(async () => {
    if (!token) return;
    setIsLoading(true);
    try {
      const result = await RetailAPI.getAccounts(token, {
        page,
        size: PAGE_SIZE,
        q: query || undefined,
        active: activeFilter === 'ALL' ? undefined : activeFilter === 'ACTIVE',
      });
      setPageData(result);
    } catch (error) {
      setPageData(emptyPage);
      toast.error(getErrorMessage(error, 'Unable to load customers from the new retail API.'));
    } finally {
      setIsLoading(false);
    }
  }, [token, page, query, activeFilter]);

  useEffect(() => { void loadAccounts() }, [loadAccounts]);

  const customers = useMemo(() => pageData.content.filter((customer) => (
    (status === 'ALL' || customer.accountStatus === status) &&
    (clientType === 'ALL' || customer.clientType === clientType)
  )), [pageData.content, status, clientType]);

  const visibleStats = useMemo(() => ({
    active: pageData.content.filter((item) => item.active && item.accountStatus === 'ACTIVE').length,
    prospects: pageData.content.filter((item) => item.accountStatus === 'PROSPECT').length,
    network: pageData.content.filter((item) => item.networkMember).length,
  }), [pageData.content]);

  const confirmDelete = async () => {
    if (!token || !deleteTarget) return;
    setIsDeleting(true);
    try {
      await RetailAPI.deleteAccount(deleteTarget.id, token);
      toast.success(`${deleteTarget.accountName} was marked inactive.`);
      setDeleteTarget(null);
      await loadAccounts();
    } catch (error) {
      toast.error(getErrorMessage(error, 'Unable to deactivate this customer.'));
    } finally {
      setIsDeleting(false);
    }
  };

  const exportCustomers = async () => {
    if (!token) return;
    setIsExporting(true);
    try {
      const first = await RetailAPI.getAccounts(token, { page: 0, size: 500, q: query || undefined, active: activeFilter === 'ALL' ? undefined : activeFilter === 'ACTIVE' });
      const all = [...first.content];
      for (let index = 1; index < first.totalPages; index += 1) {
        const next = await RetailAPI.getAccounts(token, { page: index, size: first.size, q: query || undefined, active: activeFilter === 'ALL' ? undefined : activeFilter === 'ACTIVE' });
        all.push(...next.content);
      }
      const filtered = all.filter((customer) => (status === 'ALL' || customer.accountStatus === status) && (clientType === 'ALL' || customer.clientType === clientType));
      const rows = [
        ['Account ID', 'Account Name', 'Type', 'Status', 'GSTIN', 'Owner', 'City', 'District', 'State', 'PIN', 'Region', 'Monthly Sales MT', 'Credit Terms Days', 'Credit Limit', 'Tier', 'Network Member', 'Active'],
        ...filtered.map((item) => [item.id, item.accountName, item.clientType, item.accountStatus, item.gstNumber, item.ownerEmployeeName, item.addressCity, item.addressDistrict, item.addressState, item.pinCode, item.regionName, item.declaredMonthlySalesMt ?? '', item.creditTermsDays, item.creditLimitAmount, item.clientTier, item.networkMember ? 'Yes' : 'No', item.active ? 'Yes' : 'No']),
      ];
      const blob = new Blob([rows.map((row) => row.map(csvCell).join(',')).join('\n')], { type: 'text/csv;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = `retail-customers-${new Date().toISOString().slice(0, 10)}.csv`;
      anchor.click();
      URL.revokeObjectURL(url);
      toast.success(`Exported ${filtered.length} customers.`);
    } catch (error) {
      toast.error(getErrorMessage(error, 'Unable to export customers.'));
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-center">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Retail Customers</h1>
          <p className="text-sm text-muted-foreground">Dealer and distributor accounts from the new German TMT retail API.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => void loadAccounts()} disabled={isLoading}><RefreshCw className={`mr-2 h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />Refresh</Button>
          <Button variant="outline" onClick={() => void exportCustomers()} disabled={isExporting}><Download className="mr-2 h-4 w-4" />{isExporting ? 'Exporting…' : 'Export CSV'}</Button>
          <Button onClick={() => setAddOpen(true)}><Plus className="mr-2 h-4 w-4" />Create Customer</Button>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Card><CardHeader className="pb-2"><CardDescription>Total matching accounts</CardDescription><CardTitle className="text-2xl">{pageData.totalElements}</CardTitle></CardHeader></Card>
        <Card><CardHeader className="pb-2"><CardDescription>Active on this page</CardDescription><CardTitle className="text-2xl text-emerald-700">{visibleStats.active}</CardTitle></CardHeader></Card>
        <Card><CardHeader className="pb-2"><CardDescription>Prospects on this page</CardDescription><CardTitle className="text-2xl text-blue-700">{visibleStats.prospects}</CardTitle></CardHeader></Card>
        <Card><CardHeader className="pb-2"><CardDescription>Network members on this page</CardDescription><CardTitle className="text-2xl">{visibleStats.network}</CardTitle></CardHeader></Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Customer directory</CardTitle>
          <CardDescription>Search is sent to the backend. Status and type refine the loaded page.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 md:grid-cols-[minmax(220px,1fr)_180px_180px_180px]">
            <div className="relative"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" /><Input value={queryInput} onChange={(event) => setQueryInput(event.target.value)} placeholder="Search customer name or code" className="pl-9" /></div>
            <Select value={status} onValueChange={setStatus}><SelectTrigger><SelectValue placeholder="Account status" /></SelectTrigger><SelectContent><SelectItem value="ALL">All statuses</SelectItem><SelectItem value="PROSPECT">Prospect</SelectItem><SelectItem value="ACTIVE">Active</SelectItem><SelectItem value="DORMANT">Dormant</SelectItem><SelectItem value="LOST">Lost</SelectItem></SelectContent></Select>
            <Select value={clientType} onValueChange={setClientType}><SelectTrigger><SelectValue placeholder="Client type" /></SelectTrigger><SelectContent><SelectItem value="ALL">All client types</SelectItem><SelectItem value="DEALER">Dealer</SelectItem><SelectItem value="DISTRIBUTOR">Distributor</SelectItem></SelectContent></Select>
            <Select value={activeFilter} onValueChange={(value) => { setPage(0); setActiveFilter(value) }}><SelectTrigger><SelectValue placeholder="Record state" /></SelectTrigger><SelectContent><SelectItem value="ACTIVE">Active records</SelectItem><SelectItem value="INACTIVE">Inactive records</SelectItem><SelectItem value="ALL">All records</SelectItem></SelectContent></Select>
          </div>

          <div className="rounded-lg border">
            <Table>
              <TableHeader><TableRow><TableHead>Customer</TableHead><TableHead>Status</TableHead><TableHead>Location</TableHead><TableHead>Owner</TableHead><TableHead>Commercial</TableHead><TableHead className="text-right">Actions</TableHead></TableRow></TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow><TableCell colSpan={6} className="h-36 text-center"><Loader2 className="mx-auto h-5 w-5 animate-spin text-muted-foreground" /><span className="mt-2 block text-muted-foreground">Loading customers…</span></TableCell></TableRow>
                ) : customers.length === 0 ? (
                  <TableRow><TableCell colSpan={6} className="h-36 text-center text-muted-foreground"><Users className="mx-auto mb-2 h-8 w-8 opacity-40" />No customers match these filters.</TableCell></TableRow>
                ) : customers.map((customer) => (
                  <TableRow key={customer.id} className="cursor-pointer" onClick={() => router.push(`/dashboard/customers/${customer.id}`)}>
                    <TableCell><div className="font-medium">{customer.accountName}</div><div className="text-xs text-muted-foreground">#{customer.id} · {humanize(customer.clientType)}{customer.gstNumber ? ` · ${customer.gstNumber}` : ''}</div></TableCell>
                    <TableCell><div className="flex flex-wrap gap-1"><Badge variant="outline" className={statusClass(customer.accountStatus)}>{humanize(customer.accountStatus)}</Badge>{customer.networkMember && <Badge variant="secondary">Network</Badge>}{!customer.active && <Badge variant="destructive">Inactive</Badge>}</div></TableCell>
                    <TableCell><div>{customer.addressCity || '—'}</div><div className="text-xs text-muted-foreground">{[customer.addressDistrict, customer.addressState, customer.pinCode].filter(Boolean).join(', ') || 'Address unavailable'}</div></TableCell>
                    <TableCell>{customer.ownerEmployeeName || (customer.ownerEmployeeId ? `Employee #${customer.ownerEmployeeId}` : '—')}</TableCell>
                    <TableCell><div>{customer.declaredMonthlySalesMt == null ? 'Not declared' : `${customer.declaredMonthlySalesMt} MT/month`}</div><div className="text-xs text-muted-foreground">Tier {customer.clientTier} · {money(customer.creditLimitAmount)}</div></TableCell>
                    <TableCell className="text-right"><Button size="icon" variant="ghost" aria-label={`View ${customer.accountName}`} onClick={(event) => { event.stopPropagation(); router.push(`/dashboard/customers/${customer.id}`) }}><Eye className="h-4 w-4" /></Button><Button size="icon" variant="ghost" aria-label={`Deactivate ${customer.accountName}`} disabled={!customer.active} onClick={(event) => { event.stopPropagation(); setDeleteTarget(customer) }}><Trash2 className="h-4 w-4 text-destructive" /></Button></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          <div className="flex flex-col items-center justify-between gap-3 text-sm sm:flex-row">
            <p className="text-muted-foreground">Page {pageData.number + 1} of {Math.max(1, pageData.totalPages)} · {pageData.totalElements} total</p>
            <div className="flex gap-2"><Button variant="outline" size="sm" disabled={page <= 0 || isLoading} onClick={() => setPage((value) => Math.max(0, value - 1))}>Previous</Button><Button variant="outline" size="sm" disabled={page + 1 >= pageData.totalPages || isLoading} onClick={() => setPage((value) => value + 1)}>Next</Button></div>
          </div>
        </CardContent>
      </Card>

      {token && <AddCustomerModal isOpen={addOpen} onClose={() => setAddOpen(false)} token={token} employeeId={userData?.employeeId ?? null} userRole={userRole ?? undefined} userData={userData ? { ...userData } : undefined} onCustomerAdded={() => { setAddOpen(false); setPage(0); void loadAccounts() }} />}

      <Dialog open={Boolean(deleteTarget)} onOpenChange={(open) => !open && !isDeleting && setDeleteTarget(null)}>
        <DialogContent><DialogHeader><DialogTitle>Deactivate customer?</DialogTitle><DialogDescription>This uses the new soft-delete endpoint. The account stays in history but is no longer active.</DialogDescription></DialogHeader><div className="rounded-lg border bg-muted/40 p-3 text-sm font-medium">{deleteTarget?.accountName}</div><DialogFooter><Button variant="outline" onClick={() => setDeleteTarget(null)} disabled={isDeleting}>Cancel</Button><Button variant="destructive" onClick={() => void confirmDelete()} disabled={isDeleting}>{isDeleting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Deactivate</Button></DialogFooter></DialogContent>
      </Dialog>
    </div>
  );
}
