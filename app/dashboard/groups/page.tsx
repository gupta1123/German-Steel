'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { ChevronLeft, ChevronRight, DownloadIcon, Filter, Loader2, Plus, Search, Trash2, X } from 'lucide-react';
import { toast } from 'sonner';

import { useAuth } from '@/components/auth-provider';
import { getErrorMessage } from '@/lib/api-error';
import { RetailAPI, type RetailClientGroup, type RetailClientGroupType } from '@/lib/retail-api';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Textarea } from '@/components/ui/textarea';
import { Skeleton } from '@/components/ui/skeleton';

const GROUP_TYPES: { value: RetailClientGroupType; label: string }[] = [
  { value: 'STANDALONE', label: 'Standalone' },
  { value: 'FAMILY_GROUP', label: 'Family Group' },
  { value: 'CORPORATE_GROUP', label: 'Corporate Group' },
];

function Ellipsis({ value }: { value: string | number | null | undefined }) {
  const displayValue = value === null || value === undefined || value === '' ? '—' : String(value);
  return <span className="block min-w-0 truncate" title={displayValue}>{displayValue}</span>;
}

const humanize = (value: string | null | undefined) =>
  value ? value.replaceAll('_', ' ').toLowerCase().replace(/\b\w/g, (l) => l.toUpperCase()) : '—';

const typeClassName = (type: string | null | undefined) => {
  if (type === 'CORPORATE_GROUP') return 'bg-violet-50 text-violet-700 ring-violet-600/15';
  if (type === 'FAMILY_GROUP') return 'bg-sky-50 text-sky-700 ring-sky-600/15';
  return 'bg-slate-50 text-slate-700 ring-slate-600/15';
};

const csvCell = (value: unknown) => `"${String(value ?? '').replaceAll('"', '""')}"`;

const emptyForm = { groupName: '', groupType: 'STANDALONE' as RetailClientGroupType, notes: '' };

