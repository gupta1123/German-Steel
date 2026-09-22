'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, DownloadIcon, Filter, Loader2, Plus, Search, Trash2, X } from 'lucide-react';
import { toast } from 'sonner';

import { useAuth } from '@/components/auth-provider';
import { getErrorMessage } from '@/lib/api-error';
import { RetailAPI, type RetailPinCode, type RetailSalesRegion } from '@/lib/retail-api';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';

function Ellipsis({ value }: { value: string | number | null | undefined }) {
  const v = value === null || value === undefined || value === '' ? '—' : String(value);
  return <span className="block min-w-0 truncate" title={v}>{v}</span>;
}
const humanize = (v: string | null | undefined) => v ? v.replaceAll('_',' ').toLowerCase().replace(/\b\w/g,l=>l.toUpperCase()) : '—';
const csvCell = (v: unknown) => `"${String(v ?? '').replaceAll('"','""')}"`;

export default function RegionsPage() {
  const { token } = useAuth();
  const [activeTab, setActiveTab] = useState<'pins' | 'regions'>('pins');

  // Regions state
  const [regions, setRegions] = useState<RetailSalesRegion[]>([]);
  const [regionQuery, setRegionQuery] = useState('');
  const [regionQInput, setRegionQInput] = useState('');
  const [regionActiveFilter, setRegionActiveFilter] = useState('ALL');
  const [regionPage, setRegionPage] = useState(0);
  const [regionPageSize, setRegionPageSize] = useState(10);
  const [regionLoading, setRegionLoading] = useState(true);
  const [regionDialogOpen, setRegionDialogOpen] = useState(false);
  const [editingRegion, setEditingRegion] = useState<RetailSalesRegion | null>(null);
  const [regionForm, setRegionForm] = useState({ code: '', name: '', centerLatitude: '', centerLongitude: '', active: true });
  const [regionSaving, setRegionSaving] = useState(false);
  const [regionDeleteTarget, setRegionDeleteTarget] = useState<RetailSalesRegion | null>(null);
  const [regionDeleting, setRegionDeleting] = useState(false);

  // Pins state
  const [pins, setPins] = useState<RetailPinCode[]>([]);
  const [pinQuery, setPinQuery] = useState('');
  const [pinQInput, setPinQInput] = useState('');
  const [pinRegionFilter, setPinRegionFilter] = useState('ALL');
  const [pinActiveFilter, setPinActiveFilter] = useState('ALL');
  const [pinPage, setPinPage] = useState(0);
  const [pinPageSize, setPinPageSize] = useState(15);
  const [pinLoading, setPinLoading] = useState(true);
  const [pinDialogOpen, setPinDialogOpen] = useState(false);
  const [editingPin, setEditingPin] = useState<RetailPinCode | null>(null);
  const [pinForm, setPinForm] = useState({ pinCode: '', regionId: '' });
  const [pinSaving, setPinSaving] = useState(false);
  const [pinDeleteTarget, setPinDeleteTarget] = useState<RetailPinCode | null>(null);
  const [pinDeleting, setPinDeleting] = useState(false);
  const [areFiltersVisible, setAreFiltersVisible] = useState(true);

  const regionNameById = useMemo(() => new Map(regions.map(r => [r.id, r.name])), [regions]);

  const loadRegions = useCallback(async () => {
    if (!token) return;
    setRegionLoading(true);
    try { setRegions(await RetailAPI.getSalesRegions(token)); }
    catch (e) { toast.error(getErrorMessage(e, 'Unable to load regions.')); }
    finally { setRegionLoading(false); }
  }, [token]);

  const loadPins = useCallback(async () => {
    if (!token) return;
    setPinLoading(true);
    try { setPins(await RetailAPI.getPinCodes(token)); }
    catch (e) { toast.error(getErrorMessage(e, 'Unable to load PIN mappings.')); }
    finally { setPinLoading(false); }
  }, [token]);

  const loadAll = useCallback(async () => { await Promise.all([loadRegions(), loadPins()]); }, [loadRegions, loadPins]);

  useEffect(() => { void loadAll(); }, [loadAll]);
  useEffect(() => { const t = window.setTimeout(() => setRegionQuery(regionQInput.trim()), 300); return () => window.clearTimeout(t); }, [regionQInput]);
  useEffect(() => { const t = window.setTimeout(() => { setPinPage(0); setPinQuery(pinQInput.trim()); }, 300); return () => window.clearTimeout(t); }, [pinQInput]);

  const filteredRegions = useMemo(() => {
    const q = regionQuery.toLowerCase();
    return regions.filter(r => {
      if (regionActiveFilter === 'ACTIVE' && r.active === false) return false;
      if (regionActiveFilter === 'INACTIVE' && r.active !== false) return false;
      if (!q) return true;
      return r.name.toLowerCase().includes(q) || (r.code ?? '').toLowerCase().includes(q);
    });
  }, [regions, regionQuery, regionActiveFilter]);

  const filteredPins = useMemo(() => {
    const q = pinQuery.toLowerCase();
    return pins.filter(p => {
      if (pinRegionFilter !== 'ALL' && String(p.regionId) !== pinRegionFilter) return false;
      if (pinActiveFilter === 'ACTIVE' && p.active === false) return false;
      if (pinActiveFilter === 'INACTIVE' && p.active !== false) return false;
      if (!q) return true;
      return p.pinCode.toLowerCase().includes(q) || (p.regionName ?? '').toLowerCase().includes(q);
    });
  }, [pins, pinQuery, pinRegionFilter, pinActiveFilter]);

  const openCreateRegion = () => { setEditingRegion(null); setRegionForm({ code: '', name: '', centerLatitude: '', centerLongitude: '', active: true }); setRegionDialogOpen(true); };
  const openEditRegion = (r: RetailSalesRegion) => { setEditingRegion(r); setRegionForm({ code: r.code ?? '', name: r.name, centerLatitude: '', centerLongitude: '', active: r.active !== false }); setRegionDialogOpen(true); };
  const saveRegion = async () => {
    if (!token) return;
    const code = regionForm.code.trim().toUpperCase();
    const name = regionForm.name.trim();
    if (!code || !name) { toast.error('Code and name are required.'); return; }
    setRegionSaving(true);
    try {
      const payload = { code, name, active: regionForm.active };
      if (editingRegion) { await RetailAPI.updateSalesRegion(editingRegion.id, payload, token); toast.success('Region updated.'); }
      else { await RetailAPI.createSalesRegion(payload, token); toast.success('Region created.'); }
      setRegionDialogOpen(false);
      await loadRegions();
    } catch (e) { toast.error(getErrorMessage(e, 'Unable to save region.')); } finally { setRegionSaving(false); }
  };
  const confirmDeleteRegion = async () => {
    if (!token || !regionDeleteTarget) return;
    setRegionDeleting(true);
    try { await RetailAPI.deactivateSalesRegion(regionDeleteTarget.id, token); toast.success('Region deactivated.'); setRegionDeleteTarget(null); await loadRegions(); }
    catch (e) { toast.error(getErrorMessage(e, 'Unable to deactivate region.')); } finally { setRegionDeleting(false); }
  };

  const openCreatePin = () => { setEditingPin(null); setPinForm({ pinCode: '', regionId: '' }); setPinDialogOpen(true); };
  const openEditPin = (p: RetailPinCode) => { setEditingPin(p); setPinForm({ pinCode: p.pinCode, regionId: p.regionId ? String(p.regionId) : '' }); setPinDialogOpen(true); };
  const savePin = async () => {
    if (!token) return;
    const pin = pinForm.pinCode.replace(/\D/g, '').slice(0, 6);
    const regionId = Number(pinForm.regionId);
    if (pin.length !== 6) { toast.error('PIN must be exactly 6 digits.'); return; }
    if (!Number.isFinite(regionId)) { toast.error('Choose a sales region.'); return; }
    setPinSaving(true);
    try {
      if (editingPin) { await RetailAPI.updatePinCode(editingPin.pinCode, { pinCode: pin, regionId, active: true }, token); toast.success('PIN mapping updated.'); }
      else { await RetailAPI.createPinCode({ pinCode: pin, regionId, active: true }, token); toast.success('PIN mapped to region. Retail onboarding will now accept this PIN.'); }
      setPinDialogOpen(false);
      await loadPins();
    } catch (e) { toast.error(getErrorMessage(e, 'Unable to save PIN mapping.')); } finally { setPinSaving(false); }
  };
  const confirmDeletePin = async () => {
    if (!token || !pinDeleteTarget) return;
    setPinDeleting(true);
    try { await RetailAPI.deactivatePinCode(pinDeleteTarget.pinCode, token); toast.success(`PIN ${pinDeleteTarget.pinCode} deactivated.`); setPinDeleteTarget(null); await loadPins(); }
    catch (e) { toast.error(getErrorMessage(e, 'Unable to deactivate PIN.')); } finally { setPinDeleting(false); }
  };

  const exportPins = () => {
    if (filteredPins.length > 2000) { toast.error('Too many to export — filter first.'); return; }
    const rows = [['PIN Code','Region','Region ID','Status'], ...filteredPins.map(p => [p.pinCode, p.regionName || regionNameById.get(p.regionId ?? -1) || '—', String(p.regionId ?? ''), p.active === false ? 'Inactive' : 'Active'])];
    const blob = new Blob([rows.map(r => r.map(csvCell).join(',')).join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = 'pin-mappings.csv'; document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
    toast.success(`Exported ${filteredPins.length} PINs.`);
  };

  return (
    <div className="mx-auto w-full max-w-none py-4">
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'pins' | 'regions')}>
        <div className="mb-4 flex items-center justify-between gap-3">
          <TabsList>
            <TabsTrigger value="pins">PIN → Region ({filteredPins.length})</TabsTrigger>
            <TabsTrigger value="regions">Regions ({filteredRegions.length})</TabsTrigger>
          </TabsList>
          <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => void loadAll()}>Refresh</Button>
        </div>

        <TabsContent value="pins" className="space-y-3">
          <div className="flex flex-col gap-2 lg:flex-row lg:items-center">
            <div className="min-w-0 flex-1">
              <div className="relative">
                <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                <Input value={pinQInput} onChange={(e) => setPinQInput(e.target.value)} placeholder="Search PIN or region…" className="h-8 bg-background pl-8 pr-8 text-xs shadow-none" />
                {pinQInput && <button type="button" onClick={() => { setPinQInput(''); setPinQuery(''); }} className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded p-1 text-muted-foreground hover:bg-muted"><X className="h-3.5 w-3.5" /></button>}
              </div>
            </div>
            <div className="min-w-0 flex-1">
              <Select value={pinRegionFilter} onValueChange={(v) => { setPinPage(0); setPinRegionFilter(v); }}>
                <SelectTrigger className="h-8 w-full bg-background text-xs shadow-none"><SelectValue placeholder="All regions" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">All Regions</SelectItem>
                  {regions.map(r => <SelectItem key={r.id} value={String(r.id)}>{r.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="min-w-0 flex-1">
              <Select value={pinActiveFilter} onValueChange={(v) => { setPinPage(0); setPinActiveFilter(v); }}>
                <SelectTrigger className="h-8 w-full bg-background text-xs shadow-none"><SelectValue placeholder="Record state" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">All Records</SelectItem>
                  <SelectItem value="ACTIVE">Active</SelectItem>
                  <SelectItem value="INACTIVE">Inactive</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <span className="hidden text-xs text-muted-foreground xl:inline">{filteredPins.length} mappings</span>
              <Button variant="outline" size="icon" className="h-8 w-8 shadow-none" onClick={() => setAreFiltersVisible(v => !v)}><Filter className="h-4 w-4" /></Button>
              <Button variant="outline" size="icon" className="h-8 w-8 shadow-none" onClick={exportPins}><DownloadIcon className="h-4 w-4" /></Button>
              <Button size="sm" className="h-8 text-xs" onClick={openCreatePin}><Plus className="mr-2 h-4 w-4" />Map PIN</Button>
            </div>
          </div>
          <p className="text-xs text-muted-foreground">PIN-first tab — add a new 6-digit PIN here to unblock retail onboarding (Create Retailer derives region from this master).</p>
          <div className="overflow-x-auto">
            <Table className="table-fixed text-xs">
              <colgroup><col className="w-[18%]" /><col className="w-[30%]" /><col className="w-[18%]" /><col className="w-[14%]" /><col className="w-[20%]" /></colgroup>
              <TableHeader><TableRow>{['PIN Code','Region','Region ID','Status','Actions'].map(h => <TableHead key={h} className={h==='Actions' ? 'text-right' : ''}>{h}</TableHead>)}</TableRow></TableHeader>
              <TableBody>
                {pinLoading ? Array.from({length: pinPageSize}, (_,i)=><TableRow key={`sk-${i}`}>{Array.from({length:5},(_,c)=><TableCell key={c}><Skeleton className="h-4 w-full max-w-24" /></TableCell>)}</TableRow>)
                  : filteredPins.length===0 ? <TableRow><TableCell colSpan={5} className="h-24 text-center text-muted-foreground">No PIN mappings match.</TableCell></TableRow>
                  : filteredPins.slice(pinPage*pinPageSize,(pinPage+1)*pinPageSize).map(p=>(
                    <TableRow key={p.pinCode}>
                      <TableCell className="font-mono font-medium"><Ellipsis value={p.pinCode} /></TableCell>
                      <TableCell><Ellipsis value={p.regionName || regionNameById.get(p.regionId ?? -1) || '—'} /></TableCell>
                      <TableCell><Ellipsis value={p.regionId ?? '—'} /></TableCell>
                      <TableCell><Ellipsis value={p.active===false ? 'Inactive':'Active'} /></TableCell>
                      <TableCell><div className="flex items-center justify-end gap-1">
                        <Button variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={()=>openEditPin(p)}>Edit</Button>
                        <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive" disabled={p.active===false} onClick={()=>setPinDeleteTarget(p)}><Trash2 className="h-3.5 w-3.5" /></Button>
                      </div></TableCell>
                    </TableRow>
                  ))}
              </TableBody>
            </Table>
          </div>
          <div className="flex items-center justify-between gap-2 pt-2">
            <div className="flex items-center gap-2 text-xs"><Label className="text-xs">Rows:</Label>
              <Select value={String(pinPageSize)} onValueChange={v=>{setPinPage(0); setPinPageSize(Number(v));}}><SelectTrigger className="h-7 w-16 text-xs"><SelectValue /></SelectTrigger><SelectContent>{[10,15,25,50,100].map(n=><SelectItem key={n} value={String(n)}>{n}</SelectItem>)}</SelectContent></Select>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" className="h-7" disabled={pinPage<=0} onClick={()=>setPinPage(p=>Math.max(0,p-1))}><ChevronLeft className="h-4 w-4" />Prev</Button>
              <span className="text-xs text-muted-foreground">Page {pinPage+1} of {Math.max(1,Math.ceil(filteredPins.length/Math.max(1,pinPageSize)))}</span>
              <Button variant="outline" size="sm" className="h-7" disabled={(pinPage+1)*pinPageSize>=filteredPins.length} onClick={()=>setPinPage(p=>p+1)}>Next<ChevronRight className="h-4 w-4" /></Button>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="regions" className="space-y-3">
          <div className="flex flex-col gap-2 lg:flex-row lg:items-center">
            <div className="min-w-0 flex-1">
              <div className="relative">
                <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                <Input value={regionQInput} onChange={(e) => setRegionQInput(e.target.value)} placeholder="Search code or name…" className="h-8 bg-background pl-8 pr-8 text-xs shadow-none" />
                {regionQInput && <button type="button" onClick={() => { setRegionQInput(''); setRegionQuery(''); }} className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded p-1 text-muted-foreground hover:bg-muted"><X className="h-3.5 w-3.5" /></button>}
              </div>
            </div>
            <div className="min-w-0 flex-1">
              <Select value={regionActiveFilter} onValueChange={setRegionActiveFilter}>
                <SelectTrigger className="h-8 w-full bg-background text-xs shadow-none"><SelectValue placeholder="Record state" /></SelectTrigger>
                <SelectContent><SelectItem value="ALL">All Records</SelectItem><SelectItem value="ACTIVE">Active</SelectItem><SelectItem value="INACTIVE">Inactive</SelectItem></SelectContent>
              </Select>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <span className="hidden text-xs text-muted-foreground xl:inline">{filteredRegions.length} regions</span>
              <Button size="sm" className="h-8 text-xs" onClick={openCreateRegion}><Plus className="mr-2 h-4 w-4" />Create Region</Button>
            </div>
          </div>
          <div className="overflow-x-auto">
            <Table className="table-fixed text-xs">
              <colgroup><col className="w-[18%]" /><col className="w-[28%]" /><col className="w-[20%]" /><col className="w-[14%]" /><col className="w-[20%]" /></colgroup>
              <TableHeader><TableRow>{['Code','Name','Center','Status','Actions'].map(h => <TableHead key={h} className={h==='Actions' ? 'text-right' : ''}>{h}</TableHead>)}</TableRow></TableHeader>
              <TableBody>
                {regionLoading ? Array.from({length: 6}, (_,i)=><TableRow key={`sk-${i}`}>{Array.from({length:5},(_,c)=><TableCell key={c}><Skeleton className="h-4 w-full max-w-24" /></TableCell>)}</TableRow>)
                  : filteredRegions.length===0 ? <TableRow><TableCell colSpan={5} className="h-24 text-center text-muted-foreground">No regions match.</TableCell></TableRow>
                  : filteredRegions.slice(regionPage*regionPageSize,(regionPage+1)*regionPageSize).map(r=>(
                    <TableRow key={r.id}>
                      <TableCell className="font-mono"><Ellipsis value={r.code} /></TableCell>
                      <TableCell className="font-medium"><Ellipsis value={r.name} /></TableCell>
                      <TableCell><Ellipsis value={r.code ? '—' : '—'} /></TableCell>
                      <TableCell><Ellipsis value={r.active===false ? 'Inactive':'Active'} /></TableCell>
                      <TableCell><div className="flex items-center justify-end gap-1">
                        <Button variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={()=>openEditRegion(r)}>Edit</Button>
                        <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive" disabled={r.active===false} onClick={()=>setRegionDeleteTarget(r)}><Trash2 className="h-3.5 w-3.5" /></Button>
                      </div></TableCell>
                    </TableRow>
                  ))}
              </TableBody>
            </Table>
          </div>
          <div className="flex items-center justify-between gap-2 pt-2">
            <div className="flex items-center gap-2 text-xs"><Label className="text-xs">Rows:</Label>
              <Select value={String(regionPageSize)} onValueChange={v=>{setRegionPage(0); setRegionPageSize(Number(v));}}><SelectTrigger className="h-7 w-16 text-xs"><SelectValue /></SelectTrigger><SelectContent>{[10,12,15,25,50].map(n=><SelectItem key={n} value={String(n)}>{n}</SelectItem>)}</SelectContent></Select>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" className="h-7" disabled={regionPage<=0} onClick={()=>setRegionPage(p=>Math.max(0,p-1))}><ChevronLeft className="h-4 w-4" />Prev</Button>
              <span className="text-xs text-muted-foreground">Page {regionPage+1} of {Math.max(1,Math.ceil(filteredRegions.length/Math.max(1,regionPageSize)))}</span>
              <Button variant="outline" size="sm" className="h-7" disabled={(regionPage+1)*regionPageSize>=filteredRegions.length} onClick={()=>setRegionPage(p=>p+1)}>Next<ChevronRight className="h-4 w-4" /></Button>
            </div>
          </div>
        </TabsContent>
      </Tabs>

      <Dialog open={regionDialogOpen} onOpenChange={(o)=>!regionSaving && setRegionDialogOpen(o)}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editingRegion ? `Edit Region #${editingRegion.id}` : 'New Sales Region'}</DialogTitle><DialogDescription>Code is unique. Name is shown in dropdowns across retail, institution, project.</DialogDescription></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5"><Label>Code *</Label><Input value={regionForm.code} onChange={(e)=>setRegionForm({...regionForm, code: e.target.value.toUpperCase().slice(0,40)})} placeholder="e.g. PUNE" className="uppercase" /></div>
            <div className="space-y-1.5"><Label>Name *</Label><Input value={regionForm.name} onChange={(e)=>setRegionForm({...regionForm, name: e.target.value})} placeholder="e.g. Pune" /></div>
          </div>
          <DialogFooter><Button variant="outline" onClick={()=>setRegionDialogOpen(false)} disabled={regionSaving}>Cancel</Button><Button onClick={()=>void saveRegion()} disabled={regionSaving}>{regionSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}{editingRegion ? 'Save changes' : 'Create region'}</Button></DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog open={!!regionDeleteTarget} onOpenChange={(o)=>!regionDeleting && !o && setRegionDeleteTarget(null)}>
        <DialogContent><DialogHeader><DialogTitle>Deactivate region?</DialogTitle><DialogDescription>{regionDeleteTarget?.name} will be hidden from new selections. Existing records keep their link.</DialogDescription></DialogHeader>
          <DialogFooter><Button variant="outline" onClick={()=>setRegionDeleteTarget(null)} disabled={regionDeleting}>Cancel</Button><Button variant="destructive" onClick={()=>void confirmDeleteRegion()} disabled={regionDeleting}>{regionDeleting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Deactivate</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={pinDialogOpen} onOpenChange={(o)=>!pinSaving && setPinDialogOpen(o)}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editingPin ? `Edit PIN ${editingPin.pinCode}` : 'Map PIN to Region'}</DialogTitle><DialogDescription>6-digit PIN → sales region. Retail onboarding derives region from this master and will block if missing.</DialogDescription></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5"><Label>PIN Code *</Label><Input value={pinForm.pinCode} onChange={(e)=>setPinForm({...pinForm, pinCode: e.target.value.replace(/\D/g,'').slice(0,6)})} inputMode="numeric" placeholder="560006" /></div>
            <div className="space-y-1.5"><Label>Sales Region *</Label>
              <Select value={pinForm.regionId} onValueChange={(v)=>setPinForm({...pinForm, regionId: v})}>
                <SelectTrigger><SelectValue placeholder="Choose region" /></SelectTrigger>
                <SelectContent>{regions.filter(r=>r.active!==false).map(r=><SelectItem key={r.id} value={String(r.id)}>{r.name} ({r.code})</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter><Button variant="outline" onClick={()=>setPinDialogOpen(false)} disabled={pinSaving}>Cancel</Button><Button onClick={()=>void savePin()} disabled={pinSaving}>{pinSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}{editingPin ? 'Save changes' : 'Create mapping'}</Button></DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog open={!!pinDeleteTarget} onOpenChange={(o)=>!pinDeleting && !o && setPinDeleteTarget(null)}>
        <DialogContent><DialogHeader><DialogTitle>Deactivate PIN?</DialogTitle><DialogDescription>{pinDeleteTarget?.pinCode} will be hidden from new validations, but existing accounts keep their PIN.</DialogDescription></DialogHeader>
          <DialogFooter><Button variant="outline" onClick={()=>setPinDeleteTarget(null)} disabled={pinDeleting}>Cancel</Button><Button variant="destructive" onClick={()=>void confirmDeletePin()} disabled={pinDeleting}>{pinDeleting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Deactivate</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
