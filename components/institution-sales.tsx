'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { InstitutionSalesAPI, type InstitutionCycle, type InstitutionSale, type InstitutionSalePayload } from '@/lib/institution-sales-api';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Textarea } from './ui/textarea';
import { FormField, FormGroup, FormSheet, Section, Pill, EmptyState, today, formatDay } from './detail-ui';

const empty = () => ({ applicationCycleId: '', saleDate: today(), quantityMt: '', outcomeStatus: 'WIN' as 'WIN' | 'LOST', poDate: today(), poNumber: '', invoiceReference: '', lossReason: '' });
export default function InstitutionSales({ institutionId, name, token }: { institutionId: number; name: string; token: string }) {
  const [sales, setSales] = useState<InstitutionSale[]>([]);
  const [cycles, setCycles] = useState<InstitutionCycle[]>([]);
  const [error, setError] = useState('');
  const [cycleError, setCycleError] = useState('');
  const [cyclesLoaded, setCyclesLoaded] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<InstitutionSale | null>(null);
  const [voiding, setVoiding] = useState<InstitutionSale | null>(null);
  const [reason, setReason] = useState('');
  const [draft, setDraft] = useState(empty);
  const [page, setPage] = useState(0);
  const requestVersion = useRef(0);
  const load = useCallback(async () => {
    const version = ++requestVersion.current;
    setLoading(true); setError('');
    try { const rows = await InstitutionSalesAPI.list(institutionId, token); if (version === requestVersion.current) { setSales(rows); setPage(0); } }
    catch (e) { if (version === requestVersion.current) { setSales([]); setError(e instanceof Error ? e.message : 'Unable to load sales.'); } }
    finally { if (version === requestVersion.current) setLoading(false); }
  }, [institutionId, token]);
  useEffect(() => { void load(); return () => { requestVersion.current += 1; }; }, [load]);
  useEffect(() => { let active = true; setCycles([]); setCyclesLoaded(false); setCycleError(''); InstitutionSalesAPI.cycles(institutionId, token).then((rows) => { if (active) setCycles(rows.filter((row) => row.institutionId === institutionId).sort((a, b) => b.cycleNumber - a.cycleNumber)); }).catch((e) => { if (active) setCycleError(e.message || 'Unable to load application cycles.'); }).finally(() => { if (active) setCyclesLoaded(true); }); return () => { active = false; }; }, [institutionId, token]);
  const current = cycles.find((cycle) => cycle.active && !cycle.closedAt);
  const start = (sale?: InstitutionSale) => {
    setEditing(sale || null);
    setDraft(sale ? { applicationCycleId: String(sale.applicationCycleId ?? ''), saleDate: sale.saleDate, quantityMt: String(sale.quantityMt), outcomeStatus: sale.outcomeStatus, poDate: sale.poDate || sale.saleDate, poNumber: sale.poNumber || '', invoiceReference: sale.invoiceReference || '', lossReason: sale.lossReason || '' } : { ...empty(), applicationCycleId: current ? String(current.id) : '' }); setOpen(true);
  };
  const save = async () => {
    const quantity = Number(draft.quantityMt); const won = draft.outcomeStatus === 'WIN';
    if (!cycles.some((cycle) => String(cycle.id) === draft.applicationCycleId)) return void toast.error('No valid application cycle is available. Refresh the institution and try again.');
    if (!draft.saleDate || draft.saleDate > today()) return void toast.error('Sale date is required and cannot be in the future.');
    if (!Number.isFinite(quantity) || quantity <= 0) return void toast.error('Quantity must be greater than zero.');
    if (won && (!draft.poNumber.trim() || !draft.poDate || draft.poDate > today())) return void toast.error('A PO number and valid PO date are required for a won sale.');
    if (!won && !draft.lossReason.trim()) return void toast.error('Loss reason is required.');
    const payload: InstitutionSalePayload = { applicationCycleId: Number(draft.applicationCycleId), saleDate: draft.saleDate, quantityMt: quantity, invoiceReference: draft.invoiceReference.trim() || null, sourceSystem: 'WEB', outcomeStatus: draft.outcomeStatus, poNumber: won ? draft.poNumber.trim() : null, poDate: won ? draft.poDate : null, lossReason: won ? null : draft.lossReason.trim() };
    setBusy(true);
    try { if (editing) await InstitutionSalesAPI.update(editing.id, payload, token); else await InstitutionSalesAPI.create(institutionId, payload, token); setOpen(false); toast.success(editing ? 'Sale updated.' : 'Sale recorded.'); await load(); }
    catch (e) { toast.error(e instanceof Error ? e.message : 'Unable to save sale.'); } finally { setBusy(false); }
  };
  const voidSale = async () => {
    if (!voiding || !reason.trim()) return void toast.error('Enter a correction reason.');
    setBusy(true); try { await InstitutionSalesAPI.void(voiding.id, reason.trim(), token); setVoiding(null); toast.success('Sale voided.'); await load(); } catch (e) { toast.error(e instanceof Error ? e.message : 'Unable to void sale.'); } finally { setBusy(false); }
  };
  const pages = Math.max(1, Math.ceil(sales.length / 10));
  return <>
    <Section description={`${sales.length} sales · ${sales.filter((sale) => sale.saleStatus !== 'VOIDED' && sale.outcomeStatus === 'WIN').reduce((sum, sale) => sum + Number(sale.quantityMt), 0).toLocaleString('en-IN')} MT won`} bodyClassName="p-0" action={<Button size="sm" onClick={() => start()} disabled={!current || Boolean(cycleError)}>Record sale</Button>}>
      {cycleError && <p className="p-4 text-sm text-destructive">{cycleError} Recording and editing require a real application cycle.</p>}
      {cyclesLoaded && !current && !cycleError && <p className="p-4 text-sm text-muted-foreground">No current application cycle is available for recording sales.</p>}
      {loading ? <p className="p-6 text-sm text-muted-foreground">Loading sales…</p> : error ? <p className="p-6 text-sm text-destructive">{error}</p> : !sales.length ? <EmptyState compact title="No institution sales recorded yet." /> : <div className="overflow-x-auto"><table className="w-full text-sm"><thead className="bg-muted/40 text-xs text-muted-foreground"><tr>{['Sale date', 'Outcome', 'PO / Loss reason', 'Quantity', 'Cycle', 'Status', 'Actions'].map((label) => <th key={label} className="px-4 py-2 text-left font-medium">{label}</th>)}</tr></thead><tbody className="divide-y">{[...sales].sort((a,b) => b.saleDate.localeCompare(a.saleDate)).slice(page * 10, (page + 1) * 10).map((sale) => <tr key={sale.id}><td className="px-4 py-3 whitespace-nowrap">{formatDay(sale.saleDate)}<p className="text-xs text-muted-foreground">{sale.sourceSystem}</p></td><td className="px-4 py-3"><Pill tone={sale.outcomeStatus === 'WIN' ? 'success' : 'danger'}>{sale.outcomeStatus === 'WIN' ? 'Won' : 'Lost'}</Pill></td><td className="px-4 py-3">{sale.outcomeStatus === 'WIN' ? sale.poNumber : sale.lossReason}{sale.poDate && <p className="text-xs text-muted-foreground">{formatDay(sale.poDate)}</p>}{sale.invoiceReference && <p className="text-xs text-muted-foreground">{sale.invoiceReference}</p>}</td><td className="px-4 py-3 whitespace-nowrap">{Number(sale.quantityMt).toLocaleString('en-IN')} MT</td><td className="px-4 py-3">{cycles.find((cycle) => cycle.id === sale.applicationCycleId)?.cycleNumber ?? `#${sale.applicationCycleId}`}</td><td className="px-4 py-3"><Pill tone={sale.saleStatus === 'VOIDED' ? 'danger' : 'neutral'}>{sale.saleStatus}</Pill>{sale.correctionReason && <p className="text-xs text-muted-foreground">{sale.correctionReason}</p>}</td><td className="px-4 py-3">{sale.saleStatus !== 'VOIDED' && <div className="flex gap-2"><Button variant="outline" size="sm" disabled={busy || !cycles.length} onClick={() => start(sale)}>Edit</Button><Button variant="ghost" size="sm" disabled={busy} onClick={() => { setReason(''); setVoiding(sale); }}>Void</Button></div>}</td></tr>)}</tbody></table><div className="flex justify-end items-center gap-3 p-4"><Button variant="outline" disabled={page === 0} onClick={() => setPage(page - 1)}>Previous</Button><span>Page {page + 1} of {pages}</span><Button variant="outline" disabled={page + 1 >= pages} onClick={() => setPage(page + 1)}>Next</Button></div></div>}
    </Section>
    <FormSheet open={open} onOpenChange={(value) => !busy && setOpen(value)} title={editing ? 'Edit institution sale' : 'Record institution sale'} description={`Sale for ${name}`} onSubmit={() => void save()} submitLabel={editing ? 'Save changes' : 'Record sale'} submitting={busy}>
      <FormGroup><FormField label="Sale date" required><Input type="date" max={today()} value={draft.saleDate} onChange={(e) => setDraft({ ...draft, saleDate: e.target.value })} /></FormField><FormField label="Quantity (MT)" required><Input type="number" min="0.001" step="0.001" value={draft.quantityMt} onChange={(e) => setDraft({ ...draft, quantityMt: e.target.value })} /></FormField><FormField label="Outcome" required><div className="flex gap-2">{(['WIN','LOST'] as const).map((value) => <Button key={value} type="button" variant={draft.outcomeStatus === value ? 'default' : 'outline'} onClick={() => setDraft({ ...draft, outcomeStatus: value })}>{value === 'WIN' ? 'Won' : 'Lost'}</Button>)}</div></FormField>{draft.outcomeStatus === 'WIN' ? <><FormField label="PO number" required><Input value={draft.poNumber} onChange={(e) => setDraft({ ...draft, poNumber: e.target.value })} /></FormField><FormField label="PO date" required><Input type="date" max={today()} value={draft.poDate} onChange={(e) => setDraft({ ...draft, poDate: e.target.value })} /></FormField></> : <FormField label="Loss reason" required><Textarea value={draft.lossReason} onChange={(e) => setDraft({ ...draft, lossReason: e.target.value })} /></FormField>}<FormField label="Invoice/reference" hint="Optional"><Input value={draft.invoiceReference} onChange={(e) => setDraft({ ...draft, invoiceReference: e.target.value })} /></FormField></FormGroup>
    </FormSheet>
    <FormSheet open={Boolean(voiding)} onOpenChange={(value) => !busy && !value && setVoiding(null)} title="Void institution sale?" description="This preserves the entry in history but excludes it from posted sales. Confirm with a correction reason." onSubmit={() => void voidSale()} submitLabel="Confirm void" submitting={busy}><FormField label="Correction reason" required><Textarea value={reason} onChange={(e) => setReason(e.target.value)} /></FormField></FormSheet>
  </>;
}
