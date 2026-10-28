'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { BarChart3, CalendarIcon, ChevronLeft, ChevronRight, Edit3, Loader2, Plus } from 'lucide-react';
import { format } from 'date-fns';
import { toast } from 'sonner';
import { useAuth } from '@/components/auth-provider';
import { getErrorMessage } from '@/lib/api-error';
import { RetailAPI, resolvePricingOfficerName, type CompetitorBrand, type RetailDistrict, type RetailEmployee, type RetailPinCode, type RetailPricing, type RetailPricingPayload, type RetailPricingSummary, type RetailSalesRegion } from '@/lib/retail-api';
import { getCorrectedRoleFlags } from '@/lib/auth';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Textarea } from '@/components/ui/textarea';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { SpacedCalendar } from '@/components/ui/spaced-calendar';
import { SearchableSelect, type SearchableOption } from '@/components/ui/searchable-select2';

const today = () => new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 10);
const money = (value: number) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(value);
const emptyForm = (): RetailPricingPayload => ({ competitorBrandId: 0, pricePerTon: 0, city: '', district: '', state: '', pinCode: '', observationDate: today(), remarks: null });

export default function PricingPage() {
  const { token, userRole, userData, currentUser, teamId, correctedRoleFlags } = useAuth();
  const roleFlags = useMemo(
    () => getCorrectedRoleFlags(userRole, currentUser, correctedRoleFlags, teamId),
    [userRole, currentUser, correctedRoleFlags, teamId],
  );
  const [rows, setRows] = useState<RetailPricing[]>([]);
  const [summary, setSummary] = useState<RetailPricingSummary[]>([]);
  const [brands, setBrands] = useState<CompetitorBrand[]>([]);
  const [employees, setEmployees] = useState<RetailEmployee[]>([]);
  const pricingRows = useMemo(() => rows.map((row) => ({ ...row, officerName: resolvePricingOfficerName(row, employees) })), [rows, employees]);
  const [selectedDate, setSelectedDate] = useState(today()); const [selectedCity, setSelectedCity] = useState('ALL'); const [employeeId, setEmployeeId] = useState('ALL');
  const [cities, setCities] = useState<string[]>([]);
  const [page, setPage] = useState(0); const [totalPages, setTotalPages] = useState(1); const [totalElements, setTotalElements] = useState(0);
  const [loading, setLoading] = useState(true); const [saving, setSaving] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false); const [editing, setEditing] = useState<RetailPricing | null>(null); const [form, setForm] = useState<RetailPricingPayload>(emptyForm());
  const [districtMasters, setDistrictMasters] = useState<RetailDistrict[]>([]); const [pinCodeMasters, setPinCodeMasters] = useState<RetailPinCode[]>([]); const [stateMasters, setStateMasters] = useState<RetailSalesRegion[]>([]);
  // null = unrestricted (admins, or no regional assignment found — fails open).
  const [permittedRegionIds, setPermittedRegionIds] = useState<number[] | null>(null);

  const load = useCallback(async () => {
    if (!token) return; setLoading(true);
    try {
      const city = selectedCity === 'ALL' ? undefined : selectedCity;
      const filters = { page, size: 25, from: selectedDate, to: selectedDate, city, assignedEmployeeId: employeeId === 'ALL' ? undefined : Number(employeeId) };
      const [list, totals] = await Promise.all([RetailAPI.getPricing(token, filters), RetailAPI.getPricingSummary(token, { from: selectedDate, to: selectedDate, city, groupBy: 'brand' })]);
      setRows(list.content); setTotalElements(list.totalElements); setTotalPages(Math.max(1, list.totalPages)); setSummary(totals);
    } catch (error) { toast.error(getErrorMessage(error, 'Unable to load pricing.')); }
    finally { setLoading(false); }
  }, [token, page, selectedDate, selectedCity, employeeId]);

  useEffect(() => { if (!token) return; void Promise.all([RetailAPI.getCompetitorBrands(token).then(setBrands), RetailAPI.getEmployees(token).then(setEmployees), RetailAPI.getPricing(token, { page: 0, size: 200 }).then((result) => setCities(Array.from(new Set(result.content.map((row) => row.city).filter(Boolean))).sort()))]); RetailAPI.getDistricts(token, { active: true }).then(setDistrictMasters).catch(() => {}); RetailAPI.getSalesRegions(token).then((list) => { const active = list.filter((r) => r.active !== false); if (active.length > 0) setStateMasters(active); }).catch(() => {}); RetailAPI.getPinCodes(token).then((list) => setPinCodeMasters(list.filter((pin) => pin.active !== false))).catch(() => {}); RetailAPI.getPermittedRegionIds(token, { employeeId: userData?.employeeId ?? null, isManager: roleFlags.isManager }).then(setPermittedRegionIds).catch(() => setPermittedRegionIds(null)); }, [token, roleFlags.isManager, userData?.employeeId]);
  useEffect(() => { void load(); }, [load]);
  useEffect(() => { setPage(0); }, [selectedDate, selectedCity, employeeId]);

  const openCreate = () => { setEditing(null); setForm({ ...emptyForm(), competitorBrandId: brands[0]?.id || 0 }); setSheetOpen(true); };
  const openEdit = (row: RetailPricing) => { setEditing(row); setForm({ competitorBrandId: row.competitorBrandId, pricePerTon: row.pricePerTon, city: row.city, district: row.district || '', state: row.state, pinCode: row.pinCode, observationDate: row.observationDate, remarks: row.remarks }); setSheetOpen(true); };
  const isPinValid = form.pinCode === '' || /^\d{6}$/.test(form.pinCode);
  const pricingStateOptions = useMemo(() => stateMasters.map((r) => ({ value: r.name, label: r.name })).sort((a, b) => a.label.localeCompare(b.label)), [stateMasters]);
  const useStateDropdown = stateMasters.length > 0 && (form.state === '' || pricingStateOptions.some((o) => o.value === form.state));
  // The state field holds a sales-region name: scope districts/PINs to that region.
  // Restricted users only see permitted regions; entries with unknown region are always kept.
  const selectedPricingRegion = useMemo(
    () => stateMasters.find((r) => r.name === form.state.trim()) ?? null,
    [stateMasters, form.state],
  );
  const scopeToSelectedRegion = useCallback(<T extends { regionId?: number | null; regionName?: string | null }>(items: T[]): T[] => {
    if (!selectedPricingRegion) return items;
    const scoped = items.filter((item) => {
      if (item.regionId != null) return item.regionId === selectedPricingRegion.id;
      if (item.regionName) return item.regionName === selectedPricingRegion.name;
      return true;
    });
    return scoped.length > 0 ? scoped : items;
  }, [selectedPricingRegion]);
  const pricingDistrictOptions = useMemo(() => {
    const permitted = permittedRegionIds == null
      ? districtMasters
      : districtMasters.filter((d) => d.regionId == null || permittedRegionIds.includes(d.regionId));
    const pool = scopeToSelectedRegion(permitted);
    const seen = new Set<string>();
    return pool.flatMap((d) => {
      if (seen.has(d.name)) return [];
      seen.add(d.name);
      return [{ value: d.name, label: d.regionName ? `${d.name} · ${d.regionName}` : d.name }];
    }).sort((a, b) => a.label.localeCompare(b.label));
  }, [districtMasters, permittedRegionIds, scopeToSelectedRegion]);
  const pricingPinOptions = useMemo(() => {
    const permitted = permittedRegionIds == null
      ? pinCodeMasters
      : pinCodeMasters.filter((p) => p.regionId == null || permittedRegionIds.includes(p.regionId));
    const pool = scopeToSelectedRegion(permitted);
    return pool.map((p) => ({ value: p.pinCode, label: p.regionName ? `${p.pinCode} · ${p.regionName}` : p.pinCode }));
  }, [pinCodeMasters, permittedRegionIds, scopeToSelectedRegion]);
  const useDistrictDropdown = districtMasters.length > 0 && (form.district === '' || pricingDistrictOptions.some((o) => o.value === form.district));
  const usePinDropdown = pinCodeMasters.length > 0 && (form.pinCode === '' || pinCodeMasters.some((p) => p.pinCode === form.pinCode));
  const hasStateSelected = form.state.trim() !== '';
  // Hide the PIN field when the selected state has no mapped PINs (and none is set).
  const regionPinCount = useMemo(() => {
    if (!selectedPricingRegion || pinCodeMasters.length === 0) return -1;
    const base = permittedRegionIds == null
      ? pinCodeMasters
      : pinCodeMasters.filter((p) => p.regionId == null || permittedRegionIds.includes(p.regionId));
    return base.filter((p) => (p.regionId != null && p.regionId === selectedPricingRegion.id) || (p.regionId == null && p.regionName != null && p.regionName === selectedPricingRegion.name)).length;
  }, [selectedPricingRegion, pinCodeMasters, permittedRegionIds]);
  const hidePinField = usePinDropdown && !!selectedPricingRegion && form.pinCode === '' && regionPinCount === 0;
  const isOutOfScope = (regionId: number | null | undefined): boolean =>
    regionId != null && permittedRegionIds != null && !permittedRegionIds.includes(regionId);
  const isFormValid = Boolean(form.competitorBrandId) && form.pricePerTon > 0 && form.city.trim() !== '' && form.state.trim() !== '' && isPinValid && form.observationDate !== '' && form.observationDate <= today();
  const save = async () => {
    if (!token) return;
    if (!form.competitorBrandId || form.pricePerTon <= 0 || !form.city.trim() || !form.state.trim() || !form.observationDate) { toast.error('Brand, positive price, city, state and date are required.'); return; }
    if (form.pinCode !== '' && !/^\d{6}$/.test(form.pinCode)) { toast.error('PIN code must be 6 digits, or leave it empty.'); return; }
    if (form.observationDate > today()) { toast.error('Observation date cannot be in the future.'); return; }
    const districtRegion = districtMasters.find((d) => d.name === form.district.trim())?.regionId;
    const pinRegion = pinCodeMasters.find((p) => p.pinCode === form.pinCode)?.regionId;
    if (isOutOfScope(districtRegion) || isOutOfScope(pinRegion)) { toast.error('The selected market is outside your permitted sales regions.'); return; }
    setSaving(true);
    try { if (editing) await RetailAPI.updatePricing(editing.id, form, token); else await RetailAPI.createPricing(form, token); toast.success(editing ? 'Pricing updated.' : 'Pricing recorded.'); setSheetOpen(false); await load(); }
    catch (error) { toast.error(getErrorMessage(error, 'Unable to save pricing.')); }
    finally { setSaving(false); }
  };

  return <div className="space-y-4 py-4">
    <div className="flex flex-col gap-3 border-b border-border/70 pb-4 lg:flex-row lg:items-end">
      <div className="min-w-0 space-y-1.5 lg:w-[180px]"><Label className="text-xs font-medium">City</Label><Select value={selectedCity} onValueChange={setSelectedCity}><SelectTrigger className="h-9 w-full text-sm shadow-none"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="ALL">All cities</SelectItem>{cities.map((value) => <SelectItem key={value} value={value}>{value}</SelectItem>)}</SelectContent></Select></div>
      <div className="min-w-0 space-y-1.5 lg:w-[190px]"><Label className="text-xs font-medium">Date</Label><Popover><PopoverTrigger asChild><Button variant="outline" className="h-9 w-full justify-start text-left text-sm font-normal shadow-none"><CalendarIcon className="mr-2 h-4 w-4" />{format(new Date(`${selectedDate}T00:00:00`), 'MMM dd, yyyy')}</Button></PopoverTrigger><PopoverContent className="w-auto p-0" align="start"><SpacedCalendar mode="single" defaultMonth={new Date(`${selectedDate}T00:00:00`)} selected={new Date(`${selectedDate}T00:00:00`)} disabled={{ after: new Date() }} onSelect={(date) => date && setSelectedDate(format(date, 'yyyy-MM-dd'))} /></PopoverContent></Popover></div>
      <div className="min-w-0 space-y-1.5 lg:w-[240px]"><Label className="text-xs font-medium">Field officer</Label><SearchableSelect options={employees.map((employee): SearchableOption => ({ value: String(employee.id), label: `${employee.firstName} ${employee.lastName}`.trim() }))} value={employeeId === 'ALL' ? undefined : employeeId} onSelect={(option) => setEmployeeId(option?.value || 'ALL')} placeholder="All field officers" searchPlaceholder="Search field officers..." emptyMessage="No field officers found" allowClear triggerClassName="h-9 w-full text-sm shadow-none" contentClassName="w-[var(--radix-popover-trigger-width)]" /></div>
      <Button onClick={openCreate}><Plus className="mr-2 h-4 w-4" />Record price</Button>
    </div>

    <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,36rem),1fr))] items-start gap-4">
      <Card className="min-w-0 gap-0 overflow-hidden py-0 shadow-none"><CardHeader className="border-b px-4 py-3"><CardTitle className="text-sm font-semibold">Recorded prices</CardTitle><p className="text-xs text-muted-foreground">{totalElements} prices for the selected day and market.</p></CardHeader><CardContent className="p-0"><div className="max-h-[420px] overflow-auto"><Table className="table-fixed text-xs"><TableHeader className="sticky top-0 z-10 bg-muted/95 backdrop-blur"><TableRow><TableHead className="w-[28%]">Brand</TableHead><TableHead className="w-[22%] text-right">Price/ton</TableHead><TableHead className="w-[20%]">City</TableHead><TableHead className="w-[22%]">Field officer</TableHead><TableHead className="w-[8%]" /></TableRow></TableHeader><TableBody>{loading ? Array.from({ length: 5 }, (_, index) => <TableRow key={index}><TableCell colSpan={5}><Skeleton className="h-4 w-full" /></TableCell></TableRow>) : pricingRows.length === 0 ? <TableRow><TableCell colSpan={5} className="h-48 text-center text-muted-foreground">No pricing observations for this selection.</TableCell></TableRow> : pricingRows.map((row) => <TableRow key={row.id}><TableCell className="font-medium">{row.brandName}</TableCell><TableCell className="text-right font-semibold">{money(row.pricePerTon)}</TableCell><TableCell>{row.city}</TableCell><TableCell className="whitespace-normal break-words" title={row.officerName}>{row.officerName}</TableCell><TableCell><Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => openEdit(row)}><Edit3 className="h-3.5 w-3.5" /></Button></TableCell></TableRow>)}</TableBody></Table></div></CardContent></Card>
      <Card className="min-w-0 gap-0 overflow-hidden py-0 shadow-none"><CardHeader className="border-b px-4 py-3"><CardTitle className="text-sm font-semibold">Price comparison by brand</CardTitle><p className="text-xs text-muted-foreground">Average and range per ton.</p></CardHeader><CardContent className="p-4"><div className="space-y-4">{summary.length ? summary.map((item) => { const ceiling = Math.max(...summary.map((entry) => entry.maxPrice), 1); return <div key={`${item.competitorBrandId}-${item.city || ''}`}><div className="mb-1.5 flex items-end justify-between gap-3"><div><p className="text-sm font-medium">{item.brandName}</p><p className="text-xs text-muted-foreground">{item.count} observation{item.count === 1 ? '' : 's'} · {money(item.minPrice)}–{money(item.maxPrice)}</p></div><p className="text-sm font-semibold">{money(item.avgPrice)}</p></div><div className="h-2 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-primary" style={{ width: `${Math.max(4, (item.avgPrice / ceiling) * 100)}%` }} /></div></div>; }) : <div className="flex h-64 flex-col items-center justify-center gap-2 text-muted-foreground"><BarChart3 className="h-7 w-7 stroke-[1.5]" /><span className="text-sm font-medium text-foreground">Nothing to compare yet</span><span className="text-xs">No summary data for the selected day and market.</span></div>}</div></CardContent></Card>
    </div>
    <div className="flex items-center justify-end gap-2"><Button variant="outline" size="sm" disabled={page === 0 || loading} onClick={() => setPage((value) => value - 1)}><ChevronLeft className="h-4 w-4" />Previous</Button><span className="text-xs text-muted-foreground">Page {page + 1} of {totalPages}</span><Button variant="outline" size="sm" disabled={page + 1 >= totalPages || loading} onClick={() => setPage((value) => value + 1)}>Next<ChevronRight className="h-4 w-4" /></Button></div>

    <Sheet open={sheetOpen} onOpenChange={(open) => !saving && setSheetOpen(open)}><SheetContent className="flex w-full flex-col sm:max-w-xl"><SheetHeader className="border-b pb-4"><SheetTitle>{editing ? 'Edit pricing observation' : 'Record pricing observation'}</SheetTitle><SheetDescription>{editing ? 'Update the competitor price observation details.' : 'Fill in the brand, price, market and date to record a new competitor price observation.'}</SheetDescription></SheetHeader><form onSubmit={(e) => { e.preventDefault(); void save(); }} className="flex min-h-0 flex-1 flex-col"><div className="grid min-h-0 flex-1 content-start gap-4 overflow-y-auto py-4 sm:grid-cols-2">
      <div className="sm:col-span-2"><Label htmlFor="pricing-brand">Competitor brand *</Label><Select value={form.competitorBrandId ? String(form.competitorBrandId) : ''} onValueChange={(value) => setForm({ ...form, competitorBrandId: Number(value) })}><SelectTrigger id="pricing-brand" aria-required="true" aria-invalid={!form.competitorBrandId} className={`mt-1${!form.competitorBrandId ? ' border-destructive' : ''}`}><SelectValue placeholder="Select brand" /></SelectTrigger><SelectContent>{brands.map((brand) => <SelectItem key={brand.id} value={String(brand.id)}>{brand.name}</SelectItem>)}</SelectContent></Select></div>
      <div><Label htmlFor="pricing-price">Price per MT *</Label><Input id="pricing-price" type="number" min="0.01" step="0.01" required aria-invalid={form.pricePerTon <= 0} value={form.pricePerTon || ''} onChange={(e) => setForm({ ...form, pricePerTon: Number(e.target.value) })} className="mt-1" /></div><div><Label htmlFor="pricing-date">Observation date *</Label><Input id="pricing-date" type="date" max={today()} required aria-invalid={!form.observationDate} value={form.observationDate} onChange={(e) => setForm({ ...form, observationDate: e.target.value })} className="mt-1" /></div>
      <div><Label htmlFor="pricing-city">City *</Label><Input id="pricing-city" required aria-invalid={!form.city.trim()} value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} className="mt-1" /></div><div><Label htmlFor="pricing-state">State *</Label>{useStateDropdown ? <SearchableSelect value={form.state || undefined} options={pricingStateOptions} onSelect={(option) => {
                      const name = option?.value ?? '';
                      const regionId = stateMasters.find((r) => r.name === name)?.id ?? null;
                      setForm((prev) => {
                        const keepDistrict = !name || !prev.district || regionId == null || districtMasters.some((d) => d.name === prev.district && (d.regionId == null || d.regionId === regionId));
                        const keepPin = !name || !prev.pinCode || regionId == null || pinCodeMasters.some((p) => p.pinCode === prev.pinCode && (p.regionId == null || p.regionId === regionId));
                        return { ...prev, state: name, district: keepDistrict ? prev.district : '', pinCode: keepPin ? prev.pinCode : '' };
                      });
                    }} placeholder="Select state" searchPlaceholder="Search states..." emptyMessage="No matching state" required triggerClassName="mt-1 w-full" contentClassName="w-[var(--radix-popover-trigger-width)]" /> : <Input id="pricing-state" required aria-invalid={!form.state.trim()} value={form.state} onChange={(e) => setForm({ ...form, state: e.target.value })} className="mt-1" />}</div><div><Label htmlFor="pricing-district">District</Label>{useDistrictDropdown ? <SearchableSelect value={form.district || undefined} options={pricingDistrictOptions} onSelect={(option) => setForm({ ...form, district: option?.value ?? '' })} disabled={!hasStateSelected} placeholder={!hasStateSelected ? 'Select state first' : 'Select district'} searchPlaceholder="Search districts..." emptyMessage="No matching district" triggerClassName="mt-1 w-full" contentClassName="w-[var(--radix-popover-trigger-width)]" /> : <Input id="pricing-district" value={form.district} disabled={!hasStateSelected} onChange={(e) => setForm({ ...form, district: e.target.value })} className="mt-1" placeholder={!hasStateSelected ? 'Select state first' : undefined} />}</div>{hidePinField ? null : <div><Label htmlFor="pricing-pin">PIN code</Label>{usePinDropdown ? <SearchableSelect value={form.pinCode || undefined} options={pricingPinOptions} onSelect={(option) => setForm({ ...form, pinCode: option?.value ?? '' })} disabled={!hasStateSelected} placeholder={!hasStateSelected ? 'Select state first' : 'Select PIN code'} searchPlaceholder="Search PIN codes..." emptyMessage="No matching PIN code" triggerClassName="mt-1 w-full" contentClassName="w-[var(--radix-popover-trigger-width)]" /> : <Input id="pricing-pin" inputMode="numeric" maxLength={6} aria-invalid={!isPinValid} value={form.pinCode} disabled={!hasStateSelected} onChange={(e) => setForm({ ...form, pinCode: e.target.value.replace(/\D/g, '').slice(0, 6) })} className="mt-1" placeholder={!hasStateSelected ? 'Select state first' : 'Optional'} />}</div>}
      <div className="sm:col-span-2"><Label htmlFor="pricing-remarks">Remarks</Label><Textarea id="pricing-remarks" value={form.remarks || ''} onChange={(e) => setForm({ ...form, remarks: e.target.value || null })} className="mt-1" /></div>
    </div><SheetFooter className="border-t pt-4"><Button type="button" variant="outline" onClick={() => setSheetOpen(false)} disabled={saving}>Cancel</Button><Button type="submit" disabled={saving || !isFormValid} title={!isFormValid ? 'Fill all mandatory fields to enable saving' : undefined}>{saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}{editing ? 'Save changes' : 'Record price'}</Button></SheetFooter></form></SheetContent></Sheet>
  </div>;
}
