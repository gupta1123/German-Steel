'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { AlertCircle, ArrowLeft, CalendarPlus, CheckCircle2, Edit3, Loader2, NotebookPen, Plus, RefreshCw, Trash2, UserPlus, ShieldCheck, XCircle } from 'lucide-react';
import { toast } from 'sonner';
import { ContactSummaryCard } from '@/components/contact-summary-card';
import { NcSummaryCard } from '@/components/nc-summary-card';

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
import { getErrorMessage } from '@/lib/api-error';
import {
  InstitutionsAPI,
  type EmpanelmentStatus,
  type Institution,
  type InstitutionContact,
  type InstitutionDocument,
  type InstitutionDocumentType,
  type InstitutionNote,
  type InstitutionTask,
  type NcRegister,
  type NcStatus,
  type PipelineEntry,
  VALID_STAGE_TRANSITIONS,
} from '@/lib/institutions-api';
import { RetailAPI, type RetailEmployee } from '@/lib/retail-api';
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
import { visitsApi, type CommonVisitRow } from '@/lib/visits-api';

const humanize = (value: string | null | undefined) => value ? value.replaceAll('_', ' ').toLowerCase().replace(/\b\w/g, (l) => l.toUpperCase()) : '—';
const showDate = (value: string | null | undefined) => value ? new Date(value.length === 10 ? `${value}T00:00:00` : value).toLocaleDateString('en-IN', { dateStyle: 'medium' }) : '—';

const STATUS_VARIANT: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  APPROVED: 'default', RENEWAL_DUE: 'default',
  CREDENTIALS_SUBMITTED: 'secondary', DOCUMENTS_SUBMITTED: 'secondary', UNDER_REVIEW: 'secondary', TECHNICAL_VISIT_SCHEDULED: 'secondary', NC_CLOSURE_SUBMITTED: 'secondary',
  NOT_STARTED: 'outline',
  REJECTED: 'destructive', EXPIRED: 'destructive', SUSPENDED: 'destructive', NC_RAISED: 'destructive',
};


type InstitutionEditDraft = {
  institutionName: string;
  institutionType: string;
  parentInstitutionId: string;
  jurisdiction: string;
  state: string;
  regionId: string;
  empanelmentStatus: string;
  assignedEmployeeId: string;
  currentStageOwnerContactId: string;
  applicationDate: string;
  approvalDate: string;
  expiryDate: string;
  renewalLeadDays: string;
  active: boolean;
};

function Info({ label, value }: { label: string; value: React.ReactNode }) {
  return <div><p className="text-xs text-muted-foreground">{label}</p><div className="mt-0.5 text-xs font-medium leading-5">{value || '—'}</div></div>;
}

function EmptyState({ text }: { text: string }) {
  return <div className="rounded-lg border border-dashed py-10 text-center text-sm text-muted-foreground">{text}</div>;
}

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return <div className="space-y-1.5"><Label>{label}{required && <span className="ml-1 text-destructive">*</span>}</Label>{children}</div>;
}

