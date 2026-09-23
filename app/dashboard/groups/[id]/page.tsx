'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, ArrowRightLeft, ChevronRight, Hash, Layers, Loader2, MapPin, Package, Pencil, Plus, RefreshCw, Search, Store, TrendingUp } from 'lucide-react';
import { toast } from 'sonner';

import { useAuth } from '@/components/auth-provider';
import { getErrorMessage } from '@/lib/api-error';
import { RetailAPI, type RetailAccount, type RetailClientGroup, type RetailClientGroupType } from '@/lib/retail-api';
import AddCustomerModal from '@/components/AddCustomerModal';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { DetailHero, DetailSkeleton, EmptyState, FormContext, FormField, FormGroup, FormSheet, KpiCell, OptionCards, Pill, Section, type HeroNextStep, type Tone } from '@/components/detail-ui';
import { cn } from '@/lib/utils';

const humanize = (value: string | null | undefined) =>
  value ? value.replaceAll('_', ' ').toLowerCase().replace(/\b\w/g, (l) => l.toUpperCase()) : '—';

const ACCOUNT_TONE: Record<string, Tone> = { ACTIVE: 'success', PROSPECT: 'info', DORMANT: 'warning', LOST: 'danger' };
const BRANCH_GRID = 'md:grid-cols-[minmax(0,1.6fr)_minmax(0,0.8fr)_92px_40px_96px_minmax(0,1.2fr)_56px]';

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
  const [branchFilter, setBranchFilter] = useState('');
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

  if (isLoading) return <DetailSkeleton />;

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

  const openAddBranch = () => { setSearchInput(''); setCreateOpen(false); setBranchSheetOpen(true); };
  const cities = Array.from(new Set(branches.map((b) => b.addressCity).filter(Boolean)));
  const tierMix = (['A', 'B', 'C'] as const).map((tier) => ({ tier, count: branches.filter((b) => b.clientTier === tier).length })).filter((item) => item.count > 0);
  const topBranch = [...branches].sort((left, right) => (recordedByAccount.get(right.id) ?? 0) - (recordedByAccount.get(left.id) ?? 0))[0];
  const filter = branchFilter.trim().toLowerCase();
  const visibleBranches = [...branches]
    .filter((b) => !filter || [b.accountName, b.addressCity, b.gstNumber].some((value) => String(value ?? '').toLowerCase().includes(filter)))
    .sort((left, right) => (recordedByAccount.get(right.id) ?? 0) - (recordedByAccount.get(left.id) ?? 0) || left.accountName.localeCompare(right.accountName));
  const nextStep: HeroNextStep | null = branches.length === 0
    ? { done: false, text: 'This group has no branches yet. Add the first retailer.', action: <Button size="sm" onClick={openAddBranch}><Plus className="mr-1.5 h-3.5 w-3.5" />Add branch</Button> }
    : group.groupType === 'STANDALONE' && branches.length > 1
      ? { done: false, text: `A standalone group usually has one shop, but this one has ${branches.length}. Change the group type or move the extra branches.`, action: <Button size="sm" variant="outline" onClick={openEdit}>Change type</Button> }
      : null;

  return (
    <div className="detail-page space-y-4 font-poppins text-xs">
      <DetailHero
        name={group.groupName}
        onBack={() => router.push('/dashboard/groups')}
        backLabel="Back to groups"
        badges={<>
          <Pill tone={group.groupType === 'CORPORATE_GROUP' ? 'info' : group.groupType === 'FAMILY_GROUP' ? 'success' : 'neutral'}>{humanize(group.groupType)}</Pill>
          {group.active === false && <Pill tone="danger">Inactive</Pill>}
        </>}
        meta={[
          { icon: Hash, label: group.id },
          { icon: Store, label: `${branches.length} ${branches.length === 1 ? 'branch' : 'branches'}` },
          ...(cities.length ? [{ icon: MapPin, label: cities.length <= 3 ? cities.join(', ') : `${cities.slice(0, 2).join(', ')} +${cities.length - 2} more`, title: cities.join(', ') }] : []),
        ]}
        description={group.notes || undefined}
        actions={<>
          <Button variant="outline" size="sm" className="h-8" onClick={openEdit}><Pencil className="mr-1.5 h-3.5 w-3.5" />Edit</Button>
          <Button size="sm" className="h-8" onClick={openAddBranch}><Plus className="mr-1.5 h-3.5 w-3.5" />Add branch</Button>
          <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => void load()} aria-label="Refresh" title="Refresh"><RefreshCw className="h-4 w-4" /></Button>
        </>}
        kpis={<>
          <KpiCell icon={Store} label="Branches" value={branches.length} hint={`${activeCount} active`} />
          <KpiCell icon={TrendingUp} label="Declared" value={`${declaredTotal.toLocaleString('en-IN')} MT`} hint="per month, all branches" />
          <KpiCell icon={Package} label="Recorded sales" value={`${recordedTotal.toLocaleString('en-IN')} MT`} hint={topBranch && recordedTotal > 0 ? `top: ${topBranch.accountName}` : 'No sales yet'} />
          <KpiCell icon={Layers} label="Tier mix" value={tierMix.length ? tierMix.map((item) => `${item.count}${item.tier}`).join(' · ') : '—'} hint={tierMix.length ? 'A · B · C accounts' : 'No branches'} />
        </>}
        nextStep={nextStep}
      />

      <Section
        description={branches.length ? `${visibleBranches.length === branches.length ? branches.length : `${visibleBranches.length} of ${branches.length}`} ${branches.length === 1 ? 'branch' : 'branches'} · sorted by recorded sales` : 'No branches yet'}
        bodyClassName="p-0"
        action={branches.length > 3 ? (
          <div className="relative">
            <Search className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input value={branchFilter} onChange={(e) => setBranchFilter(e.target.value)} placeholder="Filter branches…" className="h-7 w-44 pl-7 text-xs" aria-label="Filter branches" />
          </div>
        ) : undefined}
      >
        {branches.length === 0 ? <EmptyState compact title="No branches linked yet. Use Add branch to link a retailer." /> : visibleBranches.length === 0 ? <EmptyState compact title="No branches match this filter." /> : (
          <div>
            <div className={cn('hidden gap-x-4 border-b bg-muted/40 px-4 py-2 text-[11px] font-medium text-muted-foreground md:grid', BRANCH_GRID)}>
              <span>Branch</span><span>City</span><span>Status</span><span className="text-center">Tier</span><span className="text-right">Declared / mo</span><span>Recorded sales</span><span />
            </div>
            <ul className="divide-y">
              {visibleBranches.map((b) => {
                const recorded = recordedByAccount.get(b.id) ?? 0;
                const share = recordedTotal > 0 ? (recorded / recordedTotal) * 100 : 0;
                return (
                  <li key={b.id} className={cn('group grid cursor-pointer grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 px-4 py-2 transition-colors hover:bg-muted/40 md:gap-x-4', BRANCH_GRID, b.active === false && 'opacity-60')} onClick={() => router.push(`/dashboard/customers/${b.id}`)}>
                    <div className="min-w-0 leading-tight">
                      <Link href={`/dashboard/customers/${b.id}`} onClick={(e) => e.stopPropagation()} className="block truncate text-sm font-medium hover:underline" title={b.accountName}>{b.accountName}</Link>
                      <p className="truncate text-[11px] text-muted-foreground"><span className="font-mono" data-preserve-case="true">{b.gstNumber || `#${b.id}`}</span><span className="md:hidden"> · {b.addressCity || '—'} · {humanize(b.accountStatus)} · Tier {b.clientTier} · {recorded.toLocaleString('en-IN')} MT</span></p>
                    </div>
                    <span className="hidden truncate text-xs md:block" title={b.addressCity}>{b.addressCity || '—'}</span>
                    <span className="hidden md:block"><Pill tone={ACCOUNT_TONE[b.accountStatus] ?? 'neutral'}>{humanize(b.accountStatus)}</Pill></span>
                    <span className="hidden text-center text-xs font-semibold md:block">{b.clientTier || '—'}</span>
                    <span className="hidden text-right text-xs tabular-nums md:block">{b.declaredMonthlySalesMt != null ? `${b.declaredMonthlySalesMt.toLocaleString('en-IN')} MT` : '—'}</span>
                    <div className="hidden min-w-0 items-center gap-2 md:flex" title={recordedTotal > 0 ? `${share.toFixed(0)}% of group sales` : undefined}>
                      <span className="w-16 shrink-0 text-right text-xs font-medium tabular-nums">{recorded.toLocaleString('en-IN')} MT</span>
                      <span className="h-1.5 min-w-0 flex-1 overflow-hidden rounded-full bg-muted"><span className="block h-full rounded-full bg-primary/70" style={{ width: `${share}%` }} /></span>
                    </div>
                    <div className="flex items-center justify-end gap-0.5">
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-foreground" onClick={(e) => { e.stopPropagation(); setMoveTarget(b); setMoveGroupId(''); }} aria-label={`Move ${b.accountName} to another group`} title="Move to another group"><ArrowRightLeft className="h-3.5 w-3.5" /></Button>
                      <ChevronRight className="hidden h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-0.5 md:block" />
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>
        )}
      </Section>

      <FormSheet
        open={editOpen}
        onOpenChange={(open) => !isSaving && setEditOpen(open)}
        icon={Layers}
        title="Edit group"
        description={group.groupName}
        onSubmit={() => void saveEdit()}
        submitLabel="Save changes"
        submitting={isSaving}
      >
        <FormGroup columns={1}>
          <FormField label="Group name" required><Input value={editForm.groupName} onChange={(e) => setEditForm({ ...editForm, groupName: e.target.value })} /></FormField>
        </FormGroup>
        <FormGroup title="Group type" columns={1}>
          <OptionCards
            value={editForm.groupType}
            onChange={(value) => setEditForm({ ...editForm, groupType: value })}
            options={[
              { value: 'STANDALONE', label: 'Standalone', description: 'A single independent shop.' },
              { value: 'FAMILY_GROUP', label: 'Family group', description: 'Several shops owned by the same family.' },
              { value: 'CORPORATE_GROUP', label: 'Corporate group', description: 'Branches of one registered company.' },
            ]}
          />
        </FormGroup>
        <FormGroup columns={1}>
          <FormField label="Notes"><Textarea rows={3} value={editForm.notes} onChange={(e) => setEditForm({ ...editForm, notes: e.target.value })} placeholder="e.g. Owned by the Sharma family; head office in Pune" /></FormField>
        </FormGroup>
      </FormSheet>

      <FormSheet
        open={moveTarget != null}
        onOpenChange={(open) => !isMoving && !open && setMoveTarget(null)}
        icon={ArrowRightLeft}
        title="Move branch"
        description="Standalone shops should each keep their own group."
        onSubmit={() => void confirmMove()}
        submitLabel="Move branch"
        submitting={isMoving}
        submitDisabled={!moveGroupId}
      >
        {moveTarget && (
          <FormContext>
            <p className="text-sm font-medium">{moveTarget.accountName}</p>
            <p className="mt-0.5 text-muted-foreground">{[moveTarget.addressCity, humanize(moveTarget.accountStatus), `Tier ${moveTarget.clientTier}`].filter(Boolean).join(' · ')} · currently in {group.groupName}</p>
          </FormContext>
        )}
        <FormGroup columns={1}>
          <FormField label="Move to group" required>
            <Select value={moveGroupId} onValueChange={setMoveGroupId}>
              <SelectTrigger><SelectValue placeholder="Choose group" /></SelectTrigger>
              <SelectContent>
                {allGroups.filter((g) => g.active !== false && g.id !== groupId).map((g) => (
                  <SelectItem key={g.id} value={String(g.id)}>{g.groupName} · {humanize(g.groupType)}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FormField>
        </FormGroup>
      </FormSheet>

      <FormSheet
        open={branchSheetOpen}
        onOpenChange={setBranchSheetOpen}
        icon={Store}
        title="Add branch"
        description={`Link a retailer to ${group.groupName}.`}
      >
        <button type="button" onClick={() => setCreateOpen(true)} className="flex w-full items-center gap-3 rounded-lg border border-dashed px-3 py-2.5 text-left transition-colors hover:bg-muted/40">
          <Plus className="h-4 w-4 shrink-0 text-muted-foreground" />
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-medium">Create a new retailer</span>
            <span className="block text-xs text-muted-foreground">Opens the new account form, already linked to this group.</span>
          </span>
          <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
        </button>
        <section className="space-y-2">
          <h4 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Or add an existing account</h4>
          <div className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input value={searchInput} onChange={(e) => setSearchInput(e.target.value)} placeholder="Search by retailer name or GSTIN…" className="pl-8" autoFocus />
          </div>
          <div className="overflow-hidden rounded-lg border">
            {isSearching ? <p className="flex items-center justify-center gap-2 py-6 text-xs text-muted-foreground"><Loader2 className="h-3.5 w-3.5 animate-spin" />Searching…</p>
              : searchResults.length === 0 ? <p className="py-6 text-center text-xs text-muted-foreground">No accounts found outside this group.</p>
              : (
                <ul className="max-h-[50vh] divide-y overflow-y-auto">
                  {searchResults.map((a) => (
                    <li key={a.id} className="flex items-center justify-between gap-3 px-3 py-2">
                      <div className="min-w-0 leading-tight">
                        <p className="truncate text-sm font-medium">{a.accountName}</p>
                        <p className="truncate text-[11px] text-muted-foreground">{[a.addressCity, humanize(a.accountStatus), a.clientGroupName ? `in ${a.clientGroupName}` : null].filter(Boolean).join(' · ')}</p>
                      </div>
                      <Button variant="outline" size="sm" className="h-7 shrink-0 px-2.5 text-xs" disabled={isMoving} onClick={() => void moveExisting(a)}><Plus className="mr-1 h-3 w-3" />Add</Button>
                    </li>
                  ))}
                </ul>
              )}
          </div>
        </section>
      </FormSheet>

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
