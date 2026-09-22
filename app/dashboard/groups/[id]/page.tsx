'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, Loader2, Pencil, Plus } from 'lucide-react';
import { toast } from 'sonner';

import { useAuth } from '@/components/auth-provider';
import { getErrorMessage } from '@/lib/api-error';
import { RetailAPI, type RetailAccount, type RetailClientGroup, type RetailClientGroupType } from '@/lib/retail-api';
import AddCustomerModal from '@/components/AddCustomerModal';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Sheet, SheetContent, SheetFooter, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Textarea } from '@/components/ui/textarea';
import { Skeleton } from '@/components/ui/skeleton';

const humanize = (value: string | null | undefined) =>
  value ? value.replaceAll('_', ' ').toLowerCase().replace(/\b\w/g, (l) => l.toUpperCase()) : '—';

function Ellipsis({ value }: { value: string | number | null | undefined }) {
  const v = value === null || value === undefined || value === '' ? '—' : String(value);
  return <span className="block min-w-0 truncate" title={v}>{v}</span>;
}

export default function GroupDetailPage() {
  const params = useParams<{ id: string }>();
  const groupId = Number(params?.id);
  const router = useRouter();
  const { token, userData, userRole } = useAuth();
  const [group, setGroup] = useState<RetailClientGroup | null>(null);
  const [allGroups, setAllGroups] = useState<RetailClientGroup[]>([]);
  const [branches, setBranches] = useState<RetailAccount[]>([]);
  const [recordedByAccount, setRecordedByAccount] = useState<Map<number, number>>(new Map());
  const [isLoading, setIsLoading] = useState(true);
  const [branchSheetOpen, setBranchSheetOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [searchInput, setSearchInput] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<RetailAccount[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [editForm, setEditForm] = useState({ groupName: '', groupType: 'STANDALONE' as RetailClientGroupType, notes: '' });
  const [isSaving, setIsSaving] = useState(false);
  const [moveTarget, setMoveTarget] = useState<RetailAccount | null>(null);
  const [moveGroupId, setMoveGroupId] = useState('');
  const [isMoving, setIsMoving] = useState(false);

  const load = useCallback(async () => {
    if (!token || !Number.isFinite(groupId)) return;
    setIsLoading(true);
    try {
      const [groups, branchList] = await Promise.all([
        RetailAPI.getClientGroups(token),
        RetailAPI.getGroupBranches(groupId, token),
      ]);
      setAllGroups(groups);
      setGroup(groups.find((g) => g.id === groupId) ?? null);
      setBranches(branchList);
      const totals = await Promise.all(
        branchList.map(async (b) => {
          try {
            const sales = await RetailAPI.getSales(b.id, token);
            return [b.id, sales.reduce((s, x) => s + (x.quantityMt || 0), 0)] as const;
          } catch {
            return [b.id, 0] as const;
          }
        }),
      );
      setRecordedByAccount(new Map(totals));
    } catch (error) {
      toast.error(getErrorMessage(error, 'Unable to load this group.'));
    } finally {
      setIsLoading(false);
    }
  }, [token, groupId]);

  useEffect(() => { void load(); }, [load]);

  const declaredTotal = useMemo(
    () => branches.reduce((s, b) => s + (b.declaredMonthlySalesMt ?? 0), 0),
    [branches],
  );
  const recordedTotal = useMemo(
    () => branches.reduce((s, b) => s + (recordedByAccount.get(b.id) ?? 0), 0),
    [branches, recordedByAccount],
  );
  const activeCount = useMemo(() => branches.filter((b) => b.active !== false).length, [branches]);

  const openEdit = () => {
    if (!group) return;
    setEditForm({
      groupName: group.groupName ?? '',
      groupType: (['STANDALONE', 'FAMILY_GROUP', 'CORPORATE_GROUP'].includes(group.groupType ?? '')
        ? (group.groupType as RetailClientGroupType)
        : 'STANDALONE'),
      notes: group.notes ?? '',
    });
    setEditOpen(true);
  };

  const saveEdit = async () => {
    if (!token || !group) return;
    if (!editForm.groupName.trim()) { toast.error('Group name is required.'); return }
    setIsSaving(true);
    try {
      await RetailAPI.updateClientGroup(group.id, {
        groupName: editForm.groupName.trim(),
        groupType: editForm.groupType,
        notes: editForm.notes.trim() || null,
        active: true,
      }, token);
      toast.success('Group updated.');
      setEditOpen(false);
      await load();
    } catch (error) {
      toast.error(getErrorMessage(error, 'Unable to update group.'));
    } finally {
      setIsSaving(false);
    }
  };

  const confirmMove = async () => {
    if (!token || !moveTarget || !moveGroupId) return;
    setIsMoving(true);
    try {
      await RetailAPI.assignAccountGroup(moveTarget.id, Number(moveGroupId), token);
      toast.success(`${moveTarget.accountName} moved.`);
      setMoveTarget(null);
      setMoveGroupId('');
      await load();
    } catch (error) {
      toast.error(getErrorMessage(error, 'Unable to move branch.'));
    } finally {
      setIsMoving(false);
    }
  };

  useEffect(() => {
    const timer = window.setTimeout(() => setSearchQuery(searchInput.trim()), 350);
    return () => window.clearTimeout(timer);
  }, [searchInput]);

  useEffect(() => {
    if (!branchSheetOpen || !token) return;
    let cancelled = false;
    const run = async () => {
      setIsSearching(true);
      try {
        const page = await RetailAPI.getAccounts(token, { page: 0, size: 20, q: searchQuery || undefined });
        if (!cancelled) setSearchResults(page.content.filter((a) => a.clientGroupId !== groupId));
      } catch (error) {
        if (!cancelled) toast.error(getErrorMessage(error, 'Unable to search accounts.'));
      } finally {
        if (!cancelled) setIsSearching(false);
      }
    };
    void run();
    return () => { cancelled = true; };
  }, [branchSheetOpen, searchQuery, token, groupId]);

  const moveExisting = async (account: RetailAccount) => {
    if (!token) return;
    setIsMoving(true);
    try {
      await RetailAPI.assignAccountGroup(account.id, groupId, token);
      toast.success(`${account.accountName} added to this group.`);
      setSearchResults((prev) => prev.filter((a) => a.id !== account.id));
      await load();
    } catch (error) {
      toast.error(getErrorMessage(error, 'Unable to add branch.'));
    } finally {
      setIsMoving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (!Number.isFinite(groupId) || !group) {
    return (
      <Card>
        <CardHeader><CardTitle>Group not found</CardTitle><CardDescription>This group is not returned by the retail groups endpoint.</CardDescription></CardHeader>
        <CardContent>
          <Button variant="outline" onClick={() => router.push('/dashboard/groups')}><ArrowLeft className="mr-2 h-4 w-4" />Back to groups</Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="mx-auto w-full max-w-none space-y-4 py-4">
      <div className="flex flex-col justify-between gap-3 lg:flex-row lg:items-center">
        <div className="flex gap-3">
          <Button size="icon" variant="outline" onClick={() => router.push('/dashboard/groups')} aria-label="Back to groups"><ArrowLeft className="h-4 w-4" /></Button>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-xl font-semibold">{group.groupName}</h1>
              <Badge variant="outline">{humanize(group.groupType)}</Badge>
              {group.active === false && <Badge variant="destructive">Inactive</Badge>}
            </div>
            <p className="mt-0.5 text-xs text-muted-foreground">#{group.id}{group.notes ? ` · ${group.notes}` : ''}</p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={openEdit}><Pencil className="mr-2 h-3.5 w-3.5" />Edit</Button>
          <Button size="sm" onClick={() => { setSearchInput(''); setCreateOpen(false); setBranchSheetOpen(true); }}><Plus className="mr-2 h-3.5 w-3.5" />Add branch</Button>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Card><CardHeader className="pb-2"><CardDescription>Branches</CardDescription><CardTitle className="text-lg">{branches.length}</CardTitle></CardHeader></Card>
        <Card><CardHeader className="pb-2"><CardDescription>Active</CardDescription><CardTitle className="text-lg">{activeCount}</CardTitle></CardHeader></Card>
        <Card><CardHeader className="pb-2"><CardDescription>Declared total</CardDescription><CardTitle className="text-lg">{declaredTotal.toLocaleString('en-IN')} MT</CardTitle></CardHeader></Card>
        <Card><CardHeader className="pb-2"><CardDescription>Recorded total</CardDescription><CardTitle className="text-lg">{recordedTotal.toLocaleString('en-IN')} MT</CardTitle></CardHeader></Card>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-sm">Branches</CardTitle><CardAction><span className="text-xs text-muted-foreground">{branches.length} accounts</span></CardAction></CardHeader>
        <CardContent>
          {branches.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">No branches linked yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <Table className="table-fixed text-xs">
                <colgroup>
                  <col className="w-[24%]" />
                  <col className="w-[16%]" />
                  <col className="w-[12%]" />
                  <col className="w-[12%]" />
                  <col className="w-[12%]" />
                  <col className="w-[24%]" />
                </colgroup>
                <TableHeader>
                  <TableRow>
                    {['Account', 'City', 'Status', 'Tier', 'Monthly MT', 'Actions'].map((h) => (
                      <TableHead key={h} className={`overflow-hidden text-ellipsis whitespace-nowrap ${h === 'Actions' ? 'text-right' : ''}`}>{h}</TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {branches.map((b) => (
                    <TableRow key={b.id}>
                      <TableCell className="font-medium"><Ellipsis value={b.accountName} /></TableCell>
                      <TableCell><Ellipsis value={b.addressCity} /></TableCell>
                      <TableCell><Ellipsis value={humanize(b.accountStatus)} /></TableCell>
                      <TableCell className="text-center"><Ellipsis value={b.clientTier} /></TableCell>
                      <TableCell><Ellipsis value={b.declaredMonthlySalesMt ?? '—'} /></TableCell>
                      <TableCell>
                        <div className="flex items-center justify-end gap-1">
                          <Button variant="ghost" size="sm" className="h-7 px-2 text-xs" asChild>
                            <Link href={`/dashboard/customers/${b.id}`}>View</Link>
                          </Button>
                          <Button variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={() => { setMoveTarget(b); setMoveGroupId(''); }}>Move</Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <Sheet open={editOpen} onOpenChange={(open) => !isSaving && setEditOpen(open)}>
        <SheetContent className="flex w-full flex-col sm:max-w-lg">
          <SheetHeader className="border-b pb-4"><SheetTitle>Edit group</SheetTitle></SheetHeader>
          <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-1 py-4">
            <div className="space-y-1.5"><Label>Group Name *</Label><Input value={editForm.groupName} onChange={(e) => setEditForm({ ...editForm, groupName: e.target.value })} /></div>
            <div className="space-y-1.5"><Label>Group Type *</Label>
              <Select value={editForm.groupType} onValueChange={(v) => setEditForm({ ...editForm, groupType: v as RetailClientGroupType })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="STANDALONE">Standalone</SelectItem>
                  <SelectItem value="FAMILY_GROUP">Family Group</SelectItem>
                  <SelectItem value="CORPORATE_GROUP">Corporate Group</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5"><Label>Notes</Label><Textarea value={editForm.notes} onChange={(e) => setEditForm({ ...editForm, notes: e.target.value })} /></div>
          </div>
          <SheetFooter className="flex-row items-center justify-end gap-3 border-t pt-4">
            <Button variant="outline" onClick={() => setEditOpen(false)} disabled={isSaving}>Cancel</Button>
            <Button onClick={() => void saveEdit()} disabled={isSaving}>{isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Save</Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>

      <Sheet open={moveTarget != null} onOpenChange={(open) => !isMoving && !open && setMoveTarget(null)}>
        <SheetContent className="flex w-full flex-col sm:max-w-lg">
          <SheetHeader className="border-b pb-4"><SheetTitle>Move branch</SheetTitle></SheetHeader>
          <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-1 py-4">
          <p className="text-sm text-muted-foreground">Move {moveTarget?.accountName} to another group. Standalone shops should each keep their own group.</p>
          <div className="space-y-1.5"><Label>Target group *</Label>
            <Select value={moveGroupId} onValueChange={setMoveGroupId}>
              <SelectTrigger><SelectValue placeholder="Choose group" /></SelectTrigger>
              <SelectContent>
                {allGroups.filter((g) => g.active !== false && g.id !== groupId).map((g) => (
                  <SelectItem key={g.id} value={String(g.id)}>{g.groupName}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          </div>
          <SheetFooter className="flex-row items-center justify-end gap-3 border-t pt-4">
            <Button variant="outline" onClick={() => setMoveTarget(null)} disabled={isMoving}>Cancel</Button>
            <Button onClick={() => void confirmMove()} disabled={isMoving || !moveGroupId}>{isMoving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Move</Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>

      <Sheet open={branchSheetOpen} onOpenChange={setBranchSheetOpen}>
        <SheetContent className="flex w-full flex-col sm:max-w-lg">
          <SheetHeader className="border-b pb-4"><SheetTitle>Add branch to {group.groupName}</SheetTitle></SheetHeader>
          <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-1 py-4">
            <div className="rounded-lg border p-3">
              <p className="text-sm font-medium">Create new branch</p>
              <p className="mt-0.5 text-xs text-muted-foreground">New retailer pre-linked to this group.</p>
              <Button size="sm" className="mt-2" onClick={() => setCreateOpen(true)}><Plus className="mr-2 h-3.5 w-3.5" />Create new retailer</Button>
            </div>
            <div>
              <p className="text-sm font-medium">Add existing account</p>
              <div className="mt-2">
                <Input value={searchInput} onChange={(e) => setSearchInput(e.target.value)} placeholder="Search retailer, GSTIN…" className="h-8 text-xs" />
              </div>
              <div className="mt-2 space-y-2">
                {isSearching ? <p className="py-4 text-center text-xs text-muted-foreground">Searching…</p>
                  : searchResults.length === 0 ? <p className="py-4 text-center text-xs text-muted-foreground">No accounts found outside this group.</p>
                  : searchResults.map((a) => (
                    <div key={a.id} className="flex items-center justify-between gap-2 rounded-lg border px-3 py-2">
                      <div className="min-w-0"><p className="truncate text-sm font-medium">{a.accountName}</p><p className="truncate text-xs text-muted-foreground">{a.addressCity} · {humanize(a.accountStatus)}</p></div>
                      <Button variant="outline" size="sm" className="h-7 text-xs" disabled={isMoving} onClick={() => void moveExisting(a)}>Add</Button>
                    </div>
                  ))}
              </div>
            </div>
          </div>
        </SheetContent>
      </Sheet>

      {token && createOpen && (
        <AddCustomerModal
          isOpen={createOpen}
          onClose={() => setCreateOpen(false)}
          token={token}
          employeeId={userData?.employeeId ?? null}
          userRole={userRole ?? undefined}
          userData={userData ? { ...userData } as Record<string, unknown> : undefined}
          initialGroupId={String(groupId)}
          onCustomerAdded={() => { setCreateOpen(false); setBranchSheetOpen(false); void load(); }}
        />
      )}
    </div>
  );
}
