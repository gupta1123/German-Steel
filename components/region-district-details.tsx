'use client';

import { AdminRemovalAction } from '@/components/admin-removal-action';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { RetailAPI, type RetailDistrict, type RetailSalesRegion } from '@/lib/retail-api';
import { getErrorMessage } from '@/lib/api-error';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

export function RegionDistrictDetails({ region, regions, token, canManage, onClose }: {
  region: RetailSalesRegion; regions: RetailSalesRegion[]; token: string; canManage: boolean; onClose: () => void;
}) {
  const [assigned, setAssigned] = useState<RetailDistrict[]>([]);
  const [master, setMaster] = useState<RetailDistrict[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [selectedId, setSelectedId] = useState('');
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState<RetailDistrict | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [form, setForm] = useState({ code: '', name: '', state: '', regionId: String(region.id), active: true });

  const load = async () => {
    setLoading(true); setLoadError('');
    try {
      const [districts, all] = await Promise.all([
        RetailAPI.getDistricts(token, { regionId: region.id, active: true }),
        RetailAPI.getDistricts(token),
      ]);
      setAssigned(districts); setMaster(all);
    } catch (error) { setLoadError(getErrorMessage(error, 'Unable to load districts.')); }
    finally { setLoading(false); }
  };

  useEffect(() => {
    let cancelled = false;
    Promise.all([RetailAPI.getDistricts(token, { regionId: region.id, active: true }), RetailAPI.getDistricts(token)])
      .then(([districts, all]) => { if (!cancelled) { setAssigned(districts); setMaster(all); } })
      .catch(error => { if (!cancelled) setLoadError(getErrorMessage(error, 'Unable to load districts.')); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [region.id, token]);

  const assign = async () => {
    if (!canManage || region.active === false) return;
    const district = master.find(item => String(item.id) === selectedId);
    if (!district?.id || !district.code || !district.stateName) { toast.error('Choose a district with a saved code and state.'); return; }
    setSaving(true);
    try {
      await RetailAPI.updateDistrict(district.id, { code: district.code, name: district.name, state: district.stateName, regionId: region.id, active: district.active !== false }, token);
      toast.success(`${district.name} assigned to ${region.name}.`); setSelectedId(''); await load();
    } catch (error) { toast.error(getErrorMessage(error, 'Unable to assign district.')); }
    finally { setSaving(false); }
  };

  const openForm = (district?: RetailDistrict) => {
    setEditing(district ?? null);
    setForm(district ? { code: district.code ?? '', name: district.name, state: district.stateName ?? '', regionId: String(district.regionId ?? region.id), active: district.active !== false } : { code: '', name: '', state: '', regionId: String(region.id), active: true });
    setFormOpen(true);
  };

  const saveDistrict = async () => {
    if (!canManage) return;
    if (!form.code.trim() || !form.name.trim() || !form.state.trim() || !form.regionId) { toast.error('Code, name, state and region are required.'); return; }
    setSaving(true);
    try {
      const payload = { code: form.code.trim().toUpperCase(), name: form.name.trim(), state: form.state.trim(), regionId: Number(form.regionId), active: form.active };
      if (editing?.id) await RetailAPI.updateDistrict(editing.id, payload, token); else await RetailAPI.createDistrict(payload, token);
      toast.success(editing ? 'District updated.' : 'District created and assigned.'); setFormOpen(false); await load();
    } catch (error) { toast.error(getErrorMessage(error, 'Unable to save district.')); }
    finally { setSaving(false); }
  };

  const candidates = master.filter(district => district.id != null && district.active !== false && district.regionId !== region.id);
  const selected = candidates.find(district => String(district.id) === selectedId);
  return <>
    <Dialog open onOpenChange={open => { if (!open && !saving) onClose(); }}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader><DialogTitle>{region.name} — Region Details</DialogTitle><DialogDescription>{region.code} · {region.active === false ? 'Inactive' : 'Active'} · Center: {region.centerLatitude != null && region.centerLongitude != null ? `${region.centerLatitude}, ${region.centerLongitude}` : 'Not set'}</DialogDescription></DialogHeader>
        {loadError && <div role="alert" className="text-sm text-destructive">{loadError}<Button variant="link" onClick={() => void load()}>Retry</Button></div>}
        <div className="flex items-center justify-between"><h3 className="text-sm font-semibold">Assigned Districts ({assigned.length})</h3>{canManage && region.active !== false && <Button size="sm" disabled={loading || saving} onClick={() => openForm()}>Create District</Button>}</div>
        {loading ? <p className="text-sm text-muted-foreground">Loading districts…</p> : !loadError && <div className="max-h-64 overflow-auto rounded-md border"><table className="w-full text-sm"><thead><tr className="border-b"><th className="p-2 text-left">District</th><th className="p-2 text-left">State</th><th className="p-2 text-left">Code</th>{canManage && <th className="p-2 text-right">Actions</th>}</tr></thead><tbody>{assigned.map((district, index) => <tr key={district.id ?? index} className="border-b last:border-0"><td className="p-2">{district.name}</td><td className="p-2">{district.stateName || '—'}</td><td className="p-2">{district.code || '—'}</td>{canManage && <td className="p-2 text-right">{district.id && <AdminRemovalAction endpoint={`/api/common/districts/${district.id}`} name={district.name} description="Deactivate this sales district. Existing records will keep their links." disabled={saving} onRemoved={load} />}<Button size="sm" variant="outline" disabled={!district.id || saving} onClick={() => openForm(district)}>Edit / Move</Button></td>}</tr>)}{!assigned.length && <tr><td className="p-4 text-muted-foreground" colSpan={canManage ? 4 : 3}>No active districts assigned.</td></tr>}</tbody></table></div>}
        {canManage && region.active !== false && <div className="space-y-2 border-t pt-4"><Label>Assign Existing District</Label><Select value={selectedId} onValueChange={setSelectedId} disabled={loading || saving || Boolean(loadError)}><SelectTrigger aria-label="Existing district"><SelectValue placeholder="Choose from district master" /></SelectTrigger><SelectContent>{candidates.map(district => <SelectItem key={district.id} value={String(district.id)}>{district.name} · {district.stateName || 'State not set'} · {district.code}{district.regionId ? ` (${regions.find(item => item.id === district.regionId)?.name || district.regionName || 'Another region'})` : ' (Unassigned)'}</SelectItem>)}</SelectContent></Select>{selected?.regionId && <p className="text-xs text-muted-foreground">Assigning this district moves it from its current region to {region.name}.</p>}<Button disabled={!selectedId || saving || loading || Boolean(loadError)} onClick={() => void assign()}>{saving ? 'Saving…' : 'Assign District'}</Button></div>}
        <DialogFooter><Button variant="outline" disabled={saving} onClick={onClose}>Close</Button></DialogFooter>
      </DialogContent>
    </Dialog>
    <Dialog open={formOpen} onOpenChange={open => { if (!saving) setFormOpen(open); }}><DialogContent><DialogHeader><DialogTitle>{editing ? 'Edit District' : 'Create District'}</DialogTitle><DialogDescription>Choose a region to assign or move this district.</DialogDescription></DialogHeader>
      <div className="space-y-3"><div><Label htmlFor="district-code">Code *</Label><Input id="district-code" value={form.code} onChange={event => setForm({ ...form, code: event.target.value.toUpperCase() })} /></div><div><Label htmlFor="district-name">Name *</Label><Input id="district-name" value={form.name} onChange={event => setForm({ ...form, name: event.target.value })} /></div><div><Label htmlFor="district-state">State *</Label><Input id="district-state" value={form.state} onChange={event => setForm({ ...form, state: event.target.value })} /></div><div><Label>Region *</Label><Select value={form.regionId} onValueChange={regionId => setForm({ ...form, regionId })}><SelectTrigger aria-label="District region"><SelectValue /></SelectTrigger><SelectContent>{regions.filter(item => item.active !== false || String(item.id) === form.regionId).map(item => <SelectItem key={item.id} value={String(item.id)}>{item.name}</SelectItem>)}</SelectContent></Select></div></div>
      <DialogFooter><Button variant="outline" disabled={saving} onClick={() => setFormOpen(false)}>Cancel</Button><Button disabled={saving} onClick={() => void saveDistrict()}>{saving ? 'Saving…' : 'Save District'}</Button></DialogFooter>
    </DialogContent></Dialog>
  </>;
}
