'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AlertCircle, ArrowLeft, CalendarPlus, Edit3, Loader2, NotebookPen, PackagePlus, Plus, RefreshCw, Trash2, UserPlus } from 'lucide-react';
import { toast } from 'sonner';

const VISIT_PURPOSES = [
  { value: 'ROUTINE_VISIT', label: 'Routine Visit' },
  { value: 'TECHNICAL_DISCUSSION', label: 'Technical Discussion' },
  { value: 'NC_FOLLOW_UP', label: 'NC Follow-up' },
  { value: 'RELATIONSHIP_MEETING', label: 'Relationship Meeting' },
  { value: 'ORDER_FOLLOW_UP', label: 'Order Follow-up' },
  { value: 'PAYMENT_FOLLOW_UP', label: 'Payment Follow-up' },
  { value: 'OTHER', label: 'Other' },
] as const;

import { useAuth } from '@/components/auth-provider';
import { isAdminSetupRoleValue, isManagerRoleValue } from '@/lib/auth';
import { getErrorMessage } from '@/lib/api-error';
import { buildRetailAccountPayload, createRetailAccountDraft, type RetailAccountDraft, validateRetailAccountDraft } from '@/lib/retail-account';
import {
  RetailAPI,
  type CompetitorBrand,
  type RetailAccount,
  type RetailBrandUsage,
  type RetailClientGroup,
  type RetailCommercialHistory,
  type RetailContact,
  type RetailEmployee,
  type RetailMasterContact,
  type RetailNote,
  type RetailSale,
  type RetailSalesRegion,
  type RetailTask,
  type RetailVisit,
} from '@/lib/retail-api';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Sheet, SheetContent, SheetFooter, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { DetailShell } from '@/components/detail-shell';

interface CustomerDetailPageProps { accountId: number }
interface ContactForm { firstName: string; lastName: string; mobile: string; email: string; dateOfBirth: string; anniversaryDate: string; designation: string; roleDescription: string; primaryContact: boolean; active: boolean }
interface VisitForm { employeeId: string; date: string; startTime: string; endTime: string; purpose: string; selfGenerated: boolean }
interface SaleForm { saleDate: string; quantityMt: string; invoiceReference: string }
interface TaskForm { title: string; description: string; employeeId: string; dueDate: string; priority: RetailTask['priority']; status: RetailTask['status'] }
interface MonthlySalesForm { declaredMonthlySalesMt: string; changeReason: string }

const emptyContact: ContactForm = { firstName: '', lastName: '', mobile: '', email: '', dateOfBirth: '', anniversaryDate: '', designation: '', roleDescription: '', primaryContact: false, active: true };
const today = () => new Date().toISOString().slice(0, 10);
const emptyVisit = (): VisitForm => ({ employeeId: '', date: today(), startTime: '10:00', endTime: '10:30', purpose: '', selfGenerated: true });
const emptySale = (): SaleForm => ({ saleDate: today(), quantityMt: '', invoiceReference: '' });
const emptyTask = (): TaskForm => ({ title: '', description: '', employeeId: '', dueDate: today(), priority: 'MEDIUM', status: 'OPEN' });
const emptyMonthlySales = (): MonthlySalesForm => ({ declaredMonthlySalesMt: '', changeReason: '' });
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
  return <div><p className="text-xs text-muted-foreground">{label}</p><div className="mt-0.5 text-xs font-medium leading-5">{value || '—'}</div></div>;
}

