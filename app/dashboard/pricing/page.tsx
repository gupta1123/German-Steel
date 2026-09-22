'use client';

import { useCallback, useEffect, useState } from 'react';
import { BarChart3, CalendarIcon, ChevronLeft, ChevronRight, Edit3, Loader2, Plus } from 'lucide-react';
import { format } from 'date-fns';
import { toast } from 'sonner';
import { useAuth } from '@/components/auth-provider';
import { getErrorMessage } from '@/lib/api-error';
import { RetailAPI, type CompetitorBrand, type RetailEmployee, type RetailPricing, type RetailPricingPayload, type RetailPricingSummary } from '@/lib/retail-api';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Sheet, SheetContent, SheetFooter, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Textarea } from '@/components/ui/textarea';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { SpacedCalendar } from '@/components/ui/spaced-calendar';
import { SearchableSelect, type SearchableOption } from '@/components/ui/searchable-select2';

const today = () => new Date().toISOString().slice(0, 10);
const money = (value: number) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(value);
const emptyForm = (): RetailPricingPayload => ({ competitorBrandId: 0, pricePerTon: 0, city: '', district: '', state: '', pinCode: '', observationDate: today(), remarks: null });

export default function PricingPage() {
  const { token } = useAuth();
  const [rows, setRows] = useState<RetailPricing[]>([]);
  const [summary, setSummary] = useState<RetailPricingSummary[]>([]);
  const [brands, setBrands] = useState<CompetitorBrand[]>([]);
  const [employees, setEmployees] = useState<RetailEmployee[]>([]);
  const [selectedDate, setSelectedDate] = useState(today()); const [selectedCity, setSelectedCity] = useState('ALL'); const [employeeId, setEmployeeId] = useState('ALL');
  const [cities, setCities] = useState<string[]>([]);
  const [page, setPage] = useState(0); const [totalPages, setTotalPages] = useState(1); const [totalElements, setTotalElements] = useState(0);
  const [loading, setLoading] = useState(true); const [saving, setSaving] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false); const [editing, setEditing] = useState<RetailPricing | null>(null); const [form, setForm] = useState<RetailPricingPayload>(emptyForm());

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

  useEffect(() => { if (!token) return; void Promise.all([RetailAPI.getCompetitorBrands(token).then(setBrands), RetailAPI.getEmployees(token).then(setEmployees), RetailAPI.getPricing(token, { page: 0, size: 200 }).then((result) => setCities(Array.from(new Set(result.content.map((row) => row.city).filter(Boolean))).sort()))]); }, [token]);
  useEffect(() => { void load(); }, [load]);
  useEffect(() => { setPage(0); }, [selectedDate, selectedCity, employeeId]);

  const openCreate = () => { setEditing(null); setForm({ ...emptyForm(), competitorBrandId: brands[0]?.id || 0 }); setSheetOpen(true); };
  const openEdit = (row: RetailPricing) => { setEditing(row); setForm({ competitorBrandId: row.competitorBrandId, pricePerTon: row.pricePerTon, city: row.city, district: row.district || '', state: row.state, pinCode: row.pinCode, observationDate: row.observationDate, remarks: row.remarks }); setSheetOpen(true); };
  const save = async () => {
    if (!token) return;
    if (!form.competitorBrandId || form.pricePerTon <= 0 || !form.city.trim() || !form.district.trim() || !form.state.trim() || !/^\d{6}$/.test(form.pinCode) || !form.observationDate) { toast.error('Brand, positive price, city, district, state, 6-digit PIN code and date are required.'); return; }
    if (form.observationDate > today()) { toast.error('Observation date cannot be in the future.'); return; }
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
      <Card className="min-w-0 gap-0 overflow-hidden py-0 shadow-none"><CardHeader className="border-b px-4 py-3"><CardTitle className="text-sm font-semibold">Recorded prices</CardTitle><p className="text-xs text-muted-foreground">{totalElements} prices for the selected day and market.</p></CardHeader><CardContent className="p-0"><div className="max-h-[420px] overflow-auto"><Table className="table-fixed text-xs"><TableHeader className="sticky top-0 z-10 bg-muted/95 backdrop-blur"><TableRow><TableHead className="w-[28%]">Brand</TableHead><TableHead className="w-[22%] text-right">Price/ton</TableHead><TableHead className="w-[20%]">City</TableHead><TableHead className="w-[22%]">Field officer</TableHead><TableHead className="w-[8%]" /></TableRow></TableHeader><TableBody>{loading ? Array.from({ length: 5 }, (_, index) => <TableRow key={index}><TableCell colSpan={5}><Skeleton className="h-4 w-full" /></TableCell></TableRow>) : rows.length === 0 ? <TableRow><TableCell colSpan={5} className="h-48 text-center text-muted-foreground">No pricing observations for this selection.</TableCell></TableRow> : rows.map((row) => <TableRow key={row.id}><TableCell className="font-medium">{row.brandName}</TableCell><TableCell className="text-right font-semibold">{money(row.pricePerTon)}</TableCell><TableCell>{row.city}</TableCell><TableCell className="truncate">{row.createdByEmployeeName || '—'}</TableCell><TableCell><Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => openEdit(row)}><Edit3 className="h-3.5 w-3.5" /></Button></TableCell></TableRow>)}</TableBody></Table></div></CardContent></Card>
      <Card className="min-w-0 gap-0 overflow-hidden py-0 shadow-none"><CardHeader className="border-b px-4 py-3"><CardTitle className="text-sm font-semibold">Price comparison by brand</CardTitle><p className="text-xs text-muted-foreground">Average and range per ton.</p></CardHeader><CardContent className="p-4"><div className="space-y-4">{summary.length ? summary.map((item) => { const ceiling = Math.max(...summary.map((entry) => entry.maxPrice), 1); return <div key={`${item.competitorBrandId}-${item.city || ''}`}><div className="mb-1.5 flex items-end justify-between gap-3"><div><p className="text-sm font-medium">{item.brandName}</p><p className="text-xs text-muted-foreground">{item.count} observation{item.count === 1 ? '' : 's'} · {money(item.minPrice)}–{money(item.maxPrice)}</p></div><p className="text-sm font-semibold">{money(item.avgPrice)}</p></div><div className="h-2 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-primary" style={{ width: `${Math.max(4, (item.avgPrice / ceiling) * 100)}%` }} /></div></div>; }) : <div className="flex h-64 flex-col items-center justify-center gap-2 text-muted-foreground"><BarChart3 className="h-7 w-7 stroke-[1.5]" /><span className="text-sm font-medium text-foreground">Nothing to compare yet</span><span className="text-xs">No summary data for the selected day and market.</span></div>}</div></CardContent></Card>
    </div>
    <div className="flex items-center justify-end gap-2"><Button variant="outline" size="sm" disabled={page === 0 || loading} onClick={() => setPage((value) => value - 1)}><ChevronLeft className="h-4 w-4" />Previous</Button><span className="text-xs text-muted-foreground">Page {page + 1} of {totalPages}</span><Button variant="outline" size="sm" disabled={page + 1 >= totalPages || loading} onClick={() => setPage((value) => value + 1)}>Next<ChevronRight className="h-4 w-4" /></Button></div>

    <Sheet open={sheetOpen} onOpenChange={(open) => !saving && setSheetOpen(open)}><SheetContent className="flex w-full flex-col sm:max-w-xl"><SheetHeader className="border-b pb-4"><SheetTitle>{editing ? 'Edit pricing observation' : 'Record pricing observation'}</SheetTitle></SheetHeader><div className="grid min-h-0 flex-1 gap-4 overflow-y-auto py-4 sm:grid-cols-2">
      <div className="sm:col-span-2"><Label>Competitor brand *</Label><Select value={form.competitorBrandId ? String(form.competitorBrandId) : ''} onValueChange={(value) => setForm({ ...form, competitorBrandId: Number(value) })}><SelectTrigger className="mt-1"><SelectValue placeholder="Select brand" /></SelectTrigger><SelectContent>{brands.map((brand) => <SelectItem key={brand.id} value={String(brand.id)}>{brand.name}</SelectItem>)}</SelectContent></Select></div>
      <div><Label>Price per MT *</Label><Input type="number" min="0.01" step="0.01" value={form.pricePerTon || ''} onChange={(e) => setForm({ ...form, pricePerTon: Number(e.target.value) })} className="mt-1" /></div><div><Label>Observation date *</Label><Input type="date" max={today()} value={form.observationDate} onChange={(e) => setForm({ ...form, observationDate: e.target.value })} className="mt-1" /></div>
      <div><Label>City *</Label><Input value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} className="mt-1" /></div><div><Label>District *</Label><Input value={form.district} onChange={(e) => setForm({ ...form, district: e.target.value })} className="mt-1" /></div><div><Label>State *</Label><Input value={form.state} onChange={(e) => setForm({ ...form, state: e.target.value })} className="mt-1" /></div><div><Label>PIN code *</Label><Input inputMode="numeric" maxLength={6} value={form.pinCode} onChange={(e) => setForm({ ...form, pinCode: e.target.value.replace(/\D/g, '').slice(0, 6) })} className="mt-1" /></div>
      <div className="sm:col-span-2"><Label>Remarks</Label><Textarea value={form.remarks || ''} onChange={(e) => setForm({ ...form, remarks: e.target.value || null })} className="mt-1" /></div>
    </div><SheetFooter className="border-t pt-4"><Button variant="outline" onClick={() => setSheetOpen(false)} disabled={saving}>Cancel</Button><Button onClick={() => void save()} disabled={saving}>{saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}{editing ? 'Save changes' : 'Record price'}</Button></SheetFooter></SheetContent></Sheet>
  </div>;
}
