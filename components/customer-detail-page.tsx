'use client';

import { adminRemovalPaths } from '@/lib/admin-removals-api';
import { AdminRemovalAction, useAdminRemovalAccess } from '@/components/admin-removal-action';
import { useRemovalConfirmation } from '@/components/removal-confirmation-provider';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Activity, ArrowLeft, ArrowRight, ArrowRightLeft, Building2, CalendarDays, CalendarPlus, Edit3, ExternalLink, Handshake, FileText, Hash, History, ListChecks, Loader2, Mail, MapPin, MapPinned, MoreHorizontal, NotebookPen, Package, PackagePlus, Phone, Plus, RefreshCw, StickyNote, Tag, Trash2, TrendingUp, User, UserPlus, Users, Wallet, X } from 'lucide-react';
import { toast } from 'sonner';


import { useAuth } from '@/components/auth-provider';
import { getErrorMessage } from '@/lib/api-error';
import { getDateOfBirthError, localDateInputValue } from '@/lib/contact-validation';
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
  type RetailPinCode,
  type RetailSale,
  type RetailSalesRegion,
  type RetailTask,
  type RetailVisit,
} from '@/lib/retail-api';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { SearchableSelect, type SearchableOption } from '@/components/ui/searchable-select2';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { DetailShell } from '@/components/detail-shell';
import { ActivityTimeline, NotesFeed, SalesTable, TaskList, VisitList, salesSummary, taskSummary, FormCheck, FormField, FormGroup, FormSheet, DetailHero, DetailSkeleton, EmptyState, Info, Initials, KpiCell, Pill, Section, VISIT_PURPOSES, WarningBanner, dayKey, isOpenTask, purposeLabel, today, visitStatus, type ActivityItem, type Tone } from '@/components/detail-ui';
import { cn } from '@/lib/utils';
import { formatClientTypeLabel } from '@/lib/client-type-label';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';

interface CustomerDetailPageProps { accountId: number }
interface ContactForm { firstName: string; lastName: string; mobile: string; email: string; dateOfBirth: string; anniversaryDate: string; designation: string; roleDescription: string; primaryContact: boolean; active: boolean }
interface VisitForm { employeeId: string; date: string; startTime: string; endTime: string; purpose: string; description: string; selfGenerated: boolean }
interface SaleForm { saleDate: string; quantityMt: string; invoiceReference: string; outcomeStatus: 'WIN' | 'LOST' | ''; poNumber: string; poDate: string; lossReason: string }
interface TaskForm { title: string; description: string; employeeId: string; dueDate: string; priority: RetailTask['priority']; status: RetailTask['status'] }
interface MonthlySalesForm { declaredMonthlySalesMt: string; changeReason: string }

const emptyContact: ContactForm = { firstName: '', lastName: '', mobile: '', email: '', dateOfBirth: '', anniversaryDate: '', designation: '', roleDescription: '', primaryContact: false, active: true };
const emptyVisit = (): VisitForm => ({ employeeId: '', date: today(), startTime: '10:00', endTime: '10:30', purpose: '', description: '', selfGenerated: true });
const emptySale = (): SaleForm => ({ saleDate: today(), quantityMt: '', invoiceReference: '', outcomeStatus: '', poNumber: '', poDate: '', lossReason: '' });
const emptyTask = (): TaskForm => ({ title: '', description: '', employeeId: '', dueDate: today(), priority: 'MEDIUM', status: 'OPEN' });
const emptyMonthlySales = (): MonthlySalesForm => ({ declaredMonthlySalesMt: '', changeReason: '' });
const humanize = (value: string | null | undefined) => value ? value.replaceAll('_', ' ').toLowerCase().replace(/\b\w/g, (letter) => letter.toUpperCase()) : '—';
const showDate = (value: string) => value ? new Date(value.length === 10 ? `${value}T00:00:00` : value).toLocaleString('en-IN', value.length === 10 ? { dateStyle: 'medium' } : { dateStyle: 'medium', timeStyle: 'short' }) : '—';
// Radix Select cannot use '' as an item value, so "no secondary" needs a sentinel.
const NO_SECONDARY = 'none';
const money = (value: number) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(value || 0);
const validateRetailAccountEdit = (draft: RetailAccountDraft) => {
  const errors = validateRetailAccountDraft(draft);
  if (!draft.clientGroupId) errors.push('Client group is required.');
  return errors;
};
const resolveRetailAccountRegionId = (pinCode: string, pinCodes: RetailPinCode[]) => {
  const normalizedPin = pinCode.trim();
  const matchedPin = pinCodes.find((item) => item.active !== false && item.pinCode.trim() === normalizedPin);
  return matchedPin?.regionId == null ? '' : String(matchedPin.regionId);
};