export default function CustomerDetailPage({ accountId }: CustomerDetailPageProps) {
  const router = useRouter();
  const { token, userData, userRole } = useAuth();
  const canDeactivate = isAdminSetupRoleValue(userRole) || isManagerRoleValue(userRole);
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
  const [groups, setGroups] = useState<RetailClientGroup[]>([]);
  const [regions, setRegions] = useState<RetailSalesRegion[]>([]);
  const [competitorBrands, setCompetitorBrands] = useState<CompetitorBrand[]>([]);
  const [masterContacts, setMasterContacts] = useState<RetailMasterContact[]>([]);
  const [brandSelect, setBrandSelect] = useState('');
  const [brandRemarks, setBrandRemarks] = useState('');
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
  const [editingTask, setEditingTask] = useState<RetailTask | null>(null);
  const [taskForm, setTaskForm] = useState<TaskForm>(emptyTask);
  const [monthlySalesOpen, setMonthlySalesOpen] = useState(false);
  const [monthlySalesForm, setMonthlySalesForm] = useState<MonthlySalesForm>(emptyMonthlySales);
  const [networkOpen, setNetworkOpen] = useState(false);
  const [networkForm, setNetworkForm] = useState({ joiningDate: today(), firstOrderDate: '', firstOrderReference: '', reason: '' });

  const loadAccount = useCallback(async () => {
    if (!token || !Number.isFinite(accountId)) return null;
    const found = await RetailAPI.getAccountById(accountId, token);
    setAccount(found);
    return found;
  }, [accountId, token]);

  const loadContactsSection = useCallback(async () => {
    if (!token || !Number.isFinite(accountId)) return;
    try {
      const [links, masters] = await Promise.all([
        RetailAPI.getContacts(accountId, token),
        RetailAPI.getMasterContacts(token),
      ]);
      setContacts(links);
      setMasterContacts(masters);
    } catch (error) { toast.error(getErrorMessage(error, 'Unable to reload contacts.')) }
  }, [accountId, token]);

  const loadNotesSection = useCallback(async () => {
    if (!token || !Number.isFinite(accountId)) return;
    try { setNotes(await RetailAPI.getNotes(accountId, token)); }
    catch (error) { toast.error(getErrorMessage(error, 'Unable to reload notes.')) }
  }, [accountId, token]);

  const loadVisitsSection = useCallback(async () => {
    if (!token || !Number.isFinite(accountId)) return;
    try { setVisits(await RetailAPI.getVisits(accountId, token)); }
    catch (error) { toast.error(getErrorMessage(error, 'Unable to reload visits.')) }
  }, [accountId, token]);

  const loadSalesSection = useCallback(async () => {
    if (!token || !Number.isFinite(accountId)) return;
    try { setSales(await RetailAPI.getSales(accountId, token)); }
    catch (error) { toast.error(getErrorMessage(error, 'Unable to reload sales.')) }
  }, [accountId, token]);

  const loadTasksSection = useCallback(async (ownerId?: number) => {
    if (!token || !Number.isFinite(accountId)) return;
    try { setTasks(await RetailAPI.getTasks(accountId, ownerId ?? account?.ownerEmployeeId ?? userData?.employeeId ?? 0, token)); }
    catch (error) { toast.error(getErrorMessage(error, 'Unable to reload tasks.')) }
  }, [accountId, token, account?.ownerEmployeeId, userData?.employeeId]);

  const loadBrandsSection = useCallback(async () => {
    if (!token || !Number.isFinite(accountId)) return;
    try {
      const [active, history, master] = await Promise.all([
        RetailAPI.getActiveBrands(accountId, token),
        RetailAPI.getBrandHistory(accountId, token),
        RetailAPI.getCompetitorBrands(token),
      ]);
      setBrands(active);
      setBrandHistory(history);
      setCompetitorBrands(master);
    } catch (error) { toast.error(getErrorMessage(error, 'Unable to reload brands.')) }
  }, [accountId, token]);

  const loadCommercialSection = useCallback(async () => {
    if (!token || !Number.isFinite(accountId)) return;
    try { setCommercialHistory(await RetailAPI.getCommercialHistory(accountId, token)); }
    catch (error) { toast.error(getErrorMessage(error, 'Unable to reload commercial history.')) }
  }, [accountId, token]);

  const loadMastersSection = useCallback(async () => {
    if (!token) return;
    try {
      const [emps, grps, regs] = await Promise.all([
        RetailAPI.getEmployees(token),
        RetailAPI.getClientGroups(token),
        RetailAPI.getSalesRegions(token),
      ]);
      setEmployees(emps);
      setGroups(grps);
      setRegions(regs);
    } catch { /* non-blocking masters */ }
  }, [token]);

  const load = useCallback(async () => {
    if (!token || !Number.isFinite(accountId)) return;
    setIsLoading(true);
    setWarnings([]);
    try {
      const found = await loadAccount();
      if (!found) return;
      await Promise.allSettled([
        (async () => { try { const [links, masters] = await Promise.all([RetailAPI.getContacts(accountId, token), RetailAPI.getMasterContacts(token)]); setContacts(links); setMasterContacts(masters); } catch (e) { throw e } })(),
        RetailAPI.getNotes(accountId, token).then(setNotes),
        RetailAPI.getVisits(accountId, token).then(setVisits),
        RetailAPI.getSales(accountId, token).then(setSales),
        RetailAPI.getTasks(accountId, found.ownerEmployeeId || userData?.employeeId || 0, token).then(setTasks),
        RetailAPI.getActiveBrands(accountId, token).then(setBrands),
        RetailAPI.getBrandHistory(accountId, token).then(setBrandHistory),
        RetailAPI.getCommercialHistory(accountId, token).then(setCommercialHistory),
        RetailAPI.getEmployees(token).then(setEmployees),
        RetailAPI.getClientGroups(token).then(setGroups),
        RetailAPI.getSalesRegions(token).then(setRegions),
        RetailAPI.getCompetitorBrands(token).then(setCompetitorBrands),
      ]).then((sources) => {
        const labels = ['contacts', 'notes', 'visits', 'sales', 'tasks', 'active brands', 'brand history', 'commercial history', 'employees', 'groups', 'regions', 'competitor brands'];
        const failed: string[] = [];
        sources.forEach((result, index) => {
          if (result.status === 'rejected') failed.push(`${labels[index]} could not be loaded: ${getErrorMessage(result.reason, 'request failed')}`);
        });
        setWarnings(failed);
      });
    } catch (error) {
      setAccount(null);
      toast.error(getErrorMessage(error, 'Unable to load this customer.'));
    } finally {
      setIsLoading(false);
    }
  }, [accountId, token, userData?.employeeId, loadAccount]);

  useEffect(() => { void load() }, [load]);

  const assignedByEmployeeId = userData?.employeeId || account?.ownerEmployeeId || 0;
  const employeeName = (id: number | null) => employees.find((employee) => employee.id === id) ? [employees.find((employee) => employee.id === id)?.firstName, employees.find((employee) => employee.id === id)?.lastName].filter(Boolean).join(' ') : id ? `Employee #${id}` : '—';
  const totalSales = useMemo(() => sales.reduce((sum, item) => sum + item.quantityMt, 0), [sales]);
  const openTaskCount = useMemo(() => tasks.filter((task) => ['OPEN', 'IN_PROGRESS'].includes(task.status)).length, [tasks]);
  const latestVisit = useMemo(() => [...visits]
    .filter((visit) => Boolean(visit.scheduledVisitDate))
    .sort((left, right) => String(right.scheduledVisitDate).localeCompare(String(left.scheduledVisitDate)))[0] ?? null, [visits]);
  const groupNameById = useMemo(() => new Map(groups.map((g) => [g.id, g.groupName])), [groups]);
  const regionNameById = useMemo(() => new Map(regions.map((r) => [r.id, r.name])), [regions]);
  const resolvedGroupName = account?.clientGroupName || (account?.clientGroupId ? groupNameById.get(account.clientGroupId) || `Group #${account.clientGroupId}` : 'No group');
  const resolvedRegionName = account?.regionName || (account?.regionId ? regionNameById.get(account.regionId) || `Region #${account.regionId}` : '—');
  const brandNameById = useMemo(() => new Map(competitorBrands.map((b) => [b.id, b.name])), [competitorBrands]);
  const masterContactById = useMemo(() => new Map(masterContacts.map((m) => [m.id, m])), [masterContacts]);
  const resolvedContacts = useMemo(() => contacts.map((c) => {
    const master = masterContactById.get(c.contactInfluenceRegisterId);
    if (!master) return c;
    return {
      ...c,
      firstName: c.firstName || master.firstName,
      lastName: c.lastName || master.lastName,
      mobile: c.mobile || master.mobile,
      email: c.email || master.email,
      dateOfBirth: c.dateOfBirth || master.dateOfBirth,
      anniversaryDate: c.anniversaryDate || master.anniversaryDate,
    };
  }), [contacts, masterContactById]);
  const brandDisplayName = (usage: RetailBrandUsage) => brandNameById.get(usage.competitorBrandId) || usage.brandName || `Brand #${usage.competitorBrandId}`;
  const brandAddedBy = (usage: RetailBrandUsage) => {
    const fromUsage = (usage.employeeName || '').trim();
    if (fromUsage && fromUsage !== '—') return fromUsage;
    return employeeName(usage.employeeId ?? null);
  };

  const addBrand = async () => {
    if (!token || !account) return;
    const brandId = Number(brandSelect);
    if (!brandId) { toast.error('Choose a competitor brand to add.'); return }
    const empId = assignedByEmployeeId || account.ownerEmployeeId || 0;
    if (!empId) { toast.error('No employee context to record brand usage.'); return }
    setBusy(true);
    try {
      await RetailAPI.addBrandUsage({ clientAccountId: account.id, competitorBrandId: brandId, employeeId: empId, remarks: brandRemarks.trim() || null }, token);
      toast.success('Brand usage added.');
      setBrandSelect('');
      setBrandRemarks('');
      await loadBrandsSection();
    } catch (error) { toast.error(getErrorMessage(error, 'Unable to add brand usage.')) } finally { setBusy(false) }
  };

  const openEdit = () => {
    if (!account) return;
    setEditDraft(createRetailAccountDraft(account));
    setEditErrors([]);
    setEditOpen(true);
  };

  const saveAccount = async () => {
    if (!token || !editDraft) return;
    const errors = validateRetailAccountDraft(editDraft);
    if (!editDraft.clientGroupId) errors.push('Client group is required.');
    if (errors.length) { setEditErrors(errors); return }
    setBusy(true);
    try {
      await RetailAPI.updateAccount(accountId, buildRetailAccountPayload(editDraft), token);
      toast.success('Customer account updated.');
      setEditOpen(false);
      await loadAccount();
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
    setContactForm(contact ? { firstName: contact.firstName, lastName: contact.lastName, mobile: contact.mobile, email: contact.email, dateOfBirth: contact.dateOfBirth, anniversaryDate: contact.anniversaryDate, designation: contact.designation, roleDescription: contact.roleDescription, primaryContact: contact.primaryContact, active: contact.active } : { ...emptyContact, primaryContact: resolvedContacts.length === 0 });
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
      await loadContactsSection();
    } catch (error) { toast.error(getErrorMessage(error, 'Unable to save contact.')) } finally { setBusy(false) }
  };

  const removeContact = async (contact: RetailContact) => {
    if (!token || !window.confirm(`Remove ${contact.firstName || 'this contact'} from this customer?`)) return;
    setBusy(true);
    try { await RetailAPI.deleteContact(contact.id, token); toast.success('Contact link removed.'); await loadContactsSection() } catch (error) { toast.error(getErrorMessage(error, 'Unable to remove contact.')) } finally { setBusy(false) }
  };

  const openNote = (note?: RetailNote) => { setEditingNote(note ?? null); setNoteText(note?.noteText ?? ''); setNoteOpen(true) };
  const saveNote = async () => {
    if (!token || !noteText.trim()) return;
    setBusy(true);
    try {
      if (editingNote) await RetailAPI.updateNote(editingNote.id, noteText.trim(), token); else await RetailAPI.createNote(accountId, noteText.trim(), token);
      toast.success(editingNote ? 'Note updated.' : 'Note added.'); setNoteOpen(false); await loadNotesSection();
    } catch (error) { toast.error(getErrorMessage(error, 'Unable to save note.')) } finally { setBusy(false) }
  };

  const saveVisit = async () => {
    if (!token || !account) return;
    const assigned = Number(visitForm.employeeId); if (!assigned || !visitForm.date || !visitForm.purpose.trim()) { toast.error('Employee, visit date, and purpose are required.'); return }
    setBusy(true);
    try {
      await RetailAPI.createVisit({ visitType: 'DEALER_VISIT', clientAccountId: account.id, institutionId: null, projectId: null, assignedEmployeeId: assigned, assignedByEmployeeId, scheduledVisitDate: visitForm.date, scheduledStartTime: `${visitForm.startTime}:00`, scheduledEndTime: `${visitForm.endTime}:00`, scheduledLatitude: account.outletLatitude, scheduledLongitude: account.outletLongitude, purpose: visitForm.purpose.trim(), selfGenerated: visitForm.selfGenerated }, token);
      toast.success('Visit planned.'); setVisitOpen(false); await loadVisitsSection();
    } catch (error) { toast.error(getErrorMessage(error, 'Unable to plan visit.')) } finally { setBusy(false) }
  };

  const saveSale = async () => {
    if (!token || !account) return;
    const quantity = Number(saleForm.quantityMt);
    if (!saleForm.saleDate || saleForm.saleDate > today()) { toast.error('PO date is required and cannot be in the future.'); return }
    if (!Number.isFinite(quantity) || quantity <= 0) { toast.error('Quantity must be greater than zero.'); return }
    if (!saleForm.invoiceReference.trim()) { toast.error('PO number is required.'); return }
    setBusy(true);
    try { await RetailAPI.createSale({ clientAccountId: account.id, saleDate: saleForm.saleDate, quantityMt: quantity, invoiceReference: saleForm.invoiceReference.trim(), sourceSystem: 'manual' }, token); toast.success('Sale recorded.'); setSaleOpen(false); await loadSalesSection() } catch (error) { toast.error(getErrorMessage(error, 'Unable to record sale.')) } finally { setBusy(false) }
  };

  const openTask = async (task?: RetailTask) => {
    if (!account) return;
    if (task && token) {
      try { task = await RetailAPI.getTaskById(task.id, token); } catch (error) { toast.error(getErrorMessage(error, 'Unable to load task details.')); return; }
    }
    setEditingTask(task ?? null);
    setTaskForm(task ? {
      title: task.title ?? '',
      description: task.description ?? '',
      employeeId: task.assignedEmployeeId ? String(task.assignedEmployeeId) : String(account.ownerEmployeeId || ''),
      dueDate: (task.dueDate || '').slice(0, 10) || today(),
      priority: task.priority ?? 'MEDIUM',
      status: task.status ?? 'OPEN',
    } : { ...emptyTask(), employeeId: String(account.ownerEmployeeId || '') });
    setTaskOpen(true);
  };

  const saveTask = async () => {
    if (!token || !account) return;
    const employeeId = Number(taskForm.employeeId); if (!taskForm.title.trim() || !taskForm.dueDate || !employeeId) { toast.error('Title, assignee, and due date are required.'); return }
    setBusy(true);
    try {
      const payload = { taskTitle: taskForm.title.trim(), taskDescription: taskForm.description.trim() || null, taskType: 'FOLLOW_UP' as const, status: taskForm.status, priority: taskForm.priority, assignedToEmployeeId: employeeId, assignedByEmployeeId, dueDate: taskForm.dueDate, clientAccountId: account.id, visitActivityId: null };
      if (editingTask) {
        await RetailAPI.updateTask(editingTask.id, payload, token);
        toast.success('Task updated.');
      } else {
        await RetailAPI.createTask({ ...payload, status: 'OPEN' }, token);
        toast.success('Follow-up task created.');
      }
      setTaskOpen(false);
      setEditingTask(null);
      await loadTasksSection();
    } catch (error) { toast.error(getErrorMessage(error, 'Unable to save task.')) } finally { setBusy(false) }
  };

  const removeTask = async (task: RetailTask) => {
    if (!token || !window.confirm(`Delete task “${task.title}”?`)) return;
    setBusy(true); try { await RetailAPI.deleteTask(task.id, token); toast.success('Task deleted.'); await loadTasksSection() } catch (error) { toast.error(getErrorMessage(error, 'Unable to delete task.')) } finally { setBusy(false) }
  };

  const removeBrand = async (usage: RetailBrandUsage) => {
    if (!token || !assignedByEmployeeId || !window.confirm(`Stop tracking ${brandDisplayName(usage)} as an active brand?`)) return;
    setBusy(true); try { await RetailAPI.removeBrandUsage(usage.id, assignedByEmployeeId, token); toast.success('Brand usage closed.'); await loadBrandsSection() } catch (error) { toast.error(getErrorMessage(error, 'Unable to remove brand usage.')) } finally { setBusy(false) }
  };

  const saveMonthlySales = async () => {
    if (!token || !account) return;
    const quantity = Number(monthlySalesForm.declaredMonthlySalesMt);
    if (!Number.isFinite(quantity) || quantity < 0) { toast.error('Enter a valid declared monthly sales quantity.'); return }
    if (!monthlySalesForm.changeReason.trim()) { toast.error('A change reason is required for commercial history tracking.'); return }
    setBusy(true);
    try {
      await RetailAPI.updateMonthlySales(account.id, quantity, monthlySalesForm.changeReason.trim(), token);
      toast.success('Monthly sales updated with change reason recorded.');
      setMonthlySalesOpen(false);
      await loadAccount();
      await loadCommercialSection();
    } catch (error) { toast.error(getErrorMessage(error, 'Unable to update monthly sales.')) } finally { setBusy(false) }
  };

  const saveNetworkOnboard = async () => {
    if (!token || !account) return;
    if (!networkForm.firstOrderDate) { toast.error('First order date is required.'); return }
    if (!networkForm.firstOrderReference.trim()) { toast.error('First order reference is required.'); return }
    const wasProspect = account.accountStatus === 'PROSPECT';
    setBusy(true);
    try {
      await RetailAPI.onboardNetwork(account.id, {
        joiningDate: networkForm.joiningDate,
        commercialAgreementConfirmed: true,
        firstOrderDate: networkForm.firstOrderDate,
        firstOrderReference: networkForm.firstOrderReference.trim(),
        firstOrderSource: 'MANUAL',
        reason: networkForm.reason.trim() || undefined,
      }, token);
      setNetworkOpen(false);
      await loadAccount();
      if (wasProspect) {
        toast.success('Network onboarding recorded.', {
          description: 'Set status to Active now?',
          action: {
            label: 'Set Active',
            onClick: () => void flipToActive(),
          },
          duration: 8000,
        });
      } else {
        toast.success('Network onboarding recorded. This account is now a network member.');
      }
    } catch (error) { toast.error(getErrorMessage(error, 'Unable to complete network onboarding.')) } finally { setBusy(false) }
  };

  const flipToActive = async () => {
    if (!token || !account) return;
    setBusy(true);
    try {
      const fresh = await RetailAPI.getAccountById(accountId, token);
      const source = fresh ?? account;
      await RetailAPI.updateAccount(accountId, {
        accountName: source.accountName,
        clientType: source.clientType,
        gstNumber: source.gstNumber,
        clientGroupId: source.clientGroupId,
        accountStatus: 'ACTIVE',
        ownerEmployeeId: source.ownerEmployeeId,
        addressVillageArea: source.addressVillageArea,
        addressTaluka: source.addressTaluka,
        addressCity: source.addressCity,
        addressDistrict: source.addressDistrict,
        addressState: source.addressState,
        pinCode: source.pinCode,
        ...(source.regionId ? { regionId: source.regionId } : {}),
        outletLatitude: source.outletLatitude,
        outletLongitude: source.outletLongitude,
        declaredMonthlySalesMt: source.declaredMonthlySalesMt,
        focusSector: source.focusSector,
        creditTermsDays: source.creditTermsDays,
        creditLimitAmount: source.creditLimitAmount,
        clientTier: source.clientTier,
        networkMember: false,
        networkOnboardingDate: null,
        networkStatus: null,
        active: source.active,
      }, token);
      toast.success('Account set to Active.');
      await loadAccount();
    } catch (error) { toast.error(getErrorMessage(error, 'Unable to set Active. Use Edit instead.')) } finally { setBusy(false) }
  };

  if (isLoading) return <div className="flex min-h-[420px] items-center justify-center"><Loader2 className="h-7 w-7 animate-spin text-muted-foreground" /></div>;
  if (!Number.isFinite(accountId) || !account) return <Card><CardHeader><CardTitle>Customer not found</CardTitle><CardDescription>The account was not returned by the new paginated retail-accounts endpoint.</CardDescription></CardHeader><CardContent><Button variant="outline" onClick={() => router.push('/dashboard/customers')}><ArrowLeft className="mr-2 h-4 w-4" />Back to customers</Button></CardContent></Card>;

  return (
    <div className="space-y-4 font-poppins text-xs">
      <div className="flex flex-col justify-between gap-3 lg:flex-row lg:items-center">
        <div className="flex gap-3"><Button size="icon" variant="outline" onClick={() => router.push('/dashboard/customers')} aria-label="Back to customers"><ArrowLeft className="h-4 w-4" /></Button><div><div className="flex flex-wrap items-center gap-2"><h1 className="text-lg font-semibold">{account.accountName}</h1><Badge variant="outline">{humanize(account.accountStatus)}</Badge>{account.networkMember && <Badge>Network · {humanize(account.networkStatus)}</Badge>}{!account.active && <Badge variant="destructive">Inactive</Badge>}</div><p className="mt-0.5 text-xs text-muted-foreground">#{account.id}{account.gstNumber ? ` · ${account.gstNumber}` : ''} · Tier {account.clientTier} · {resolvedGroupName}</p></div></div>
        <div className="flex flex-wrap gap-2"><Button variant="outline" size="sm" onClick={openEdit}><Edit3 className="mr-2 h-3.5 w-3.5" />Edit</Button>{!account.networkMember && <Button size="sm" onClick={() => setNetworkOpen(true)}><PackagePlus className="mr-2 h-3.5 w-3.5" />Network onboard</Button>}<Button variant="ghost" size="sm" onClick={() => void load()}><RefreshCw className="mr-2 h-3.5 w-3.5" />Refresh</Button>{canDeactivate && <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-destructive" disabled={!account.active} onClick={() => setDeleteOpen(true)}>Deactivate</Button>}</div>
      </div>

      {warnings.length > 0 && <div className="flex gap-2 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900"><AlertCircle className="mt-0.5 h-4 w-4 shrink-0" /><p>The account loaded, but {warnings.join(', ')}. You can retry with Refresh.</p></div>}

      <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,1fr)_300px]">
      <div className="min-w-0 space-y-4">
      <Card className="border-l-4 border-l-primary py-0">
        <CardContent className="flex flex-col gap-2 px-4 py-2.5 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex min-w-0 items-center gap-2">
            <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
            <p className="truncate text-[13px] font-medium">
              {!account.networkMember && totalSales === 0 ? 'Next required: Record first sale, then onboard' : !account.networkMember ? 'Next required: Network onboard (first order done)' : account.accountStatus === 'PROSPECT' ? 'Next required: Set status to Active' : account.networkMember && account.networkStatus === 'INACTIVE' ? 'Next required: Win-back visit — no sale in 3 months' : account.accountStatus === 'DORMANT' ? 'Next: Re-activate via Edit' : 'On track — regular visits & sales in tabs below'}
            </p>
          </div>
          <div className="flex shrink-0 flex-wrap gap-1.5">
            {!account.networkMember && totalSales === 0 && <Button size="sm" className="h-7 px-2.5 text-xs" onClick={() => { setSaleForm(emptySale()); setSaleOpen(true) }}>Record first sale</Button>}
            {!account.networkMember && totalSales > 0 && <Button size="sm" className="h-7 px-2.5 text-xs" onClick={() => setNetworkOpen(true)}>Network onboard</Button>}
            {account.networkMember && account.accountStatus === 'PROSPECT' && <Button size="sm" className="h-7 px-2.5 text-xs" onClick={() => void flipToActive()} disabled={busy}>Set Active</Button>}
            {account.networkMember && account.networkStatus === 'INACTIVE' && <Button variant="outline" size="sm" className="h-7 px-2.5 text-xs" onClick={() => { setVisitForm({ ...emptyVisit(), employeeId: String(account.ownerEmployeeId || '') }); setVisitOpen(true) }}><CalendarPlus className="mr-1 h-3 w-3" />Plan win-back visit</Button>}
          </div>
        </CardContent>
      </Card>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Card><CardHeader className="flex-row items-center justify-between pb-2"><div><CardDescription className="text-xs">Monthly sales</CardDescription><CardTitle className="text-base">{totalSales.toLocaleString('en-IN')} / {account.declaredMonthlySalesMt ?? '—'} MT</CardTitle></div><Button variant="ghost" size="sm" className="h-6 px-2 text-[11px]" onClick={() => { setMonthlySalesForm({ declaredMonthlySalesMt: account.declaredMonthlySalesMt == null ? '' : String(account.declaredMonthlySalesMt), changeReason: '' }); setMonthlySalesOpen(true); }}>Update</Button></CardHeader></Card>
        <Card><CardHeader className="pb-2"><CardDescription className="text-xs">Active brands</CardDescription><CardTitle className="text-base">{brands.length}</CardTitle></CardHeader></Card>
        <Card><CardHeader className="pb-2"><CardDescription className="text-xs">Open tasks</CardDescription><CardTitle className="text-base">{openTaskCount}</CardTitle></CardHeader></Card>
        <Card><CardHeader className="pb-2"><CardDescription className="text-xs">Last visit</CardDescription><CardTitle className="text-base">{latestVisit ? showDate(latestVisit.scheduledVisitDate) : 'No visits'}</CardTitle></CardHeader></Card>
      </div>
      <DetailShell
        defaultValue="overview"
        tabs={[
          {
            value: 'overview',
            label: 'Overview',
            content: (
              <div className="grid gap-4 lg:grid-cols-2">
                <Card><CardHeader><CardTitle className="text-sm">Account and ownership</CardTitle></CardHeader><CardContent className="grid gap-4 sm:grid-cols-2"><Info label="Account status" value={humanize(account.accountStatus)} /><Info label="Account owner" value={account.ownerEmployeeName || employeeName(account.ownerEmployeeId)} /><Info label="Client group" value={resolvedGroupName} /><Info label="Focus sector" value={humanize(account.focusSector)} /><Info label="Client tier" value={`Tier ${account.clientTier}`} /><Info label="Region" value={resolvedRegionName} /></CardContent></Card>
                <Card><CardHeader><CardTitle className="text-sm">Outlet and network</CardTitle></CardHeader><CardContent className="grid gap-4 sm:grid-cols-2"><Info label="Address" value={[account.addressVillageArea, account.addressTaluka, account.addressCity, account.addressDistrict, account.addressState, account.pinCode].filter(Boolean).join(', ')} /><Info label="GPS" value={`${account.outletLatitude}, ${account.outletLongitude}`} /><Info label="Network member" value={account.networkMember ? 'Yes' : 'No'} /><Info label="Network status" value={humanize(account.networkStatus)} /><Info label="Onboarding date" value={account.networkOnboardingDate ? showDate(account.networkOnboardingDate) : '—'} /><Info label="Record state" value={account.active ? 'Active' : 'Inactive'} /></CardContent></Card>
              </div>
            ),
          },
          {
            value: 'relationship',
            label: `Relationship (${brands.length + brandHistory.length + commercialHistory.length})`,
            content: (
              <div className="space-y-4">
                <div className="grid gap-4 xl:grid-cols-2"><Card><CardHeader><CardTitle className="text-sm">Active brands</CardTitle></CardHeader><CardContent>
                <div className="mb-3 flex flex-col gap-2 sm:flex-row">
                  <Select value={brandSelect} onValueChange={setBrandSelect}><SelectTrigger className="h-8 flex-1 text-xs"><SelectValue placeholder="Choose brand to add" /></SelectTrigger><SelectContent>{competitorBrands.map((b) => <SelectItem key={b.id} value={String(b.id)}>{b.name}</SelectItem>)}</SelectContent></Select>
                  <Button variant="outline" size="sm" className="h-8" onClick={() => void addBrand()} disabled={busy || !brandSelect}><Plus className="mr-1 h-3.5 w-3.5" />Add</Button>
                </div>
                <Input value={brandRemarks} onChange={(e) => setBrandRemarks(e.target.value)} placeholder="Remarks (optional)" className="mb-3 h-8 text-xs" />
                {brands.length === 0 ? <EmptyState text="No active brands." /> : <ol className="relative ml-1.5 space-y-3 border-l pl-4">{brands.map((brand) => <li key={brand.id} className="relative"><span className="absolute -left-[21px] top-1 h-2.5 w-2.5 rounded-full border-2 border-background bg-muted-foreground/60" /><div className="flex items-start justify-between gap-2"><div className="min-w-0"><p className="truncate text-sm font-medium leading-none">{brandDisplayName(brand)}</p><p className="mt-1 truncate text-xs text-muted-foreground" title={brand.remarks}>{brand.remarks || 'No remarks'} · by {brandAddedBy(brand)}</p></div><Button variant="ghost" size="sm" className="h-6 shrink-0 px-2 text-xs text-muted-foreground hover:text-destructive" onClick={() => void removeBrand(brand)} disabled={busy}>Remove</Button></div></li>)}</ol>}</CardContent></Card><Card><CardHeader><CardTitle className="text-sm">Brand history</CardTitle></CardHeader><CardContent>{brandHistory.length === 0 ? <EmptyState text="No brand history." /> : <ol className="relative ml-1.5 space-y-3 border-l pl-4">{brandHistory.map((brand) => <li key={brand.id} className="relative"><span className="absolute -left-[21px] top-1 h-2.5 w-2.5 rounded-full border-2 border-background bg-muted-foreground/40" /><div className="flex items-center gap-1.5"><p className="truncate text-sm font-medium leading-none">{brandDisplayName(brand)}</p><Badge variant="outline" className="h-4 px-1 text-[10px]">{brand.active ? 'Active' : 'Removed'}</Badge></div><p className="mt-1 text-[11px] text-muted-foreground">{showDate(brand.addedAt)}{brand.removedAt ? ` · out ${showDate(brand.removedAt)}` : ''} · by {brandAddedBy(brand)}</p></li>)}</ol>}</CardContent></Card></div>
                <Card><CardHeader><CardTitle className="text-sm">Commercial change history</CardTitle></CardHeader><CardContent>{commercialHistory.length === 0 ? <EmptyState text="No commercial changes found." /> : <ol className="relative ml-1.5 space-y-4 border-l pl-4">{commercialHistory.map((entry) => <li key={entry.id} className="relative"><span className="absolute -left-[21px] top-1 h-2.5 w-2.5 rounded-full border-2 border-background bg-muted-foreground/60" /><p className="text-sm font-medium leading-none">{humanize(entry.fieldName)} <span className="ml-1 font-normal text-muted-foreground">{entry.oldValue || '—'} → {entry.newValue || '—'}</span></p><p className="mt-1 truncate text-xs text-muted-foreground" title={entry.changeReason}>{entry.changeReason || 'No reason recorded'}</p><p className="mt-0.5 text-[11px] text-muted-foreground">{entry.changedBy || 'System'} · {showDate(entry.changedAt)}</p></li>)}</ol>}</CardContent></Card>
              </div>
            ),
          },
          {
            value: 'contacts',
            label: `Contacts (${resolvedContacts.length})`,
            content: (
              <Card><CardHeader><CardTitle className="text-sm">Account contacts</CardTitle><CardAction><Button size="sm" onClick={() => openContact()}><UserPlus className="mr-2 h-3.5 w-3.5" />Add contact</Button></CardAction></CardHeader><CardContent className="space-y-2">{resolvedContacts.length === 0 ? <EmptyState text="No contacts are linked yet." /> : resolvedContacts.map((contact) => <div key={contact.id} className="flex items-center justify-between gap-3 rounded-lg border px-3 py-2.5"><div className="min-w-0"><div className="flex flex-wrap items-center gap-1.5"><p className="truncate text-sm font-medium">{[contact.firstName, contact.lastName].filter(Boolean).join(' ') || `Contact #${contact.id}`}</p>{contact.primaryContact && <Badge className="h-5 px-1.5 text-[10px]">Primary</Badge>}{!contact.active && <Badge variant="destructive" className="h-5 px-1.5 text-[10px]">Inactive</Badge>}</div><p className="mt-0.5 truncate text-xs text-muted-foreground">{[contact.designation, contact.roleDescription].filter(Boolean).join(' · ') || '—'} · {[contact.mobile, contact.email].filter(Boolean).join(' · ') || 'No phone'}</p></div><div className="flex shrink-0 items-center gap-1"><Button variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={() => openContact(contact)}>Edit</Button>{canDeactivate && <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => void removeContact(contact)} disabled={busy}><Trash2 className="h-3.5 w-3.5 text-destructive" /></Button>}</div></div>)}</CardContent></Card>
            ),
          },
          {
            value: 'visits',
            label: `Visits (${visits.length})`,
            content: (
              <Card><CardHeader><CardTitle className="text-sm">Visits</CardTitle><CardAction><Button size="sm" onClick={() => { setVisitForm({ ...emptyVisit(), employeeId: String(account.ownerEmployeeId || '') }); setVisitOpen(true) }}><CalendarPlus className="mr-2 h-3.5 w-3.5" />Plan visit</Button></CardAction></CardHeader><CardContent>{visits.length === 0 ? <EmptyState text="No visits yet." /> : <ol className="relative ml-1.5 space-y-1 border-l pl-4">{visits.map((visit) => <li key={visit.id} className="relative"><span className="absolute -left-[21px] top-3 h-2.5 w-2.5 rounded-full border-2 border-background bg-muted-foreground/60" /><button type="button" onClick={() => router.push(`/dashboard/visits/${visit.id}`)} className="w-full rounded-md px-2 py-2 text-left transition-colors hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"><div className="flex items-center gap-1.5"><p className="text-sm font-medium leading-none">{showDate(visit.scheduledVisitDate)}</p><Badge variant="outline" className="h-4 px-1 text-[10px]">{visit.outcome ? humanize(visit.outcome) : visit.actualCheckinAt ? 'Checked in' : 'Planned'}</Badge></div><p className="mt-1 truncate text-xs text-muted-foreground" title={visit.purpose}>{visit.purpose || 'No purpose'} · {visit.assignedEmployeeName || employeeName(visit.assignedEmployeeId)}</p>{visit.nextActionText && <p className="mt-0.5 truncate text-[11px] text-muted-foreground" title={visit.nextActionText}>Next: {visit.nextActionText}{visit.nextActionDate ? ` · ${showDate(visit.nextActionDate)}` : ''}</p>}</button></li>)}</ol>}</CardContent></Card>
            ),
          },
          {
            value: 'sales',
            label: `Sales (${sales.length})`,
            content: (
              <Card><CardHeader><CardTitle className="text-sm">Sales history</CardTitle><CardAction><Button size="sm" onClick={() => { setSaleForm(emptySale()); setSaleOpen(true) }}><PackagePlus className="mr-2 h-3.5 w-3.5" />Record sale</Button></CardAction></CardHeader><CardContent className="space-y-3">{sales.length === 0 ? <EmptyState text="No sales have been recorded." /> : sales.map((sale) => <div key={sale.id} className="grid gap-2 rounded-lg border p-4 sm:grid-cols-4"><Info label="PO date" value={showDate(sale.saleDate)} /><Info label="Quantity" value={`${sale.quantityMt} MT`} /><Info label="PO number" value={sale.invoiceReference} /><Info label="Source" value={sale.sourceSystem} /></div>)}</CardContent></Card>
            ),
          },
          {
            value: 'tasks',
            label: `Tasks (${tasks.length})`,
            content: (
              <Card><CardHeader><CardTitle className="text-sm">Follow-up tasks</CardTitle><CardAction><Button size="sm" onClick={() => openTask()}><Plus className="mr-2 h-3.5 w-3.5" />Add task</Button></CardAction></CardHeader><CardContent className="space-y-3">{tasks.length === 0 ? <EmptyState text="No customer tasks found." /> : tasks.map((task) => <div key={task.id} className="flex justify-between gap-3 rounded-lg border p-4"><div><div className="flex flex-wrap items-center gap-2"><p className="font-medium">{task.title || `Task #${task.id}`}</p><Badge variant="outline">{humanize(task.status)}</Badge><Badge variant="secondary">{humanize(task.priority)}</Badge></div><p className="mt-1 text-sm text-muted-foreground">{task.description}</p><p className="mt-2 text-xs text-muted-foreground">Due {showDate(task.dueDate)} · {task.assignedEmployeeName || employeeName(task.assignedEmployeeId)}</p></div><div className="flex shrink-0 items-start gap-1"><Button variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={() => openTask(task)}>Edit</Button><Button variant="ghost" size="icon" onClick={() => void removeTask(task)} disabled={busy}><Trash2 className="h-4 w-4 text-destructive" /></Button></div></div>)}</CardContent></Card>
            ),
          },
          {
            value: 'notes',
            label: `Notes (${notes.length})`,
            content: (
              <Card><CardHeader><CardTitle className="text-sm">Notes</CardTitle><CardAction><Button size="sm" onClick={() => openNote()}><NotebookPen className="mr-2 h-3.5 w-3.5" />Add note</Button></CardAction></CardHeader><CardContent className="space-y-3">{notes.length === 0 ? <EmptyState text="No notes have been added." /> : notes.map((note) => <div key={note.id} className="rounded-xl border bg-card p-5"><div className="flex items-start justify-between gap-4"><p className="whitespace-pre-wrap text-sm leading-6">{note.noteText}</p><Button variant="ghost" size="icon" onClick={() => openNote(note)}><Edit3 className="h-4 w-4" /></Button></div><p className="mt-3 text-xs text-muted-foreground">{note.authorName || employeeName(note.authorEmployeeId) || 'System'} · {showDate(note.updatedAt || note.createdAt)}</p></div>)}</CardContent></Card>
            ),
          },
        ]}
      />
      </div>
      <aside className="xl:sticky xl:top-4">
        <Card>
          <CardHeader className="pb-3"><CardTitle className="text-sm">About this account</CardTitle></CardHeader>
          <CardContent className="space-y-3 text-xs">
            <div className="flex items-center justify-between gap-3"><span className="text-muted-foreground">Status</span><Badge variant="outline">{humanize(account.accountStatus)}</Badge></div>
            <div className="flex items-center justify-between gap-3"><span className="text-muted-foreground">Network</span><span className="font-medium">{account.networkMember ? humanize(account.networkStatus) : 'Not a member'}</span></div>
            <div className="flex items-center justify-between gap-3"><span className="text-muted-foreground">Onboarded</span><span className="font-medium">{account.networkOnboardingDate ? showDate(account.networkOnboardingDate) : '—'}</span></div>
            <div className="h-px bg-border" />
            <div className="flex items-center justify-between gap-3"><span className="text-muted-foreground">Group</span><span className="max-w-[160px] truncate font-medium" title={resolvedGroupName}>{resolvedGroupName}</span></div>
            <div className="flex items-center justify-between gap-3"><span className="text-muted-foreground">Tier</span><span className="font-medium">Tier {account.clientTier}</span></div>
            <div className="flex items-center justify-between gap-3"><span className="text-muted-foreground">Owner</span><span className="max-w-[160px] truncate font-medium" title={account.ownerEmployeeName || employeeName(account.ownerEmployeeId)}>{account.ownerEmployeeName || employeeName(account.ownerEmployeeId)}</span></div>
            <div className="flex items-center justify-between gap-3"><span className="text-muted-foreground">Region</span><span className="font-medium">{resolvedRegionName}</span></div>
            <div className="flex items-center justify-between gap-3"><span className="text-muted-foreground">Focus</span><span className="font-medium">{humanize(account.focusSector)}</span></div>
            <div className="flex items-center justify-between gap-3"><span className="text-muted-foreground">Terms</span><span className="font-medium">{account.creditTermsDays}d · {money(account.creditLimitAmount)}</span></div>
            <div className="h-px bg-border" />
          </CardContent>
        </Card>
      </aside>
      </div>


      <Sheet open={editOpen} onOpenChange={(open) => !busy && setEditOpen(open)}><SheetContent className="flex w-full flex-col sm:max-w-2xl"><SheetHeader className="border-b pb-4"><SheetTitle>Edit retail customer</SheetTitle></SheetHeader><div className="min-h-0 flex-1 overflow-y-auto px-1 py-4">{editDraft && <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Account name" required><Input value={editDraft.accountName} onChange={(event) => setEditDraft({ ...editDraft, accountName: event.target.value })} /></Field><Field label="GSTIN" required><Input value={editDraft.gstNumber} onChange={(event) => setEditDraft({ ...editDraft, gstNumber: event.target.value.toUpperCase().slice(0, 15) })} /></Field><Field label="Client type"><Select value={editDraft.clientType} onValueChange={(value) => setEditDraft({ ...editDraft, clientType: value as RetailAccountDraft['clientType'] })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="DEALER">Dealer</SelectItem><SelectItem value="DISTRIBUTOR">Distributor</SelectItem></SelectContent></Select></Field>
        <Field label="Account status"><Select value={editDraft.accountStatus} onValueChange={(value) => setEditDraft({ ...editDraft, accountStatus: value as RetailAccountDraft['accountStatus'] })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="PROSPECT">Prospect</SelectItem><SelectItem value="ACTIVE">Active</SelectItem><SelectItem value="DORMANT">Dormant</SelectItem><SelectItem value="LOST">Lost</SelectItem></SelectContent></Select></Field><Field label="Owner"><Select value={editDraft.ownerEmployeeId} onValueChange={(value) => setEditDraft({ ...editDraft, ownerEmployeeId: value })}><SelectTrigger><SelectValue placeholder="Choose employee" /></SelectTrigger><SelectContent>{employees.map((employee) => <SelectItem key={employee.id} value={String(employee.id)}>{[employee.firstName, employee.lastName].filter(Boolean).join(' ') || `Employee #${employee.id}`}</SelectItem>)}</SelectContent></Select></Field><Field label="Client group" required><Select value={editDraft.clientGroupId} onValueChange={(value) => setEditDraft({ ...editDraft, clientGroupId: value })}><SelectTrigger><SelectValue placeholder="Choose group" /></SelectTrigger><SelectContent>{groups.filter((g) => g.active !== false).map((g) => <SelectItem key={g.id} value={String(g.id)}>{g.groupName}</SelectItem>)}</SelectContent></Select></Field>
        <Field label="Village / area" required><Input value={editDraft.addressVillageArea} onChange={(event) => setEditDraft({ ...editDraft, addressVillageArea: event.target.value })} /></Field><Field label="Taluka" required><Input value={editDraft.addressTaluka} onChange={(event) => setEditDraft({ ...editDraft, addressTaluka: event.target.value })} /></Field><Field label="City" required><Input value={editDraft.addressCity} onChange={(event) => setEditDraft({ ...editDraft, addressCity: event.target.value })} /></Field><Field label="District" required><Input value={editDraft.addressDistrict} onChange={(event) => setEditDraft({ ...editDraft, addressDistrict: event.target.value })} /></Field><Field label="State" required><Input value={editDraft.addressState} onChange={(event) => setEditDraft({ ...editDraft, addressState: event.target.value })} /></Field><Field label="PIN code" required><Input value={editDraft.pinCode} onChange={(event) => setEditDraft({ ...editDraft, pinCode: event.target.value.replace(/\D/g, '').slice(0, 6) })} /></Field>
        <Field label="Region"><Select value={editDraft.regionId} onValueChange={(value) => setEditDraft({ ...editDraft, regionId: value })}><SelectTrigger><SelectValue placeholder="Derived from PIN" /></SelectTrigger><SelectContent>{regions.filter((r) => r.active !== false).map((r) => <SelectItem key={r.id} value={String(r.id)}>{r.name}</SelectItem>)}</SelectContent></Select></Field><Field label="Latitude" required><Input type="number" value={editDraft.outletLatitude} onChange={(event) => setEditDraft({ ...editDraft, outletLatitude: event.target.value })} /></Field><Field label="Longitude" required><Input type="number" value={editDraft.outletLongitude} onChange={(event) => setEditDraft({ ...editDraft, outletLongitude: event.target.value })} /></Field>
        <Field label="Monthly sales (MT)"><Input type="number" min="0" value={editDraft.declaredMonthlySalesMt} onChange={(event) => setEditDraft({ ...editDraft, declaredMonthlySalesMt: event.target.value })} /></Field><Field label="Focus sector"><Select value={editDraft.focusSector} onValueChange={(value) => setEditDraft({ ...editDraft, focusSector: value as RetailAccountDraft['focusSector'] })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="RETAIL">Retail</SelectItem><SelectItem value="GOVERNMENT_PROJECTS">Government projects</SelectItem><SelectItem value="DEVELOPER_PROJECTS">Developer projects</SelectItem><SelectItem value="ALL_SECTORS">All sectors</SelectItem></SelectContent></Select></Field><Field label="Client tier"><Select value={editDraft.clientTier} onValueChange={(value) => setEditDraft({ ...editDraft, clientTier: value as RetailAccountDraft['clientTier'] })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="A">A</SelectItem><SelectItem value="B">B</SelectItem><SelectItem value="C">C</SelectItem></SelectContent></Select></Field>
        <Field label="Credit terms (days)" required><Input type="number" min="0" value={editDraft.creditTermsDays} onChange={(event) => setEditDraft({ ...editDraft, creditTermsDays: event.target.value })} /></Field><Field label="Credit limit" required><Input type="number" min="0" value={editDraft.creditLimitAmount} onChange={(event) => setEditDraft({ ...editDraft, creditLimitAmount: event.target.value })} /></Field><p className="text-xs text-muted-foreground sm:col-span-2">Network membership is managed only via Network onboard / leave, not via edit.</p>
      </div>}{editErrors.length > 0 && <ul className="mt-4 list-disc rounded-lg border border-destructive/40 bg-destructive/5 p-4 pl-8 text-sm text-destructive">{editErrors.map((error) => <li key={error}>{error}</li>)}</ul>}</div><SheetFooter className="flex-row items-center justify-end gap-3 border-t pt-4"><Button variant="outline" onClick={() => setEditOpen(false)} disabled={busy}>Cancel</Button><Button onClick={() => void saveAccount()} disabled={busy}>{busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Save account</Button></SheetFooter></SheetContent></Sheet>

      <Sheet open={contactOpen} onOpenChange={(open) => !busy && setContactOpen(open)}><SheetContent className="flex w-full flex-col sm:max-w-lg"><SheetHeader className="border-b pb-4"><SheetTitle>{editingContact ? 'Edit contact' : 'Add contact'}</SheetTitle></SheetHeader><div className="min-h-0 flex-1 overflow-y-auto px-1 py-4"><div className="grid gap-4 sm:grid-cols-2"><Field label="First name" required><Input disabled={Boolean(editingContact)} value={contactForm.firstName} onChange={(event) => setContactForm({ ...contactForm, firstName: event.target.value })} /></Field><Field label="Last name"><Input disabled={Boolean(editingContact)} value={contactForm.lastName} onChange={(event) => setContactForm({ ...contactForm, lastName: event.target.value })} /></Field><Field label="Mobile" required><Input disabled={Boolean(editingContact)} value={contactForm.mobile} onChange={(event) => setContactForm({ ...contactForm, mobile: event.target.value.replace(/\D/g, '').slice(0, 10) })} /></Field><Field label="Email"><Input disabled={Boolean(editingContact)} type="email" value={contactForm.email} onChange={(event) => setContactForm({ ...contactForm, email: event.target.value })} /></Field><Field label="Designation" required><Input value={contactForm.designation} onChange={(event) => setContactForm({ ...contactForm, designation: event.target.value })} /></Field><Field label="Role description"><Input value={contactForm.roleDescription} onChange={(event) => setContactForm({ ...contactForm, roleDescription: event.target.value })} /></Field>{!editingContact && <><Field label="Date of birth"><Input type="date" value={contactForm.dateOfBirth} onChange={(event) => setContactForm({ ...contactForm, dateOfBirth: event.target.value })} /></Field><Field label="Anniversary"><Input type="date" value={contactForm.anniversaryDate} onChange={(event) => setContactForm({ ...contactForm, anniversaryDate: event.target.value })} /></Field></>}<label className="flex items-center gap-2 text-sm"><Checkbox checked={contactForm.primaryContact} onCheckedChange={(checked) => setContactForm({ ...contactForm, primaryContact: checked === true })} />Primary contact</label>{editingContact && <label className="flex items-center gap-2 text-sm"><Checkbox checked={contactForm.active} onCheckedChange={(checked) => setContactForm({ ...contactForm, active: checked === true })} />Active link</label>}</div></div><SheetFooter className="flex-row items-center justify-end gap-3 border-t pt-4"><Button variant="outline" onClick={() => setContactOpen(false)} disabled={busy}>Cancel</Button><Button onClick={() => void saveContact()} disabled={busy}>{busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Save contact</Button></SheetFooter></SheetContent></Sheet>

      <Sheet open={noteOpen} onOpenChange={(open) => !busy && setNoteOpen(open)}><SheetContent className="flex w-full flex-col sm:max-w-lg"><SheetHeader className="border-b pb-4"><SheetTitle>{editingNote ? 'Edit note' : 'Add note'}</SheetTitle></SheetHeader><div className="min-h-0 flex-1 overflow-y-auto px-1 py-4"><Field label="Note" required><Textarea rows={6} value={noteText} onChange={(event) => setNoteText(event.target.value)} /></Field></div><SheetFooter className="flex-row items-center justify-end gap-3 border-t pt-4"><Button variant="outline" onClick={() => setNoteOpen(false)} disabled={busy}>Cancel</Button><Button onClick={() => void saveNote()} disabled={busy || !noteText.trim()}>{busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Save note</Button></SheetFooter></SheetContent></Sheet>

      <Sheet open={visitOpen} onOpenChange={(open) => !busy && setVisitOpen(open)}><SheetContent className="flex w-full flex-col sm:max-w-lg"><SheetHeader className="border-b pb-4"><SheetTitle>Plan visit</SheetTitle></SheetHeader><div className="min-h-0 flex-1 overflow-y-auto px-1 py-4"><div className="grid gap-4 sm:grid-cols-2"><Field label="Assigned employee" required><Select value={visitForm.employeeId} onValueChange={(value) => setVisitForm({ ...visitForm, employeeId: value })}><SelectTrigger><SelectValue placeholder="Choose employee" /></SelectTrigger><SelectContent>{employees.map((employee) => <SelectItem key={employee.id} value={String(employee.id)}>{[employee.firstName, employee.lastName].filter(Boolean).join(' ') || `Employee #${employee.id}`}</SelectItem>)}</SelectContent></Select></Field><Field label="Visit date" required><Input type="date" value={visitForm.date} onChange={(event) => setVisitForm({ ...visitForm, date: event.target.value })} /></Field><Field label="Start time"><Input type="time" value={visitForm.startTime} onChange={(event) => setVisitForm({ ...visitForm, startTime: event.target.value })} /></Field><Field label="End time"><Input type="time" value={visitForm.endTime} onChange={(event) => setVisitForm({ ...visitForm, endTime: event.target.value })} /></Field><div className="sm:col-span-2"><Field label="Purpose" required><Select value={VISIT_PURPOSES.some(o=>o.value===visitForm.purpose || o.label===visitForm.purpose) ? (VISIT_PURPOSES.find(o=>o.value===visitForm.purpose || o.label===visitForm.purpose)?.value || 'ROUTINE_VISIT') : visitForm.purpose} onValueChange={(v) => setVisitForm({ ...visitForm, purpose: v === 'OTHER' ? visitForm.purpose : VISIT_PURPOSES.find(o=>o.value===v)?.label || v })}><SelectTrigger><SelectValue placeholder="Select purpose" /></SelectTrigger><SelectContent>{VISIT_PURPOSES.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent></Select></Field></div><label className="flex items-center gap-2 text-sm"><Checkbox checked={visitForm.selfGenerated} onCheckedChange={(checked) => setVisitForm({ ...visitForm, selfGenerated: checked === true })} />Self-generated visit</label></div></div><SheetFooter className="flex-row items-center justify-end gap-3 border-t pt-4"><Button variant="outline" onClick={() => setVisitOpen(false)} disabled={busy}>Cancel</Button><Button onClick={() => void saveVisit()} disabled={busy}>{busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Plan visit</Button></SheetFooter></SheetContent></Sheet>

      <Sheet open={saleOpen} onOpenChange={(open) => !busy && setSaleOpen(open)}><SheetContent className="flex w-full flex-col sm:max-w-lg"><SheetHeader className="border-b pb-4"><SheetTitle>Record actual sale</SheetTitle></SheetHeader><div className="min-h-0 flex-1 overflow-y-auto px-1 py-4"><div className="grid gap-4 sm:grid-cols-2"><Field label="PO date" required><Input type="date" max={today()} value={saleForm.saleDate} onChange={(event) => setSaleForm({ ...saleForm, saleDate: event.target.value })} /></Field><Field label="Quantity (MT)" required><Input type="number" min="0.01" step="0.01" value={saleForm.quantityMt} onChange={(event) => setSaleForm({ ...saleForm, quantityMt: event.target.value })} /></Field><div className="sm:col-span-2"><Field label="PO number" required><Input placeholder="PO-2026-101" value={saleForm.invoiceReference} onChange={(event) => setSaleForm({ ...saleForm, invoiceReference: event.target.value })} /></Field></div></div></div><SheetFooter className="flex-row items-center justify-end gap-3 border-t pt-4"><Button variant="outline" onClick={() => setSaleOpen(false)} disabled={busy}>Cancel</Button><Button onClick={() => void saveSale()} disabled={busy}>{busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Record sale</Button></SheetFooter></SheetContent></Sheet>

      <Sheet open={taskOpen} onOpenChange={(open) => !busy && setTaskOpen(open)}><SheetContent className="flex w-full flex-col sm:max-w-lg"><SheetHeader className="border-b pb-4"><SheetTitle>{editingTask ? 'Edit task' : 'New task'}</SheetTitle></SheetHeader><div className="min-h-0 flex-1 overflow-y-auto px-1 py-4"><div className="grid gap-4 sm:grid-cols-2"><Field label="Task title" required><Input value={taskForm.title} onChange={(event) => setTaskForm({ ...taskForm, title: event.target.value })} /></Field><Field label="Assignee" required><Select value={taskForm.employeeId} onValueChange={(value) => setTaskForm({ ...taskForm, employeeId: value })}><SelectTrigger><SelectValue placeholder="Choose employee" /></SelectTrigger><SelectContent>{employees.map((employee) => <SelectItem key={employee.id} value={String(employee.id)}>{[employee.firstName, employee.lastName].filter(Boolean).join(' ') || `Employee #${employee.id}`}</SelectItem>)}</SelectContent></Select></Field><Field label="Due date" required><Input type="date" value={taskForm.dueDate} onChange={(event) => setTaskForm({ ...taskForm, dueDate: event.target.value })} /></Field><Field label="Priority"><Select value={taskForm.priority} onValueChange={(value) => setTaskForm({ ...taskForm, priority: value as RetailTask['priority'] })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="LOW">Low</SelectItem><SelectItem value="MEDIUM">Medium</SelectItem><SelectItem value="HIGH">High</SelectItem><SelectItem value="URGENT">Urgent</SelectItem></SelectContent></Select></Field>{editingTask && <Field label="Status"><Select value={taskForm.status} onValueChange={(value) => setTaskForm({ ...taskForm, status: value as RetailTask['status'] })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="OPEN">Open</SelectItem><SelectItem value="IN_PROGRESS">In progress</SelectItem><SelectItem value="COMPLETED">Completed</SelectItem><SelectItem value="CANCELLED">Cancelled</SelectItem></SelectContent></Select></Field>}<div className="sm:col-span-2"><Field label="Description"><Textarea value={taskForm.description} onChange={(event) => setTaskForm({ ...taskForm, description: event.target.value })} /></Field></div></div></div><SheetFooter className="flex-row items-center justify-end gap-3 border-t pt-4"><Button variant="outline" onClick={() => setTaskOpen(false)} disabled={busy}>Cancel</Button><Button onClick={() => void saveTask()} disabled={busy}>{busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}{editingTask ? 'Save changes' : 'Create task'}</Button></SheetFooter></SheetContent></Sheet>

      <Sheet open={monthlySalesOpen} onOpenChange={(open) => !busy && setMonthlySalesOpen(open)}>
        <SheetContent className="flex w-full flex-col sm:max-w-lg">
          <SheetHeader className="border-b pb-4">
            <SheetTitle>Update declared MT</SheetTitle>
          </SheetHeader>
          <div className="min-h-0 flex-1 overflow-y-auto px-1 py-4">
          <div className="grid gap-4">
            <Field label="Declared monthly sales (MT)" required>
              <Input type="number" min="0" step="0.01" value={monthlySalesForm.declaredMonthlySalesMt} onChange={(event) => setMonthlySalesForm({ ...monthlySalesForm, declaredMonthlySalesMt: event.target.value })} />
            </Field>
            <Field label="Change reason" required>
              <Textarea value={monthlySalesForm.changeReason} onChange={(event) => setMonthlySalesForm({ ...monthlySalesForm, changeReason: event.target.value })} placeholder="e.g. Updated after monthly review with client" />
              <p className="text-xs text-muted-foreground">This reason is recorded in the commercial change history.</p>
            </Field>
          </div>
          </div>
          <SheetFooter className="flex-row items-center justify-end gap-3 border-t pt-4">
            <Button variant="outline" onClick={() => setMonthlySalesOpen(false)} disabled={busy}>Cancel</Button>
            <Button onClick={() => void saveMonthlySales()} disabled={busy}>{busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Update</Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>

      <Dialog open={deleteOpen} onOpenChange={(open) => !busy && setDeleteOpen(open)}><DialogContent><DialogHeader><DialogTitle>Deactivate this customer?</DialogTitle><DialogDescription>The new DELETE endpoint performs a soft delete, preserving account history.</DialogDescription></DialogHeader><div className="rounded-lg border bg-muted/40 p-3 font-medium">{account.accountName}</div><DialogFooter><Button variant="outline" onClick={() => setDeleteOpen(false)} disabled={busy}>Cancel</Button><Button variant="destructive" onClick={() => void deactivateAccount()} disabled={busy}>{busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Deactivate</Button></DialogFooter></DialogContent></Dialog>

      <Sheet open={networkOpen} onOpenChange={(open) => !busy && setNetworkOpen(open)}>
        <SheetContent className="flex w-full flex-col sm:max-w-lg">
          <SheetHeader className="border-b pb-4">
            <SheetTitle>Network onboarding</SheetTitle>
          </SheetHeader>
          <div className="min-h-0 flex-1 overflow-y-auto px-1 py-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Joining date" required>
              <Input type="date" value={networkForm.joiningDate} onChange={(e) => setNetworkForm({ ...networkForm, joiningDate: e.target.value })} />
            </Field>
            <Field label="First order date" required>
              <Input type="date" value={networkForm.firstOrderDate} onChange={(e) => setNetworkForm({ ...networkForm, firstOrderDate: e.target.value })} />
            </Field>
            <div className="sm:col-span-2">
              <Field label="First order reference" required>
                <Input value={networkForm.firstOrderReference} onChange={(e) => setNetworkForm({ ...networkForm, firstOrderReference: e.target.value })} placeholder="e.g. Invoice #1001 or SO-2026-001" />
              </Field>
            </div>
            <div className="sm:col-span-2">
              <Field label="Reason (optional)">
                <Textarea value={networkForm.reason} onChange={(e) => setNetworkForm({ ...networkForm, reason: e.target.value })} placeholder="e.g. Commercial terms agreed, first order placed." />
              </Field>
            </div>
          </div>
          </div>
          <SheetFooter className="flex-row items-center justify-end gap-3 border-t pt-4">
            <Button variant="outline" onClick={() => setNetworkOpen(false)} disabled={busy}>Cancel</Button>
            <Button onClick={() => void saveNetworkOnboard()} disabled={busy}>
              {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Confirm onboarding
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>
    </div>
  );
}
