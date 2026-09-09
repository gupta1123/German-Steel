'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AlertCircle, ArrowLeft, CalendarPlus, Edit3, FileClock, Loader2, NotebookPen, PackagePlus, Plus, RefreshCw, Trash2, UserPlus } from 'lucide-react';
import { toast } from 'sonner';

import { useAuth } from '@/components/auth-provider';
import { getErrorMessage } from '@/lib/api-error';
import { buildRetailAccountPayload, createRetailAccountDraft, type RetailAccountDraft, validateRetailAccountDraft } from '@/lib/retail-account';
import {
  RetailAPI,
  type RetailAccount,
  type RetailBrandUsage,
  type RetailCommercialHistory,
  type RetailContact,
  type RetailEmployee,
  type RetailNote,
  type RetailSale,
  type RetailTask,
  type RetailVisit,
} from '@/lib/retail-api';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';

interface CustomerDetailPageProps { accountId: number }
interface ContactForm { firstName: string; lastName: string; mobile: string; email: string; dateOfBirth: string; anniversaryDate: string; designation: string; roleDescription: string; primaryContact: boolean; active: boolean }
interface VisitForm { employeeId: string; date: string; startTime: string; endTime: string; purpose: string; selfGenerated: boolean }
interface SaleForm { saleDate: string; quantityMt: string; invoiceReference: string }
interface TaskForm { title: string; description: string; employeeId: string; dueDate: string; priority: RetailTask['priority'] }

const emptyContact: ContactForm = { firstName: '', lastName: '', mobile: '', email: '', dateOfBirth: '', anniversaryDate: '', designation: '', roleDescription: '', primaryContact: false, active: true };
const today = () => new Date().toISOString().slice(0, 10);
const emptyVisit = (): VisitForm => ({ employeeId: '', date: today(), startTime: '10:00', endTime: '10:30', purpose: '', selfGenerated: true });
const emptySale = (): SaleForm => ({ saleDate: today(), quantityMt: '', invoiceReference: '' });
const emptyTask = (): TaskForm => ({ title: '', description: '', employeeId: '', dueDate: today(), priority: 'MEDIUM' });
const humanize = (value: string | null | undefined) => value ? value.replaceAll('_', ' ').toLowerCase().replace(/\b\w/g, (letter) => letter.toUpperCase()) : '—';
const showDate = (value: string) => value ? new Date(value.length === 10 ? `${value}T00:00:00` : value).toLocaleString('en-IN', value.length === 10 ? { dateStyle: 'medium' } : { dateStyle: 'medium', timeStyle: 'short' }) : '—';
const money = (value: number) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(value || 0);

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return <div className="space-y-1.5"><Label>{label}{required && <span className="ml-1 text-destructive">*</span>}</Label>{children}</div>;
}

function EmptyState({ text }: { text: string }) {
  return <div className="rounded-lg border border-dashed py-10 text-center text-sm text-muted-foreground">{text}</div>;
}

function Info({ label, value }: { label: string; value: React.ReactNode }) {
  return <div><p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p><div className="mt-1 text-sm font-medium">{value || '—'}</div></div>;
}