export default function CustomerDetailPage({ accountId }: CustomerDetailPageProps) {
  const router = useRouter();
  const { token, userData } = useAuth();
  const confirmRemoval = useRemovalConfirmation();
  const canDeactivate = useAdminRemovalAccess();
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
  const employeeOptions: SearchableOption[] = useMemo(() => employees.map(e => ({ value: String(e.id), label: [e.firstName, e.lastName].filter(Boolean).join(' ') || `Employee #${e.id}` })), [employees]);
  const [groups, setGroups] = useState<RetailClientGroup[]>([]);
  const [regions, setRegions] = useState<RetailSalesRegion[]>([]);
  const [pinCodes, setPinCodes] = useState<RetailPinCode[]>([]);
  const [competitorBrands, setCompetitorBrands] = useState<CompetitorBrand[]>([]);
  const [masterContacts, setMasterContacts] = useState<RetailMasterContact[]>([]);
  const [brandSelect, setBrandSelect] = useState('');
  const [brandRemarks, setBrandRemarks] = useState('');
  const [brandFormOpen, setBrandFormOpen] = useState(false);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [editDraft, setEditDraft] = useState<RetailAccountDraft | null>(null);
  const [editErrors, setEditErrors] = useState<string[]>([]);
  const [editValidationActive, setEditValidationActive] = useState(false);
  const [contactOpen, setContactOpen] = useState(false);
  const [editingContact, setEditingContact] = useState<RetailContact | null>(null);
  const [contactForm, setContactForm] = useState<ContactForm>(emptyContact);
  const contactDateOfBirthError = getDateOfBirthError(contactForm.dateOfBirth);
  const [noteOpen, setNoteOpen] = useState(false);
  const [editingNote, setEditingNote] = useState<RetailNote | null>(null);
  const [noteText, setNoteText] = useState('');
  const [visitOpen, setVisitOpen] = useState(false);
  const [visitForm, setVisitForm] = useState<VisitForm>(emptyVisit);
  const [saleOpen, setSaleOpen] = useState(false);
  const [editingSale, setEditingSale] = useState<RetailSale | null>(null);
  const [saleForm, setSaleForm] = useState<SaleForm>(emptySale);
  const [taskOpen, setTaskOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<RetailTask | null>(null);
  const [taskForm, setTaskForm] = useState<TaskForm>(emptyTask);
  const [taskKind, setTaskKind] = useState<'COMPLAINT' | 'REQUIREMENT'>('COMPLAINT');
  const [monthlySalesOpen, setMonthlySalesOpen] = useState(false);
  const [monthlySalesForm, setMonthlySalesForm] = useState<MonthlySalesForm>(emptyMonthlySales);
  const [networkOpen, setNetworkOpen] = useState(false);
  const [networkForm, setNetworkForm] = useState({ joiningDate: today(), firstOrderDate: '', firstOrderReference: '', reason: '' });

  const loadAccount = useCallback(async () => {
    if (!token || !Number.isFinite(accountId)) return null;
    let found = await RetailAPI.getAccountById(accountId, token);
    if (found && found.secondaryEmployeeId == null) {
      const secondary = (await RetailAPI.getAccountEmployees(accountId, token)).find((entry) => entry.assignmentRole === 'SECONDARY');
      if (secondary) found = { ...found, secondaryEmployeeId: secondary.employeeId, secondaryEmployeeName: secondary.employeeName };
    }
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
        RetailAPI.getPinCodes(token).then((items) => setPinCodes(items.filter((pinCode) => pinCode.active !== false))),
        RetailAPI.getCompetitorBrands(token).then(setCompetitorBrands),
      ]).then((sources) => {
        const labels = ['contacts', 'notes', 'visits', 'sales', 'tasks', 'active brands', 'brand history', 'commercial history', 'employees', 'groups', 'regions', 'PIN codes', 'competitor brands'];
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
  const totalSales = useMemo(() => sales.filter((item) => item.outcomeStatus !== 'LOST').reduce((sum, item) => sum + item.quantityMt, 0), [sales]);
  const openTaskCount = useMemo(() => tasks.filter((task) => ['OPEN', 'IN_PROGRESS'].includes(task.status)).length, [tasks]);
  const latestVisit = useMemo(() => [...visits]
    .filter((visit) => Boolean(visit.scheduledVisitDate))
    .sort((left, right) => String(right.scheduledVisitDate).localeCompare(String(left.scheduledVisitDate)))[0] ?? null, [visits]);
  const openTasks = useMemo(() => tasks.filter(isOpenTask).sort((left, right) => String(left.dueDate).localeCompare(String(right.dueDate))), [tasks]);
  const sortedNotes = useMemo(() => [...notes].sort((left, right) => String(right.updatedAt || right.createdAt).localeCompare(String(left.updatedAt || left.createdAt))), [notes]);
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
      setBrandFormOpen(false);
      await loadBrandsSection();
    } catch (error) { toast.error(getErrorMessage(error, 'Unable to add brand usage.')) } finally { setBusy(false) }
  };

  const openEdit = () => {
    if (!account) return;
    setEditDraft({
      ...createRetailAccountDraft(account),
      regionId: resolveRetailAccountRegionId(account.pinCode, pinCodes),
    });
    setEditErrors([]);
    setEditValidationActive(false);
    setEditOpen(true);
  };

  const updateEditDraft = (nextDraft: RetailAccountDraft) => {
    const draftWithRegion = {
      ...nextDraft,
      regionId: resolveRetailAccountRegionId(nextDraft.pinCode, pinCodes),
    };
    setEditDraft(draftWithRegion);
    if (editValidationActive) setEditErrors(validateRetailAccountEdit(draftWithRegion));
  };

  const saveAccount = async () => {
    if (!token || !editDraft) return;
    const draftWithRegion = {
      ...editDraft,
      regionId: resolveRetailAccountRegionId(editDraft.pinCode, pinCodes),
    };
    setEditDraft(draftWithRegion);
    const errors = validateRetailAccountEdit(draftWithRegion);
    setEditValidationActive(true);
    setEditErrors(errors);
    if (errors.length) return;
    setBusy(true);
    try {
      const currentSecondaryId = account?.secondaryEmployeeId ?? null;
      const nextSecondaryId = draftWithRegion.secondaryEmployeeId ? Number(draftWithRegion.secondaryEmployeeId) : null;
      const nextOwnerId = Number(draftWithRegion.ownerEmployeeId);
      // Promoting the current secondary to primary: release the secondary slot first.
      const releaseSecondaryFirst = currentSecondaryId != null && currentSecondaryId === nextOwnerId;
      if (releaseSecondaryFirst) await RetailAPI.removeAccountEmployee(accountId, currentSecondaryId, token);
      await RetailAPI.updateAccount(accountId, buildRetailAccountPayload(draftWithRegion), token);
      await RetailAPI.setSecondaryEmployee(accountId, releaseSecondaryFirst ? null : currentSecondaryId, nextSecondaryId, token);
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
    setContactForm(contact ? { firstName: contact.firstName, lastName: contact.lastName, mobile: contact.mobile, email: contact.email, dateOfBirth: contact.dateOfBirth.slice(0, 10), anniversaryDate: contact.anniversaryDate.slice(0, 10), designation: contact.designation, roleDescription: contact.roleDescription, primaryContact: contact.primaryContact, active: contact.active } : { ...emptyContact, primaryContact: resolvedContacts.length === 0 });
    setContactOpen(true);
  };

  const saveContact = async () => {
    if (!token || !account) return;
    const dateOfBirthError = getDateOfBirthError(contactForm.dateOfBirth);
    if (dateOfBirthError) { toast.error(dateOfBirthError); return }
    if (!contactForm.firstName.trim() || !contactForm.lastName.trim() || !contactForm.designation.trim() || contactForm.mobile.replace(/\D/g, '').length !== 10) { toast.error('First name, last name, designation, and a 10-digit mobile number are required.'); return }
    const datesChanged = Boolean(editingContact && (contactForm.dateOfBirth !== editingContact.dateOfBirth.slice(0, 10) || contactForm.anniversaryDate !== editingContact.anniversaryDate.slice(0, 10)));
    if (datesChanged && (!editingContact?.contactInfluenceRegisterId || editingContact.contactInfluenceRegisterId <= 0)) { toast.error('The shared contact ID is missing. Reload the contact and try again.'); return }
    setBusy(true);
    let datesSaved = false;
    try {
      if (editingContact) {
        if (datesChanged) {
          await RetailAPI.updateMasterContact(editingContact.contactInfluenceRegisterId, { dateOfBirth: contactForm.dateOfBirth || null, anniversaryDate: contactForm.anniversaryDate || null }, token);
          datesSaved = true;
        }
        if (contactForm.designation.trim() !== editingContact.designation || contactForm.roleDescription.trim() !== editingContact.roleDescription || contactForm.primaryContact !== editingContact.primaryContact || contactForm.active !== editingContact.active) {
          await RetailAPI.updateContact(editingContact.id, { clientAccountId: account.id, contactInfluenceRegisterId: editingContact.contactInfluenceRegisterId, designation: contactForm.designation.trim(), roleDescription: contactForm.roleDescription.trim() || null, primaryContact: contactForm.primaryContact, active: contactForm.active }, token);
        }
      } else {
        const masterId = await RetailAPI.createMasterContact({ firstName: contactForm.firstName.trim(), lastName: contactForm.lastName.trim(), mobile: contactForm.mobile.replace(/\D/g, ''), email: contactForm.email.trim() || null, dateOfBirth: contactForm.dateOfBirth || null, anniversaryDate: contactForm.anniversaryDate || null, active: true }, token);
        await RetailAPI.linkContact({ clientAccountId: account.id, contactInfluenceRegisterId: masterId, designation: contactForm.designation.trim(), roleDescription: contactForm.roleDescription.trim() || null, primaryContact: contactForm.primaryContact, active: true }, token);
      }
      toast.success(editingContact ? 'Contact updated.' : 'Contact created and linked.');
      setContactOpen(false);
      await loadContactsSection();
    } catch (error) {
      toast.error(datesSaved ? `Birthday and anniversary were saved, but the account contact details could not be saved. ${getErrorMessage(error, 'Please try again.')}` : getErrorMessage(error, 'Unable to save contact.'));
      if (datesSaved) await loadContactsSection();
    } finally { setBusy(false) }
  };

  const removeContact = async (contact: RetailContact) => {
    if (!token || !(await confirmRemoval({ title: "Confirm removal", description: `Remove ${contact.firstName || 'this contact'} from this customer?` }))) return;
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
      await RetailAPI.createVisit({ visitType: 'DEALER_VISIT', clientAccountId: account.id, institutionId: null, projectId: null, assignedEmployeeId: assigned, assignedByEmployeeId, scheduledVisitDate: visitForm.date, scheduledStartTime: `${visitForm.startTime}:00`, scheduledEndTime: `${visitForm.endTime}:00`, scheduledLatitude: account.outletLatitude, scheduledLongitude: account.outletLongitude, purpose: visitForm.purpose.trim(), description: visitForm.description.trim() || null, selfGenerated: visitForm.selfGenerated }, token);
      toast.success('Visit planned.'); setVisitOpen(false); await loadVisitsSection();
    } catch (error) { toast.error(getErrorMessage(error, 'Unable to plan visit.')) } finally { setBusy(false) }
  };

  const openSale = (sale?: RetailSale) => {
    setEditingSale(sale ?? null);
    setSaleForm(sale ? { saleDate: sale.saleDate.slice(0, 10), quantityMt: String(sale.quantityMt), invoiceReference: sale.invoiceReference, outcomeStatus: sale.outcomeStatus ?? '', poNumber: sale.poNumber, poDate: sale.poDate.slice(0, 10), lossReason: sale.lossReason } : emptySale());
    setSaleOpen(true);
  };

  const saveSale = async () => {
    if (!token || !account) return;
    const quantity = Number(saleForm.quantityMt);
    if (!saleForm.outcomeStatus) { toast.error('Select Won or Lost.'); return }
    if (!saleForm.saleDate || saleForm.saleDate > today()) { toast.error('Sale date is required and cannot be in the future.'); return }
    if (!Number.isFinite(quantity) || quantity <= 0) { toast.error('Quantity must be greater than zero.'); return }
    if (saleForm.outcomeStatus === 'WIN' && (!saleForm.poNumber.trim() || !saleForm.poDate)) { toast.error('PO date and PO number are required for a won sale.'); return }
    if (saleForm.outcomeStatus === 'WIN' && saleForm.poDate > today()) { toast.error('PO date cannot be in the future.'); return }
    if (saleForm.outcomeStatus === 'LOST' && !saleForm.lossReason.trim()) { toast.error('Lost reason is required.'); return }
    setBusy(true);
    try {
      const payload = { clientAccountId: account.id, saleDate: saleForm.saleDate, quantityMt: quantity, invoiceReference: saleForm.invoiceReference.trim() || null, sourceSystem: editingSale?.sourceSystem || 'MANUAL', outcomeStatus: saleForm.outcomeStatus, poNumber: saleForm.outcomeStatus === 'WIN' ? saleForm.poNumber.trim() : null, poDate: saleForm.outcomeStatus === 'WIN' ? saleForm.poDate : null, lossReason: saleForm.outcomeStatus === 'LOST' ? saleForm.lossReason.trim() : null };
      if (editingSale) await RetailAPI.updateSale(editingSale.id, payload, token); else await RetailAPI.createSale(payload, token);
      toast.success(editingSale ? 'Sale updated.' : 'Sale recorded.'); setSaleOpen(false); await loadSalesSection();
    } catch (error) { toast.error(getErrorMessage(error, 'Unable to save sale.')) } finally { setBusy(false) }
  };

  const openTask = async (task?: RetailTask) => {
    if (!account) return;
    if (task && token) {
      try { task = await RetailAPI.getTaskById(task.id, token); } catch (error) { toast.error(getErrorMessage(error, 'Unable to load task details.')); return; }
    }
    setEditingTask(task ?? null);
    if (!task) setTaskKind('COMPLAINT');
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
      const payload = { taskTitle: taskForm.title.trim(), taskDescription: taskForm.description.trim() || null, taskType: (editingTask ? ((editingTask as { taskType?: string }).taskType ?? taskKind) : taskKind) as string, status: taskForm.status, priority: taskForm.priority, assignedToEmployeeId: employeeId, assignedByEmployeeId, dueDate: taskForm.dueDate, clientAccountId: account.id, visitActivityId: null };
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
    if (!token || !(await confirmRemoval({ title: "Confirm removal", description: `Cancel task “${task.title}”?` }))) return;
    setBusy(true); try { await RetailAPI.deleteTask(task.id, token); toast.success('Task cancelled.'); await loadTasksSection() } catch (error) { toast.error(getErrorMessage(error, 'Unable to delete task.')) } finally { setBusy(false) }
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

  if (isLoading) return <DetailSkeleton />;
  if (!Number.isFinite(accountId) || !account) return <Card><CardHeader><CardTitle>Customer not found</CardTitle><CardDescription>The account was not returned by the new paginated retail-accounts endpoint.</CardDescription></CardHeader><CardContent><Button variant="outline" onClick={() => router.push('/dashboard/customers')}><ArrowLeft className="mr-2 h-4 w-4" />Back to customers</Button></CardContent></Card>;

  const germanNetworkOn = Boolean(account.networkMember && account.networkStatus === 'ACTIVE');
  const ownerName = account.ownerEmployeeName || employeeName(account.ownerEmployeeId);
  const secondaryName = account.secondaryEmployeeId == null ? '' : account.secondaryEmployeeName || employeeName(account.secondaryEmployeeId);
  const openVisitForm = () => { setVisitForm({ ...emptyVisit(), employeeId: String(account.ownerEmployeeId || '') }); setVisitOpen(true) };
  const openMonthlySales = () => { setMonthlySalesForm({ declaredMonthlySalesMt: account.declaredMonthlySalesMt == null ? '' : String(account.declaredMonthlySalesMt), changeReason: '' }); setMonthlySalesOpen(true) };
  const statusTone: Tone = account.accountStatus === 'ACTIVE' ? 'success' : account.accountStatus === 'PROSPECT' ? 'info' : account.accountStatus === 'LOST' ? 'danger' : 'warning';
  const nextStep: { text: string; done: boolean; action?: React.ReactNode } =
    !account.networkMember && totalSales === 0 ? { text: 'Record the first sale, then onboard this account to the network.', done: false, action: <Button size="sm" className="h-8" onClick={() => openSale()}><PackagePlus className="mr-1.5 h-3.5 w-3.5" />Record first sale</Button> }
    : !account.networkMember ? { text: 'First order is in. Onboard this account to the network.', done: false, action: <Button size="sm" className="h-8" onClick={() => setNetworkOpen(true)}>Network onboard</Button> }
    : account.accountStatus === 'PROSPECT' ? { text: 'Network onboarding is done. Set the account status to Active.', done: false, action: <Button size="sm" className="h-8" onClick={() => void flipToActive()} disabled={busy}>Set Active</Button> }
    : account.networkStatus === 'INACTIVE' ? { text: 'No sale in the last 3 months. Plan a win-back visit.', done: false, action: <Button size="sm" variant="outline" className="h-8" onClick={openVisitForm}><CalendarPlus className="mr-1.5 h-3.5 w-3.5" />Plan win-back visit</Button> }
    : account.accountStatus === 'DORMANT' ? { text: 'Account is dormant. Re-activate it via Edit.', done: false, action: <Button size="sm" variant="outline" className="h-8" onClick={openEdit}>Edit account</Button> }
    : { text: 'On track. Keep up regular visits and sales.', done: true };
  const recentActivity: ActivityItem[] = [
    ...visits.map((visit) => ({ key: `visit-${visit.id}`, date: visit.actualCheckinAt || visit.scheduledVisitDate, icon: CalendarDays, title: `Visit · ${purposeLabel(visit.purpose)}`, meta: `${visitStatus(visit).label} · ${visit.assignedEmployeeName || employeeName(visit.assignedEmployeeId)}`, onClick: () => router.push(`/dashboard/visits/${visit.id}`) })),
    ...sales.map((sale) => ({ key: `sale-${sale.id}`, date: sale.saleDate, icon: Package, title: `${sale.outcomeStatus === 'LOST' ? 'Lost sale' : sale.outcomeStatus === 'WIN' ? 'Won sale' : 'Sale'} · ${sale.quantityMt.toLocaleString('en-IN')} MT`, meta: sale.outcomeStatus === 'LOST' ? sale.lossReason : [sale.poNumber ? `PO ${sale.poNumber}` : '', sale.invoiceReference].filter(Boolean).join(' · ') || '—' })),
    ...notes.map((note) => ({ key: `note-${note.id}`, date: note.createdAt, icon: StickyNote, title: `Note · ${note.authorName || employeeName(note.authorEmployeeId) || 'System'}`, meta: note.noteText })),
    ...commercialHistory.map((entry) => ({ key: `change-${entry.id}`, date: entry.changedAt, icon: ArrowRightLeft, title: `${humanize(entry.fieldName)} changed`, meta: `${entry.oldValue || '—'} → ${entry.newValue || '—'} · ${entry.changedBy || 'System'}` })),
  ].filter((item) => item.date && dayKey(item.date) <= today()).sort((left, right) => String(right.date).localeCompare(String(left.date))).slice(0, 8);
  const upNext: ActivityItem[] = [
    ...openTasks.map((task) => ({ key: `task-${task.id}`, date: task.dueDate, icon: ListChecks, title: task.title || `Task #${task.id}`, meta: `Task · ${humanize(task.priority)} · ${task.assignedEmployeeName || employeeName(task.assignedEmployeeId)}`, alert: Boolean(task.dueDate) && dayKey(task.dueDate) < today(), onClick: () => void openTask(task) })),
    ...visits.filter((visit) => !visit.actualCheckinAt && !visit.outcome && dayKey(visit.scheduledVisitDate) >= today()).map((visit) => ({ key: `planned-${visit.id}`, date: visit.scheduledVisitDate, icon: CalendarDays, title: purposeLabel(visit.purpose), meta: `Planned visit · ${visit.assignedEmployeeName || employeeName(visit.assignedEmployeeId)}`, onClick: () => router.push(`/dashboard/visits/${visit.id}`) })),
  ].filter((item) => item.date).sort((left, right) => String(left.date).localeCompare(String(right.date)));

  return (
    <div className="detail-page space-y-4 font-poppins text-xs">
      <DetailHero
        name={account.accountName}
        imageUrl={account.storeImageUrl ?? null}
        onBack={() => router.push('/dashboard/customers')}
        backLabel="Back to customers"
        badges={<>
          <Pill tone={statusTone}>{humanize(account.accountStatus)}</Pill>
          <Pill tone={germanNetworkOn ? 'success' : 'warning'}>German Network {germanNetworkOn ? 'On' : 'Off'}</Pill>
          {!account.active && <Pill tone="danger">Inactive record</Pill>}
        </>}
        meta={[
          { icon: Building2, label: formatClientTypeLabel(account.clientType) || 'Retail' },
          { icon: Hash, label: account.id },
          ...(account.gstNumber ? [{ icon: FileText, label: account.gstNumber, mono: true }] : []),
          ...(account.addressCity || account.addressState ? [{ icon: MapPin, label: [account.addressCity, account.addressState].filter(Boolean).join(', ') }] : []),
          { icon: User, label: ownerName, title: 'Primary assigned employee' },
          ...(secondaryName ? [{ icon: Users, label: secondaryName, title: 'Secondary assigned employee' }] : []),
          { icon: Users, label: resolvedGroupName, title: 'Client group' },
          { icon: MapPinned, label: resolvedRegionName, title: 'Region' },
          { icon: Tag, label: `Tier ${account.clientTier}`, title: 'Client tier' },
        ]}
        actions={<>
            <Button variant="outline" size="sm" className="h-8" onClick={openEdit}><Edit3 className="mr-1.5 h-3.5 w-3.5" />Edit</Button>
            {!account.networkMember && <Button size="sm" className="h-8" onClick={() => setNetworkOpen(true)}><PackagePlus className="mr-1.5 h-3.5 w-3.5" />Network onboard</Button>}
            <DropdownMenu>
              <DropdownMenuTrigger asChild><Button variant="outline" size="icon" className="h-8 w-8" aria-label="More actions"><MoreHorizontal className="h-4 w-4" /></Button></DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-52">
                <DropdownMenuItem onSelect={() => void load()}><RefreshCw />Refresh data</DropdownMenuItem>
                <DropdownMenuItem onSelect={openMonthlySales}><TrendingUp />Update declared MT</DropdownMenuItem>
                <DropdownMenuItem onSelect={openVisitForm}><CalendarPlus />Plan visit</DropdownMenuItem>
                {canDeactivate && <><DropdownMenuSeparator /><DropdownMenuItem variant="destructive" disabled={!account.active} onSelect={() => setDeleteOpen(true)}><Trash2 />Deactivate account</DropdownMenuItem></>}
              </DropdownMenuContent>
            </DropdownMenu>
        </>}
        kpis={<>
          <KpiCell icon={TrendingUp} label="Sales recorded" value={`${totalSales.toLocaleString('en-IN')} MT`} hint={`Declared ${account.declaredMonthlySalesMt ?? '—'} MT / month`} action={<Button variant="link" size="sm" className="h-auto shrink-0 p-0 text-xs" onClick={openMonthlySales}>Update</Button>} />
          <KpiCell icon={Tag} label="Active brands" value={brands.length} hint={brands.length ? brands.slice(0, 2).map(brandDisplayName).join(', ') : 'None tracked'} />
          <KpiCell icon={ListChecks} label="Open tasks" value={openTaskCount} hint={openTasks[0] ? `Next due ${showDate(openTasks[0].dueDate)}` : 'Nothing pending'} />
          <KpiCell icon={CalendarDays} label="Last visit" value={latestVisit ? showDate(latestVisit.scheduledVisitDate) : 'No visits'} hint={latestVisit ? (latestVisit.assignedEmployeeName || employeeName(latestVisit.assignedEmployeeId)) : 'Plan one from Visits'} />
        </>}
        nextStep={nextStep}
      />

      {warnings.length > 0 && <WarningBanner>The account loaded, but {warnings.join(', ')}. You can retry with Refresh.</WarningBanner>}

      <DetailShell
        defaultValue="overview"
        tabs={[
          {
            value: 'overview',
            label: 'Overview',
            content: (
              <div>
                <div className="grid gap-4 lg:grid-cols-2">
                <Section icon={Activity} title="Activity" className="lg:row-span-2" bodyClassName="p-0" action={<Button size="sm" variant="ghost" className="h-6 px-2 text-xs" onClick={() => void openTask()}><Plus className="mr-1 h-3.5 w-3.5" />Task</Button>}>
                  <ActivityTimeline upcoming={upNext} recent={recentActivity} viewAllHref="#tasks" />
                </Section>
                <Section icon={Users} title="Assigned employees" action={account.secondaryEmployeeId ? <AdminRemovalAction endpoint={`/api/retail/accounts/${accountId}/employees/${account.secondaryEmployeeId}`} label="Remove assignment" name={secondaryName} description="Remove this secondary employee assignment. The employee record and account history will be kept." onRemoved={load} /> : undefined}>
                  <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-2">
                    <Info label="Primary employee" value={ownerName} />
                    <Info label="Secondary employee" value={secondaryName || 'Not assigned'} />
                  </dl>
                </Section>
                <Section icon={MapPin} title="Outlet and network" action={account.storeImageUrl ? <AdminRemovalAction endpoint={`/api/retail/accounts/${accountId}/store-image`} label="Remove store image" name={account.accountName} description="Remove this store image from the customer account." onRemoved={load} /> : undefined}>
                  <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-2">
                    <Info className="sm:col-span-2" label="Address" value={[account.addressVillageArea, account.addressTaluka, account.addressCity, account.addressDistrict, account.addressState, account.pinCode].filter(Boolean).join(', ')} />
                    <Info
                      className="sm:col-span-2"
                      label="GPS"
                      value={account.outletLatitude != null && account.outletLongitude != null ? (
                        <a href={`https://www.google.com/maps?q=${account.outletLatitude},${account.outletLongitude}`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 hover:underline">
                          {account.outletLatitude}, {account.outletLongitude}<ExternalLink className="h-3.5 w-3.5 text-muted-foreground" />
                        </a>
                      ) : null}
                    />
                    <Info label="German Network" value={<Pill tone={germanNetworkOn ? 'success' : 'warning'}>{germanNetworkOn ? 'On' : 'Off'}</Pill>} />
                    <Info label="Onboarding date" value={account.networkOnboardingDate ? showDate(account.networkOnboardingDate) : '—'} />
                    <Info label="Record state" value={account.active ? <Pill tone="success">Active</Pill> : <Pill tone="danger">Inactive</Pill>} />
                  </dl>
                </Section>
                <Section icon={Wallet} title="Commercial">
                  <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-2">
                    <Info label="Client type" value={formatClientTypeLabel(account.clientType)} />
                    <Info label="GSTIN" value={account.gstNumber ? <span className="font-mono" data-preserve-case="true">{account.gstNumber}</span> : null} />
                    <Info label="Declared monthly sales" value={<span className="inline-flex items-center gap-2">{account.declaredMonthlySalesMt ?? '—'} MT<Button variant="link" size="sm" className="h-auto p-0 text-xs" onClick={openMonthlySales}>Update</Button></span>} />
                    <Info label="Client tier" value={`Tier ${account.clientTier}`} />
                    <Info label="Credit terms" value={`${account.creditTermsDays ?? '—'} days`} />
                    <Info label="Credit limit" value={money(account.creditLimitAmount)} />
                  </dl>
                </Section>
                </div>
              </div>
            ),
          },
          {
            value: 'relationship',
            label: 'Relationship',
            count: brands.length + brandHistory.length + commercialHistory.length,
            content: (
              <div className="space-y-4">
                <Section
                  icon={Tag}
                  title={`Active brands · ${brands.length}`}
                  action={<Button size="sm" variant={brandFormOpen ? 'ghost' : 'outline'} className="h-7 px-2 text-xs" onClick={() => setBrandFormOpen((open) => !open)}>{brandFormOpen ? <><X className="mr-1 h-3.5 w-3.5" />Close</> : <><Plus className="mr-1 h-3.5 w-3.5" />Add brand</>}</Button>}
                  bodyClassName="p-0"
                >
                  {brandFormOpen && (
                    <div className="grid gap-2 border-b bg-muted/30 px-4 py-2.5 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto]">
                      <Select value={brandSelect} onValueChange={setBrandSelect}><SelectTrigger className="h-8 bg-background text-xs"><SelectValue placeholder="Choose brand" /></SelectTrigger><SelectContent>{competitorBrands.map((b) => <SelectItem key={b.id} value={String(b.id)}>{b.name}</SelectItem>)}</SelectContent></Select>
                      <Input value={brandRemarks} onChange={(e) => setBrandRemarks(e.target.value)} placeholder="Remarks (optional)" className="h-8 bg-background text-xs" />
                      <Button size="sm" className="h-8" onClick={() => void addBrand()} disabled={busy || !brandSelect}>Add</Button>
                    </div>
                  )}
                  {brands.length === 0 ? <EmptyState compact title="No active brands tracked yet." /> : (
                    <div className="flex flex-wrap gap-2 px-4 py-3">
                      {brands.map((brand) => (
                        <span key={brand.id} className="inline-flex max-w-full items-center gap-1.5 rounded-full border bg-background py-1 pl-3 pr-1 text-xs" title={`${brand.remarks || 'No remarks'} · Added ${showDate(brand.addedAt)} by ${brandAddedBy(brand)}`}>
                          <span className="truncate font-medium">{brandDisplayName(brand)}</span>
                          {brand.remarks && <span className="hidden max-w-[180px] truncate text-muted-foreground sm:inline">· {brand.remarks}</span>}
                          <AdminRemovalAction endpoint={adminRemovalPaths.retailBrand(brand.id)} label="Remove brand" name={brandDisplayName(brand)} description="Remove this brand from this customer account’s active brands. This affects the whole account, even if the brand was added during a visit." disabled={busy} onRemoved={async () => { await loadBrandsSection(); await loadCommercialSection(); }} />
                        </span>
                      ))}
                    </div>
                  )}
                </Section>
                <div className="grid items-start gap-4 xl:grid-cols-2">
                  <Section icon={History} title={`Brand history · ${brandHistory.length}`} bodyClassName="p-0">
                    {brandHistory.length === 0 ? <EmptyState compact title="No brands added or removed yet." /> : (
                      <ul className="max-h-80 divide-y overflow-y-auto">
                        {brandHistory.map((brand) => (
                          <li key={brand.id} className="flex items-center gap-3 px-4 py-2">
                            <span className={cn('h-2 w-2 shrink-0 rounded-full', brand.active ? 'bg-emerald-500' : 'bg-muted-foreground/40')} />
                            <div className="min-w-0 flex-1 leading-tight">
                              <p className="truncate text-sm font-medium">{brandDisplayName(brand)}</p>
                              <p className="truncate text-[11px] text-muted-foreground">{showDate(brand.addedAt)}{brand.removedAt ? ` → ${showDate(brand.removedAt)}` : ''} · {brandAddedBy(brand)}</p>
                            </div>
                            <Pill tone={brand.active ? 'success' : 'neutral'}>{brand.active ? 'Active' : 'Removed'}</Pill>
                          </li>
                        ))}
                      </ul>
                    )}
                  </Section>
                  <Section icon={ArrowRightLeft} title={`Commercial changes · ${commercialHistory.length}`} bodyClassName="p-0">
                    {commercialHistory.length === 0 ? <EmptyState compact title="No commercial changes recorded yet." /> : (
                      <ul className="max-h-80 divide-y overflow-y-auto">
                        {commercialHistory.map((entry) => (
                          <li key={entry.id} className="px-4 py-2 leading-tight">
                            <div className="flex min-w-0 items-center gap-2 text-xs">
                              <span className="shrink-0 text-sm font-medium">{humanize(entry.fieldName)}</span>
                              <span className="truncate text-muted-foreground line-through">{entry.oldValue || '—'}</span>
                              <ArrowRight className="h-3 w-3 shrink-0 text-muted-foreground" />
                              <span className="truncate font-semibold">{entry.newValue || '—'}</span>
                              <span className="ml-auto shrink-0 pl-2 text-[11px] text-muted-foreground">{showDate(entry.changedAt)}</span>
                            </div>
                            <p className="mt-0.5 truncate text-[11px] text-muted-foreground" title={entry.changeReason}>{entry.changeReason || 'No reason recorded'} · {entry.changedBy || 'System'}</p>
                          </li>
                        ))}
                      </ul>
                    )}
                  </Section>
                </div>
              </div>
            ),
          },
          {
            value: 'contacts',
            label: 'Contacts',
            count: resolvedContacts.length,
            content: (
              <Section description={`${resolvedContacts.length} ${resolvedContacts.length === 1 ? 'person' : 'people'} linked`} bodyClassName="p-0" action={<Button size="sm" className="h-7 px-2.5 text-xs" onClick={() => openContact()}><UserPlus className="mr-1.5 h-3.5 w-3.5" />Add contact</Button>}>
                {resolvedContacts.length === 0 ? <EmptyState compact title="No contacts linked yet. Add the owner or purchase manager." /> : (
                  <div>
                    <div className="hidden grid-cols-[minmax(0,1.4fr)_120px_minmax(0,1fr)_64px] gap-x-4 border-b bg-muted/40 px-4 py-2 text-[11px] font-medium text-muted-foreground md:grid">
                      <span>Name</span><span>Mobile</span><span>Email</span><span />
                    </div>
                    <ul className="divide-y">
                      {resolvedContacts.map((contact) => {
                        const name = [contact.firstName, contact.lastName].filter(Boolean).join(' ') || `Contact #${contact.id}`;
                        const role = [contact.designation, contact.roleDescription].filter(Boolean).join(' · ') || 'No designation';
                        return (
                          <li key={contact.id} className={cn('grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 px-4 py-2 transition-colors hover:bg-muted/30 md:grid-cols-[minmax(0,1.4fr)_120px_minmax(0,1fr)_64px] md:gap-x-4', !contact.active && 'opacity-70')}>
                            <div className="flex min-w-0 items-center gap-2.5">
                              <Initials name={name} className="h-7 w-7 text-[10px]" />
                              <div className="min-w-0 leading-tight">
                                <div className="flex min-w-0 items-center gap-1.5"><p className="truncate text-sm font-medium">{name}</p>{contact.primaryContact && <Pill tone="info">Primary</Pill>}{!contact.active && <Pill tone="danger">Inactive</Pill>}</div>
                                <p className="truncate text-[11px] text-muted-foreground" title={role}>
                                  {role}
                                  <span className="md:hidden">{contact.mobile ? <> · <a href={`tel:${contact.mobile}`} className="text-foreground hover:underline">{contact.mobile}</a></> : ''}</span>
                                </p>
                              </div>
                            </div>
                            <span className="hidden text-xs tabular-nums md:block">{contact.mobile ? <a href={`tel:${contact.mobile}`} className="inline-flex items-center gap-1.5 hover:underline"><Phone className="h-3 w-3 text-muted-foreground" />{contact.mobile}</a> : <span className="text-muted-foreground">—</span>}</span>
                            <span className="hidden min-w-0 text-xs md:block">{contact.email ? <a href={`mailto:${contact.email}`} className="flex min-w-0 items-center gap-1.5 hover:underline" title={contact.email}><Mail className="h-3 w-3 shrink-0 text-muted-foreground" /><span className="truncate">{contact.email}</span></a> : <span className="text-muted-foreground">—</span>}</span>
                            <div className="flex items-center justify-end gap-0.5">
                              <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-foreground" onClick={() => openContact(contact)} aria-label={`Edit ${name}`} title="Edit contact"><Edit3 className="h-3.5 w-3.5" /></Button>
                              {canDeactivate && <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-destructive" onClick={() => void removeContact(contact)} disabled={busy} aria-label={`Remove ${name}`} title="Remove contact"><Trash2 className="h-3.5 w-3.5" /></Button>}
                            </div>
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                )}
              </Section>
            ),
          },
          {
            value: 'visits',
            label: 'Visits',
            count: visits.length,
            content: (
              <Section description={`${visits.length} ${visits.length === 1 ? 'visit' : 'visits'} · newest first`} bodyClassName="p-0" action={<Button size="sm" className="h-7 px-2.5 text-xs" onClick={openVisitForm}><CalendarPlus className="mr-1.5 h-3.5 w-3.5" />Plan visit</Button>}>
                {visits.length === 0 ? <EmptyState compact title="No visits yet. Plan the first visit to this outlet." /> : <VisitList visits={visits} assignee={(visit) => visit.assignedEmployeeName || employeeName(visit.assignedEmployeeId)} onOpen={(visit) => router.push(`/dashboard/visits/${visit.id}`)} />}
              </Section>
            ),
          },
          {
            value: 'sales',
            label: 'Sales',
            count: sales.length,
            content: (
              <Section
                description={salesSummary(sales)}
                bodyClassName="p-0"
                action={<Button size="sm" className="h-7 px-2.5 text-xs" onClick={() => openSale()}><PackagePlus className="mr-1.5 h-3.5 w-3.5" />Record sale</Button>}
              >
                {sales.length === 0 ? <EmptyState compact title="Record the first sale to track won and lost opportunities." /> : <SalesTable sales={sales} showOutcome voidEndpoint={(id) => `/api/retail/sales/${id}/void`} onVoided={loadSalesSection} onEdit={(sale) => openSale(sales.find((item) => item.id === sale.id))} />}
              </Section>
            ),
          },
          {
            value: 'tasks',
            label: 'Complaints & requirements',
            count: tasks.length,
            content: (
              <Section description={taskSummary(tasks)} bodyClassName="p-0" action={<Button size="sm" className="h-7 px-2.5 text-xs" onClick={() => void openTask()}><Plus className="mr-1.5 h-3.5 w-3.5" />Add task</Button>}>
                {tasks.length === 0 ? <EmptyState compact title="No complaints or requirements yet. They also appear on the Complaints and Requirements pages." /> : <TaskList tasks={tasks} assignee={(task) => task.assignedEmployeeName || employeeName(task.assignedEmployeeId)} onEdit={(task) => void openTask(task)} onDelete={(task) => void removeTask(task)} busy={busy} />}
              </Section>
            ),
          },
          {
            value: 'notes',
            label: 'Notes',
            count: notes.length,
            content: (
              <NotesFeed
                onRemoved={loadNotesSection}
                notes={sortedNotes.map((note) => ({ id: note.id, text: note.noteText, author: note.authorName || employeeName(note.authorEmployeeId) || 'System', date: note.updatedAt || note.createdAt, edited: Boolean(note.updatedAt && note.updatedAt !== note.createdAt) }))}
                onAdd={async (text) => { if (!token) return false; try { await RetailAPI.createNote(accountId, text, token); toast.success('Note added.'); await loadNotesSection(); return true; } catch (error) { toast.error(getErrorMessage(error, 'Unable to save note.')); return false; } }}
                onEdit={(id) => { const note = notes.find((item) => item.id === id); if (note) openNote(note); }} placeholder="Write a note for the team… e.g. what was discussed on the call"
              />
            ),
          },
        ]}
      />


      <FormSheet
        open={editOpen}
        onOpenChange={(open) => !busy && setEditOpen(open)}
        icon={Building2}
        title="Edit retail account"
        description={account.accountName}
        wide
        errors={editErrors}
        footerNote="Network membership changes only via Network onboard."
        onSubmit={() => void saveAccount()}
        submitLabel="Save changes"
        submitting={busy}
      >
        {editDraft && <>
          <FormGroup title="Account">
            <FormField label="Account name" required className="sm:col-span-2"><Input value={editDraft.accountName} onChange={(event) => updateEditDraft({ ...editDraft, accountName: event.target.value })} /></FormField>
            <FormField label="GSTIN" required><Input className="font-mono uppercase" value={editDraft.gstNumber} onChange={(event) => updateEditDraft({ ...editDraft, gstNumber: event.target.value.toUpperCase().slice(0, 15) })} /></FormField>
            <FormField label="Client type"><Select value={editDraft.clientType} onValueChange={(value) => updateEditDraft({ ...editDraft, clientType: value as RetailAccountDraft['clientType'] })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="DEALER">Dealer</SelectItem><SelectItem value="DISTRIBUTOR">Distributor</SelectItem></SelectContent></Select></FormField>
            <FormField label="Account status"><Select value={editDraft.accountStatus} onValueChange={(value) => updateEditDraft({ ...editDraft, accountStatus: value as RetailAccountDraft['accountStatus'] })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="PROSPECT">Prospect</SelectItem><SelectItem value="ACTIVE">Active</SelectItem><SelectItem value="DORMANT">Dormant</SelectItem><SelectItem value="LOST">Lost</SelectItem></SelectContent></Select></FormField>
            <FormField label="Primary employee"><SearchableSelect modal triggerId="retail-edit-primary-employee" options={[...employeeOptions].sort((a, b) => a.label.localeCompare(b.label))} value={editDraft.ownerEmployeeId || undefined} onSelect={option => { const value = option?.value || ''; updateEditDraft({ ...editDraft, ownerEmployeeId: value, secondaryEmployeeId: value === editDraft.secondaryEmployeeId ? '' : editDraft.secondaryEmployeeId }); }} placeholder="Choose employee" searchPlaceholder="Search employees..." triggerClassName="h-9 w-full text-xs" /></FormField>
            <FormField label="Secondary employee" hint="Optional. Must differ from the primary employee."><SearchableSelect modal triggerId="retail-edit-secondary-employee" options={[{ value: NO_SECONDARY, label: 'None' }, ...employeeOptions.filter(option => option.value !== editDraft.ownerEmployeeId).sort((a, b) => a.label.localeCompare(b.label))]} value={editDraft.secondaryEmployeeId || NO_SECONDARY} onSelect={option => updateEditDraft({ ...editDraft, secondaryEmployeeId: !option || option.value === NO_SECONDARY ? '' : option.value })} placeholder="None" searchPlaceholder="Search employees..." triggerClassName="h-9 w-full text-xs" /></FormField>
            <FormField label="Client group" required className="sm:col-span-2"><Select value={editDraft.clientGroupId} onValueChange={(value) => updateEditDraft({ ...editDraft, clientGroupId: value })}><SelectTrigger><SelectValue placeholder="Choose group" /></SelectTrigger><SelectContent>{groups.filter((g) => g.active !== false).map((g) => <SelectItem key={g.id} value={String(g.id)}>{g.groupName}</SelectItem>)}</SelectContent></Select></FormField>
          </FormGroup>
          <FormGroup title="Outlet address">
            <FormField label="Village / area" required><Input value={editDraft.addressVillageArea} onChange={(event) => updateEditDraft({ ...editDraft, addressVillageArea: event.target.value })} /></FormField>
            <FormField label="Taluka" required><Input value={editDraft.addressTaluka} onChange={(event) => updateEditDraft({ ...editDraft, addressTaluka: event.target.value })} /></FormField>
            <FormField label="City" required><Input value={editDraft.addressCity} onChange={(event) => updateEditDraft({ ...editDraft, addressCity: event.target.value })} /></FormField>
            <FormField label="District" required><Input value={editDraft.addressDistrict} onChange={(event) => updateEditDraft({ ...editDraft, addressDistrict: event.target.value })} /></FormField>
            <FormField label="State" required><Input value={editDraft.addressState} onChange={(event) => updateEditDraft({ ...editDraft, addressState: event.target.value })} /></FormField>
            <FormField label="PIN code" required><Input inputMode="numeric" value={editDraft.pinCode} onChange={(event) => updateEditDraft({ ...editDraft, pinCode: event.target.value.replace(/\D/g, '').slice(0, 6) })} /></FormField>
            <FormField label="Region" hint="Automatically derived from the PIN-code master." className="sm:col-span-2"><Select value={editDraft.regionId} disabled><SelectTrigger><SelectValue placeholder="Derived from PIN" /></SelectTrigger><SelectContent>{regions.filter((r) => r.active !== false).map((r) => <SelectItem key={r.id} value={String(r.id)}>{r.name}</SelectItem>)}</SelectContent></Select></FormField>
            <FormField label="Latitude" required><Input type="number" value={editDraft.outletLatitude} onChange={(event) => updateEditDraft({ ...editDraft, outletLatitude: event.target.value })} /></FormField>
            <FormField label="Longitude" required><Input type="number" value={editDraft.outletLongitude} onChange={(event) => updateEditDraft({ ...editDraft, outletLongitude: event.target.value })} /></FormField>
          </FormGroup>
          <FormGroup title="Commercial">
            <FormField label="Declared monthly sales (MT)"><Input type="number" min="0" value={editDraft.declaredMonthlySalesMt} onChange={(event) => updateEditDraft({ ...editDraft, declaredMonthlySalesMt: event.target.value })} /></FormField>
            <FormField label="Focus sector"><Select value={editDraft.focusSector} onValueChange={(value) => updateEditDraft({ ...editDraft, focusSector: value as RetailAccountDraft['focusSector'] })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="RETAIL">Retail</SelectItem><SelectItem value="GOVERNMENT_PROJECTS">Government projects</SelectItem><SelectItem value="DEVELOPER_PROJECTS">Developer projects</SelectItem><SelectItem value="ALL_SECTORS">All sectors</SelectItem></SelectContent></Select></FormField>
            <FormField label="Client tier"><Select value={editDraft.clientTier} onValueChange={(value) => updateEditDraft({ ...editDraft, clientTier: value as RetailAccountDraft['clientTier'] })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="A">Tier A</SelectItem><SelectItem value="B">Tier B</SelectItem><SelectItem value="C">Tier C</SelectItem></SelectContent></Select></FormField>
            <FormField label="Credit terms (days)" required><Input type="number" min="0" value={editDraft.creditTermsDays} onChange={(event) => updateEditDraft({ ...editDraft, creditTermsDays: event.target.value })} /></FormField>
            <FormField label="Credit limit (₹)" required className="sm:col-span-2"><Input type="number" min="0" value={editDraft.creditLimitAmount} onChange={(event) => updateEditDraft({ ...editDraft, creditLimitAmount: event.target.value })} /></FormField>
          </FormGroup>
        </>}
      </FormSheet>

      <FormSheet
        open={contactOpen}
        onOpenChange={(open) => !busy && setContactOpen(open)}
        icon={UserPlus}
        title={editingContact ? 'Edit contact' : 'Add contact'}
        description={editingContact ? 'Birthday and anniversary update the shared contact wherever this person is linked. Name and phone are read-only here.' : `Link a person to ${account.accountName}.`}
        onSubmit={() => void saveContact()}
        submitLabel={editingContact ? 'Save changes' : 'Add contact'}
        submitting={busy}
      >
        <FormGroup title="Person">
          <FormField label="First name" required><Input disabled={Boolean(editingContact)} value={contactForm.firstName} onChange={(event) => setContactForm({ ...contactForm, firstName: event.target.value })} /></FormField>
          <FormField label="Last name" required><Input disabled={Boolean(editingContact)} value={contactForm.lastName} onChange={(event) => setContactForm({ ...contactForm, lastName: event.target.value })} /></FormField>
          <FormField label="Mobile" required hint={editingContact ? undefined : '10-digit number'}><Input disabled={Boolean(editingContact)} inputMode="numeric" value={contactForm.mobile} onChange={(event) => setContactForm({ ...contactForm, mobile: event.target.value.replace(/\D/g, '').slice(0, 10) })} /></FormField>
          <FormField label="Email"><Input disabled={Boolean(editingContact)} type="email" value={contactForm.email} onChange={(event) => setContactForm({ ...contactForm, email: event.target.value })} /></FormField>
          <FormField label="Birthday (date of birth)" hint="Optional. Today or an earlier date.">
            <Input aria-label="Birthday (date of birth)" type="date" max={localDateInputValue()} value={contactForm.dateOfBirth} aria-invalid={Boolean(contactDateOfBirthError)} aria-describedby={contactDateOfBirthError ? 'contact-birth-error' : undefined} onChange={(event) => setContactForm({ ...contactForm, dateOfBirth: event.target.value })} />
            {contactDateOfBirthError && <p id="contact-birth-error" role="alert" className="text-xs text-destructive">{contactDateOfBirthError}</p>}
          </FormField>
          <FormField label="Anniversary" hint="Optional."><Input aria-label="Anniversary" type="date" value={contactForm.anniversaryDate} onChange={(event) => setContactForm({ ...contactForm, anniversaryDate: event.target.value })} /></FormField>
        </FormGroup>
        <FormGroup title="Role at this account">
          <FormField label="Designation" required><Input placeholder="e.g. Owner" value={contactForm.designation} onChange={(event) => setContactForm({ ...contactForm, designation: event.target.value })} /></FormField>
          <FormField label="Role description"><Input placeholder="e.g. Approves purchases" value={contactForm.roleDescription} onChange={(event) => setContactForm({ ...contactForm, roleDescription: event.target.value })} /></FormField>
          <FormCheck className="sm:col-span-2" checked={contactForm.primaryContact} onCheckedChange={(checked) => setContactForm({ ...contactForm, primaryContact: checked })} label="Primary contact" description="The main person the team reaches out to." />
          {editingContact && <FormCheck className="sm:col-span-2" checked={contactForm.active} onCheckedChange={(checked) => setContactForm({ ...contactForm, active: checked })} label="Active link" description="Uncheck when this person no longer works with the account." />}
        </FormGroup>
      </FormSheet>

      <FormSheet
        open={noteOpen}
        onOpenChange={(open) => !busy && setNoteOpen(open)}
        icon={NotebookPen}
        title={editingNote ? 'Edit note' : 'Add note'}
        description="Visible to everyone who works on this account."
        onSubmit={() => void saveNote()}
        submitLabel="Save note"
        submitting={busy}
        submitDisabled={!noteText.trim()}
      >
        <FormField label="Note" required><Textarea rows={8} value={noteText} onChange={(event) => setNoteText(event.target.value)} placeholder="What was discussed, agreed, or needs follow-up…" /></FormField>
      </FormSheet>

      <FormSheet
        open={visitOpen}
        onOpenChange={(open) => !busy && setVisitOpen(open)}
        icon={CalendarPlus}
        title="Plan visit"
        description={`Dealer visit to ${account.accountName}. Outlet GPS is used as the visit location.`}
        onSubmit={() => void saveVisit()}
        submitLabel="Plan visit"
        submitting={busy}
      >
        <FormGroup title="When and who">
          <FormField label="Assigned employee" required className="sm:col-span-2"><SearchableSelect options={employeeOptions} value={visitForm.employeeId || undefined} onSelect={(option) => setVisitForm({ ...visitForm, employeeId: option?.value || '' })} placeholder="Choose employee" searchPlaceholder="Search employees..." triggerClassName="h-9 w-full overflow-hidden text-xs" /></FormField>
          <FormField label="Visit date" required className="sm:col-span-2"><Input type="date" value={visitForm.date} onChange={(event) => setVisitForm({ ...visitForm, date: event.target.value })} /></FormField>
          <FormField label="Start time"><Input type="time" value={visitForm.startTime} onChange={(event) => setVisitForm({ ...visitForm, startTime: event.target.value })} /></FormField>
          <FormField label="End time"><Input type="time" value={visitForm.endTime} onChange={(event) => setVisitForm({ ...visitForm, endTime: event.target.value })} /></FormField>
        </FormGroup>
        <FormGroup title="Purpose" columns={1}>
          <FormField label="Purpose" required><Select value={VISIT_PURPOSES.some(o=>o.value===visitForm.purpose || o.label===visitForm.purpose) ? (VISIT_PURPOSES.find(o=>o.value===visitForm.purpose || o.label===visitForm.purpose)?.value || 'ROUTINE_VISIT') : visitForm.purpose} onValueChange={(v) => setVisitForm({ ...visitForm, purpose: v === 'OTHER' ? visitForm.purpose : VISIT_PURPOSES.find(o=>o.value===v)?.label || v })}><SelectTrigger><SelectValue placeholder="Select purpose" /></SelectTrigger><SelectContent>{VISIT_PURPOSES.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent></Select></FormField>
          <FormField label="Instructions" hint="Optional instructions for the assigned employee."><Textarea rows={3} value={visitForm.description} onChange={(event) => setVisitForm({ ...visitForm, description: event.target.value })} placeholder="e.g. Collect the cheque and photograph the display" /></FormField>
          <FormCheck checked={visitForm.selfGenerated} onCheckedChange={(checked) => setVisitForm({ ...visitForm, selfGenerated: checked })} label="Self-generated visit" description="Planned by the field employee rather than assigned by a manager." />
        </FormGroup>
      </FormSheet>

      <FormSheet
        open={saleOpen}
        onOpenChange={(open) => !busy && setSaleOpen(open)}
        icon={PackagePlus}
        title={editingSale ? 'Edit sale' : 'Record sale'}
        description={`Record a won or lost sale for ${account.accountName}.`}
        onSubmit={() => void saveSale()}
        submitLabel={editingSale ? 'Save changes' : 'Record sale'}
        submitting={busy}
      >
        <FormGroup>
          <FormField label="Outcome" required className="sm:col-span-2"><div className="flex gap-2"><Button type="button" variant={saleForm.outcomeStatus === 'WIN' ? 'default' : 'outline'} aria-pressed={saleForm.outcomeStatus === 'WIN'} onClick={() => setSaleForm({ ...saleForm, outcomeStatus: 'WIN' })}>Won</Button><Button type="button" variant={saleForm.outcomeStatus === 'LOST' ? 'destructive' : 'outline'} aria-pressed={saleForm.outcomeStatus === 'LOST'} onClick={() => setSaleForm({ ...saleForm, outcomeStatus: 'LOST' })}>Lost</Button></div></FormField>
          <FormField label="Sale date" required hint="Can’t be in the future."><Input type="date" max={today()} value={saleForm.saleDate} onChange={(event) => setSaleForm({ ...saleForm, saleDate: event.target.value })} /></FormField>
          <FormField label="Quantity (MT)" required><Input type="number" min="0.01" step="0.01" value={saleForm.quantityMt} onChange={(event) => setSaleForm({ ...saleForm, quantityMt: event.target.value })} /></FormField>
          {saleForm.outcomeStatus === 'WIN' && <><FormField label="PO date" required><Input type="date" max={today()} value={saleForm.poDate} onChange={(event) => setSaleForm({ ...saleForm, poDate: event.target.value })} /></FormField><FormField label="PO number" required><Input placeholder="PO-2026-101" value={saleForm.poNumber} onChange={(event) => setSaleForm({ ...saleForm, poNumber: event.target.value })} /></FormField></>}
          {saleForm.outcomeStatus === 'LOST' && <FormField label="Lost reason" required className="sm:col-span-2"><Textarea placeholder="Why was this sale lost?" value={saleForm.lossReason} onChange={(event) => setSaleForm({ ...saleForm, lossReason: event.target.value })} /></FormField>}
          {saleForm.outcomeStatus && <FormField label="Invoice or reference" hint="Optional." className="sm:col-span-2"><Input placeholder="INV-1001" value={saleForm.invoiceReference} onChange={(event) => setSaleForm({ ...saleForm, invoiceReference: event.target.value })} /></FormField>}
        </FormGroup>
      </FormSheet>

      <FormSheet
        open={taskOpen}
        onOpenChange={(open) => !busy && setTaskOpen(open)}
        icon={ListChecks}
        title={editingTask ? 'Edit item' : 'New complaint or requirement'}
        description={editingTask ? editingTask.title : `Follow-up for ${account.accountName}.`}
        onSubmit={() => void saveTask()}
        submitLabel={editingTask ? 'Save changes' : 'Create'}
        submitting={busy}
      >
        <FormGroup>
          <FormField label="Type" required className="sm:col-span-2"><Select value={editingTask ? String((editingTask as { taskType?: string }).taskType || taskKind).toUpperCase() : taskKind} onValueChange={(v) => setTaskKind(v as 'COMPLAINT' | 'REQUIREMENT')} disabled={Boolean(editingTask)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="COMPLAINT">Complaint</SelectItem><SelectItem value="REQUIREMENT">Requirement</SelectItem>{editingTask && <SelectItem value="FOLLOW_UP">Follow-up</SelectItem>}</SelectContent></Select></FormField>
          <FormField label="Title" required className="sm:col-span-2"><Input placeholder="e.g. Share revised price list" value={taskForm.title} onChange={(event) => setTaskForm({ ...taskForm, title: event.target.value })} /></FormField>
          <FormField label="Assignee" required><Select value={taskForm.employeeId} onValueChange={(value) => setTaskForm({ ...taskForm, employeeId: value })}><SelectTrigger><SelectValue placeholder="Choose employee" /></SelectTrigger><SelectContent>{employees.map((employee) => <SelectItem key={employee.id} value={String(employee.id)}>{[employee.firstName, employee.lastName].filter(Boolean).join(' ') || `Employee #${employee.id}`}</SelectItem>)}</SelectContent></Select></FormField>
          <FormField label="Due date" required><Input type="date" value={taskForm.dueDate} onChange={(event) => setTaskForm({ ...taskForm, dueDate: event.target.value })} /></FormField>
          <FormField label="Priority"><Select value={taskForm.priority} onValueChange={(value) => setTaskForm({ ...taskForm, priority: value as RetailTask['priority'] })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="LOW">Low</SelectItem><SelectItem value="MEDIUM">Medium</SelectItem><SelectItem value="HIGH">High</SelectItem><SelectItem value="URGENT">Urgent</SelectItem></SelectContent></Select></FormField>
          {editingTask && <FormField label="Status"><Select value={taskForm.status} onValueChange={(value) => setTaskForm({ ...taskForm, status: value as RetailTask['status'] })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="OPEN">Open</SelectItem><SelectItem value="IN_PROGRESS">In progress</SelectItem><SelectItem value="COMPLETED">Completed</SelectItem><SelectItem value="CANCELLED">Cancelled</SelectItem></SelectContent></Select></FormField>}
          <FormField label="Description" className="sm:col-span-2"><Textarea rows={4} value={taskForm.description} onChange={(event) => setTaskForm({ ...taskForm, description: event.target.value })} placeholder="Optional details" /></FormField>
        </FormGroup>
      </FormSheet>

      <FormSheet
        open={monthlySalesOpen}
        onOpenChange={(open) => !busy && setMonthlySalesOpen(open)}
        icon={TrendingUp}
        title="Update declared monthly sales"
        description={`Currently ${account.declaredMonthlySalesMt ?? '—'} MT / month.`}
        footerNote="The reason is saved to the commercial change history."
        onSubmit={() => void saveMonthlySales()}
        submitLabel="Update"
        submitting={busy}
      >
        <FormGroup columns={1}>
          <FormField label="Declared monthly sales (MT)" required><Input type="number" min="0" step="0.01" value={monthlySalesForm.declaredMonthlySalesMt} onChange={(event) => setMonthlySalesForm({ ...monthlySalesForm, declaredMonthlySalesMt: event.target.value })} /></FormField>
          <FormField label="Change reason" required><Textarea rows={4} value={monthlySalesForm.changeReason} onChange={(event) => setMonthlySalesForm({ ...monthlySalesForm, changeReason: event.target.value })} placeholder="e.g. Updated after monthly review with client" /></FormField>
        </FormGroup>
      </FormSheet>

      <Dialog open={deleteOpen} onOpenChange={(open) => !busy && setDeleteOpen(open)}><DialogContent><DialogHeader><DialogTitle>Deactivate this customer?</DialogTitle><DialogDescription>The new DELETE endpoint performs a soft delete, preserving account history.</DialogDescription></DialogHeader><div className="rounded-lg border bg-muted/40 p-3 font-medium">{account.accountName}</div><DialogFooter><Button variant="outline" onClick={() => setDeleteOpen(false)} disabled={busy}>Cancel</Button><Button variant="destructive" onClick={() => void deactivateAccount()} disabled={busy}>{busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Deactivate</Button></DialogFooter></DialogContent></Dialog>

      <FormSheet
        open={networkOpen}
        onOpenChange={(open) => !busy && setNetworkOpen(open)}
        icon={Handshake}
        title="Network onboarding"
        description={`Add ${account.accountName} to the German Steels dealer network.`}
        footerNote="Confirms the commercial agreement is in place."
        onSubmit={() => void saveNetworkOnboard()}
        submitLabel="Confirm onboarding"
        submitting={busy}
      >
        <FormGroup title="Dates">
          <FormField label="Joining date" required><Input type="date" value={networkForm.joiningDate} onChange={(e) => setNetworkForm({ ...networkForm, joiningDate: e.target.value })} /></FormField>
          <FormField label="First order date" required><Input type="date" value={networkForm.firstOrderDate} onChange={(e) => setNetworkForm({ ...networkForm, firstOrderDate: e.target.value })} /></FormField>
        </FormGroup>
        <FormGroup title="First order" columns={1}>
          <FormField label="First order reference" required><Input value={networkForm.firstOrderReference} onChange={(e) => setNetworkForm({ ...networkForm, firstOrderReference: e.target.value })} placeholder="e.g. Invoice #1001 or SO-2026-001" /></FormField>
          <FormField label="Reason"><Textarea rows={3} value={networkForm.reason} onChange={(e) => setNetworkForm({ ...networkForm, reason: e.target.value })} placeholder="e.g. Commercial terms agreed, first order placed." /></FormField>
        </FormGroup>
      </FormSheet>
    </div>
  );
}