export default function GroupsPage() {
  const { token } = useAuth();
  const [allGroups, setAllGroups] = useState<RetailClientGroup[]>([]);
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(10);
  const [hasUserChosenPageSize, setHasUserChosenPageSize] = useState(false);

  useEffect(() => {
    if (hasUserChosenPageSize) return;
    const calc = () => {
      const h = window.innerHeight;
      const w = window.innerWidth;
      const available = h - 320;
      const byHeight = Math.floor(available / 36);
      let target = 10;
      if (w >= 1536) target = Math.max(target, 20);
      else if (w >= 1280) target = Math.max(target, 15);
      if (byHeight >= 18) target = Math.max(target, 20);
      else if (byHeight >= 14) target = Math.max(target, 15);
      else if (byHeight >= 10) target = Math.max(target, 12);
      target = Math.min(100, Math.max(5, target));
      const snap = target <= 10 ? 10 : target <= 12 ? 12 : target <= 15 ? 15 : target <= 20 ? 20 : 25;
      setPageSize((prev) => (prev === snap ? prev : snap));
    };
    calc();
    window.addEventListener('resize', calc);
    return () => window.removeEventListener('resize', calc);
  }, [hasUserChosenPageSize]);

  const [queryInput, setQueryInput] = useState('');
  const [query, setQuery] = useState('');
  const [groupType, setGroupType] = useState('ALL');
  const [activeFilter, setActiveFilter] = useState('ALL');
  const [areFiltersVisible, setAreFiltersVisible] = useState(true);
  const [isLoading, setIsLoading] = useState(true);
  const [isExporting, setIsExporting] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<RetailClientGroup | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [isSaving, setIsSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<RetailClientGroup | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setPage(0);
      setQuery(queryInput.trim());
    }, 350);
    return () => window.clearTimeout(timer);
  }, [queryInput]);

  const loadGroups = useCallback(async () => {
    if (!token) return;
    setIsLoading(true);
    setError(null);
    try {
      setAllGroups(await RetailAPI.getClientGroups(token));
    } catch (err) {
      setAllGroups([]);
      const msg = getErrorMessage(err, 'Unable to load client groups.');
      setError(msg);
      toast.error(msg);
    } finally {
      setIsLoading(false);
    }
  }, [token]);

  useEffect(() => { void loadGroups(); }, [loadGroups]);

  const filtered = useMemo(() => {
    const q = query.toLowerCase();
    return allGroups.filter((g) => {
      if (groupType !== 'ALL' && (g.groupType ?? '') !== groupType) return false;
      if (activeFilter === 'ACTIVE' && g.active === false) return false;
      if (activeFilter === 'INACTIVE' && g.active !== false) return false;
      if (!q) return true;
      return (
        g.groupName.toLowerCase().includes(q) ||
        (g.groupType ?? '').toLowerCase().includes(q) ||
        (g.notes ?? '').toLowerCase().includes(q)
      );
    });
  }, [allGroups, query, groupType, activeFilter]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / Math.max(1, pageSize)));
  const safePage = Math.min(page, totalPages - 1);
  const pageContent = filtered.slice(safePage * pageSize, safePage * pageSize + pageSize);

  const openCreate = () => {
    setEditing(null);
    setForm(emptyForm);
    setDialogOpen(true);
  };

  const openEdit = (group: RetailClientGroup) => {
    setEditing(group);
    setForm({
      groupName: group.groupName ?? '',
      groupType: (['STANDALONE', 'FAMILY_GROUP', 'CORPORATE_GROUP'].includes(group.groupType ?? '')
        ? (group.groupType as RetailClientGroupType)
        : 'STANDALONE'),
      notes: group.notes ?? '',
    });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    const name = form.groupName.trim();
    if (!name) {
      toast.error('Group name is required.');
      return;
    }
    if (!token) {
      toast.error('Your login session is missing. Sign in again.');
      return;
    }
    setIsSaving(true);
    try {
      const payload = { groupName: name, groupType: form.groupType, notes: form.notes.trim() || null, active: true };
      if (editing) {
        await RetailAPI.updateClientGroup(editing.id, payload, token);
        toast.success('Client group updated.');
      } else {
        await RetailAPI.createClientGroup(payload, token);
        toast.success('Client group created. It can now be selected while creating a retail account.');
      }
      setDialogOpen(false);
      await loadGroups();
    } catch (err) {
      toast.error(getErrorMessage(err, 'Could not save the client group.'));
    } finally {
      setIsSaving(false);
    }
  };

  const confirmDelete = async () => {
    if (!token || !deleteTarget) return;
    setIsDeleting(true);
    try {
      await RetailAPI.deactivateClientGroup(deleteTarget.id, token);
      toast.success(`${deleteTarget.groupName} deactivated.`);
      setDeleteTarget(null);
      await loadGroups();
    } catch (err) {
      toast.error(getErrorMessage(err, 'Unable to deactivate group.'));
    } finally {
      setIsDeleting(false);
    }
  };

  const exportGroups = async () => {
    if (filtered.length > 2000) {
      toast.error('Too many records to export — narrow the filters first.');
      return;
    }
    setIsExporting(true);
    try {
      const rows = [
        ['Group Name', 'Group Type', 'Notes', 'Status'],
        ...filtered.map((g) => [g.groupName, humanize(g.groupType), g.notes ?? '', g.active === false ? 'Inactive' : 'Active']),
      ];
      const blob = new Blob([rows.map((r) => r.map(csvCell).join(',')).join('\n')], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'client-groups.csv';
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      toast.success(`Exported ${filtered.length} groups.`);
    } catch (err) {
      toast.error(getErrorMessage(err, 'Unable to export groups.'));
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
              <Label htmlFor="group-search" className="sr-only">Search groups</Label>
              <div className="relative">
                <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="group-search"
                  type="search"
                  autoComplete="off"
                  placeholder="Search group name, type, notes…"
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
              <Label className="sr-only">Group type</Label>
              <Select value={groupType} onValueChange={(v) => { setPage(0); setGroupType(v); }}>
                <SelectTrigger className="h-8 w-full bg-background text-xs shadow-none"><SelectValue placeholder="Group type" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">All Types</SelectItem>
                  <SelectItem value="STANDALONE">Standalone</SelectItem>
                  <SelectItem value="FAMILY_GROUP">Family Group</SelectItem>
                  <SelectItem value="CORPORATE_GROUP">Corporate Group</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="min-w-0 flex-1">
              <Label className="sr-only">Record state</Label>
              <Select value={activeFilter} onValueChange={(v) => { setPage(0); setActiveFilter(v); }}>
                <SelectTrigger className="h-8 w-full bg-background text-xs shadow-none"><SelectValue placeholder="Record state" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">All Records</SelectItem>
                  <SelectItem value="ACTIVE">Active</SelectItem>
                  <SelectItem value="INACTIVE">Inactive</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <span className="hidden text-xs text-muted-foreground xl:inline">{filtered.length} groups</span>
              <Button variant="outline" size="icon" className="h-8 w-8 shadow-none" onClick={() => setAreFiltersVisible(false)} aria-label="Hide filters" title="Hide filters">
                <Filter className="h-4 w-4" />
              </Button>
              <Button variant="outline" size="icon" className="h-8 w-8 shadow-none" onClick={() => void exportGroups()} disabled={isExporting} aria-label="Export groups" title="Export groups">
                {isExporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <DownloadIcon className="h-4 w-4" />}
              </Button>
              <Button size="sm" className="h-8 text-xs" onClick={openCreate}>
                <Plus className="mr-2 h-4 w-4" />Create Group
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
          <Button variant="outline" size="icon" className="h-8 w-8 shadow-none" onClick={() => void exportGroups()} disabled={isExporting} aria-label="Export groups" title="Export groups">
            {isExporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <DownloadIcon className="h-4 w-4" />}
          </Button>
          <Button size="sm" className="h-8 text-xs" onClick={openCreate}>
            <Plus className="mr-2 h-4 w-4" />Create Group
          </Button>
        </div>
      )}

      {error && <div className="mb-3 rounded-md border border-red-200 bg-red-50 p-2.5 text-sm text-red-700" role="alert">{error}</div>}

      <div className="overflow-x-auto">
        <Table className="table-fixed text-xs">
          <colgroup>
            <col className="w-[22%]" />
            <col className="w-[16%]" />
            <col className="w-[32%]" />
            <col className="w-[10%]" />
            <col className="w-[20%]" />
          </colgroup>
          <TableHeader>
            <TableRow>
              {['Group Name', 'Group Type', 'Notes', 'Status', 'Actions'].map((h) => (
                <TableHead key={h} className={`overflow-hidden text-ellipsis whitespace-nowrap ${h === 'Actions' ? 'text-right' : ''}`} title={h}>{h}</TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              Array.from({ length: pageSize }, (_, i) => (
                <TableRow key={`sk-${i}`}>{Array.from({ length: 5 }, (_, c) => <TableCell key={c}><Skeleton className="h-4 w-full max-w-24" /></TableCell>)}</TableRow>
              ))
            ) : pageContent.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="h-24 text-center text-muted-foreground">
                  No groups match the selected filters
                </TableCell>
              </TableRow>
            ) : (
              pageContent.map((g) => (
                <TableRow key={g.id}>
                  <TableCell className="font-medium"><Ellipsis value={g.groupName} /></TableCell>
                  <TableCell>
                    <span className={`inline-flex max-w-full truncate rounded-full px-2 py-0.5 text-[11px] font-medium ring-1 ring-inset ${typeClassName(g.groupType)}`}>
                      {humanize(g.groupType)}
                    </span>
                  </TableCell>
                  <TableCell><Ellipsis value={g.notes || '—'} /></TableCell>
                  <TableCell>
                    <Ellipsis value={g.active === false ? 'Inactive' : 'Active'} />
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center justify-end gap-1">
                      <Button variant="ghost" size="sm" className="h-7 px-2 text-xs" asChild>
                        <Link href={`/dashboard/groups/${g.id}`}>View</Link>
                      </Button>
                      <Button variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={() => openEdit(g)}>
                        Edit
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive"
                        aria-label={`Deactivate ${g.groupName}`}
                        disabled={g.active === false}
                        onClick={() => setDeleteTarget(g)}
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
          <Label htmlFor="group-page-size" className="text-xs">Rows per page:</Label>
          <Select value={String(pageSize)} onValueChange={(v) => { setHasUserChosenPageSize(true); setPage(0); setPageSize(Number(v)); }}>
            <SelectTrigger id="group-page-size" className="h-8 w-20 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>{[10, 12, 15, 20, 25, 50, 100].map((n) => <SelectItem key={n} value={String(n)}>{String(n)}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" className="h-8" onClick={() => setPage((p) => Math.max(0, p - 1))} disabled={safePage <= 0 || isLoading}>
            <ChevronLeft className="h-4 w-4" /><span className="hidden sm:inline">Previous</span>
          </Button>
          <span className="text-xs text-muted-foreground">Page {safePage + 1} of {totalPages}</span>
          <Button variant="outline" size="sm" className="h-8" onClick={() => setPage((p) => p + 1)} disabled={safePage + 1 >= totalPages || isLoading}>
            <span className="hidden sm:inline">Next</span><ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <Dialog open={dialogOpen} onOpenChange={(open) => !isSaving && setDialogOpen(open)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? `Edit Group #${editing.id}` : 'New Client Group'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label>Group Name *</Label>
              <Input value={form.groupName} onChange={(e) => setForm({ ...form, groupName: e.target.value })} placeholder="e.g. Shree Steel Family" />
            </div>
            <div className="space-y-1.5">
              <Label>Group Type *</Label>
              <Select value={form.groupType} onValueChange={(v) => setForm({ ...form, groupType: v as RetailClientGroupType })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {GROUP_TYPES.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Notes</Label>
              <Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="Optional — e.g. 3 branches in Pune district" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)} disabled={isSaving}>Cancel</Button>
            <Button onClick={() => void handleSave()} disabled={isSaving}>
              {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {editing ? 'Save changes' : 'Create group'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(deleteTarget)} onOpenChange={(open) => !open && !isDeleting && setDeleteTarget(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Deactivate group?</DialogTitle><DialogDescription>This will mark the group as inactive. Existing accounts keep their link, but it will be hidden from new selections.</DialogDescription></DialogHeader>
          {deleteTarget && (
            <div className="rounded-md border bg-muted/30 px-3 py-2 text-sm">
              <span className="font-medium">{deleteTarget.groupName}</span>
              <span className="text-muted-foreground"> · #{deleteTarget.id}</span>
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