export default function CustomerDetailPage({ accountId }: CustomerDetailPageProps) {
  const router = useRouter();
  const { token, userData } = useAuth();
  const [account, setAccount] = useState<RetailAccount | null>(null);
  const [contacts, setContacts] = useState<RetailContact[]>([]);
  const [notes, setNotes] = useState<RetailNote[]>([]);
  const [visits, setVisits] = useState<RetailVisit[]>([]);
  const [sales, setSales] = useState<RetailSale[]>([]);
  const [tasks, setTasks] = useState<RetailTask[]>([]);
  const [brands, setBrands] = useState<RetailBrandUsage[]>([]);
  const [brandHistory, setBrandHistory] = useState<RetailBrandUsage[]>([]);
  const [commercialHistory, setCommercialHistory] = useState<RetailCommercialHistory[]>([]);
  const [employees, setEmployees] = useState<RetailEmployee[]>([]);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [editDraft, setEditDraft] = useState<RetailAccountDraft | null>(null);
  const [editErrors, setEditErrors] = useState<string[]>([]);
  const [contactOpen, setContactOpen] = useState(false);
  const [editingContact, setEditingContact] = useState<RetailContact | null>(null);
  const [contactForm, setContactForm] = useState<ContactForm>(emptyContact);
  const [noteOpen, setNoteOpen] = useState(false);
  const [editingNote, setEditingNote] = useState<RetailNote | null>(null);
  const [noteText, setNoteText] = useState('');
  const [visitOpen, setVisitOpen] = useState(false);
  const [visitForm, setVisitForm] = useState<VisitForm>(emptyVisit);
  const [saleOpen, setSaleOpen] = useState(false);
  const [saleForm, setSaleForm] = useState<SaleForm>(emptySale);
  const [taskOpen, setTaskOpen] = useState(false);
  const [taskForm, setTaskForm] = useState<TaskForm>(emptyTask);

  const load = useCallback(async () => {
    if (!token || !Number.isFinite(accountId)) return;
    setIsLoading(true);
    setWarnings([]);
    try {
      const found = await RetailAPI.getAccountById(accountId, token);
      setAccount(found);
      if (!found) return;
      const sources = await Promise.allSettled([
        RetailAPI.getContacts(accountId, token), RetailAPI.getNotes(accountId, token), RetailAPI.getVisits(accountId, token),
        RetailAPI.getSales(accountId, token), RetailAPI.getTasks(accountId, found.ownerEmployeeId || userData?.employeeId || 0, token), RetailAPI.getActiveBrands(accountId, token),
        RetailAPI.getBrandHistory(accountId, token), RetailAPI.getCommercialHistory(accountId, token), RetailAPI.getEmployees(token),
      ]);
      const setters = [setContacts, setNotes, setVisits, setSales, setTasks, setBrands, setBrandHistory, setCommercialHistory, setEmployees] as const;
      const labels = ['contacts', 'notes', 'visits', 'sales', 'tasks', 'active brands', 'brand history', 'commercial history', 'employees'];
      const failed: string[] = [];
      sources.forEach((result, index) => {
        if (result.status === 'fulfilled') (setters[index] as (value: never) => void)(result.value as never);
        else failed.push(`${labels[index]} could not be loaded: ${getErrorMessage(result.reason, 'request failed')}`);
      });
      setWarnings(failed);
    } catch (error) {
      setAccount(null);
      toast.error(getErrorMessage(error, 'Unable to load this customer.'));
    } finally {
      setIsLoading(false);
    }
  }, [accountId, token, userData?.employeeId]);

  useEffect(() => { void load() }, [load]);

  const assignedByEmployeeId = userData?.employeeId || account?.ownerEmployeeId || 0;
  const employeeName = (id: number | null) => employees.find((employee) => employee.id === id) ? [employees.find((employee) => employee.id === id)?.firstName, employees.find((employee) => employee.id === id)?.lastName].filter(Boolean).join(' ') : id ? `Employee #${id}` : '—';
  const totalSales = useMemo(() => sales.reduce((sum, item) => sum + item.quantityMt, 0), [sales]);

  const openEdit = () => {
    if (!account) return;
    setEditDraft(createRetailAccountDraft(account));
    setEditErrors([]);
    setEditOpen(true);
  };

  const saveAccount = async () => {
    if (!token || !editDraft) return;
    const errors = validateRetailAccountDraft(editDraft);
    if (errors.length) { setEditErrors(errors); return }
    setBusy(true);
    try {
      await RetailAPI.updateAccount(accountId, buildRetailAccountPayload(editDraft), token);
      toast.success('Customer account updated.');
      setEditOpen(false);
      await load();
    } catch (error) { toast.error(getErrorMessage(error, 'Unable to update the customer.')) } finally { setBusy(false) }
  };

  const deactivateAccount = async () => {
    if (!token || !account) return;
    setBusy(true);
    try {
      await RetailAPI.deleteAccount(account.id, token);
      toast.success('Customer was marked inactive.');
      router.push('/dashboard/customers');
    } catch (error) { toast.error(getErrorMessage(error, 'Unable to deactivate the customer.')) } finally { setBusy(false) }
  };

  const openContact = (contact?: RetailContact) => {
    setEditingContact(contact ?? null);
    setContactForm(contact ? { firstName: contact.firstName, lastName: contact.lastName, mobile: contact.mobile, email: contact.email, dateOfBirth: contact.dateOfBirth, anniversaryDate: contact.anniversaryDate, designation: contact.designation, roleDescription: contact.roleDescription, primaryContact: contact.primaryContact, active: contact.active } : { ...emptyContact, primaryContact: contacts.length === 0 });
    setContactOpen(true);
  };

  const saveContact = async () => {
    if (!token || !account) return;
    if (!contactForm.firstName.trim() || !contactForm.designation.trim() || contactForm.mobile.replace(/\D/g, '').length !== 10) { toast.error('First name, designation, and a 10-digit mobile number are required.'); return }
    setBusy(true);
    try {
      if (editingContact) {
        await RetailAPI.updateContact(editingContact.id, { clientAccountId: account.id, contactInfluenceRegisterId: editingContact.contactInfluenceRegisterId, designation: contactForm.designation.trim(), roleDescription: contactForm.roleDescription.trim() || null, primaryContact: contactForm.primaryContact, active: contactForm.active }, token);
      } else {
        const masterId = await RetailAPI.createMasterContact({ firstName: contactForm.firstName.trim(), lastName: contactForm.lastName.trim(), mobile: contactForm.mobile.replace(/\D/g, ''), email: contactForm.email.trim() || null, dateOfBirth: contactForm.dateOfBirth || null, anniversaryDate: contactForm.anniversaryDate || null, active: true }, token);
        await RetailAPI.linkContact({ clientAccountId: account.id, contactInfluenceRegisterId: masterId, designation: contactForm.designation.trim(), roleDescription: contactForm.roleDescription.trim() || null, primaryContact: contactForm.primaryContact, active: true }, token);
      }
      toast.success(editingContact ? 'Contact link updated.' : 'Contact created and linked.');
      setContactOpen(false);
      await load();
    } catch (error) { toast.error(getErrorMessage(error, 'Unable to save contact.')) } finally { setBusy(false) }
  };

  const removeContact = async (contact: RetailContact) => {
    if (!token || !window.confirm(`Remove ${contact.firstName || 'this contact'} from this customer?`)) return;
    setBusy(true);
    try { await RetailAPI.deleteContact(contact.id, token); toast.success('Contact link removed.'); await load() } catch (error) { toast.error(getErrorMessage(error, 'Unable to remove contact.')) } finally { setBusy(false) }
  };

  const openNote = (note?: RetailNote) => { setEditingNote(note ?? null); setNoteText(note?.noteText ?? ''); setNoteOpen(true) };
  const saveNote = async () => {
    if (!token || !noteText.trim()) return;
    setBusy(true);
    try {
      if (editingNote) await RetailAPI.updateNote(editingNote.id, accountId, noteText.trim(), token); else await RetailAPI.createNote(accountId, noteText.trim(), token);
      toast.success(editingNote ? 'Note updated.' : 'Note added.'); setNoteOpen(false); await load();
    } catch (error) { toast.error(getErrorMessage(error, 'Unable to save note.')) } finally { setBusy(false) }
  };

  const saveVisit = async () => {
    if (!token || !account) return;
    const assigned = Number(visitForm.employeeId); if (!assigned || !visitForm.date || !visitForm.purpose.trim()) { toast.error('Employee, visit date, and purpose are required.'); return }
    setBusy(true);
    try {
      await RetailAPI.createVisit({ visitType: 'DEALER_VISIT', clientAccountId: account.id, institutionId: null, projectId: null, assignedEmployeeId: assigned, assignedByEmployeeId, scheduledVisitDate: visitForm.date, scheduledStartTime: `${visitForm.startTime}:00`, scheduledEndTime: `${visitForm.endTime}:00`, scheduledLatitude: account.outletLatitude, scheduledLongitude: account.outletLongitude, purpose: visitForm.purpose.trim(), selfGenerated: visitForm.selfGenerated }, token);
      toast.success('Visit planned.'); setVisitOpen(false); await load();
    } catch (error) { toast.error(getErrorMessage(error, 'Unable to plan visit.')) } finally { setBusy(false) }
  };

  const saveSale = async () => {
    if (!token || !account) return;
    const quantity = Number(saleForm.quantityMt); if (!saleForm.saleDate || !Number.isFinite(quantity) || quantity <= 0) { toast.error('Enter a valid sale date and quantity.'); return }
    setBusy(true);
    try { await RetailAPI.createSale({ clientAccountId: account.id, saleDate: saleForm.saleDate, quantityMt: quantity, invoiceReference: saleForm.invoiceReference.trim(), sourceSystem: 'manual' }, token); toast.success('Sale recorded.'); setSaleOpen(false); await load() } catch (error) { toast.error(getErrorMessage(error, 'Unable to record sale.')) } finally { setBusy(false) }
  };

  const saveTask = async () => {
    if (!token || !account) return;
    const employeeId = Number(taskForm.employeeId); if (!taskForm.title.trim() || !taskForm.dueDate || !employeeId) { toast.error('Title, assignee, and due date are required.'); return }
    setBusy(true);
    try { await RetailAPI.createTask({ taskTitle: taskForm.title.trim(), taskDescription: taskForm.description.trim() || null, taskType: 'FOLLOW_UP', status: 'OPEN', priority: taskForm.priority, assignedToEmployeeId: employeeId, assignedByEmployeeId, dueDate: taskForm.dueDate, clientAccountId: account.id, visitActivityId: null }, token); toast.success('Follow-up task created.'); setTaskOpen(false); await load() } catch (error) { toast.error(getErrorMessage(error, 'Unable to create task.')) } finally { setBusy(false) }
  };

  const removeTask = async (task: RetailTask) => {
    if (!token || !window.confirm(`Delete task “${task.title}”?`)) return;
    setBusy(true); try { await RetailAPI.deleteTask(task.id, token); toast.success('Task deleted.'); await load() } catch (error) { toast.error(getErrorMessage(error, 'Unable to delete task.')) } finally { setBusy(false) }
  };

  const removeBrand = async (usage: RetailBrandUsage) => {
    if (!token || !assignedByEmployeeId || !window.confirm(`Stop tracking ${usage.brandName} as an active brand?`)) return;
    setBusy(true); try { await RetailAPI.removeBrandUsage(usage.id, assignedByEmployeeId, token); toast.success('Brand usage closed.'); await load() } catch (error) { toast.error(getErrorMessage(error, 'Unable to remove brand usage.')) } finally { setBusy(false) }
  };

  if (isLoading) return <div className="flex min-h-[420px] items-center justify-center"><Loader2 className="h-7 w-7 animate-spin text-muted-foreground" /></div>;
  if (!Number.isFinite(accountId) || !account) return <Card><CardHeader><CardTitle>Customer not found</CardTitle><CardDescription>The account was not returned by the new paginated retail-accounts endpoint.</CardDescription></CardHeader><CardContent><Button variant="outline" onClick={() => router.push('/dashboard/customers')}><ArrowLeft className="mr-2 h-4 w-4" />Back to customers</Button></CardContent></Card>;

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-start">
        <div className="flex gap-3"><Button size="icon" variant="outline" onClick={() => router.push('/dashboard/customers')} aria-label="Back to customers"><ArrowLeft className="h-4 w-4" /></Button><div><div className="flex flex-wrap items-center gap-2"><h1 className="text-2xl font-semibold">{account.accountName}</h1><Badge variant="outline">{humanize(account.accountStatus)}</Badge><Badge variant="secondary">{humanize(account.clientType)}</Badge>{account.networkMember && <Badge>Network member</Badge>}{!account.active && <Badge variant="destructive">Inactive</Badge>}</div><p className="mt-1 text-sm text-muted-foreground">Retail account #{account.id}{account.gstNumber ? ` · GSTIN ${account.gstNumber}` : ''}</p></div></div>
        <div className="flex flex-wrap gap-2"><Button variant="outline" onClick={() => void load()}><RefreshCw className="mr-2 h-4 w-4" />Refresh</Button><Button variant="outline" onClick={openEdit}><Edit3 className="mr-2 h-4 w-4" />Edit account</Button><Button variant="destructive" disabled={!account.active} onClick={() => setDeleteOpen(true)}><Trash2 className="mr-2 h-4 w-4" />Deactivate</Button></div>
      </div>

      {warnings.length > 0 && <div className="flex gap-2 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900"><AlertCircle className="mt-0.5 h-4 w-4 shrink-0" /><p>The account loaded, but {warnings.join(', ')}. You can retry with Refresh.</p></div>}

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Card><CardHeader className="pb-2"><CardDescription>Declared monthly sales</CardDescription><CardTitle>{account.declaredMonthlySalesMt == null ? 'Not declared' : `${account.declaredMonthlySalesMt} MT`}</CardTitle></CardHeader></Card>
        <Card><CardHeader className="pb-2"><CardDescription>Recorded sales</CardDescription><CardTitle>{totalSales.toLocaleString('en-IN')} MT</CardTitle></CardHeader></Card>
        <Card><CardHeader className="pb-2"><CardDescription>Visits / open tasks</CardDescription><CardTitle>{visits.length} / {tasks.filter((task) => ['OPEN', 'IN_PROGRESS'].includes(task.status)).length}</CardTitle></CardHeader></Card>
        <Card><CardHeader className="pb-2"><CardDescription>Commercial terms</CardDescription><CardTitle>{account.creditTermsDays} days · {money(account.creditLimitAmount)}</CardTitle></CardHeader></Card>
      </div>

      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList className="h-auto flex-wrap justify-start"><TabsTrigger value="overview">Overview</TabsTrigger><TabsTrigger value="contacts">Contacts ({contacts.length})</TabsTrigger><TabsTrigger value="notes">Notes ({notes.length})</TabsTrigger><TabsTrigger value="activity">Visits & Tasks</TabsTrigger><TabsTrigger value="sales">Sales ({sales.length})</TabsTrigger><TabsTrigger value="brands">Brands ({brands.length})</TabsTrigger><TabsTrigger value="history">Commercial History</TabsTrigger></TabsList>

        <TabsContent value="overview" className="grid gap-4 lg:grid-cols-2">
          <Card><CardHeader><CardTitle className="text-base">Account and ownership</CardTitle></CardHeader><CardContent className="grid gap-5 sm:grid-cols-2"><Info label="Account status" value={humanize(account.accountStatus)} /><Info label="Account owner" value={account.ownerEmployeeName || employeeName(account.ownerEmployeeId)} /><Info label="Client group" value={account.clientGroupName || (account.clientGroupId ? `Group #${account.clientGroupId}` : 'No group')} /><Info label="Focus sector" value={humanize(account.focusSector)} /><Info label="Client tier" value={`Tier ${account.clientTier}`} /><Info label="Region" value={account.regionName || (account.regionId ? `Region #${account.regionId}` : '—')} /></CardContent></Card>
          <Card><CardHeader><CardTitle className="text-base">Outlet and network</CardTitle></CardHeader><CardContent className="grid gap-5 sm:grid-cols-2"><Info label="Address" value={[account.addressVillageArea, account.addressTaluka, account.addressCity, account.addressDistrict, account.addressState, account.pinCode].filter(Boolean).join(', ')} /><Info label="GPS" value={`${account.outletLatitude}, ${account.outletLongitude}`} /><Info label="Network member" value={account.networkMember ? 'Yes' : 'No'} /><Info label="Network status" value={humanize(account.networkStatus)} /><Info label="Onboarding date" value={account.networkOnboardingDate ? showDate(account.networkOnboardingDate) : '—'} /><Info label="Record state" value={account.active ? 'Active' : 'Inactive'} /></CardContent></Card>
        </TabsContent>

        <TabsContent value="contacts"><Card><CardHeader className="flex-row items-center justify-between"><div><CardTitle className="text-base">Account contacts</CardTitle><CardDescription>Contact master records linked to this retail account.</CardDescription></div><Button onClick={() => openContact()}><UserPlus className="mr-2 h-4 w-4" />Add contact</Button></CardHeader><CardContent className="space-y-3">{contacts.length === 0 ? <EmptyState text="No contacts are linked yet." /> : contacts.map((contact) => <div key={contact.id} className="flex flex-col justify-between gap-3 rounded-lg border p-4 sm:flex-row sm:items-center"><div><div className="flex items-center gap-2"><p className="font-medium">{[contact.firstName, contact.lastName].filter(Boolean).join(' ') || `Contact #${contact.id}`}</p>{contact.primaryContact && <Badge>Primary</Badge>}{!contact.active && <Badge variant="destructive">Inactive</Badge>}</div><p className="text-sm text-muted-foreground">{contact.designation}{contact.roleDescription ? ` · ${contact.roleDescription}` : ''}</p><p className="mt-1 text-sm">{[contact.mobile, contact.email].filter(Boolean).join(' · ') || 'No phone or email returned'}</p></div><div className="flex gap-2"><Button variant="outline" size="sm" onClick={() => openContact(contact)}><Edit3 className="mr-2 h-3.5 w-3.5" />Edit link</Button><Button variant="ghost" size="icon" onClick={() => void removeContact(contact)} disabled={busy}><Trash2 className="h-4 w-4 text-destructive" /></Button></div></div>)}</CardContent></Card></TabsContent>

        <TabsContent value="notes"><Card><CardHeader className="flex-row items-center justify-between"><div><CardTitle className="text-base">Notes</CardTitle><CardDescription>Timestamped customer notes; the new contract supports create and edit.</CardDescription></div><Button onClick={() => openNote()}><NotebookPen className="mr-2 h-4 w-4" />Add note</Button></CardHeader><CardContent className="space-y-3">{notes.length === 0 ? <EmptyState text="No notes have been added." /> : notes.map((note) => <div key={note.id} className="rounded-lg border p-4"><div className="flex items-start justify-between gap-4"><p className="whitespace-pre-wrap text-sm">{note.noteText}</p><Button variant="ghost" size="icon" onClick={() => openNote(note)}><Edit3 className="h-4 w-4" /></Button></div><p className="mt-3 text-xs text-muted-foreground">{note.authorName || 'Current user'} · {showDate(note.updatedAt || note.createdAt)}</p></div>)}</CardContent></Card></TabsContent>

        <TabsContent value="activity" className="grid gap-4 xl:grid-cols-2">
          <Card><CardHeader className="flex-row items-center justify-between"><div><CardTitle className="text-base">Retail visits</CardTitle><CardDescription>Plans and outcomes for this account.</CardDescription></div><Button size="sm" onClick={() => { setVisitForm({ ...emptyVisit(), employeeId: String(account.ownerEmployeeId || '') }); setVisitOpen(true) }}><CalendarPlus className="mr-2 h-4 w-4" />Plan visit</Button></CardHeader><CardContent className="space-y-3">{visits.length === 0 ? <EmptyState text="No retail visits found." /> : visits.map((visit) => <div key={visit.id} className="rounded-lg border p-4"><div className="flex items-center justify-between"><p className="font-medium">{showDate(visit.scheduledVisitDate)}</p><Badge variant="outline">{visit.outcome ? humanize(visit.outcome) : visit.actualCheckinAt ? 'Checked in' : 'Planned'}</Badge></div><p className="mt-1 text-sm">{visit.purpose || 'No purpose returned'}</p><p className="mt-2 text-xs text-muted-foreground">{visit.assignedEmployeeName || employeeName(visit.assignedEmployeeId)} · {visit.scheduledStartTime || '—'}–{visit.scheduledEndTime || '—'}</p>{visit.discussionSummary && <p className="mt-2 text-sm text-muted-foreground">{visit.discussionSummary}</p>}</div>)}</CardContent></Card>
          <Card><CardHeader className="flex-row items-center justify-between"><div><CardTitle className="text-base">Follow-up tasks</CardTitle><CardDescription>Tasks associated with this client account.</CardDescription></div><Button size="sm" onClick={() => { setTaskForm({ ...emptyTask(), employeeId: String(account.ownerEmployeeId || '') }); setTaskOpen(true) }}><Plus className="mr-2 h-4 w-4" />Add task</Button></CardHeader><CardContent className="space-y-3">{tasks.length === 0 ? <EmptyState text="No customer tasks found." /> : tasks.map((task) => <div key={task.id} className="flex justify-between gap-3 rounded-lg border p-4"><div><div className="flex flex-wrap items-center gap-2"><p className="font-medium">{task.title || `Task #${task.id}`}</p><Badge variant="outline">{humanize(task.status)}</Badge><Badge variant="secondary">{humanize(task.priority)}</Badge></div><p className="mt-1 text-sm text-muted-foreground">{task.description}</p><p className="mt-2 text-xs text-muted-foreground">Due {showDate(task.dueDate)} · {task.assignedEmployeeName || employeeName(task.assignedEmployeeId)}</p></div><Button variant="ghost" size="icon" onClick={() => void removeTask(task)} disabled={busy}><Trash2 className="h-4 w-4 text-destructive" /></Button></div>)}</CardContent></Card>
        </TabsContent>

        <TabsContent value="sales"><Card><CardHeader className="flex-row items-center justify-between"><div><CardTitle className="text-base">Sales history</CardTitle><CardDescription>Manual or integrated quantities recorded for this customer.</CardDescription></div><Button onClick={() => { setSaleForm(emptySale()); setSaleOpen(true) }}><PackagePlus className="mr-2 h-4 w-4" />Record sale</Button></CardHeader><CardContent className="space-y-3">{sales.length === 0 ? <EmptyState text="No sales have been recorded." /> : sales.map((sale) => <div key={sale.id} className="grid gap-2 rounded-lg border p-4 sm:grid-cols-4"><Info label="Date" value={showDate(sale.saleDate)} /><Info label="Quantity" value={`${sale.quantityMt} MT`} /><Info label="Invoice" value={sale.invoiceReference} /><Info label="Source" value={sale.sourceSystem} /></div>)}</CardContent></Card></TabsContent>

        <TabsContent value="brands"><div className="grid gap-4 xl:grid-cols-2"><Card><CardHeader><CardTitle className="text-base">Active competitor brands</CardTitle><CardDescription>The supplied new API has no competitor-brand master endpoint, so adding a brand is disabled until that endpoint is provided.</CardDescription></CardHeader><CardContent className="space-y-3">{brands.length === 0 ? <EmptyState text="No active brand usage found." /> : brands.map((brand) => <div key={brand.id} className="flex justify-between gap-3 rounded-lg border p-4"><div><p className="font-medium">{brand.brandName}</p><p className="text-sm text-muted-foreground">{brand.remarks || 'No remarks'}</p></div><Button variant="outline" size="sm" onClick={() => void removeBrand(brand)} disabled={busy}>Remove</Button></div>)}</CardContent></Card><Card><CardHeader><CardTitle className="text-base">Brand history</CardTitle></CardHeader><CardContent className="space-y-3">{brandHistory.length === 0 ? <EmptyState text="No brand history found." /> : brandHistory.map((brand) => <div key={brand.id} className="rounded-lg border p-4"><div className="flex justify-between"><p className="font-medium">{brand.brandName}</p><Badge variant="outline">{brand.active ? 'Active' : 'Removed'}</Badge></div><p className="mt-1 text-sm text-muted-foreground">{brand.remarks || 'No remarks'}</p><p className="mt-2 text-xs text-muted-foreground">Added {showDate(brand.addedAt)}{brand.removedAt ? ` · Removed ${showDate(brand.removedAt)}` : ''}</p></div>)}</CardContent></Card></div></TabsContent>

        <TabsContent value="history"><Card><CardHeader><CardTitle className="text-base">Commercial change history</CardTitle><CardDescription>Audited changes returned by the new retail API.</CardDescription></CardHeader><CardContent className="space-y-3">{commercialHistory.length === 0 ? <EmptyState text="No commercial changes found." /> : commercialHistory.map((entry) => <div key={entry.id} className="rounded-lg border p-4"><div className="flex items-center gap-2"><FileClock className="h-4 w-4 text-muted-foreground" /><p className="font-medium">{humanize(entry.fieldName)}</p></div><p className="mt-2 text-sm"><span className="text-muted-foreground">From:</span> {entry.oldValue || '—'} <span className="mx-2 text-muted-foreground">→</span><span className="text-muted-foreground">To:</span> {entry.newValue || '—'}</p><p className="mt-1 text-sm text-muted-foreground">{entry.changeReason || 'No reason recorded'}</p><p className="mt-2 text-xs text-muted-foreground">{entry.changedBy || 'Current user'} · {showDate(entry.changedAt)}</p></div>)}</CardContent></Card></TabsContent>
      </Tabs>

      <Dialog open={editOpen} onOpenChange={(open) => !busy && setEditOpen(open)}><DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-4xl"><DialogHeader><DialogTitle>Edit retail customer</DialogTitle><DialogDescription>All account fields are saved through PUT /api/retail/accounts/{accountId}.</DialogDescription></DialogHeader>{editDraft && <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Field label="Account name" required><Input value={editDraft.accountName} onChange={(event) => setEditDraft({ ...editDraft, accountName: event.target.value })} /></Field><Field label="GSTIN" required><Input value={editDraft.gstNumber} onChange={(event) => setEditDraft({ ...editDraft, gstNumber: event.target.value.toUpperCase().slice(0, 15) })} /></Field><Field label="Client type"><Select value={editDraft.clientType} onValueChange={(value) => setEditDraft({ ...editDraft, clientType: value as RetailAccountDraft['clientType'] })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="DEALER">Dealer</SelectItem><SelectItem value="DISTRIBUTOR">Distributor</SelectItem></SelectContent></Select></Field>
        <Field label="Account status"><Select value={editDraft.accountStatus} onValueChange={(value) => setEditDraft({ ...editDraft, accountStatus: value as RetailAccountDraft['accountStatus'] })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="PROSPECT">Prospect</SelectItem><SelectItem value="ACTIVE">Active</SelectItem><SelectItem value="DORMANT">Dormant</SelectItem><SelectItem value="LOST">Lost</SelectItem></SelectContent></Select></Field><Field label="Owner"><Select value={editDraft.ownerEmployeeId} onValueChange={(value) => setEditDraft({ ...editDraft, ownerEmployeeId: value })}><SelectTrigger><SelectValue placeholder="Choose employee" /></SelectTrigger><SelectContent>{employees.map((employee) => <SelectItem key={employee.id} value={String(employee.id)}>{[employee.firstName, employee.lastName].filter(Boolean).join(' ') || `Employee #${employee.id}`}</SelectItem>)}</SelectContent></Select></Field><Field label="Client group ID"><Input type="number" value={editDraft.clientGroupId} onChange={(event) => setEditDraft({ ...editDraft, clientGroupId: event.target.value })} placeholder="Optional" /></Field>
        <Field label="Village / area" required><Input value={editDraft.addressVillageArea} onChange={(event) => setEditDraft({ ...editDraft, addressVillageArea: event.target.value })} /></Field><Field label="Taluka" required><Input value={editDraft.addressTaluka} onChange={(event) => setEditDraft({ ...editDraft, addressTaluka: event.target.value })} /></Field><Field label="City" required><Input value={editDraft.addressCity} onChange={(event) => setEditDraft({ ...editDraft, addressCity: event.target.value })} /></Field><Field label="District" required><Input value={editDraft.addressDistrict} onChange={(event) => setEditDraft({ ...editDraft, addressDistrict: event.target.value })} /></Field><Field label="State" required><Input value={editDraft.addressState} onChange={(event) => setEditDraft({ ...editDraft, addressState: event.target.value })} /></Field><Field label="PIN code" required><Input value={editDraft.pinCode} onChange={(event) => setEditDraft({ ...editDraft, pinCode: event.target.value.replace(/\D/g, '').slice(0, 6) })} /></Field>
        <Field label="Region ID"><Input type="number" value={editDraft.regionId} onChange={(event) => setEditDraft({ ...editDraft, regionId: event.target.value })} /></Field><Field label="Latitude" required><Input type="number" value={editDraft.outletLatitude} onChange={(event) => setEditDraft({ ...editDraft, outletLatitude: event.target.value })} /></Field><Field label="Longitude" required><Input type="number" value={editDraft.outletLongitude} onChange={(event) => setEditDraft({ ...editDraft, outletLongitude: event.target.value })} /></Field>
        <Field label="Monthly sales (MT)"><Input type="number" min="0" value={editDraft.declaredMonthlySalesMt} onChange={(event) => setEditDraft({ ...editDraft, declaredMonthlySalesMt: event.target.value })} /></Field><Field label="Focus sector"><Select value={editDraft.focusSector} onValueChange={(value) => setEditDraft({ ...editDraft, focusSector: value as RetailAccountDraft['focusSector'] })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="RETAIL">Retail</SelectItem><SelectItem value="GOVERNMENT_PROJECTS">Government projects</SelectItem><SelectItem value="DEVELOPER_PROJECTS">Developer projects</SelectItem><SelectItem value="ALL_SECTORS">All sectors</SelectItem></SelectContent></Select></Field><Field label="Client tier"><Select value={editDraft.clientTier} onValueChange={(value) => setEditDraft({ ...editDraft, clientTier: value as RetailAccountDraft['clientTier'] })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="A">A</SelectItem><SelectItem value="B">B</SelectItem><SelectItem value="C">C</SelectItem></SelectContent></Select></Field>
        <Field label="Credit terms (days)" required><Input type="number" min="0" value={editDraft.creditTermsDays} onChange={(event) => setEditDraft({ ...editDraft, creditTermsDays: event.target.value })} /></Field><Field label="Credit limit" required><Input type="number" min="0" value={editDraft.creditLimitAmount} onChange={(event) => setEditDraft({ ...editDraft, creditLimitAmount: event.target.value })} /></Field><div className="flex items-center justify-between rounded-lg border p-3"><Label>Network member</Label><Switch checked={editDraft.networkMember} onCheckedChange={(checked) => setEditDraft({ ...editDraft, networkMember: checked })} /></div>
        {editDraft.networkMember && <><Field label="Onboarding date" required><Input type="date" value={editDraft.networkOnboardingDate} onChange={(event) => setEditDraft({ ...editDraft, networkOnboardingDate: event.target.value })} /></Field><Field label="Network status"><Select value={editDraft.networkStatus} onValueChange={(value) => setEditDraft({ ...editDraft, networkStatus: value as RetailAccountDraft['networkStatus'] })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="ACTIVE">Active</SelectItem><SelectItem value="INACTIVE">Inactive</SelectItem></SelectContent></Select></Field></>}
      </div>}{editErrors.length > 0 && <ul className="list-disc rounded-lg border border-destructive/40 bg-destructive/5 p-4 pl-8 text-sm text-destructive">{editErrors.map((error) => <li key={error}>{error}</li>)}</ul>}<DialogFooter><Button variant="outline" onClick={() => setEditOpen(false)} disabled={busy}>Cancel</Button><Button onClick={() => void saveAccount()} disabled={busy}>{busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Save account</Button></DialogFooter></DialogContent></Dialog>

      <Dialog open={contactOpen} onOpenChange={(open) => !busy && setContactOpen(open)}><DialogContent className="sm:max-w-2xl"><DialogHeader><DialogTitle>{editingContact ? 'Edit account contact link' : 'Create and link contact'}</DialogTitle><DialogDescription>{editingContact ? 'The documented PUT route updates the account link fields. Master name and phone remain unchanged.' : 'This creates a shared contact master record, then links it to the customer.'}</DialogDescription></DialogHeader><div className="grid gap-4 sm:grid-cols-2"><Field label="First name" required><Input disabled={Boolean(editingContact)} value={contactForm.firstName} onChange={(event) => setContactForm({ ...contactForm, firstName: event.target.value })} /></Field><Field label="Last name"><Input disabled={Boolean(editingContact)} value={contactForm.lastName} onChange={(event) => setContactForm({ ...contactForm, lastName: event.target.value })} /></Field><Field label="Mobile" required><Input disabled={Boolean(editingContact)} value={contactForm.mobile} onChange={(event) => setContactForm({ ...contactForm, mobile: event.target.value.replace(/\D/g, '').slice(0, 10) })} /></Field><Field label="Email"><Input disabled={Boolean(editingContact)} type="email" value={contactForm.email} onChange={(event) => setContactForm({ ...contactForm, email: event.target.value })} /></Field><Field label="Designation" required><Input value={contactForm.designation} onChange={(event) => setContactForm({ ...contactForm, designation: event.target.value })} /></Field><Field label="Role description"><Input value={contactForm.roleDescription} onChange={(event) => setContactForm({ ...contactForm, roleDescription: event.target.value })} /></Field>{!editingContact && <><Field label="Date of birth"><Input type="date" value={contactForm.dateOfBirth} onChange={(event) => setContactForm({ ...contactForm, dateOfBirth: event.target.value })} /></Field><Field label="Anniversary"><Input type="date" value={contactForm.anniversaryDate} onChange={(event) => setContactForm({ ...contactForm, anniversaryDate: event.target.value })} /></Field></>}<label className="flex items-center gap-2 text-sm"><Checkbox checked={contactForm.primaryContact} onCheckedChange={(checked) => setContactForm({ ...contactForm, primaryContact: checked === true })} />Primary contact</label>{editingContact && <label className="flex items-center gap-2 text-sm"><Checkbox checked={contactForm.active} onCheckedChange={(checked) => setContactForm({ ...contactForm, active: checked === true })} />Active link</label>}</div><DialogFooter><Button variant="outline" onClick={() => setContactOpen(false)} disabled={busy}>Cancel</Button><Button onClick={() => void saveContact()} disabled={busy}>{busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Save contact</Button></DialogFooter></DialogContent></Dialog>

      <Dialog open={noteOpen} onOpenChange={(open) => !busy && setNoteOpen(open)}><DialogContent><DialogHeader><DialogTitle>{editingNote ? 'Edit note' : 'Add customer note'}</DialogTitle><DialogDescription>Notes support create and edit in the supplied API. No delete route was documented.</DialogDescription></DialogHeader><Field label="Note" required><Textarea rows={6} value={noteText} onChange={(event) => setNoteText(event.target.value)} /></Field><DialogFooter><Button variant="outline" onClick={() => setNoteOpen(false)} disabled={busy}>Cancel</Button><Button onClick={() => void saveNote()} disabled={busy || !noteText.trim()}>{busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Save note</Button></DialogFooter></DialogContent></Dialog>

      <Dialog open={visitOpen} onOpenChange={(open) => !busy && setVisitOpen(open)}><DialogContent><DialogHeader><DialogTitle>Plan retail visit</DialogTitle><DialogDescription>This creates a plan only; check-in and checkout happen through the visit workflow.</DialogDescription></DialogHeader><div className="grid gap-4 sm:grid-cols-2"><Field label="Assigned employee" required><Select value={visitForm.employeeId} onValueChange={(value) => setVisitForm({ ...visitForm, employeeId: value })}><SelectTrigger><SelectValue placeholder="Choose employee" /></SelectTrigger><SelectContent>{employees.map((employee) => <SelectItem key={employee.id} value={String(employee.id)}>{[employee.firstName, employee.lastName].filter(Boolean).join(' ') || `Employee #${employee.id}`}</SelectItem>)}</SelectContent></Select></Field><Field label="Visit date" required><Input type="date" value={visitForm.date} onChange={(event) => setVisitForm({ ...visitForm, date: event.target.value })} /></Field><Field label="Start time"><Input type="time" value={visitForm.startTime} onChange={(event) => setVisitForm({ ...visitForm, startTime: event.target.value })} /></Field><Field label="End time"><Input type="time" value={visitForm.endTime} onChange={(event) => setVisitForm({ ...visitForm, endTime: event.target.value })} /></Field><div className="sm:col-span-2"><Field label="Purpose" required><Textarea value={visitForm.purpose} onChange={(event) => setVisitForm({ ...visitForm, purpose: event.target.value })} /></Field></div><label className="flex items-center gap-2 text-sm"><Checkbox checked={visitForm.selfGenerated} onCheckedChange={(checked) => setVisitForm({ ...visitForm, selfGenerated: checked === true })} />Self-generated visit</label></div><DialogFooter><Button variant="outline" onClick={() => setVisitOpen(false)} disabled={busy}>Cancel</Button><Button onClick={() => void saveVisit()} disabled={busy}>{busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Plan visit</Button></DialogFooter></DialogContent></Dialog>

      <Dialog open={saleOpen} onOpenChange={(open) => !busy && setSaleOpen(open)}><DialogContent><DialogHeader><DialogTitle>Record customer sale</DialogTitle><DialogDescription>Save an actual quantity against this retail account.</DialogDescription></DialogHeader><div className="grid gap-4 sm:grid-cols-2"><Field label="Sale date" required><Input type="date" value={saleForm.saleDate} onChange={(event) => setSaleForm({ ...saleForm, saleDate: event.target.value })} /></Field><Field label="Quantity (MT)" required><Input type="number" min="0" step="0.01" value={saleForm.quantityMt} onChange={(event) => setSaleForm({ ...saleForm, quantityMt: event.target.value })} /></Field><div className="sm:col-span-2"><Field label="Invoice reference"><Input value={saleForm.invoiceReference} onChange={(event) => setSaleForm({ ...saleForm, invoiceReference: event.target.value })} /></Field></div></div><DialogFooter><Button variant="outline" onClick={() => setSaleOpen(false)} disabled={busy}>Cancel</Button><Button onClick={() => void saveSale()} disabled={busy}>{busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Record sale</Button></DialogFooter></DialogContent></Dialog>

      <Dialog open={taskOpen} onOpenChange={(open) => !busy && setTaskOpen(open)}><DialogContent><DialogHeader><DialogTitle>Create follow-up task</DialogTitle><DialogDescription>Tasks do not change customer status; they track the next action.</DialogDescription></DialogHeader><div className="grid gap-4 sm:grid-cols-2"><Field label="Task title" required><Input value={taskForm.title} onChange={(event) => setTaskForm({ ...taskForm, title: event.target.value })} /></Field><Field label="Assignee" required><Select value={taskForm.employeeId} onValueChange={(value) => setTaskForm({ ...taskForm, employeeId: value })}><SelectTrigger><SelectValue placeholder="Choose employee" /></SelectTrigger><SelectContent>{employees.map((employee) => <SelectItem key={employee.id} value={String(employee.id)}>{[employee.firstName, employee.lastName].filter(Boolean).join(' ') || `Employee #${employee.id}`}</SelectItem>)}</SelectContent></Select></Field><Field label="Due date" required><Input type="date" value={taskForm.dueDate} onChange={(event) => setTaskForm({ ...taskForm, dueDate: event.target.value })} /></Field><Field label="Priority"><Select value={taskForm.priority} onValueChange={(value) => setTaskForm({ ...taskForm, priority: value as RetailTask['priority'] })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="LOW">Low</SelectItem><SelectItem value="MEDIUM">Medium</SelectItem><SelectItem value="HIGH">High</SelectItem><SelectItem value="URGENT">Urgent</SelectItem></SelectContent></Select></Field><div className="sm:col-span-2"><Field label="Description"><Textarea value={taskForm.description} onChange={(event) => setTaskForm({ ...taskForm, description: event.target.value })} /></Field></div></div><DialogFooter><Button variant="outline" onClick={() => setTaskOpen(false)} disabled={busy}>Cancel</Button><Button onClick={() => void saveTask()} disabled={busy}>{busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Create task</Button></DialogFooter></DialogContent></Dialog>

      <Dialog open={deleteOpen} onOpenChange={(open) => !busy && setDeleteOpen(open)}><DialogContent><DialogHeader><DialogTitle>Deactivate this customer?</DialogTitle><DialogDescription>The new DELETE endpoint performs a soft delete, preserving account history.</DialogDescription></DialogHeader><div className="rounded-lg border bg-muted/40 p-3 font-medium">{account.accountName}</div><DialogFooter><Button variant="outline" onClick={() => setDeleteOpen(false)} disabled={busy}>Cancel</Button><Button variant="destructive" onClick={() => void deactivateAccount()} disabled={busy}>{busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Deactivate</Button></DialogFooter></DialogContent></Dialog>
    </div>
  );
}