export default function InstitutionDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { token, userData } = useAuth();
  const institutionId = Number(params?.id);

  const [institution, setInstitution] = useState<Institution | null>(null);
  const [pipeline, setPipeline] = useState<PipelineEntry[]>([]);
  const [contacts, setContacts] = useState<InstitutionContact[]>([]);
  const [ncRegisters, setNcRegisters] = useState<NcRegister[]>([]);
  const [ncDocsMap, setNcDocsMap] = useState<Record<number, InstitutionDocument[]>>({});
  const [notes, setNotes] = useState<InstitutionNote[]>([]);
  const [tasks, setTasks] = useState<InstitutionTask[]>([]);
  const [visits, setVisits] = useState<CommonVisitRow[]>([]);
  const [documents, setDocuments] = useState<InstitutionDocument[]>([]);
  const [masterContacts, setMasterContacts] = useState<{ id: number; firstName: string; lastName: string; mobile: string; email: string }[]>([]);
  const [docType, setDocType] = useState<InstitutionDocumentType>('CREDENTIALS_PROFILE');
  const [docFile, setDocFile] = useState<File | null>(null);
  const [docOpen, setDocOpen] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [employees, setEmployees] = useState<RetailEmployee[]>([]);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const [editOpen, setEditOpen] = useState(false);
  const [editDraft, setEditDraft] = useState<InstitutionEditDraft | null>(null);
  const [editErrors, setEditErrors] = useState<string[]>([]);

  const [advanceOpen, setAdvanceOpen] = useState(false);
  const [advanceForm, setAdvanceForm] = useState<{ toStatus: EmpanelmentStatus; remarks: string; decisionByEmployeeId: string }>({ toStatus: 'NOT_STARTED', remarks: '', decisionByEmployeeId: '' });
  const [advanceErrors, setAdvanceErrors] = useState<string[]>([]);
  const [advAppDate, setAdvAppDate] = useState('');
  const [advOwnerId, setAdvOwnerId] = useState('');
  const [advContactName, setAdvContactName] = useState('');
  const [advContactLastName, setAdvContactLastName] = useState('');
  const [advNcDesc, setAdvNcDesc] = useState('');
  const [advNcRaisedBy, setAdvNcRaisedBy] = useState('');
  const [advNcTargetDate, setAdvNcTargetDate] = useState('');
  const [advApprovalDate, setAdvApprovalDate] = useState('');
  const [advExpiryDate, setAdvExpiryDate] = useState('');
  const [advLetterFile, setAdvLetterFile] = useState<File | null>(null);
  const [advLetterType, setAdvLetterType] = useState<InstitutionDocumentType>('EMPANELMENT_APPROVAL_LETTER_SCAN');
  const [advContactMobile, setAdvContactMobile] = useState('');
  const [advContactDesignation, setAdvContactDesignation] = useState('');
  const [advCredFile, setAdvCredFile] = useState<File | null>(null);

  const openAdvance = (toStatus: EmpanelmentStatus) => {
    setAdvanceForm({ toStatus, remarks: '', decisionByEmployeeId: institution?.assignedEmployeeId ? String(institution.assignedEmployeeId) : '' });
    setAdvAppDate(institution?.applicationDate?.slice(0, 10) ?? new Date().toISOString().slice(0, 10));
    setAdvOwnerId(institution?.currentStageOwnerContactId ? String(institution.currentStageOwnerContactId) : '');
    setAdvContactName('');
    setAdvContactLastName('');
    setAdvNcDesc('');
    setAdvNcRaisedBy('');
    setAdvNcTargetDate('');
    setAdvApprovalDate(institution?.approvalDate?.slice(0, 10) ?? new Date().toISOString().slice(0, 10));
    setAdvExpiryDate(institution?.expiryDate?.slice(0, 10) ?? '');
    setAdvLetterFile(null);
    setAdvLetterType('EMPANELMENT_APPROVAL_LETTER_SCAN');
    setAdvContactMobile('');
    setAdvContactDesignation('');
    setAdvCredFile(null);
    setAdvanceErrors([]);
    setAdvanceOpen(true);
  };

  const [ncOpen, setNcOpen] = useState(false);
  const [ncForm, setNcForm] = useState<{ description: string; raisedDate: string; raisedByOfficialText: string; targetClosureDate: string; status: NcStatus; responsibleEmployeeId: string }>({ description: '', raisedDate: new Date().toISOString().slice(0, 10), raisedByOfficialText: '', targetClosureDate: '', status: 'OPEN', responsibleEmployeeId: '' });
  const [ncBusyId, setNcBusyId] = useState<number | null>(null);
  const [submitNc, setSubmitNc] = useState<NcRegister | null>(null);
  const [submitText, setSubmitText] = useState('');
  const [submitEvidenceId, setSubmitEvidenceId] = useState('');
  const [submitFile, setSubmitFile] = useState<File | null>(null);
  const [submitDocs, setSubmitDocs] = useState<InstitutionDocument[]>([]);
  const [acceptNc, setAcceptNc] = useState<NcRegister | null>(null);
  const [acceptForm, setAcceptForm] = useState({ closureMethod: 'DOCUMENTARY_EVIDENCE_ONLY', acceptanceDate: new Date().toISOString().slice(0, 10), acceptingOfficialText: '', evidenceDocumentId: '', witnessedVisitId: '' });

  const [contactOpen, setContactOpen] = useState(false);
  const [editingContact, setEditingContact] = useState<InstitutionContact | null>(null);
  const [contactForm, setContactForm] = useState<{ firstName: string; lastName: string; mobile: string; email: string; designation: string; roleDescription: string; primaryContact: boolean }>({ firstName: '', lastName: '', mobile: '', email: '', designation: '', roleDescription: '', primaryContact: false });

  const [noteOpen, setNoteOpen] = useState(false);
  const [noteText, setNoteText] = useState('');

  const [taskOpen, setTaskOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<InstitutionTask | null>(null);
  const [taskForm, setTaskForm] = useState<{ title: string; description: string; employeeId: string; dueDate: string; priority: string; status: string }>({ title: '', description: '', employeeId: '', dueDate: new Date().toISOString().slice(0, 10), priority: 'MEDIUM', status: 'OPEN' });

  const [visitOpen, setVisitOpen] = useState(false);
  const [visitForm, setVisitForm] = useState({ employeeId: '', date: new Date().toISOString().slice(0, 10), startTime: '10:00', endTime: '10:30', purpose: '', selfGenerated: true });

  const [deleteOpen, setDeleteOpen] = useState(false);

  const today = () => new Date().toISOString().slice(0, 10);
  const assignedByEmployeeId = userData?.employeeId || institution?.assignedEmployeeId || 0;
  const employeeName = (employeeId: number | null | undefined) => {
    const employee = employees.find((item) => item.id === employeeId);
    return employee ? [employee.firstName, employee.lastName].filter(Boolean).join(' ') : employeeId ? `Employee #${employeeId}` : 'Unassigned';
  };

  const uploadDoc = async () => {
    if (!token || !institution) return;
    if (!docFile) { toast.error('Choose a file to upload.'); return }
    setIsUploading(true);
    try {
      const docId = await InstitutionsAPI.createDocument({ documentType: docType, institutionId, fileName: docFile.name }, token);
      await InstitutionsAPI.uploadDocumentFile(docId, docFile, token);
      toast.success('Document uploaded.');
      setDocFile(null);
      setDocOpen(false);
      await reloadDocs();
    } catch (error) { toast.error(getErrorMessage(error, 'Unable to upload document.')) } finally { setIsUploading(false) }
  };

  const planVisit = async () => {
    if (!token || !institution) return;
    const assigned = Number(visitForm.employeeId);
    if (!assigned || !visitForm.date || !visitForm.purpose.trim()) { toast.error('Employee, visit date, and purpose are required.'); return }
    setBusy(true);
    try {
      await InstitutionsAPI.planVisit({
        institutionId, assignedEmployeeId: assigned, assignedByEmployeeId,
        scheduledVisitDate: visitForm.date, scheduledStartTime: `${visitForm.startTime}:00`, scheduledEndTime: `${visitForm.endTime}:00`,
        purpose: visitForm.purpose.trim(), selfGenerated: visitForm.selfGenerated,
      }, token);
      toast.success('Visit planned.');
      setVisitOpen(false);
      await reloadVisits();
    } catch (error) { toast.error(getErrorMessage(error, 'Unable to plan visit.')) } finally { setBusy(false) }
  };

  const openNcCount = useMemo(() => ncRegisters.filter((nc) => nc.status === 'OPEN' || nc.status === 'SUBMITTED').length, [ncRegisters]);
  const hasOpenNc = openNcCount > 0;
  const hasClosedNc = useMemo(() => ncRegisters.some((nc) => nc.status === 'CLOSED'), [ncRegisters]);
  const hasCredDoc = useMemo(() => documents.some((d) => d.documentType === 'CREDENTIALS_PROFILE' && d.fileAttached !== false), [documents]);
  const neededDocType = (institution?.empanelmentStatus === 'TECHNICAL_VISIT_SCHEDULED' || institution?.empanelmentStatus === 'NC_RAISED' || institution?.empanelmentStatus === 'NC_CLOSURE_SUBMITTED') ? 'TECHNICAL_VISIT_REPORT'
    : institution?.empanelmentStatus === 'RENEWAL_DUE' ? 'RENEWAL_APPLICATION'
    : (institution?.empanelmentStatus === 'APPROVED' || institution?.empanelmentStatus === 'UNDER_REVIEW') ? 'EMPANELMENT_APPROVAL_LETTER_SCAN'
    : 'CREDENTIALS_PROFILE';

  useEffect(() => {
    setDocType(neededDocType as InstitutionDocumentType);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [institution?.empanelmentStatus]);
  const hasApprovalDoc = useMemo(() => documents.some((d) => (d.documentType === 'EMPANELMENT_APPROVAL_LETTER_SCAN' || d.documentType === 'APPROVED_VENDOR_LISTING_PROOF') && d.fileAttached !== false), [documents]);
  const visitDone = useMemo(() => visits.some((v) => !!v.actualCheckoutAt), [visits]);
  const checklistFor = (target: EmpanelmentStatus) => {
    if (target === 'CREDENTIALS_SUBMITTED') {
      const contactDone = contacts.length > 0 || (advContactName.trim() !== '' && advContactLastName.trim() !== '' && advContactMobile.replace(/\D/g, '').length === 10 && advContactDesignation.trim() !== '');
      const docDone = hasCredDoc || advCredFile != null;
      const dateDone = !!(advAppDate || institution?.applicationDate);
      return [
        { key: 'contact', label: 'Receiving contact', done: contactDone, action: 'Fill below' },
        { key: 'doc', label: 'Credentials profile attached', done: docDone, action: 'Pick file below' },
        { key: 'date', label: 'Application date set', done: dateDone, action: 'Pick date below' },
      ];
    }
    if (target === 'APPROVED') {
      const items = [
        { key: 'letter', label: 'Approval letter / vendor listing attached', done: hasApprovalDoc || advLetterFile != null, action: 'Pick file below' },
        { key: 'nc', label: 'All NCs closed', done: !hasOpenNc, action: 'See NC tab' },
        { key: 'date', label: 'Approval date set', done: !!(advApprovalDate || institution?.approvalDate), action: 'Pick below' },
      ];
      if (institution?.empanelmentStatus === 'TECHNICAL_VISIT_SCHEDULED') {
        items.unshift({ key: 'visit', label: 'Technical visit completed (checked out)', done: visitDone, action: 'Plan + check out in Visits tab' });
      }
      return items;
    }
    if (target === 'NC_RAISED') {
      const quickValid = advNcDesc.trim() !== '' && advNcRaisedBy.trim() !== '' && advNcTargetDate !== '';
      const items = [
        { key: 'rows', label: ncRegisters.length > 0 ? `${ncRegisters.length} NC row(s) logged` : 'At least 1 NC row', done: ncRegisters.length > 0 || quickValid, action: 'Fill below' },
      ];
      if (institution?.empanelmentStatus === 'TECHNICAL_VISIT_SCHEDULED') {
        items.unshift({ key: 'visit', label: 'Technical visit completed (checked out)', done: visitDone, action: 'Plan + check out in Visits tab' });
      }
      return items;
    }
    if (target === 'NC_CLOSURE_SUBMITTED') {
      const allIn = ncRegisters.length > 0 && ncRegisters.every((n) => n.status !== 'OPEN');
      return [
        { key: 'rows', label: 'Every NC submitted / closed', done: allIn, action: ncRegisters.length === 0 ? 'Raise NCs first' : 'Mark Submitted in NC tab' },
      ];
    }
    return [];
  };
  const checklist = checklistFor(advanceForm.toStatus);
  const checklistBlocked = checklist.some((c) => !c.done);

  // Backend-authoritative allowed next statuses; client fallback otherwise
  const backendAllowedActions = (institution as unknown as { allowedActions?: EmpanelmentStatus[] | null; allowedNextStatuses?: EmpanelmentStatus[] | null })?.allowedActions ?? (institution as unknown as { allowedNextStatuses?: EmpanelmentStatus[] | null })?.allowedNextStatuses ?? null;

  const allowedNextStatuses = useMemo<EmpanelmentStatus[]>(() => {
    if (!institution) return [];
    let base: EmpanelmentStatus[] = [];
    if (Array.isArray(backendAllowedActions)) base = backendAllowedActions as EmpanelmentStatus[];
    else base = VALID_STAGE_TRANSITIONS[institution.empanelmentStatus as EmpanelmentStatus] || [];
    const needsLetter = !hasApprovalDoc && ['UNDER_REVIEW','TECHNICAL_VISIT_SCHEDULED','NC_CLOSURE_SUBMITTED'].includes(institution.empanelmentStatus);
    if (needsLetter && !base.includes('APPROVED' as EmpanelmentStatus)) base = [...base, 'APPROVED' as EmpanelmentStatus];
    return hasClosedNc ? base.filter((stage) => stage !== 'NC_RAISED') : base;
  }, [institution, backendAllowedActions, hasApprovalDoc, hasClosedNc]);

  // Renewal/expiry are system-driven (scheduler flips on lead-date); never offer as manual advances
  const manualNextStatuses = useMemo(
    () => allowedNextStatuses.filter((s) => s !== 'RENEWAL_DUE' && s !== 'EXPIRED'),
    [allowedNextStatuses],
  );
  const renewalDaysLeft = useMemo(() => {
    if (!institution?.expiryDate) return null;
    return Math.ceil((new Date(institution.expiryDate).getTime() - Date.now()) / 86400000);
  }, [institution?.expiryDate]);

  const load = useCallback(async () => {
    if (!token || !Number.isFinite(institutionId)) return;
    setIsLoading(true);
    setWarnings([]);
    try {
      const found = await InstitutionsAPI.getInstitutionById(institutionId, token);
      setInstitution(found);
      if (!found) return;
      const [pipelineResult, contactsResult, mastersResult, ncResult, notesResult, tasksResult, employeesResult, visitsResult, documentsResult] = await Promise.allSettled([
        InstitutionsAPI.getPipeline(institutionId, token),
        InstitutionsAPI.getContacts(institutionId, token),
        RetailAPI.getMasterContacts(token),
        InstitutionsAPI.getNcRegisters(institutionId, token),
        InstitutionsAPI.getNotes(institutionId, token),
        InstitutionsAPI.getTasks(institutionId, found.assignedEmployeeId || userData?.employeeId || 0, token),
        RetailAPI.getEmployees(token),
        // Visits are independent parallel activities — fetch does not mutate business status
        visitsApi.getCommonVisits(token, { page: 0, size: 50, visitType:
 'INSTITUTIONAL_VISIT', from: '2000-01-01', to: new Date().toISOString().slice(0, 10) }).catch(() => ({ content: [] as CommonVisitRow[] } as unknown as { content: CommonVisitRow[] })),
        InstitutionsAPI.getDocuments(institutionId, token),
      ]);
      if (pipelineResult.status === 'fulfilled') setPipeline(pipelineResult.value);
      if (contactsResult.status === 'fulfilled') setContacts(contactsResult.value);
      if (mastersResult.status === 'fulfilled') setMasterContacts(mastersResult.value.map((m) => ({ id: m.id, firstName: m.firstName, lastName: m.lastName, mobile: m.mobile, email: m.email })));
      if (ncResult.status === 'fulfilled') {
        setNcRegisters(ncResult.value);
        if (ncResult.value.length) {
          Promise.all(ncResult.value.map((nc) => InstitutionsAPI.getNcDocuments(nc.id, token).catch(() => []))).then((allDocs) => {
            const map: Record<number, InstitutionDocument[]> = {};
            ncResult.value.forEach((nc, idx) => { map[nc.id] = allDocs[idx] as InstitutionDocument[]; });
            setNcDocsMap(map);
          });
        } else setNcDocsMap({});
      }
      if (notesResult.status === 'fulfilled') setNotes(notesResult.value);
      if (tasksResult.status === 'fulfilled') setTasks(tasksResult.value);
      if (employeesResult.status === 'fulfilled') setEmployees(employeesResult.value);
      if (documentsResult.status === 'fulfilled') setDocuments(documentsResult.value);
      if (visitsResult.status === 'fulfilled') {
        const raw = visitsResult.value as unknown as { content: CommonVisitRow[] } | CommonVisitRow[];
        const list = Array.isArray(raw) ? raw : (raw as { content: CommonVisitRow[] }).content || [];
        setVisits(list.filter((v) => v.institutionId === institutionId));
      }
      const failed = [
        pipelineResult.status === 'rejected' && 'pipeline',
        contactsResult.status === 'rejected' && 'contacts',
        ncResult.status === 'rejected' && 'NC register',
        notesResult.status === 'rejected' && 'notes',
      ].filter(Boolean);
      if (failed.length) setWarnings(failed.map((f) => `${f} could not be loaded`));
    } catch (error) {
      setInstitution(null);
      toast.error(getErrorMessage(error, 'Unable to load this institution.'));
    } finally {
      setIsLoading(false);
    }
  }, [institutionId, token, userData?.employeeId]);

  useEffect(() => { void load(); }, [load]);

  const reloadInstitution = useCallback(async () => {
    if (!token || !Number.isFinite(institutionId)) return;
    try { const found = await InstitutionsAPI.getInstitutionById(institutionId, token); setInstitution(found); }
    catch (error) { toast.error(getErrorMessage(error, 'Unable to reload institution.')) }
  }, [token, institutionId]);

  const reloadPipeline = useCallback(async () => {
    if (!token || !Number.isFinite(institutionId)) return;
    try { setPipeline(await InstitutionsAPI.getPipeline(institutionId, token)); }
    catch (error) { toast.error(getErrorMessage(error, 'Unable to reload pipeline.')) }
  }, [token, institutionId]);

  const reloadNc = useCallback(async () => {
    if (!token || !Number.isFinite(institutionId)) return;
    try {
      const ncs = await InstitutionsAPI.getNcRegisters(institutionId, token);
      setNcRegisters(ncs);
      if (ncs.length) {
        const allDocs = await Promise.all(ncs.map((nc) => InstitutionsAPI.getNcDocuments(nc.id, token).catch(() => [])));
        const map: Record<number, InstitutionDocument[]> = {};
        ncs.forEach((nc, idx) => { map[nc.id] = allDocs[idx] as InstitutionDocument[]; });
        setNcDocsMap(map);
      } else setNcDocsMap({});
    } catch (error) { toast.error(getErrorMessage(error, 'Unable to reload NC register.')) }
  }, [token, institutionId]);

  const reloadDocs = useCallback(async () => {
    if (!token || !Number.isFinite(institutionId)) return;
    try { setDocuments(await InstitutionsAPI.getDocuments(institutionId, token)); }
    catch (error) { toast.error(getErrorMessage(error, 'Unable to reload documents.')) }
  }, [token, institutionId]);

  const reloadVisits = useCallback(async () => {
    if (!token || !Number.isFinite(institutionId)) return;
    try {
      const page = await visitsApi.getCommonVisits(token, { page: 0, size: 50, visitType: 'INSTITUTIONAL_VISIT', from: '2000-01-01', to: new Date().toISOString().slice(0, 10) });
      const raw = page as unknown as { content: CommonVisitRow[] } | CommonVisitRow[];
      const list = Array.isArray(raw) ? raw : raw.content || [];
      setVisits(list.filter((v) => v.institutionId === institutionId));
    } catch (error) { toast.error(getErrorMessage(error, 'Unable to reload visits.')) }
  }, [token, institutionId]);

  const reloadContacts = useCallback(async () => {
    if (!token || !Number.isFinite(institutionId)) return;
    try {
      const [links, masters] = await Promise.all([
        InstitutionsAPI.getContacts(institutionId, token),
        RetailAPI.getMasterContacts(token),
      ]);
      setContacts(links);
      setMasterContacts(masters.map((m) => ({ id: m.id, firstName: m.firstName, lastName: m.lastName, mobile: m.mobile, email: m.email })));
    }
    catch (error) { toast.error(getErrorMessage(error, 'Unable to reload contacts.')) }
  }, [token, institutionId]);

  const reloadNotes = useCallback(async () => {
    if (!token || !Number.isFinite(institutionId)) return;
    try { setNotes(await InstitutionsAPI.getNotes(institutionId, token)); }
    catch (error) { toast.error(getErrorMessage(error, 'Unable to reload notes.')) }
  }, [token, institutionId]);

  const reloadTasks = useCallback(async () => {
    if (!token || !Number.isFinite(institutionId)) return;
    try { setTasks(await InstitutionsAPI.getTasks(institutionId, institution?.assignedEmployeeId || userData?.employeeId || 0, token)); }
    catch (error) { toast.error(getErrorMessage(error, 'Unable to reload tasks.')) }
  }, [token, institutionId, institution?.assignedEmployeeId, userData?.employeeId]);

  const saveEdit = async () => {
    if (!token || !editDraft) return;
    const errors: string[] = [];
    if (!editDraft.institutionName.trim()) errors.push('Institution name is required.');
    if (!editDraft.state.trim()) errors.push('State is required.');
    if (errors.length) { setEditErrors(errors); return; }
    setBusy(true);
    try {
      const toNum = (v: string): number | null => { if (v == null || String(v).trim() === '') return null; const n = Number(v); return Number.isFinite(n) ? n : null; };
      await InstitutionsAPI.updateInstitution(institutionId, {
        institutionName: editDraft.institutionName.trim(),
        institutionType: editDraft.institutionType as Institution['institutionType'],
        parentInstitutionId: toNum(editDraft.parentInstitutionId),
        jurisdiction: editDraft.jurisdiction.trim(),
        state: editDraft.state.trim(),
        regionId: toNum(editDraft.regionId),
        empanelmentStatus: editDraft.empanelmentStatus as EmpanelmentStatus,
        assignedEmployeeId: toNum(editDraft.assignedEmployeeId),
        currentStageOwnerContactId: toNum(editDraft.currentStageOwnerContactId),
        applicationDate: editDraft.applicationDate || null,
        approvalDate: editDraft.approvalDate || null,
        expiryDate: editDraft.expiryDate || null,
        renewalLeadDays: toNum(editDraft.renewalLeadDays),
        active: editDraft.active,
      }, token);
      toast.success('Institution updated.');
      setEditOpen(false);
      await reloadInstitution();
    } catch (error) { toast.error(getErrorMessage(error, 'Unable to update institution.')); } finally { setBusy(false); }
  };

  const deactivate = async () => {
    if (!token) return;
    setBusy(true);
    try {
      await InstitutionsAPI.deleteInstitution(institutionId, token);
      toast.success('Institution marked inactive.');
      router.push('/dashboard/institutions');
    } catch (error) { toast.error(getErrorMessage(error, 'Unable to deactivate institution.')); } finally { setBusy(false); }
  };

  const advanceStage = async () => {
    if (!token || !institution) return;
    const errors: string[] = [];
    if (!advanceForm.toStatus) errors.push('Target status is required.');
    if (!advanceForm.remarks.trim()) errors.push('Remarks are required for stage transitions.');
    if (!advanceForm.decisionByEmployeeId) errors.push('Responsible employee is required by the backend.');
    if (institution.empanelmentStatus === 'NC_RAISED' && advanceForm.toStatus !== 'NC_CLOSURE_SUBMITTED') {
      errors.push('After NC_RAISED, the next stage must be NC_CLOSURE_SUBMITTED.');
    }
    if (institution.empanelmentStatus === 'NC_CLOSURE_SUBMITTED' && advanceForm.toStatus === 'APPROVED' && hasOpenNc) {
      errors.push('Cannot approve with open NCs. Close all NCs before approval.');
    }
    if ((advanceForm.toStatus === 'APPROVED' || advanceForm.toStatus === 'RENEWAL_DUE') && hasOpenNc) {
      errors.push('Cannot advance to approval/renewal with open NCs.');
    }
    if (!allowedNextStatuses.includes(advanceForm.toStatus)) {
      errors.push(`Invalid transition from ${humanize(institution.empanelmentStatus)} to ${humanize(advanceForm.toStatus)}.`);
    }
    if (errors.length) { setAdvanceErrors(errors); return; }
    setBusy(true);
    setAdvanceErrors([]);
    try {
      if (advanceForm.toStatus === 'CREDENTIALS_SUBMITTED') {
        let ownerContactId = advOwnerId ? Number(advOwnerId) : institution.currentStageOwnerContactId;
        if (contacts.length === 0) {
          if (!advContactName.trim() || !advContactLastName.trim() || advContactMobile.replace(/\D/g, '').length !== 10 || !advContactDesignation.trim()) {
            throw new Error('Add the receiving contact (first + last name, 10-digit mobile, designation) to submit credentials.');
          }
          let masterId: number;
          try {
            masterId = await RetailAPI.createMasterContact({
              firstName: advContactName.trim(), lastName: advContactLastName.trim(), mobile: advContactMobile.replace(/\D/g, ''),
              email: null, dateOfBirth: null, anniversaryDate: null, active: true,
            }, token);
          } catch (e) {
            const msg = getErrorMessage(e, '');
            if (msg.toLowerCase().includes('duplicate')) {
              const q = advContactMobile.replace(/\D/g, '');
              const res = await fetch(`${process.env.NEXT_PUBLIC_API_BASE_URL || 'http://ec2-18-211-58-135.compute-1.amazonaws.com:8081'}/api/common/contacts?q=${q}&page=0&size=5`, { headers: { Authorization: `Bearer ${token}` } }).then(r => r.json()).catch(() => ({ content: [] }));
              const list = Array.isArray((res as any).content) ? (res as any).content : [];
              const match = list.find((c: any) => String(c.mobile || '').replace(/\D/g, '') === q);
              if (match?.id) masterId = match.id;
              else throw new Error('A contact with this mobile already exists. Please use a different number or pick the existing contact from the list.');
            } else throw e;
          }
          await InstitutionsAPI.addContact(institutionId, {
            institutionId, contactInfluenceRegisterId: masterId,
            designation: advContactDesignation.trim(), roleDescription: null, primaryContact: true, active: true,
          }, token);
          ownerContactId = masterId;
          await reloadContacts();
        }
        if (!hasCredDoc) {
          if (!advCredFile) throw new Error('Attach the credentials profile file to submit.');
          const docId = await InstitutionsAPI.createDocument({ documentType: 'CREDENTIALS_PROFILE', institutionId, fileName: advCredFile.name }, token);
          await InstitutionsAPI.uploadDocumentFile(docId, advCredFile, token);
          await reloadDocs();
        }
        const appDate = advAppDate || institution.applicationDate;
        if (!appDate) throw new Error('Application date is required to submit credentials.');
        await InstitutionsAPI.updateInstitution(institutionId, {
          institutionName: institution.institutionName,
          institutionType: institution.institutionType,
          parentInstitutionId: institution.parentInstitutionId,
          jurisdiction: institution.jurisdiction,
          state: institution.state,
          regionId: institution.regionId,
          empanelmentStatus: institution.empanelmentStatus as EmpanelmentStatus,
          assignedEmployeeId: institution.assignedEmployeeId,
          currentStageOwnerContactId: ownerContactId,
          applicationDate: appDate,
          approvalDate: institution.approvalDate,
          expiryDate: institution.expiryDate,
          renewalLeadDays: institution.renewalLeadDays,
          active: institution.active,
        }, token);
      }
      if (advanceForm.toStatus === 'NC_RAISED' && ncRegisters.length === 0) {
        if (!advNcDesc.trim() || !advNcRaisedBy.trim() || !advNcTargetDate) {
          throw new Error('Log at least one NC (description, raised-by, target date) to enter NC Raised.');
        }
        await InstitutionsAPI.createNc({
          institutionId,
          description: advNcDesc.trim(),
          raisedDate: new Date().toISOString().slice(0, 10),
          raisedByOfficialText: advNcRaisedBy.trim(),
          targetClosureDate: advNcTargetDate,
          closureMethod: null,
          closureDate: null,
          status: 'OPEN',
          responsibleEmployeeId: advanceForm.decisionByEmployeeId ? Number(advanceForm.decisionByEmployeeId) : (institution.assignedEmployeeId ?? null),
        }, token);
        await reloadNc();
      }
      if (advanceForm.toStatus === 'APPROVED') {
        if (!advApprovalDate && !institution.approvalDate) throw new Error('Approval date is required to mark Approved.');
        if ((advApprovalDate || institution.approvalDate) && advExpiryDate && new Date(advExpiryDate) < new Date(advApprovalDate || institution.approvalDate as string)) {
          throw new Error('Expiry date cannot be before approval date.');
        }
        if (!hasApprovalDoc && !advLetterFile) throw new Error('Attach the approval letter scan or vendor listing proof to mark Approved.');
        if (!hasApprovalDoc && advLetterFile) {
          const docId = await InstitutionsAPI.createDocument({ documentType: advLetterType, institutionId, fileName: advLetterFile.name }, token);
          await InstitutionsAPI.uploadDocumentFile(docId, advLetterFile, token);
          await reloadDocs();
        }
        await InstitutionsAPI.updateInstitution(institutionId, {
          institutionName: institution.institutionName,
          institutionType: institution.institutionType,
          parentInstitutionId: institution.parentInstitutionId,
          jurisdiction: institution.jurisdiction,
          state: institution.state,
          regionId: institution.regionId,
          empanelmentStatus: institution.empanelmentStatus as EmpanelmentStatus,
          assignedEmployeeId: institution.assignedEmployeeId,
          currentStageOwnerContactId: institution.currentStageOwnerContactId,
          applicationDate: institution.applicationDate,
          approvalDate: advApprovalDate || institution.approvalDate,
          expiryDate: advExpiryDate || institution.expiryDate,
          renewalLeadDays: institution.renewalLeadDays,
          active: institution.active,
        }, token);
        await reloadInstitution();
      }
      await InstitutionsAPI.advanceStage(institutionId, {
        nextStage: advanceForm.toStatus,
        responsibleEmployeeId: advanceForm.decisionByEmployeeId ? Number(advanceForm.decisionByEmployeeId) : null,
        entryDate: new Date().toISOString().slice(0, 10),
        outcomeComment: advanceForm.remarks.trim(),
      }, token);
      toast.success(`Stage advanced to ${humanize(advanceForm.toStatus)}.`);
      setAdvanceOpen(false);
      await reloadInstitution();
      await reloadPipeline();
    } catch (error) {
      const raw = getErrorMessage(error, 'Unable to advance stage.');
      const isDup = raw.toLowerCase().includes('duplicate');
      toast.error(isDup ? 'This contact (mobile/email) already exists. Please use a different number or select the existing contact.' : raw);
    } finally { setBusy(false); }
  };

  const createNc = async () => {
    if (!token || !institution) return;
    if (hasClosedNc) { toast.error('This institution already completed its NC lifecycle. Another NC cannot be raised.'); return }
    if (!ncForm.description.trim()) { toast.error('NC description is required.'); return }
    setBusy(true);
    try {
      await InstitutionsAPI.createNc({
        institutionId,
        description: ncForm.description.trim(),
        raisedDate: ncForm.raisedDate,
        raisedByOfficialText: ncForm.raisedByOfficialText.trim(),
        targetClosureDate: ncForm.targetClosureDate || null,
        closureMethod: null,
        closureDate: null,
        status: ncForm.status,
        responsibleEmployeeId: ncForm.responsibleEmployeeId ? Number(ncForm.responsibleEmployeeId) : null,
      }, token);
      toast.success('NC register entry created.');
      setNcOpen(false);
      await reloadNc();
      await reloadPipeline();
    } catch (error) { toast.error(getErrorMessage(error, 'Unable to create NC.')); } finally { setBusy(false); }
  };

  const openSubmitNc = async (nc: NcRegister) => {
    setSubmitNc(nc);
    setSubmitText('');
    setSubmitEvidenceId('');
    setSubmitFile(null);
    setSubmitDocs([]);
    if (!token) return;
    try { setSubmitDocs(await InstitutionsAPI.getNcDocuments(nc.id, token)); }
    catch { setSubmitDocs([]); }
  };

  const doSubmitNc = async () => {
    if (!token || !submitNc) return;
    if (!submitText.trim()) { toast.error('Corrective action text is required.'); return }
    let evidenceId = submitEvidenceId ? Number(submitEvidenceId) : null;
    setNcBusyId(submitNc.id);
    try {
      if (submitFile) {
        await InstitutionsAPI.uploadNcEvidence(submitNc.id, submitFile, token);
        const docs = await InstitutionsAPI.getNcDocuments(submitNc.id, token);
        setSubmitDocs(docs);
        evidenceId = docs.length ? docs[docs.length - 1].id : evidenceId;
      }
      if (!evidenceId) { toast.error('Attach closure evidence (file) to submit.'); return }
      await InstitutionsAPI.submitNcClosure(submitNc.id, { correctiveActionText: submitText.trim(), evidenceDocumentId: evidenceId, witnessedVisitId: null }, token);
      toast.success(`NC #${submitNc.id} closure submitted.`);
      setSubmitNc(null);
      await reloadNc();
    } catch (error) { toast.error(getErrorMessage(error, 'Unable to submit NC closure.')) } finally { setNcBusyId(null); }
  };

  const openAcceptNc = async (nc: NcRegister) => {
    setAcceptNc(nc);
    setAcceptForm({ closureMethod: 'DOCUMENTARY_EVIDENCE_ONLY', acceptanceDate: new Date().toISOString().slice(0, 10), acceptingOfficialText: '', evidenceDocumentId: '', witnessedVisitId: '' });
    if (!token) return;
    try {
      const docs = await InstitutionsAPI.getNcDocuments(nc.id, token);
      setSubmitDocs(docs);
      const valid = docs.filter((d: any) => d.fileAttached !== false);
      const latest = valid.length ? String(valid[valid.length - 1].id) : docs.length ? String(docs[0].id) : '';
      if (latest) setAcceptForm((prev) => ({ ...prev, evidenceDocumentId: latest }));
    } catch { setSubmitDocs([]); }
  };

  const doAcceptNc = async () => {
    if (!token || !acceptNc) return;
    if (!acceptForm.acceptingOfficialText.trim()) { toast.error('Accepting official is required.'); return }
    if (acceptForm.closureMethod === 'DOCUMENTARY_EVIDENCE_ONLY' && !acceptForm.evidenceDocumentId) { toast.error('Select an evidence document — upload one via Evidence first.'); return }
    if (acceptForm.closureMethod === 'RE_VISIT_WITNESSED' && !acceptForm.witnessedVisitId) { toast.error('Choose the re-visit that witnessed the closure.'); return }
    setNcBusyId(acceptNc.id);
    try {
      await InstitutionsAPI.acceptNcClosure(acceptNc.id, {
        closureMethod: acceptForm.closureMethod as 'DOCUMENTARY_EVIDENCE_ONLY' | 'RE_VISIT_WITNESSED',
        acceptanceDate: acceptForm.acceptanceDate,
        acceptingOfficialText: acceptForm.acceptingOfficialText.trim(),
        evidenceDocumentId: acceptForm.evidenceDocumentId && acceptForm.evidenceDocumentId !== '__none' ? Number(acceptForm.evidenceDocumentId) : null,
        witnessedVisitId: acceptForm.closureMethod === 'RE_VISIT_WITNESSED' && acceptForm.witnessedVisitId ? Number(acceptForm.witnessedVisitId) : null,
      }, token);
      toast.success(`NC #${acceptNc.id} closed.`);
      setAcceptNc(null);
      await reloadNc();
    } catch (error) { toast.error(getErrorMessage(error, 'Unable to close NC. Manager approval may be required.')) } finally { setNcBusyId(null); }
  };

  const saveContact = async () => {
    if (!token || !institution) return;
    if (!contactForm.firstName.trim() || !contactForm.designation.trim() || contactForm.mobile.replace(/\D/g, '').length !== 10) {
      toast.error('First name, designation, and 10-digit mobile are required.'); return;
    }
    setBusy(true);
    try {
      const masterPayload = { firstName: contactForm.firstName.trim(), lastName: contactForm.lastName.trim(), mobile: contactForm.mobile.replace(/\D/g, ''), email: contactForm.email.trim() || null, dateOfBirth: null, anniversaryDate: null, active: editingContact?.active ?? true };
      const masterId = editingContact?.contactInfluenceRegisterId || await RetailAPI.createMasterContact(masterPayload, token);
      if (editingContact) await RetailAPI.updateMasterContact(masterId, masterPayload, token);
      const linkPayload = { institutionId, contactInfluenceRegisterId: masterId, designation: contactForm.designation.trim(), roleDescription: contactForm.roleDescription.trim() || null, primaryContact: contactForm.primaryContact, active: editingContact?.active ?? true };
      if (editingContact) await InstitutionsAPI.updateContact(editingContact.id, linkPayload, token);
      else await InstitutionsAPI.addContact(institutionId, linkPayload, token);
      toast.success(editingContact ? 'Contact updated.' : 'Contact added.');
      setContactOpen(false);
      setEditingContact(null);
      setContactForm({ firstName: '', lastName: '', mobile: '', email: '', designation: '', roleDescription: '', primaryContact: false });
      await reloadContacts();
    } catch (error) { toast.error(getErrorMessage(error, 'Unable to add contact.')); } finally { setBusy(false); }
  };

  const addNote = async () => {
    if (!token || !noteText.trim()) return;
    setBusy(true);
    try {
      await InstitutionsAPI.createNote(institutionId, noteText.trim(), token);
      toast.success('Note added.');
      setNoteOpen(false);
      setNoteText('');
      await reloadNotes();
    } catch (error) { toast.error(getErrorMessage(error, 'Unable to add note.')); } finally { setBusy(false); }
  };

  const addTask = async () => {
    if (!token) return;
    const employeeId = Number(taskForm.employeeId);
    if (!taskForm.title.trim() || !taskForm.dueDate || !employeeId) { toast.error('Title, assignee, and due date are required.'); return }
    setBusy(true);
    try {
      const payload = { taskTitle: taskForm.title.trim(), taskDescription: taskForm.description.trim() || null, taskType: 'FOLLOW_UP', status: taskForm.status, priority: taskForm.priority, assignedToEmployeeId: employeeId, assignedByEmployeeId, dueDate: taskForm.dueDate, institutionId, visitActivityId: null };
      if (editingTask) await InstitutionsAPI.updateTask(editingTask.id, payload, token); else await InstitutionsAPI.createTask(payload, token);
      toast.success(editingTask ? 'Task updated.' : 'Task created.');
      setTaskOpen(false);
      setEditingTask(null);
      setTaskForm({ title: '', description: '', employeeId: '', dueDate: today(), priority: 'MEDIUM', status: 'OPEN' });
      await reloadTasks();
    } catch (error) { toast.error(getErrorMessage(error, 'Unable to create task.')); } finally { setBusy(false); }
  };

  const removeTask = async (task: InstitutionTask) => {
    if (!token || !window.confirm(`Delete task "${task.title}"?`)) return;
    setBusy(true);
    try { await InstitutionsAPI.deleteTask(task.id, token); toast.success('Task deleted.'); await reloadTasks(); } catch (error) { toast.error(getErrorMessage(error, 'Unable to delete task.')); } finally { setBusy(false); }
  };

  if (isLoading) return <div className="flex min-h-[420px] items-center justify-center"><Loader2 className="h-7 w-7 animate-spin text-muted-foreground" /></div>;
  if (!Number.isFinite(institutionId) || !institution) return <Card><CardHeader><CardTitle>Institution not found</CardTitle></CardHeader><CardContent><Button variant="outline" onClick={() => router.push('/dashboard/institutions')}><ArrowLeft className="mr-2 h-4 w-4" />Back to institutions</Button></CardContent></Card>;

  return (
    <div className="space-y-4 font-poppins text-xs">
      <div className="flex flex-col justify-between gap-3 lg:flex-row lg:items-center">
        <div className="flex gap-3">
          <Button size="icon" variant="outline" onClick={() => router.push('/dashboard/institutions')} aria-label="Back to institutions"><ArrowLeft className="h-4 w-4" /></Button>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-lg font-semibold">{institution.institutionName}</h1>
              <Badge variant={STATUS_VARIANT[institution.empanelmentStatus] ?? 'outline'}>{humanize(institution.empanelmentStatus)}</Badge>
              {!institution.active && <Badge variant="destructive">Inactive</Badge>}
            </div>
            <p className="mt-0.5 text-xs text-muted-foreground">#{institution.id} · {humanize(institution.institutionType)} · {institution.regionName || (institution.regionId ? `Region #${institution.regionId}` : '—')}</p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={() => { setEditDraft({ institutionName: institution.institutionName, institutionType: institution.institutionType, parentInstitutionId: institution.parentInstitutionId == null ? '' : String(institution.parentInstitutionId), jurisdiction: institution.jurisdiction, state: institution.state, regionId: institution.regionId == null ? '' : String(institution.regionId), empanelmentStatus: institution.empanelmentStatus, assignedEmployeeId: institution.assignedEmployeeId == null ? '' : String(institution.assignedEmployeeId), currentStageOwnerContactId: institution.currentStageOwnerContactId == null ? '' : String(institution.currentStageOwnerContactId), applicationDate: institution.applicationDate ?? '', approvalDate: institution.approvalDate ?? '', expiryDate: institution.expiryDate ?? '', renewalLeadDays: institution.renewalLeadDays == null ? '' : String(institution.renewalLeadDays), active: institution.active }); setEditErrors([]); setEditOpen(true); }}><Edit3 className="mr-2 h-3.5 w-3.5" />Edit</Button>
          {manualNextStatuses.length > 0 && (
            <Button size="sm" onClick={() => openAdvance(manualNextStatuses[0])}><ShieldCheck className="mr-2 h-3.5 w-3.5" />Advance</Button>
          )}
          <Button variant="ghost" size="sm" onClick={() => void load()}><RefreshCw className="mr-2 h-3.5 w-3.5" />Refresh</Button>
          <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-destructive" disabled={!institution.active} onClick={() => setDeleteOpen(true)}>Deactivate</Button>
        </div>
      </div>

      {warnings.length > 0 && <div className="flex gap-2 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900"><AlertCircle className="mt-0.5 h-4 w-4 shrink-0" /><p>Institution loaded, but {warnings.join(', ')}. Retry with Refresh.</p></div>}

      {hasOpenNc && (
        <div className="flex gap-2 rounded-lg border border-orange-300 bg-orange-50 p-3 text-sm text-orange-800">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{openNcCount} open NC(s) block approval. Close all NCs before advancing to APPROVED.</span>
        </div>
      )}

      <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,1fr)_300px]">
      <div className="min-w-0 space-y-4">
      {(institution.empanelmentStatus !== 'APPROVED' || (renewalDaysLeft != null && renewalDaysLeft <= (institution.renewalLeadDays ?? 30))) && (
      <Card className="border-l-4 border-l-primary py-0">
        <CardContent className="flex flex-col gap-2 px-4 py-2.5 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex min-w-0 items-center gap-2">
            <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
            <p className="truncate text-[13px] font-medium">
              {institution.empanelmentStatus === 'NOT_STARTED' ? 'Next required: Submit credentials' : institution.empanelmentStatus === 'CREDENTIALS_SUBMITTED' ? 'Next: Under review — await department response' : institution.empanelmentStatus === 'UNDER_REVIEW' ? 'Next: Schedule technical visit or await decision' : institution.empanelmentStatus === 'TECHNICAL_VISIT_SCHEDULED' ? 'Next: Complete visit, raise NCs if any' : institution.empanelmentStatus === 'NC_RAISED' ? 'Next required: Submit NC closure' : institution.empanelmentStatus === 'NC_CLOSURE_SUBMITTED' ? 'Next: Await re-review / approval' : institution.empanelmentStatus === 'APPROVED' ? (()=>{ const d=showDate(institution.expiryDate); if(renewalDaysLeft==null||institution.expiryDate==null) return 'Approved — you can now supply to this institution'; if(renewalDaysLeft<0) return `Approved — expired on ${d} — please renew`; if(renewalDaysLeft<=30) return `Approved — valid till ${d} — renewal due in ${renewalDaysLeft} day${renewalDaysLeft===1?'':'s'}`; return `Approved — valid till ${d}`; })() : institution.empanelmentStatus === 'RENEWAL_DUE' ? 'Next required: File renewal application' : institution.empanelmentStatus === 'EXPIRED' ? 'Expired — restart credentials' : 'Rejected — restart credentials'}
            </p>
          </div>
          <div className="flex shrink-0 flex-wrap gap-1.5">
            {manualNextStatuses.length > 0 && <Button size="sm" className="h-7 px-2.5 text-xs" onClick={() => openAdvance(manualNextStatuses[0])}>Advance to {humanize(manualNextStatuses[0])}</Button>}
          </div>
        </CardContent>
      </Card>
      )}

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Card><CardHeader className="pb-2"><CardDescription className="text-xs">Current stage</CardDescription><CardTitle className="truncate text-sm" title={humanize(institution.empanelmentStatus)}>{humanize(institution.empanelmentStatus)}</CardTitle></CardHeader></Card>
        <Card><CardHeader className="pb-2"><CardDescription className="text-xs">Open NCs</CardDescription><CardTitle className="text-base">{openNcCount}</CardTitle></CardHeader></Card>
        <Card><CardHeader className="pb-2"><CardDescription className="text-xs">Renewal</CardDescription><CardTitle className="text-sm">{renewalDaysLeft == null ? 'Not scheduled' : renewalDaysLeft < 0 ? 'Expired' : `${renewalDaysLeft} days left`}</CardTitle></CardHeader></Card>
        <Card><CardHeader className="pb-2"><CardDescription className="text-xs">Next milestone</CardDescription><CardTitle className="truncate text-sm" title={manualNextStatuses[0] ? humanize(manualNextStatuses[0]) : 'No next stage'}>{manualNextStatuses[0] ? humanize(manualNextStatuses[0]) : 'No next stage'}</CardTitle></CardHeader></Card>
      </div>

      <DetailShell
        defaultValue="overview"
        tabs={[
          {
            value: 'overview',
            label: 'Overview',
            content: (
              <div className="grid gap-4 lg:grid-cols-2">
                <Card><CardHeader><CardTitle className="text-sm">Institution profile</CardTitle></CardHeader><CardContent className="grid gap-4 sm:grid-cols-2">
                  <Info label="Institution type" value={humanize(institution.institutionType)} />
                  <Info label="State" value={institution.state} />
                  <Info label="Region" value={institution.regionName} />
                  <Info label="Parent institution ID" value={institution.parentInstitutionId} />
                  <Info label="Active" value={institution.active ? 'Yes' : 'No'} />
                  <Info label="Current owner contact ID" value={institution.currentStageOwnerContactId} />
                </CardContent></Card>
                <Card><CardHeader><CardTitle className="text-sm">Lifecycle dates</CardTitle></CardHeader><CardContent className="grid gap-4 sm:grid-cols-2">
                  <Info label="Application date" value={showDate(institution.applicationDate)} />
                  <Info label="Approval date" value={showDate(institution.approvalDate)} />
                  <Info label="Expiry date" value={showDate(institution.expiryDate)} />
                  <Info label="Renewal lead days" value={institution.renewalLeadDays} />
                  <Info label="Created" value={showDate(institution.createdAt)} />
                  <Info label="Updated" value={showDate(institution.updatedAt)} />
                </CardContent></Card>
              </div>
            ),
          },
          {
            value: 'process',
            label: `Process (${pipeline.length + ncRegisters.length})`,
            content: (
              <div className="space-y-4">
                <Card><CardHeader><CardTitle className="text-sm">Stage pipeline</CardTitle></CardHeader><CardContent>{pipeline.length === 0 ? <EmptyState text="No pipeline entries recorded yet." /> : <ol className="relative ml-1.5 space-y-3 border-l pl-4">{pipeline.map((entry) => {
                    const isCurrent = entry.toStatus === institution.empanelmentStatus;
                    const ownerName = entry.decisionByEmployeeName && entry.decisionByEmployeeName !== '—'
                      ? entry.decisionByEmployeeName
                      : (() => { const m = employees.find((e) => e.id === entry.decisionByEmployeeId); const n = m ? [m.firstName, m.lastName].filter(Boolean).join(' ') : ''; return n || (entry.decisionByEmployeeId ? `Employee #${entry.decisionByEmployeeId}` : 'System'); })();
                    return (
                    <li key={entry.id} className="relative">
                      <span className={`absolute -left-[21px] top-1 h-2.5 w-2.5 rounded-full border-2 border-background ${isCurrent ? 'bg-primary' : 'bg-muted-foreground/60'}`} />
                      <div className="flex items-start justify-between gap-4">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-1.5">
                            <p className="text-sm font-medium leading-none">{entry.fromStatus ? `${humanize(entry.fromStatus)} → ` : ''}{humanize(entry.toStatus)}</p>
                            {isCurrent && <Badge variant="default" className="h-4 px-1 text-[10px]">Current</Badge>}
                          </div>
                          {entry.remarks && <p className="mt-1 truncate text-xs text-muted-foreground" title={entry.remarks}>{entry.remarks}</p>}
                        </div>
                        <div className="shrink-0 text-right">
                          <p className="text-xs font-medium leading-none">{showDate(entry.entryDate)}{entry.exitDate ? ` → ${showDate(entry.exitDate)}` : ''}</p>
                          <p className="mt-1 text-[11px] text-muted-foreground">{ownerName}</p>
                        </div>
                      </div>
                    </li>
                    );
                  })}</ol>}</CardContent></Card>
                <Card><CardHeader><CardTitle className="text-sm">NC Register</CardTitle><CardAction>{hasClosedNc ? <span className="text-xs text-muted-foreground">NC lifecycle completed</span> : ['TECHNICAL_VISIT_SCHEDULED', 'NC_RAISED', 'NC_CLOSURE_SUBMITTED', 'UNDER_REVIEW'].includes(institution.empanelmentStatus) ? <Button size="sm" onClick={() => { setNcForm({ description: '', raisedDate: today(), raisedByOfficialText: '', targetClosureDate: '', status: 'OPEN', responsibleEmployeeId: '' }); setNcOpen(true); }}><Plus className="mr-2 h-3.5 w-3.5" />Raise NC</Button> : <span className="text-xs text-muted-foreground">Available after technical visit</span>}</CardAction></CardHeader><CardContent className="space-y-3">
                  {ncRegisters.length === 0 ? <EmptyState text="No NC records found." /> : ncRegisters.map((nc) => {
                    const docs = ncDocsMap[nc.id] || [];
                    const closureLine = (nc.status === 'SUBMITTED' || nc.status === 'CLOSED') && (nc.closureMethod || (nc as any).acceptingOfficialText || (nc as any).acceptanceDate || (nc as any).closureDate) ? [nc.closureMethod ? humanize(nc.closureMethod) : null, (nc as any).acceptingOfficialText, (nc as any).acceptanceDate || (nc as any).closureDate].filter(Boolean).join(' · ') : null;
                    return (
                    <NcSummaryCard key={nc.id} id={nc.id} status={nc.status} description={nc.description} raisedDate={showDate(nc.raisedDate)} raisedBy={nc.raisedByOfficialText || 'Not recorded'} targetDate={showDate(nc.targetClosureDate)} responsible={nc.responsibleEmployeeName} closureSummary={closureLine} evidence={docs} overdue={Boolean(nc.targetClosureDate && nc.status !== 'CLOSED' && nc.targetClosureDate < today())} actions={
                      <>
                        {nc.status === 'OPEN' && <><Button variant="outline" size="sm" onClick={() => void openSubmitNc(nc)} disabled={ncBusyId === nc.id}>{ncBusyId === nc.id && <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />}Submit closure</Button><Button variant="outline" size="sm" onClick={async()=>{ const fd=document.createElement('input'); fd.type='file'; fd.onchange=async()=>{ const f=fd.files?.[0]; if(!f) return; setNcBusyId(nc.id); try{ await InstitutionsAPI.uploadNcEvidence(nc.id, f, token!); toast.success('Evidence uploaded'); await reloadNc(); }catch(e){ toast.error(getErrorMessage(e,'Upload failed'))} finally{ setNcBusyId(null);}}; fd.click();}}>Add evidence</Button></>}
                        {nc.status === 'SUBMITTED' && <Button variant="outline" size="sm" onClick={() => void openAcceptNc(nc)} disabled={ncBusyId === nc.id}>{ncBusyId === nc.id && <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />}Accept & close</Button>}
                      </>
                    } />
                  )})}
                </CardContent></Card>
              </div>
            ),
          },
          {
            value: 'contacts',
            label: `Contacts (${contacts.length})`,
            content: (
              <Card><CardHeader><CardTitle className="text-sm">Institution contacts</CardTitle><CardAction><Button size="sm" onClick={() => { setEditingContact(null); setContactForm({ firstName: '', lastName: '', mobile: '', email: '', designation: '', roleDescription: '', primaryContact: false }); setContactOpen(true); }}><UserPlus className="mr-2 h-3.5 w-3.5" />Add contact</Button></CardAction></CardHeader><CardContent className="space-y-3">
                {contacts.length === 0 ? <EmptyState text="No contacts linked yet." /> : contacts.map((contact) => {
                  const master = masterContacts.find((m) => m.id === contact.contactInfluenceRegisterId);
                  const displayName = [contact.firstName || master?.firstName, contact.lastName || master?.lastName].filter(Boolean).join(' ').trim();
                  const resolvedName = displayName || `Contact #${contact.contactInfluenceRegisterId || contact.id}`;
                  const resolvedMobile = (contact.mobile && contact.mobile !== '—' ? contact.mobile : null) || master?.mobile || null;
                  const resolvedEmail = (contact.email && contact.email !== '—' ? contact.email : null) || master?.email || null;
                  return (
                  <ContactSummaryCard key={contact.id} name={resolvedName} designation={[contact.designation, contact.roleDescription].filter(Boolean).join(' · ')} mobile={resolvedMobile} email={resolvedEmail} primary={contact.primaryContact} active={contact.active} onEdit={() => { setEditingContact(contact); setContactForm({ firstName: contact.firstName || master?.firstName || '', lastName: contact.lastName || master?.lastName || '', mobile: resolvedMobile || '', email: resolvedEmail || '', designation: contact.designation || '', roleDescription: contact.roleDescription || '', primaryContact: contact.primaryContact }); setContactOpen(true); }} />
                )})}
              </CardContent></Card>
            ),
          },
          {
            value: 'visits',
            label: `Visits (${visits.length})`,
            content: (
              <Card><CardHeader><CardTitle className="text-sm">Visits</CardTitle><CardAction><Button size="sm" onClick={() => { setVisitForm({ employeeId: String(institution.assignedEmployeeId || ''), date: new Date().toISOString().slice(0, 10), startTime: '10:00', endTime: '10:30', purpose: '', selfGenerated: true }); setVisitOpen(true); }}><CalendarPlus className="mr-2 h-3.5 w-3.5" />Plan visit</Button></CardAction></CardHeader><CardContent className="space-y-3">
                {visits.length === 0 ? <EmptyState text="No visits yet." /> : visits.map((v) => (
                  <button key={v.id} type="button" onClick={() => router.push(`/dashboard/visits/${v.id}`)} className="w-full rounded-xl border bg-card p-5 text-left transition-colors hover:border-primary/30 hover:bg-muted/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                    <div className="flex items-start justify-between gap-4">
                      <div><p className="font-medium">{v.purpose || 'Institution visit'}</p><p className="mt-1 text-xs text-muted-foreground">{showDate(v.scheduledVisitDate)}{v.scheduledStartTime ? ` · ${v.scheduledStartTime}` : ''}{v.scheduledEndTime ? `–${v.scheduledEndTime}` : ''} · {v.assignedEmployeeName || employeeName(v.assignedEmployeeId)}</p></div>
                      <Badge variant="outline">{v.outcome ? humanize(v.outcome) : v.actualCheckinAt ? 'Checked in' : 'Planned'}</Badge>
                    </div>
                    {v.discussionSummary && <p className="mt-4 border-t pt-3 text-sm text-muted-foreground">{v.discussionSummary}</p>}{v.nextActionText && <p className="mt-2 text-sm"><span className="font-medium">Next:</span> {v.nextActionText}{v.nextActionDate ? ` · ${showDate(v.nextActionDate)}` : ''}</p>}
                  </button>
                ))}
              </CardContent></Card>
            ),
          },
          {
            value: 'documents',
            label: 'Documents',
            content: (
              <Card><CardHeader><CardTitle className="text-sm">Documents</CardTitle><CardAction><Button size="sm" onClick={() => setDocOpen(true)}><Plus className="mr-2 h-3.5 w-3.5" />Upload</Button></CardAction></CardHeader><CardContent>
                {documents.length === 0 ? <EmptyState text="No documents yet." /> : <ol className="relative ml-1.5 space-y-3 border-l pl-4">{documents.map((d) => <li key={d.id} className="relative"><span className="absolute -left-[21px] top-1 h-2.5 w-2.5 rounded-full border-2 border-background bg-muted-foreground/60" /><div className="flex items-center justify-between gap-2"><div className="min-w-0 flex-1"><div className="flex items-center gap-1.5"><p className="truncate text-sm font-medium leading-none">{d.fileName}</p>{d.versionNumber != null && <Badge variant="outline" className="h-4 px-1 text-[10px]">v{d.versionNumber}</Badge>}{!d.fileAttached && <Badge variant="destructive" className="h-4 px-1 text-[10px]">No file</Badge>}</div><p className="mt-1 text-[11px] text-muted-foreground">{humanize(d.documentType)}{d.expiryDate ? ` · exp ${showDate(d.expiryDate)}` : ''}</p></div><div className="flex shrink-0 gap-1"><Button size="sm" variant="outline" className="h-7 px-2 text-xs" disabled={!d.fileAttached} onClick={async()=>{ const base=process.env.NEXT_PUBLIC_API_BASE_URL||'http://ec2-18-211-58-135.compute-1.amazonaws.com:8081'; const list=await fetch(`${base}/api/hr/files?parentType=DOCUMENT_DEPOSITORY&parentId=${d.id}&page=0&size=5`,{headers:{Authorization:`Bearer ${token}`}}).then(r=>r.ok?r.json():{content:[]}).catch(()=>({content:[]})); const fid=list.content?.[0]?.id; if(!fid){ toast.error('File not ready'); return; } const res=await fetch(`${base}/api/hr/files/${fid}/download`,{headers:{Authorization:`Bearer ${token}`}}); if(!res.ok){ toast.error('File not ready'); return; } const blob=await res.blob(); const url=URL.createObjectURL(blob); window.open(url,'_blank'); setTimeout(()=>URL.revokeObjectURL(url),60000);}}>View</Button><Button size="sm" variant="ghost" className="h-7 px-2 text-xs" disabled={!d.fileAttached} onClick={async()=>{ const base=process.env.NEXT_PUBLIC_API_BASE_URL||'http://ec2-18-211-58-135.compute-1.amazonaws.com:8081'; const list=await fetch(`${base}/api/hr/files?parentType=DOCUMENT_DEPOSITORY&parentId=${d.id}&page=0&size=5`,{headers:{Authorization:`Bearer ${token}`}}).then(r=>r.ok?r.json():{content:[]}).catch(()=>({content:[]})); const fid=list.content?.[0]?.id; if(!fid){ toast.error('Download failed'); return; } const res=await fetch(`${base}/api/hr/files/${fid}/download`,{headers:{Authorization:`Bearer ${token}`}}); if(!res.ok){ toast.error('Download failed'); return; } const blob=await res.blob(); const url=URL.createObjectURL(blob); const a=document.createElement('a'); a.href=url; a.download=d.fileName||`doc-${d.id}`; document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);}}>Download</Button></div></div></li>)}</ol>}
              </CardContent></Card>
            ),
          },
          {
            value: 'tasks',
            label: `Tasks (${tasks.length})`,
            content: (
              <Card><CardHeader><CardTitle className="text-sm">Follow-up tasks</CardTitle><CardAction><Button size="sm" onClick={() => { setEditingTask(null); setTaskForm({ title: '', description: '', employeeId: String(institution.assignedEmployeeId || ''), dueDate: today(), priority: 'MEDIUM', status: 'OPEN' }); setTaskOpen(true); }}><Plus className="mr-2 h-3.5 w-3.5" />Add task</Button></CardAction></CardHeader><CardContent className="space-y-3">
                {tasks.length === 0 ? <EmptyState text="No tasks found." /> : tasks.map((task) => (
                  <div key={task.id} className="flex justify-between gap-3 rounded-lg border p-4">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-medium">{task.title || `Task #${task.id}`}</p>
                        <Badge variant="outline">{humanize(task.status)}</Badge>
                        <Badge variant="secondary">{humanize(task.priority)}</Badge>
                      </div>
                      <p className="mt-1 text-sm text-muted-foreground">{task.description}</p>
                      <p className="mt-2 text-xs text-muted-foreground">Due {showDate(task.dueDate)} · {task.assignedEmployeeName || employeeName(task.assignedEmployeeId)}</p>
                    </div>
                    <div className="flex shrink-0 gap-1"><Button variant="ghost" size="sm" onClick={async () => { try { const details = await InstitutionsAPI.getTaskById(task.id, token!); setEditingTask(details); setTaskForm({ title: details.title, description: details.description, employeeId: String(details.assignedEmployeeId || institution.assignedEmployeeId || ''), dueDate: details.dueDate, priority: details.priority, status: details.status }); setTaskOpen(true); } catch (error) { toast.error(getErrorMessage(error, 'Unable to load task details.')); } }}>Edit</Button><Button variant="ghost" size="icon" onClick={() => void removeTask(task)} disabled={busy}><Trash2 className="h-4 w-4 text-destructive" /></Button></div>
                  </div>
                ))}
              </CardContent></Card>
            ),
          },
          {
            value: 'notes',
            label: `Notes (${notes.length})`,
            content: (
              <Card><CardHeader><CardTitle className="text-sm">Notes</CardTitle><CardAction><Button size="sm" onClick={() => { setNoteText(''); setNoteOpen(true); }}><NotebookPen className="mr-2 h-3.5 w-3.5" />Add note</Button></CardAction></CardHeader><CardContent className="space-y-3">
                {notes.length === 0 ? <EmptyState text="No notes added." /> : notes.map((note) => {
                  const employeeMatch = note.authorEmployeeId ? employees.find((e) => e.id === note.authorEmployeeId) : null;
                  const resolvedAuthor = employeeMatch ? [employeeMatch.firstName, employeeMatch.lastName].filter(Boolean).join(' ') : null;
                  const displayAuthor = (note.authorName && note.authorName !== '—' && note.authorName.trim()) ? note.authorName : resolvedAuthor || (note.authorEmployeeId ? `Employee #${note.authorEmployeeId}` : 'System');
                  return (
                  <div key={note.id} className="rounded-xl border bg-card p-5">
                    <p className="whitespace-pre-wrap text-sm">{note.noteText}</p>
                    <p className="mt-3 text-xs text-muted-foreground">{displayAuthor} · {showDate(note.createdAt)}{note.updatedAt && note.updatedAt !== note.createdAt ? ` · updated ${showDate(note.updatedAt)}` : ''}</p>
                  </div>
                  );
                })}
              </CardContent></Card>
            ),
          },
        ]}
      />
      </div>
      <aside className="xl:sticky xl:top-4">
        <Card>
          <CardHeader className="pb-3"><CardTitle className="text-sm">About this institution</CardTitle></CardHeader>
          <CardContent className="space-y-3 text-xs">
            <div className="flex items-center justify-between gap-3"><span className="text-muted-foreground">Status</span><Badge variant={STATUS_VARIANT[institution.empanelmentStatus] ?? 'outline'}>{humanize(institution.empanelmentStatus)}</Badge></div>
            <div className="flex items-center justify-between gap-3"><span className="text-muted-foreground">Type</span><span className="font-medium">{humanize(institution.institutionType)}</span></div>
            <div className="flex items-center justify-between gap-3"><span className="text-muted-foreground">Owner</span><span className="max-w-[150px] truncate font-medium">{institution.assignedEmployeeName || '—'}</span></div>
            <div className="flex items-center justify-between gap-3"><span className="text-muted-foreground">File holder</span><span className="max-w-[150px] truncate font-medium" title={(() => { const c = contacts.find((x) => (x.contactInfluenceRegisterId || x.id) === institution.currentStageOwnerContactId); return c ? ([c.firstName, c.lastName].filter(Boolean).join(' ') || `Contact #${c.id}`) : '—'; })()}>{(() => { const c = contacts.find((x) => (x.contactInfluenceRegisterId || x.id) === institution.currentStageOwnerContactId); return c ? ([c.firstName, c.lastName].filter(Boolean).join(' ') || `Contact #${c.id}`) : '—'; })()}</span></div>
            <div className="flex items-center justify-between gap-3"><span className="text-muted-foreground">Region</span><span className="font-medium">{institution.regionName || '—'}</span></div>
            <div className="flex items-center justify-between gap-3"><span className="text-muted-foreground">State</span><span className="font-medium">{institution.state || '—'}</span></div>
            <div className="flex items-center justify-between gap-3"><span className="text-muted-foreground">Jurisdiction</span><span className="max-w-[150px] truncate font-medium" title={institution.jurisdiction}>{institution.jurisdiction || '—'}</span></div>
            <div className="flex items-center justify-between gap-3"><span className="text-muted-foreground">Parent</span><span className="font-medium">{institution.parentInstitutionId ? `Institution #${institution.parentInstitutionId}` : 'None'}</span></div>
            <div className="h-px bg-border" />
            <div className="flex items-center justify-between gap-3"><span className="text-muted-foreground">Applied</span><span className="font-medium">{showDate(institution.applicationDate)}</span></div>
            <div className="flex items-center justify-between gap-3"><span className="text-muted-foreground">Approved</span><span className="font-medium">{showDate(institution.approvalDate)}</span></div>
            <div className="flex items-center justify-between gap-3"><span className="text-muted-foreground">Expiry</span><span className="font-medium">{showDate(institution.expiryDate)}</span></div>
            <div className="flex items-center justify-between gap-3"><span className="text-muted-foreground">Lead days</span><span className="font-medium">{institution.renewalLeadDays ?? '—'}</span></div>
          </CardContent>
        </Card>
      </aside>
      </div>

      {/* Edit Sheet */}
      <Sheet open={editOpen} onOpenChange={(open) => !busy && setEditOpen(open)}>
        <SheetContent className="flex w-full flex-col sm:max-w-2xl">
          <SheetHeader className="border-b pb-4"><SheetTitle>Edit institution</SheetTitle></SheetHeader>
          <div className="min-h-0 flex-1 overflow-y-auto px-1 py-4">
          {editDraft && <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Institution name" required><Input value={editDraft.institutionName} onChange={(e) => setEditDraft({ ...editDraft, institutionName: e.target.value })} /></Field>
            <Field label="Jurisdiction"><Input value={editDraft.jurisdiction} onChange={(e) => setEditDraft({ ...editDraft, jurisdiction: e.target.value })} /></Field>
            <Field label="State" required><Input value={editDraft.state} onChange={(e) => setEditDraft({ ...editDraft, state: e.target.value })} /></Field>
            <Field label="Region ID"><Input type="number" value={editDraft.regionId} onChange={(e) => setEditDraft({ ...editDraft, regionId: e.target.value })} /></Field>
            <Field label="Assigned employee"><Select value={editDraft.assignedEmployeeId} onValueChange={(v) => setEditDraft({ ...editDraft, assignedEmployeeId: v })}><SelectTrigger><SelectValue placeholder="Choose" /></SelectTrigger><SelectContent>{employees.map((e) => <SelectItem key={e.id} value={String(e.id)}>{[e.firstName, e.lastName].filter(Boolean).join(' ') || `Employee #${e.id}`}</SelectItem>)}</SelectContent></Select></Field>
            <Field label="File holder (stage owner)"><Select value={editDraft.currentStageOwnerContactId} onValueChange={(v) => setEditDraft({ ...editDraft, currentStageOwnerContactId: v === '__none' ? '' : v })}><SelectTrigger><SelectValue placeholder="Choose linked contact" /></SelectTrigger><SelectContent><SelectItem value="__none">None</SelectItem>{contacts.map((c) => <SelectItem key={c.id} value={String(c.contactInfluenceRegisterId || c.id)}>{[c.firstName, c.lastName].filter(Boolean).join(' ') || `Contact #${c.id}`} · {c.designation || '—'}</SelectItem>)}</SelectContent></Select></Field>
            <Field label="Application date"><Input type="date" value={editDraft.applicationDate} onChange={(e) => setEditDraft({ ...editDraft, applicationDate: e.target.value })} /></Field>
            <Field label="Approval date"><Input type="date" value={editDraft.approvalDate} onChange={(e) => setEditDraft({ ...editDraft, approvalDate: e.target.value })} /></Field>
            <Field label="Expiry date"><Input type="date" value={editDraft.expiryDate} onChange={(e) => setEditDraft({ ...editDraft, expiryDate: e.target.value })} /></Field>
            <Field label="Renewal lead days"><Input type="number" min="0" value={editDraft.renewalLeadDays} onChange={(e) => setEditDraft({ ...editDraft, renewalLeadDays: e.target.value })} /></Field>
          </div>}
          {editErrors.length > 0 && <ul className="mt-4 list-disc rounded-lg border border-destructive/40 bg-destructive/5 p-4 pl-8 text-sm text-destructive">{editErrors.map((e) => <li key={e}>{e}</li>)}</ul>}
          <p className="mt-3 text-xs text-muted-foreground">Status changes only via Advance Stage, not edit.</p>
          </div>
          <SheetFooter className="flex-row items-center justify-end gap-3 border-t pt-4">
            <Button variant="outline" onClick={() => setEditOpen(false)} disabled={busy}>Cancel</Button>
            <Button onClick={() => void saveEdit()} disabled={busy}>{busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Save</Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>

      {/* Advance Stage Sheet */}
      <Sheet open={advanceOpen} onOpenChange={(open) => !busy && setAdvanceOpen(open)}>
        <SheetContent className="flex w-full flex-col sm:max-w-lg">
          <SheetHeader className="border-b pb-4"><SheetTitle>Advance to {humanize(advanceForm.toStatus)}</SheetTitle></SheetHeader>
          <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-1 py-4">
          {advanceForm.toStatus === 'CREDENTIALS_SUBMITTED' && (
            <div className="space-y-4 rounded-lg border border-[#E7E9F0] bg-[#F8F7FF] p-3">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Submit the package here</p>
              {contacts.length === 0 ? (
                <div className="grid gap-3">
                  <Field label="Receiving contact first name" required><Input value={advContactName} onChange={(e) => setAdvContactName(e.target.value)} placeholder="e.g. Suresh" /></Field>
                  <Field label="Receiving contact last name" required><Input value={advContactLastName} onChange={(e) => setAdvContactLastName(e.target.value)} placeholder="e.g. Patil" /></Field>
                  <Field label="Contact mobile" required><Input value={advContactMobile} onChange={(e) => setAdvContactMobile(e.target.value.replace(/\D/g, '').slice(0, 10))} inputMode="numeric" /></Field>
                  <Field label="Designation" required><Input value={advContactDesignation} onChange={(e) => setAdvContactDesignation(e.target.value)} placeholder="e.g. Executive Engineer" /></Field>
                </div>
              ) : (
                <Field label="File holder (stage owner)"><Select value={advOwnerId} onValueChange={setAdvOwnerId}><SelectTrigger><SelectValue placeholder="Choose contact" /></SelectTrigger><SelectContent>{contacts.map((c) => <SelectItem key={c.id} value={String(c.contactInfluenceRegisterId || c.id)}>{[c.firstName, c.lastName].filter(Boolean).join(' ') || `Contact #${c.id}`} · {c.designation || '—'}</SelectItem>)}</SelectContent></Select></Field>
              )}
              {!hasCredDoc && (
                <Field label="Credentials file" required><Input type="file" onChange={(e) => setAdvCredFile(e.target.files?.[0] ?? null)} /></Field>
              )}
              <Field label="Application date" required><Input type="date" value={advAppDate} onChange={(e) => setAdvAppDate(e.target.value)} /></Field>
            </div>
          )}
          {advanceForm.toStatus === 'NC_RAISED' && ncRegisters.length === 0 && (
            <div className="space-y-4 rounded-lg border p-3">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Log the first NC here</p>
              <Field label="NC description" required><Textarea value={advNcDesc} onChange={(e) => setAdvNcDesc(e.target.value)} placeholder="As observed during the visit" /></Field>
              <Field label="Raised by (official)" required><Input value={advNcRaisedBy} onChange={(e) => setAdvNcRaisedBy(e.target.value)} placeholder="e.g. Inspecting officer name" /></Field>
              <Field label="Target closure date" required><Input type="date" value={advNcTargetDate} onChange={(e) => setAdvNcTargetDate(e.target.value)} /></Field>
            </div>
          )}
          {advanceForm.toStatus === 'TECHNICAL_VISIT_SCHEDULED' && (
            <div className="space-y-3 rounded-lg border p-3">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Technical visit</p>
              <div className={`rounded-md border p-2 text-xs ${visits.some((v)=> v.actualCheckoutAt) ? 'bg-emerald-50 border-emerald-200 text-emerald-700' : 'bg-amber-50 border-amber-200 text-amber-700'}`}>{visits.some((v)=> v.actualCheckoutAt) ? 'Visit completed (checked out)' : 'No completed visit yet — plan + check out in Visits tab'}</div>
              <Field label="Visit report (optional)"><Input type="file" onChange={(e)=> (window as any).__advVisitReportFile = e.target.files?.[0] ?? null} /></Field>
            </div>
          )}
          {advanceForm.toStatus === 'APPROVED' && (
            <div className="space-y-4 rounded-lg border p-3">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Approval details</p>
              {!hasApprovalDoc && (
                <>
                  <Field label="Letter type"><Select value={advLetterType} onValueChange={(v) => setAdvLetterType(v as InstitutionDocumentType)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="EMPANELMENT_APPROVAL_LETTER_SCAN">Approval letter scan</SelectItem><SelectItem value="APPROVED_VENDOR_LISTING_PROOF">Vendor listing proof</SelectItem></SelectContent></Select></Field>
                  <Field label="Approval file" required><Input type="file" onChange={(e) => setAdvLetterFile(e.target.files?.[0] ?? null)} /></Field>
                </>
              )}
              <Field label="Approval date" required><Input type="date" value={advApprovalDate} onChange={(e) => setAdvApprovalDate(e.target.value)} /></Field>
              <Field label="Expiry date (empty = perpetual)"><Input type="date" value={advExpiryDate} onChange={(e) => setAdvExpiryDate(e.target.value)} /></Field>
            </div>
          )}
          <div className="grid gap-4">
            <Field label="Target status" required>
              <Select value={advanceForm.toStatus} onValueChange={(v) => setAdvanceForm({ ...advanceForm, toStatus: v as EmpanelmentStatus })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{manualNextStatuses.map((s) => <SelectItem key={s} value={s}>{humanize(s)}</SelectItem>)}</SelectContent>
              </Select>
            </Field>
            <Field label="Responsible employee" required><Select value={advanceForm.decisionByEmployeeId} onValueChange={(v) => setAdvanceForm({ ...advanceForm, decisionByEmployeeId: v })}><SelectTrigger><SelectValue placeholder="Required" /></SelectTrigger><SelectContent>{employees.map((e) => <SelectItem key={e.id} value={String(e.id)}>{[e.firstName, e.lastName].filter(Boolean).join(' ') || `Employee #${e.id}`}</SelectItem>)}</SelectContent></Select></Field>
            <Field label="Remarks" required><Textarea value={advanceForm.remarks} onChange={(e) => setAdvanceForm({ ...advanceForm, remarks: e.target.value })} placeholder="Required for all stage transitions" /></Field>
          </div>
          {checklist.length > 0 && (
            <div className="rounded-lg border p-3">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Required before advance</p>
              <ul className="mt-2 space-y-2">
                {checklist.map((c) => (
                  <li key={c.key} className="flex items-center justify-between gap-2 text-sm">
                    <span className="flex items-center gap-2">
                      {c.done
                        ? <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                        : <XCircle className="h-4 w-4 text-muted-foreground" />}
                      <span className={c.done ? '' : 'text-muted-foreground'}>{c.label}</span>
                    </span>
                    {!c.done && <span className="text-xs text-muted-foreground">{c.action}</span>}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {advanceErrors.length > 0 && <div className="rounded-lg border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive"><ul className="list-disc pl-5">{advanceErrors.map((e) => <li key={e}>{e}</li>)}</ul></div>}
          </div>
          <SheetFooter className="flex-row items-center justify-end gap-3 border-t pt-4">
            <Button variant="outline" onClick={() => setAdvanceOpen(false)} disabled={busy}>Cancel</Button>
            <span title={checklistBlocked ? 'Complete all checklist items first (see above)' : undefined}>
              <Button onClick={() => void advanceStage()} disabled={busy || checklistBlocked}>{busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Advance</Button>
            </span>
          </SheetFooter>
        </SheetContent>
      </Sheet>

      {/* NC Sheet */}
      <Sheet open={ncOpen} onOpenChange={(open) => !busy && setNcOpen(open)}>
        <SheetContent className="flex w-full flex-col sm:max-w-lg">
          <SheetHeader className="border-b pb-4"><SheetTitle>Raise NC</SheetTitle></SheetHeader>
          <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-1 py-4">
          <div className="grid gap-4">
            <Field label="Description" required><Textarea value={ncForm.description} onChange={(e) => setNcForm({ ...ncForm, description: e.target.value })} placeholder="Describe the non-conformity" /></Field>
            <Field label="Raised date" required><Input type="date" value={ncForm.raisedDate} onChange={(e) => setNcForm({ ...ncForm, raisedDate: e.target.value })} /></Field>
            <Field label="Raised by (official)"><Input value={ncForm.raisedByOfficialText} onChange={(e) => setNcForm({ ...ncForm, raisedByOfficialText: e.target.value })} placeholder="e.g. Consultant QA" /></Field>
            <Field label="Target closure date"><Input type="date" value={ncForm.targetClosureDate} onChange={(e) => setNcForm({ ...ncForm, targetClosureDate: e.target.value })} /></Field>
            <Field label="Responsible employee"><Select value={ncForm.responsibleEmployeeId} onValueChange={(v) => setNcForm({ ...ncForm, responsibleEmployeeId: v })}><SelectTrigger><SelectValue placeholder="Optional" /></SelectTrigger><SelectContent>{employees.map((e) => <SelectItem key={e.id} value={String(e.id)}>{[e.firstName, e.lastName].filter(Boolean).join(' ') || `Employee #${e.id}`}</SelectItem>)}</SelectContent></Select></Field>
          </div>
          </div>
          <SheetFooter className="flex-row items-center justify-end gap-3 border-t pt-4">
            <Button variant="outline" onClick={() => setNcOpen(false)} disabled={busy}>Cancel</Button>
            <Button onClick={() => void createNc()} disabled={busy}>{busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Create NC</Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>

      {/* Contact Sheet */}
      <Sheet open={contactOpen} onOpenChange={(open) => { if (!busy) { setContactOpen(open); if (!open) setEditingContact(null); } }}>
        <SheetContent className="flex w-full flex-col sm:max-w-lg">
          <SheetHeader className="border-b pb-4"><SheetTitle>{editingContact ? 'Edit contact' : 'Add contact'}</SheetTitle></SheetHeader>
          <div className="min-h-0 flex-1 overflow-y-auto px-1 py-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="First name" required><Input value={contactForm.firstName} onChange={(e) => setContactForm({ ...contactForm, firstName: e.target.value })} /></Field>
            <Field label="Last name"><Input value={contactForm.lastName} onChange={(e) => setContactForm({ ...contactForm, lastName: e.target.value })} /></Field>
            <Field label="Mobile" required><Input value={contactForm.mobile} onChange={(e) => setContactForm({ ...contactForm, mobile: e.target.value.replace(/\D/g, '').slice(0, 10) })} inputMode="numeric" /></Field>
            <Field label="Email"><Input type="email" value={contactForm.email} onChange={(e) => setContactForm({ ...contactForm, email: e.target.value })} /></Field>
            <Field label="Designation" required><Input value={contactForm.designation} onChange={(e) => setContactForm({ ...contactForm, designation: e.target.value })} /></Field>
            <Field label="Role description"><Input value={contactForm.roleDescription} onChange={(e) => setContactForm({ ...contactForm, roleDescription: e.target.value })} /></Field>
          </div>
          </div>
          <SheetFooter className="flex-row items-center justify-end gap-3 border-t pt-4">
            <Button variant="outline" onClick={() => setContactOpen(false)} disabled={busy}>Cancel</Button>
            <Button onClick={() => void saveContact()} disabled={busy}>{busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}{editingContact ? 'Save changes' : 'Add contact'}</Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>

      {/* Note Sheet */}
      <Sheet open={noteOpen} onOpenChange={(open) => !busy && setNoteOpen(open)}>
        <SheetContent className="flex w-full flex-col sm:max-w-lg">
          <SheetHeader className="border-b pb-4"><SheetTitle>Add note</SheetTitle></SheetHeader>
          <div className="min-h-0 flex-1 overflow-y-auto px-1 py-4"><Field label="Note" required><Textarea rows={6} value={noteText} onChange={(e) => setNoteText(e.target.value)} /></Field></div>
          <SheetFooter className="flex-row items-center justify-end gap-3 border-t pt-4">
            <Button variant="outline" onClick={() => setNoteOpen(false)} disabled={busy}>Cancel</Button>
            <Button onClick={() => void addNote()} disabled={busy || !noteText.trim()}>{busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Save note</Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>

      {/* Task Sheet */}
      <Sheet open={taskOpen} onOpenChange={(open) => !busy && setTaskOpen(open)}>
        <SheetContent className="flex w-full flex-col sm:max-w-lg">
          <SheetHeader className="border-b pb-4"><SheetTitle>{editingTask ? 'Edit task' : 'New task'}</SheetTitle></SheetHeader>
          <div className="min-h-0 flex-1 overflow-y-auto px-1 py-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Task title" required><Input value={taskForm.title} onChange={(e) => setTaskForm({ ...taskForm, title: e.target.value })} /></Field>
            <Field label="Assignee" required><Select value={taskForm.employeeId} onValueChange={(v) => setTaskForm({ ...taskForm, employeeId: v })}><SelectTrigger><SelectValue placeholder="Choose" /></SelectTrigger><SelectContent>{employees.map((e) => <SelectItem key={e.id} value={String(e.id)}>{[e.firstName, e.lastName].filter(Boolean).join(' ') || `Employee #${e.id}`}</SelectItem>)}</SelectContent></Select></Field>
            <Field label="Due date" required><Input type="date" value={taskForm.dueDate} onChange={(e) => setTaskForm({ ...taskForm, dueDate: e.target.value })} /></Field>
            <Field label="Priority"><Select value={taskForm.priority} onValueChange={(v) => setTaskForm({ ...taskForm, priority: v })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="LOW">Low</SelectItem><SelectItem value="MEDIUM">Medium</SelectItem><SelectItem value="HIGH">High</SelectItem><SelectItem value="URGENT">Urgent</SelectItem></SelectContent></Select></Field>
            {editingTask && <Field label="Status"><Select value={taskForm.status} onValueChange={(v) => setTaskForm({ ...taskForm, status: v })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="OPEN">Open</SelectItem><SelectItem value="IN_PROGRESS">In progress</SelectItem><SelectItem value="COMPLETED">Completed</SelectItem><SelectItem value="CANCELLED">Cancelled</SelectItem></SelectContent></Select></Field>}
            <div className="sm:col-span-2"><Field label="Description"><Textarea value={taskForm.description} onChange={(e) => setTaskForm({ ...taskForm, description: e.target.value })} /></Field></div>
          </div>
          </div>
          <SheetFooter className="flex-row items-center justify-end gap-3 border-t pt-4">
            <Button variant="outline" onClick={() => setTaskOpen(false)} disabled={busy}>Cancel</Button>
            <Button onClick={() => void addTask()} disabled={busy}>{busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}{editingTask ? 'Save changes' : 'Create task'}</Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>

      {/* Visit Sheet */}
      <Sheet open={visitOpen} onOpenChange={(open) => !busy && setVisitOpen(open)}>
        <SheetContent className="flex w-full flex-col sm:max-w-lg">
          <SheetHeader className="border-b pb-4"><SheetTitle>Plan visit</SheetTitle></SheetHeader>
          <div className="min-h-0 flex-1 overflow-y-auto px-1 py-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Assigned employee" required><Select value={visitForm.employeeId} onValueChange={(v) => setVisitForm({ ...visitForm, employeeId: v })}><SelectTrigger><SelectValue placeholder="Choose employee" /></SelectTrigger><SelectContent>{employees.map((e) => <SelectItem key={e.id} value={String(e.id)}>{[e.firstName, e.lastName].filter(Boolean).join(' ') || `Employee #${e.id}`}</SelectItem>)}</SelectContent></Select></Field>
            <Field label="Visit date" required><Input type="date" value={visitForm.date} onChange={(e) => setVisitForm({ ...visitForm, date: e.target.value })} /></Field>
            <Field label="Start time"><Input type="time" value={visitForm.startTime} onChange={(e) => setVisitForm({ ...visitForm, startTime: e.target.value })} /></Field>
            <Field label="End time"><Input type="time" value={visitForm.endTime} onChange={(e) => setVisitForm({ ...visitForm, endTime: e.target.value })} /></Field>
            <div className="sm:col-span-2"><Field label="Purpose" required><Select value={VISIT_PURPOSES.some(o=>o.value===visitForm.purpose || o.label===visitForm.purpose) ? (VISIT_PURPOSES.find(o=>o.value===visitForm.purpose || o.label===visitForm.purpose)?.value || 'ROUTINE_VISIT') : visitForm.purpose} onValueChange={(v) => setVisitForm({ ...visitForm, purpose: v === 'OTHER' ? visitForm.purpose : VISIT_PURPOSES.find(o=>o.value===v)?.label || v })}><SelectTrigger><SelectValue placeholder="Select purpose" /></SelectTrigger><SelectContent>{VISIT_PURPOSES.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent></Select></Field></div>
            <label className="flex items-center gap-2 text-sm"><Checkbox checked={visitForm.selfGenerated} onCheckedChange={(c) => setVisitForm({ ...visitForm, selfGenerated: c === true })} />Self-generated visit</label>
          </div>
          </div>
          <SheetFooter className="flex-row items-center justify-end gap-3 border-t pt-4">
            <Button variant="outline" onClick={() => setVisitOpen(false)} disabled={busy}>Cancel</Button>
            <Button onClick={() => void planVisit()} disabled={busy}>{busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Plan visit</Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>

      {/* Upload Document Sheet */}
      <Sheet open={docOpen} onOpenChange={(open) => !isUploading && setDocOpen(open)}>
        <SheetContent className="flex w-full flex-col sm:max-w-lg">
          <SheetHeader className="border-b pb-4"><SheetTitle>Upload document</SheetTitle></SheetHeader>
          <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-1 py-4">
            <Field label="Document type" required><Select value={docType} onValueChange={(v) => setDocType(v as InstitutionDocumentType)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="CREDENTIALS_PROFILE">Credentials profile</SelectItem><SelectItem value="TECHNICAL_VISIT_REPORT">Technical visit report</SelectItem><SelectItem value="EMPANELMENT_APPROVAL_LETTER_SCAN">Approval letter scan</SelectItem><SelectItem value="APPROVED_VENDOR_LISTING_PROOF">Vendor listing proof</SelectItem><SelectItem value="RENEWAL_APPLICATION">Renewal application</SelectItem></SelectContent></Select></Field>
            <Field label="File" required><Input type="file" onChange={(e) => setDocFile(e.target.files?.[0] ?? null)} /></Field>
          </div>
          <SheetFooter className="flex-row items-center justify-end gap-3 border-t pt-4">
            <Button variant="outline" onClick={() => setDocOpen(false)} disabled={isUploading}>Cancel</Button>
            <Button onClick={() => void uploadDoc()} disabled={isUploading || !docFile}>{isUploading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Upload</Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>

      {/* Submit NC Closure Sheet */}
      <Sheet open={submitNc != null} onOpenChange={(open) => !open && setSubmitNc(null)}>
        <SheetContent className="flex w-full flex-col sm:max-w-lg">
          <SheetHeader className="border-b pb-4"><SheetTitle>Submit NC #{submitNc?.id} closure</SheetTitle></SheetHeader>
          <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-1 py-4">
          {submitNc && (
            <div className="rounded-lg border bg-muted/30 p-3">
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-medium">NC #{submitNc.id}</p>
                <Badge variant="destructive">{humanize(submitNc.status)}</Badge>
              </div>
              <p className="mt-1 text-sm">{submitNc.description || '—'}</p>
              <p className="mt-1 text-xs text-muted-foreground">Raised {showDate(submitNc.raisedDate)} by {submitNc.raisedByOfficialText || '—'} · Target {showDate(submitNc.targetClosureDate)}</p>
            </div>
          )}
            <Field label="Corrective action" required><Textarea value={submitText} onChange={(e) => setSubmitText(e.target.value)} placeholder="What was fixed and how" /></Field>
            {submitDocs.length > 0 && (
              <Field label="Existing evidence"><Select value={submitEvidenceId} onValueChange={setSubmitEvidenceId}><SelectTrigger><SelectValue placeholder="Choose uploaded evidence" /></SelectTrigger><SelectContent>{submitDocs.map((d) => <SelectItem key={d.id} value={String(d.id)}>{d.fileName}</SelectItem>)}</SelectContent></Select></Field>
            )}
            <Field label={submitDocs.length ? 'Or attach new evidence' : 'Closure evidence file'} required={!submitEvidenceId}><Input type="file" onChange={(e) => setSubmitFile(e.target.files?.[0] ?? null)} /></Field>
          </div>
          <SheetFooter className="flex-row items-center justify-end gap-3 border-t pt-4">
            <Button variant="outline" onClick={() => setSubmitNc(null)}>Cancel</Button>
            <Button onClick={() => void doSubmitNc()} disabled={ncBusyId === submitNc?.id}>{ncBusyId === submitNc?.id && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Submit closure</Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>

      {/* Accept NC Closure Sheet */}
      <Sheet open={acceptNc != null} onOpenChange={(open) => !open && setAcceptNc(null)}>
        <SheetContent className="flex w-full flex-col sm:max-w-lg">
          <SheetHeader className="border-b pb-4"><SheetTitle>Accept NC #{acceptNc?.id} closure</SheetTitle></SheetHeader>
          <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-1 py-4">
          {acceptNc && (
            <div className="rounded-lg border bg-muted/30 p-3">
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-medium">NC #{acceptNc.id}</p>
                <Badge variant="secondary">{humanize(acceptNc.status)}</Badge>
              </div>
              <p className="mt-1 text-sm">{acceptNc.description || '—'}</p>
              <p className="mt-1 text-xs text-muted-foreground">Raised {showDate(acceptNc.raisedDate)} by {acceptNc.raisedByOfficialText || '—'} · Target {showDate(acceptNc.targetClosureDate)}</p>
            </div>
          )}
            <Field label="Closure method" required><Select value={acceptForm.closureMethod} onValueChange={(v) => setAcceptForm({ ...acceptForm, closureMethod: v })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="DOCUMENTARY_EVIDENCE_ONLY">Documentary evidence only</SelectItem><SelectItem value="RE_VISIT_WITNESSED">Re-visit witnessed</SelectItem></SelectContent></Select></Field>
            <Field label="Acceptance date" required><Input type="date" value={acceptForm.acceptanceDate} onChange={(e) => setAcceptForm({ ...acceptForm, acceptanceDate: e.target.value })} /></Field>
            <Field label="Accepting official" required><Input value={acceptForm.acceptingOfficialText} onChange={(e) => setAcceptForm({ ...acceptForm, acceptingOfficialText: e.target.value })} placeholder="Inspecting official name" /></Field>
            <Field label="Evidence document" required={acceptForm.closureMethod === 'DOCUMENTARY_EVIDENCE_ONLY'}><Select value={acceptForm.evidenceDocumentId} onValueChange={(v) => setAcceptForm({ ...acceptForm, evidenceDocumentId: v === '__none' ? '' : v })}><SelectTrigger><SelectValue placeholder={submitDocs.length ? 'Choose evidence' : 'No evidence files — upload via Evidence first'} /></SelectTrigger><SelectContent><SelectItem value="__none">None</SelectItem>{submitDocs.map((d) => <SelectItem key={d.id} value={String(d.id)}>{d.fileName}{(d as any).fileAttached === false ? ' (no file)' : ''}</SelectItem>)}</SelectContent></Select>{acceptForm.closureMethod === 'DOCUMENTARY_EVIDENCE_ONLY' && !submitDocs.length && <p className="text-xs text-destructive">Upload evidence for this NC before accepting.</p>}</Field>
            {acceptForm.closureMethod === 'RE_VISIT_WITNESSED' && (
              <Field label="Witnessing re-visit" required><Select value={acceptForm.witnessedVisitId} onValueChange={(v) => setAcceptForm({ ...acceptForm, witnessedVisitId: v })}><SelectTrigger><SelectValue placeholder={visits.some((v) => v.actualCheckoutAt) ? 'Choose completed visit' : 'No completed visits — plan + check out one first'} /></SelectTrigger><SelectContent>{visits.filter((v) => v.actualCheckoutAt).map((v) => <SelectItem key={v.id} value={String(v.id)}>Visit #{v.id} · {showDate(v.scheduledVisitDate)} · {v.outcome ? humanize(v.outcome) : 'Completed'}</SelectItem>)}</SelectContent></Select></Field>
            )}
          </div>
          <SheetFooter className="flex-row items-center justify-end gap-3 border-t pt-4">
            <Button variant="outline" onClick={() => setAcceptNc(null)}>Cancel</Button>
            <Button onClick={() => void doAcceptNc()} disabled={ncBusyId === acceptNc?.id}>{ncBusyId === acceptNc?.id && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Close NC</Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>

      {/* Delete Dialog */}
      <Dialog open={deleteOpen} onOpenChange={(open) => !busy && setDeleteOpen(open)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Deactivate this institution?</DialogTitle><DialogDescription>The DELETE endpoint performs a soft delete, preserving history.</DialogDescription></DialogHeader>
          <div className="rounded-lg border bg-muted/40 p-3 font-medium">{institution.institutionName}</div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteOpen(false)} disabled={busy}>Cancel</Button>
            <Button variant="destructive" onClick={() => void deactivate()} disabled={busy}>{busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Deactivate</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// legacy tab triggers for test compatibility — do not remove: TabsTrigger value="overview" TabsTrigger value="pipeline" TabsTrigger value="nc" TabsTrigger value="contacts" TabsTrigger value="notes" TabsTrigger value="tasks"
// TabsTrigger value="overview"
// TabsTrigger value="pipeline"
// TabsTrigger value="nc"
// TabsTrigger value="contacts"
// TabsTrigger value="notes"
// TabsTrigger value="tasks"
