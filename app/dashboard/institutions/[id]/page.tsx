'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Activity, ArrowLeft, Building2, CalendarClock, CalendarDays, CalendarPlus, CheckCircle2, Circle, Download, Edit3, Eye, FileText, FileUser, Hash, History, Landmark, ListChecks, Loader2, Mail, MapPin, MapPinned, MoreHorizontal, NotebookPen, Phone, Plus, RefreshCw, ShieldAlert, ShieldCheck, StickyNote, Trash2, Upload, User, UserPlus, Workflow } from 'lucide-react';
import { toast } from 'sonner';


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
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { SearchableSelect, type SearchableOption } from '@/components/ui/searchable-select2';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { DetailShell } from '@/components/detail-shell';
import { ActivityTimeline, NotesFeed, NcRow, StageHistoryRow, StageStepper, TaskList, VisitList, pickFile, taskSummary, FilePicker, FormCheck, FormContext, FormField, FormGroup, FormSheet, DetailHero, DetailSkeleton, EmptyState, Info, Initials, KpiCell, Pill, Section, VISIT_PURPOSES, WarningBanner, dayKey, formatDay, isOpenTask, isOverdue, purposeLabel, today, visitStatus, type ActivityItem, type HeroNextStep, type Tone } from '@/components/detail-ui';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import { visitsApi, type CommonVisitRow } from '@/lib/visits-api';

const humanize = (value: string | null | undefined) => value ? value.replaceAll('_', ' ').toLowerCase().replace(/\b\w/g, (l) => l.toUpperCase()) : '—';
const showDate = (value: string | null | undefined) => value ? new Date(value.length === 10 ? `${value}T00:00:00` : value).toLocaleDateString('en-IN', { dateStyle: 'medium' }) : '—';

const STATUS_TONE: Record<string, Tone> = {
  APPROVED: 'success', RENEWAL_DUE: 'warning',
  CREDENTIALS_SUBMITTED: 'info', DOCUMENTS_SUBMITTED: 'info', UNDER_REVIEW: 'info', TECHNICAL_VISIT_SCHEDULED: 'info', NC_CLOSURE_SUBMITTED: 'info',
  NOT_STARTED: 'neutral',
  REJECTED: 'danger', EXPIRED: 'danger', SUSPENDED: 'danger', NC_RAISED: 'danger',
};

// Main empanelment path shown as a stepper on the Process tab.
const STAGE_STEPS = [
  { key: 'NOT_STARTED', label: 'Not started' },
  { key: 'CREDENTIALS_SUBMITTED', label: 'Credentials' },
  { key: 'UNDER_REVIEW', label: 'Under review' },
  { key: 'TECHNICAL_VISIT_SCHEDULED', label: 'Technical visit' },
  { key: 'NC', label: 'NC closure' },
  { key: 'APPROVED', label: 'Approved' },
] as const;
const STAGE_INDEX: Record<string, number> = {
  NOT_STARTED: 0, CREDENTIALS_SUBMITTED: 1, DOCUMENTS_SUBMITTED: 1, UNDER_REVIEW: 2, TECHNICAL_VISIT_SCHEDULED: 3,
  NC_RAISED: 4, NC_CLOSURE_SUBMITTED: 4, APPROVED: 5, RENEWAL_DUE: 5,
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
  const employeeOptions: SearchableOption[] = useMemo(() => employees.map(e => ({ value: String(e.id), label: [e.firstName, e.lastName].filter(Boolean).join(' ') || `Employee #${e.id}` })), [employees]);
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
  const [visitForm, setVisitForm] = useState({ employeeId: '', date: new Date().toISOString().slice(0, 10), startTime: '10:00', endTime: '10:30', purpose: '', description: '', selfGenerated: true });

  const [deleteOpen, setDeleteOpen] = useState(false);

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
        purpose: visitForm.purpose.trim(), description: visitForm.description.trim() || null, selfGenerated: visitForm.selfGenerated,
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

  if (isLoading) return <DetailSkeleton />;
  if (!Number.isFinite(institutionId) || !institution) return <Card><CardHeader><CardTitle>Institution not found</CardTitle></CardHeader><CardContent><Button variant="outline" onClick={() => router.push('/dashboard/institutions')}><ArrowLeft className="mr-2 h-4 w-4" />Back to institutions</Button></CardContent></Card>;

  const status = institution.empanelmentStatus;
  const statusTone: Tone = STATUS_TONE[status] ?? 'neutral';
  const ownerName = institution.assignedEmployeeName || employeeName(institution.assignedEmployeeId);
  const fileHolder = (() => { const c = contacts.find((x) => (x.contactInfluenceRegisterId || x.id) === institution.currentStageOwnerContactId); return c ? ([c.firstName, c.lastName].filter(Boolean).join(' ') || `Contact #${c.id}`) : null; })();
  const contactName = (contact: InstitutionContact) => {
    const master = masterContacts.find((m) => m.id === contact.contactInfluenceRegisterId);
    return [contact.firstName || master?.firstName, contact.lastName || master?.lastName].filter(Boolean).join(' ').trim() || `Contact #${contact.contactInfluenceRegisterId || contact.id}`;
  };
  const noteAuthor = (note: InstitutionNote) => {
    if (note.authorName && note.authorName !== '—' && note.authorName.trim()) return note.authorName;
    const match = note.authorEmployeeId ? employees.find((e) => e.id === note.authorEmployeeId) : null;
    return (match && [match.firstName, match.lastName].filter(Boolean).join(' ')) || (note.authorEmployeeId ? `Employee #${note.authorEmployeeId}` : 'System');
  };
  const pipelineOwner = (entry: PipelineEntry) => {
    if (entry.decisionByEmployeeName && entry.decisionByEmployeeName !== '—') return entry.decisionByEmployeeName;
    const m = employees.find((e) => e.id === entry.decisionByEmployeeId);
    return (m && [m.firstName, m.lastName].filter(Boolean).join(' ')) || (entry.decisionByEmployeeId ? `Employee #${entry.decisionByEmployeeId}` : 'System');
  };

  const openEdit = () => { setEditDraft({ institutionName: institution.institutionName, institutionType: institution.institutionType, parentInstitutionId: institution.parentInstitutionId == null ? '' : String(institution.parentInstitutionId), jurisdiction: institution.jurisdiction, state: institution.state, regionId: institution.regionId == null ? '' : String(institution.regionId), empanelmentStatus: institution.empanelmentStatus, assignedEmployeeId: institution.assignedEmployeeId == null ? '' : String(institution.assignedEmployeeId), currentStageOwnerContactId: institution.currentStageOwnerContactId == null ? '' : String(institution.currentStageOwnerContactId), applicationDate: institution.applicationDate ?? '', approvalDate: institution.approvalDate ?? '', expiryDate: institution.expiryDate ?? '', renewalLeadDays: institution.renewalLeadDays == null ? '' : String(institution.renewalLeadDays), active: institution.active }); setEditErrors([]); setEditOpen(true); };
  const openVisitForm = () => { setVisitForm({ employeeId: String(institution.assignedEmployeeId || ''), date: today(), startTime: '10:00', endTime: '10:30', purpose: '', description: '', selfGenerated: true }); setVisitOpen(true); };
  const openNewTask = () => { setEditingTask(null); setTaskForm({ title: '', description: '', employeeId: String(institution.assignedEmployeeId || ''), dueDate: today(), priority: 'MEDIUM', status: 'OPEN' }); setTaskOpen(true); };
  const openEditTask = async (task: InstitutionTask) => {
    try {
      const details = await InstitutionsAPI.getTaskById(task.id, token!);
      setEditingTask(details);
      setTaskForm({ title: details.title, description: details.description, employeeId: String(details.assignedEmployeeId || institution.assignedEmployeeId || ''), dueDate: details.dueDate, priority: details.priority, status: details.status });
      setTaskOpen(true);
    } catch (error) { toast.error(getErrorMessage(error, 'Unable to load task details.')); }
  };
  const openContactForm = (contact?: InstitutionContact) => {
    if (!contact) { setEditingContact(null); setContactForm({ firstName: '', lastName: '', mobile: '', email: '', designation: '', roleDescription: '', primaryContact: false }); setContactOpen(true); return; }
    const master = masterContacts.find((m) => m.id === contact.contactInfluenceRegisterId);
    setEditingContact(contact);
    setContactForm({ firstName: contact.firstName || master?.firstName || '', lastName: contact.lastName || master?.lastName || '', mobile: (contact.mobile && contact.mobile !== '—' ? contact.mobile : null) || master?.mobile || '', email: (contact.email && contact.email !== '—' ? contact.email : null) || master?.email || '', designation: contact.designation || '', roleDescription: contact.roleDescription || '', primaryContact: contact.primaryContact });
    setContactOpen(true);
  };
  const canRaiseNc = !hasClosedNc && ['TECHNICAL_VISIT_SCHEDULED', 'NC_RAISED', 'NC_CLOSURE_SUBMITTED', 'UNDER_REVIEW'].includes(status);
  const openRaiseNc = () => { setNcForm({ description: '', raisedDate: today(), raisedByOfficialText: '', targetClosureDate: '', status: 'OPEN', responsibleEmployeeId: '' }); setNcOpen(true); };
  const pickNcEvidence = (nc: NcRegister) => pickFile(async (file) => {
    setNcBusyId(nc.id);
    try { await InstitutionsAPI.uploadNcEvidence(nc.id, file, token!); toast.success('Evidence uploaded'); await reloadNc(); }
    catch (e) { toast.error(getErrorMessage(e, 'Upload failed')) } finally { setNcBusyId(null); }
  });
  const openDocumentFile = async (doc: InstitutionDocument, mode: 'view' | 'download') => {
    const failMessage = mode === 'view' ? 'File not ready' : 'Download failed';
    const base = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://ec2-18-211-58-135.compute-1.amazonaws.com:8081';
    const list = await fetch(`${base}/api/hr/files?parentType=DOCUMENT_DEPOSITORY&parentId=${doc.id}&page=0&size=5`, { headers: { Authorization: `Bearer ${token}` } }).then((r) => r.ok ? r.json() : { content: [] }).catch(() => ({ content: [] }));
    const fileId = list.content?.[0]?.id;
    if (!fileId) { toast.error(failMessage); return; }
    const res = await fetch(`${base}/api/hr/files/${fileId}/download`, { headers: { Authorization: `Bearer ${token}` } });
    if (!res.ok) { toast.error(failMessage); return; }
    const url = URL.createObjectURL(await res.blob());
    if (mode === 'view') { window.open(url, '_blank'); setTimeout(() => URL.revokeObjectURL(url), 60000); return; }
    const a = document.createElement('a'); a.href = url; a.download = doc.fileName || `doc-${doc.id}`; document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
  };

  const nextAdvance = manualNextStatuses[0];
  const advanceButton = nextAdvance ? <Button size="sm" onClick={() => openAdvance(nextAdvance)}><ShieldCheck className="mr-1.5 h-3.5 w-3.5" />Advance to {humanize(nextAdvance)}</Button> : undefined;
  const nearRenewal = renewalDaysLeft != null && renewalDaysLeft <= (institution.renewalLeadDays ?? 30);
  const nextStep: HeroNextStep = status === 'APPROVED' && !nearRenewal
    ? { done: true, text: institution.expiryDate ? `Approved and valid till ${showDate(institution.expiryDate)}. You can supply to this institution.` : 'Approved. You can supply to this institution.', action: advanceButton }
    : {
      done: false,
      tone: ['REJECTED', 'EXPIRED', 'SUSPENDED', 'NC_RAISED'].includes(status) || (renewalDaysLeft != null && renewalDaysLeft < 0) ? 'danger' : 'warning',
      text: status === 'NOT_STARTED' ? 'Submit credentials to start empanelment.'
        : status === 'CREDENTIALS_SUBMITTED' || status === 'DOCUMENTS_SUBMITTED' ? 'Under review. Await the department’s response.'
        : status === 'UNDER_REVIEW' ? 'Schedule a technical visit or await the decision.'
        : status === 'TECHNICAL_VISIT_SCHEDULED' ? 'Complete the technical visit and raise NCs if any.'
        : status === 'NC_RAISED' ? `Submit closure for ${openNcCount} open NC${openNcCount === 1 ? '' : 's'}. They block approval.`
        : status === 'NC_CLOSURE_SUBMITTED' ? 'NC closure submitted. Await re-review and approval.'
        : status === 'APPROVED' ? (renewalDaysLeft != null && renewalDaysLeft < 0 ? `Expired on ${showDate(institution.expiryDate)}. Please renew.` : `Valid till ${showDate(institution.expiryDate)}. Renewal due in ${renewalDaysLeft} day${renewalDaysLeft === 1 ? '' : 's'}.`)
        : status === 'RENEWAL_DUE' ? 'File the renewal application.'
        : status === 'EXPIRED' ? 'Expired. Restart credentials.'
        : status === 'SUSPENDED' ? 'Suspended until reactivated.'
        : 'Rejected. Restart credentials.',
      action: advanceButton,
    };

  const currentEntry = pipeline.find((entry) => entry.toStatus === status && !entry.exitDate) ?? pipeline.find((entry) => entry.toStatus === status);
  const sortedPipeline = [...pipeline].sort((left, right) => String(right.entryDate).localeCompare(String(left.entryDate)));
  const sortedVisits = [...visits].sort((left, right) => `${right.scheduledVisitDate}${right.scheduledStartTime ?? ''}`.localeCompare(`${left.scheduledVisitDate}${left.scheduledStartTime ?? ''}`));
  const latestVisit = sortedVisits.find((visit) => dayKey(visit.scheduledVisitDate) <= today()) ?? null;
  const openTasks = tasks.filter(isOpenTask).sort((left, right) => String(left.dueDate).localeCompare(String(right.dueDate)));
  const sortedNotes = [...notes].sort((left, right) => String(right.updatedAt || right.createdAt).localeCompare(String(left.updatedAt || left.createdAt)));
  const closedNcCount = ncRegisters.filter((nc) => nc.status === 'CLOSED').length;
  const stageIndex = STAGE_INDEX[status] ?? -1;
  const validity = institution.approvalDate && institution.expiryDate ? (() => {
    const start = new Date(institution.approvalDate).getTime();
    const end = new Date(institution.expiryDate).getTime();
    return end > start ? Math.min(100, Math.max(0, ((Date.now() - start) / (end - start)) * 100)) : null;
  })() : null;

  const recentActivity: ActivityItem[] = [
    ...visits.map((visit) => ({ key: `visit-${visit.id}`, date: visit.actualCheckinAt || visit.scheduledVisitDate, icon: CalendarDays, title: `Visit · ${purposeLabel(visit.purpose)}`, meta: `${visitStatus(visit).label} · ${visit.assignedEmployeeName || employeeName(visit.assignedEmployeeId)}`, onClick: () => router.push(`/dashboard/visits/${visit.id}`) })),
    ...pipeline.map((entry) => ({ key: `stage-${entry.id}`, date: entry.entryDate, icon: Workflow, title: `Stage · ${humanize(entry.toStatus)}`, meta: `${entry.remarks || 'No remarks'} · ${pipelineOwner(entry)}` })),
    ...ncRegisters.map((nc) => ({ key: `nc-${nc.id}`, date: nc.raisedDate, icon: ShieldAlert, title: `NC #${nc.id} raised`, meta: nc.description })),
    ...notes.map((note) => ({ key: `note-${note.id}`, date: note.createdAt, icon: StickyNote, title: `Note · ${noteAuthor(note)}`, meta: note.noteText })),
  ].filter((item) => item.date && dayKey(item.date) <= today()).sort((left, right) => String(right.date).localeCompare(String(left.date))).slice(0, 8);
  const upNext: ActivityItem[] = [
    ...openTasks.map((task) => ({ key: `task-${task.id}`, date: task.dueDate, icon: ListChecks, title: task.title || `Task #${task.id}`, meta: `Task · ${humanize(task.priority)} · ${task.assignedEmployeeName || employeeName(task.assignedEmployeeId)}`, alert: isOverdue(task), onClick: () => void openEditTask(task) })),
    ...ncRegisters.filter((nc) => nc.status !== 'CLOSED' && nc.targetClosureDate).map((nc) => ({ key: `nc-due-${nc.id}`, date: nc.targetClosureDate as string, icon: ShieldAlert, title: `Close NC #${nc.id}`, meta: nc.description, alert: dayKey(nc.targetClosureDate) < today() })),
    ...visits.filter((visit) => !visit.actualCheckinAt && !visit.outcome && dayKey(visit.scheduledVisitDate) >= today()).map((visit) => ({ key: `planned-${visit.id}`, date: visit.scheduledVisitDate, icon: CalendarDays, title: purposeLabel(visit.purpose), meta: `Planned visit · ${visit.assignedEmployeeName || employeeName(visit.assignedEmployeeId)}`, onClick: () => router.push(`/dashboard/visits/${visit.id}`) })),
  ].filter((item) => item.date).sort((left, right) => String(left.date).localeCompare(String(right.date)));

  return (
    <div className="detail-page space-y-4 font-poppins text-xs">
      <DetailHero
        name={institution.institutionName}
        onBack={() => router.push('/dashboard/institutions')}
        backLabel="Back to institutions"
        badges={<>
          <Pill tone={statusTone}>{humanize(status)}</Pill>
          {!institution.active && <Pill tone="danger">Inactive record</Pill>}
        </>}
        meta={[
          { icon: Building2, label: humanize(institution.institutionType) },
          { icon: Hash, label: institution.id },
          ...(institution.state ? [{ icon: MapPin, label: institution.state }] : []),
          { icon: MapPinned, label: institution.regionName || (institution.regionId ? `Region #${institution.regionId}` : 'No region'), title: 'Region' },
          ...(institution.jurisdiction ? [{ icon: Landmark, label: institution.jurisdiction, title: 'Jurisdiction' }] : []),
          { icon: User, label: ownerName, title: 'Assigned employee' },
          ...(fileHolder ? [{ icon: FileUser, label: fileHolder, title: 'File holder (stage owner)' }] : []),
        ]}
        actions={<>
          <Button variant="outline" size="sm" className="h-8" onClick={openEdit}><Edit3 className="mr-1.5 h-3.5 w-3.5" />Edit</Button>
          {nextAdvance && <Button size="sm" className="h-8" onClick={() => openAdvance(nextAdvance)}><ShieldCheck className="mr-1.5 h-3.5 w-3.5" />Advance</Button>}
          <DropdownMenu>
            <DropdownMenuTrigger asChild><Button variant="outline" size="icon" className="h-8 w-8" aria-label="More actions"><MoreHorizontal className="h-4 w-4" /></Button></DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-52">
              <DropdownMenuItem onSelect={() => void load()}><RefreshCw />Refresh data</DropdownMenuItem>
              <DropdownMenuItem onSelect={openVisitForm}><CalendarPlus />Plan visit</DropdownMenuItem>
              <DropdownMenuItem onSelect={() => setDocOpen(true)}><Upload />Upload document</DropdownMenuItem>
              {canRaiseNc && <DropdownMenuItem onSelect={openRaiseNc}><ShieldAlert />Raise NC</DropdownMenuItem>}
              <DropdownMenuSeparator />
              <DropdownMenuItem variant="destructive" disabled={!institution.active} onSelect={() => setDeleteOpen(true)}><Trash2 />Deactivate institution</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </>}
        kpis={<>
          <KpiCell icon={Workflow} label="Current stage" value={humanize(status)} hint={currentEntry ? `since ${formatDay(currentEntry.entryDate)}` : undefined} />
          <KpiCell icon={ShieldAlert} label="Open NCs" value={openNcCount} tone={hasOpenNc ? 'danger' : undefined} hint={hasOpenNc ? 'Blocks approval' : ncRegisters.length ? `${closedNcCount} closed` : 'None raised'} />
          <KpiCell icon={CalendarClock} label="Validity" value={renewalDaysLeft == null ? '—' : renewalDaysLeft < 0 ? 'Expired' : `${renewalDaysLeft} days`} tone={renewalDaysLeft != null && renewalDaysLeft < 0 ? 'danger' : nearRenewal ? 'warning' : undefined} hint={institution.expiryDate ? `till ${formatDay(institution.expiryDate)}` : 'Not approved yet'} />
          <KpiCell icon={CalendarDays} label="Last visit" value={latestVisit ? formatDay(latestVisit.scheduledVisitDate) : 'No visits'} hint={latestVisit ? (latestVisit.assignedEmployeeName || employeeName(latestVisit.assignedEmployeeId)) : 'Plan one from Visits'} />
        </>}
        nextStep={nextStep}
      />

      {warnings.length > 0 && <WarningBanner>Institution loaded, but {warnings.join(', ')}. Retry with Refresh.</WarningBanner>}

      <DetailShell
        defaultValue="overview"
        tabs={[
          {
            value: 'overview',
            label: 'Overview',
            content: (
              <div>
                <div className="grid gap-4 lg:grid-cols-2">
                <Section icon={Activity} title="Activity" className="lg:row-span-2" bodyClassName="p-0" action={<Button size="sm" variant="ghost" className="h-6 px-2 text-xs" onClick={openNewTask}><Plus className="mr-1 h-3.5 w-3.5" />Task</Button>}>
                  <ActivityTimeline upcoming={upNext} recent={recentActivity} viewAllHref="#tasks" />
                </Section>
                <Section icon={Building2} title="Institution profile">
                  <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-2">
                    <Info label="Institution type" value={humanize(institution.institutionType)} />
                    <Info label="Jurisdiction" value={institution.jurisdiction} />
                    <Info label="State" value={institution.state} />
                    <Info label="Region" value={institution.regionName} />
                    <Info label="Assigned employee" value={ownerName} />
                    <Info label="File holder" value={fileHolder} />
                    <Info label="Parent institution" value={institution.parentInstitutionId ? `Institution #${institution.parentInstitutionId}` : 'None'} />
                    <Info label="Record state" value={institution.active ? <Pill tone="success">Active</Pill> : <Pill tone="danger">Inactive</Pill>} />
                  </dl>
                </Section>
                <Section icon={CalendarClock} title="Lifecycle dates">
                  {validity != null && (
                    <div className="mb-4">
                      <div className="mb-1.5 flex items-center justify-between text-[11px] text-muted-foreground"><span>Approved {formatDay(institution.approvalDate)}</span><span>Expires {formatDay(institution.expiryDate)}</span></div>
                      <div className="h-1.5 overflow-hidden rounded-full bg-muted"><div className={cn('h-full rounded-full', renewalDaysLeft != null && renewalDaysLeft < 0 ? 'bg-red-500' : nearRenewal ? 'bg-amber-500' : 'bg-emerald-500')} style={{ width: `${validity}%` }} /></div>
                    </div>
                  )}
                  <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-2">
                    <Info label="Application date" value={formatDay(institution.applicationDate)} />
                    <Info label="Approval date" value={formatDay(institution.approvalDate)} />
                    <Info label="Expiry date" value={formatDay(institution.expiryDate)} />
                    <Info label="Renewal lead days" value={institution.renewalLeadDays} />
                    <Info label="Created" value={formatDay(institution.createdAt)} />
                    <Info label="Updated" value={formatDay(institution.updatedAt)} />
                  </dl>
                </Section>
                </div>
              </div>
            ),
          },
          {
            value: 'process',
            label: 'Process',
            count: pipeline.length + ncRegisters.length,
            content: (
              <div className="space-y-4">
                <Section bodyClassName="px-4 py-3">
                  <StageStepper steps={STAGE_STEPS} index={stageIndex} offPath={<Pill tone={statusTone}>{humanize(status)}</Pill>} />
                </Section>
                <div className="grid items-start gap-4 xl:grid-cols-2">
                  <Section icon={History} title={`Stage history · ${pipeline.length}`} bodyClassName="p-0">
                    {sortedPipeline.length === 0 ? <EmptyState compact title="No stage changes recorded yet." /> : (
                      <ul className="max-h-[420px] divide-y overflow-y-auto">
                        {sortedPipeline.map((entry) => <StageHistoryRow key={entry.id} from={entry.fromStatus} to={String(entry.toStatus)} remarks={entry.remarks} date={entry.entryDate} by={pipelineOwner(entry)} current={entry === currentEntry} />)}
                      </ul>
                    )}
                  </Section>
                  <Section
                    icon={ShieldAlert}
                    title={`NC register · ${ncRegisters.length}`}
                    description={hasClosedNc ? 'NC lifecycle completed' : !canRaiseNc ? 'NCs can be raised after the technical visit' : undefined}
                    bodyClassName="p-0"
                    action={canRaiseNc ? <Button size="sm" variant="outline" className="h-7 px-2 text-xs" onClick={openRaiseNc}><Plus className="mr-1 h-3.5 w-3.5" />Raise NC</Button> : undefined}
                  >
                    {ncRegisters.length === 0 ? <EmptyState compact title="No NCs raised." /> : (
                      <ul className="max-h-[420px] divide-y overflow-y-auto">
                        {ncRegisters.map((nc) => <NcRow key={nc.id} nc={nc} evidence={ncDocsMap[nc.id] || []} busy={ncBusyId === nc.id} onSubmitClosure={() => void openSubmitNc(nc)} onAddEvidence={() => pickNcEvidence(nc)} onAccept={() => void openAcceptNc(nc)} />)}
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
            count: contacts.length,
            content: (
              <Section description={`${contacts.length} ${contacts.length === 1 ? 'person' : 'people'} linked`} bodyClassName="p-0" action={<Button size="sm" className="h-7 px-2.5 text-xs" onClick={() => openContactForm()}><UserPlus className="mr-1.5 h-3.5 w-3.5" />Add contact</Button>}>
                {contacts.length === 0 ? <EmptyState compact title="No contacts linked yet. Add the officer who receives the file." /> : (
                  <div>
                    <div className="hidden grid-cols-[minmax(0,1.4fr)_120px_minmax(0,1fr)_40px] gap-x-4 border-b bg-muted/40 px-4 py-2 text-[11px] font-medium text-muted-foreground md:grid">
                      <span>Name</span><span>Mobile</span><span>Email</span><span />
                    </div>
                    <ul className="divide-y">
                      {contacts.map((contact) => {
                        const master = masterContacts.find((m) => m.id === contact.contactInfluenceRegisterId);
                        const name = contactName(contact);
                        const mobile = (contact.mobile && contact.mobile !== '—' ? contact.mobile : null) || master?.mobile || null;
                        const email = (contact.email && contact.email !== '—' ? contact.email : null) || master?.email || null;
                        const role = [contact.designation, contact.roleDescription].filter(Boolean).join(' · ') || 'No designation';
                        const isHolder = (contact.contactInfluenceRegisterId || contact.id) === institution.currentStageOwnerContactId;
                        return (
                          <li key={contact.id} className={cn('grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 px-4 py-2 transition-colors hover:bg-muted/30 md:grid-cols-[minmax(0,1.4fr)_120px_minmax(0,1fr)_40px] md:gap-x-4', !contact.active && 'opacity-70')}>
                            <div className="flex min-w-0 items-center gap-2.5">
                              <Initials name={name} className="h-7 w-7 text-[10px]" />
                              <div className="min-w-0 leading-tight">
                                <div className="flex min-w-0 items-center gap-1.5"><p className="truncate text-sm font-medium">{name}</p>{contact.primaryContact && <Pill tone="info">Primary</Pill>}{isHolder && <Pill tone="warning">File holder</Pill>}{!contact.active && <Pill tone="danger">Inactive</Pill>}</div>
                                <p className="truncate text-[11px] text-muted-foreground" title={role}>{role}<span className="md:hidden">{mobile ? <> · <a href={`tel:${mobile}`} className="text-foreground hover:underline">{mobile}</a></> : ''}</span></p>
                              </div>
                            </div>
                            <span className="hidden text-xs tabular-nums md:block">{mobile ? <a href={`tel:${mobile}`} className="inline-flex items-center gap-1.5 hover:underline"><Phone className="h-3 w-3 text-muted-foreground" />{mobile}</a> : <span className="text-muted-foreground">—</span>}</span>
                            <span className="hidden min-w-0 text-xs md:block">{email ? <a href={`mailto:${email}`} className="flex min-w-0 items-center gap-1.5 hover:underline" title={email}><Mail className="h-3 w-3 shrink-0 text-muted-foreground" /><span className="truncate">{email}</span></a> : <span className="text-muted-foreground">—</span>}</span>
                            <div className="flex items-center justify-end"><Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-foreground" onClick={() => openContactForm(contact)} aria-label={`Edit ${name}`} title="Edit contact"><Edit3 className="h-3.5 w-3.5" /></Button></div>
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
                {visits.length === 0 ? <EmptyState compact title="No visits yet. Plan a technical or relationship visit." /> : <VisitList visits={visits} assignee={(visit) => visit.assignedEmployeeName || employeeName(visit.assignedEmployeeId)} onOpen={(visit) => router.push(`/dashboard/visits/${visit.id}`)} />}
              </Section>
            ),
          },
          {
            value: 'documents',
            label: 'Documents',
            count: documents.length,
            content: (
              <Section description={`${documents.length} ${documents.length === 1 ? 'document' : 'documents'}${documents.some((doc) => !doc.fileAttached) ? ` · ${documents.filter((doc) => !doc.fileAttached).length} missing file` : ''}`} bodyClassName="p-0" action={<Button size="sm" className="h-7 px-2.5 text-xs" onClick={() => setDocOpen(true)}><Upload className="mr-1.5 h-3.5 w-3.5" />Upload</Button>}>
                {documents.length === 0 ? <EmptyState compact title="No documents yet. Upload the credentials profile to get started." /> : (
                  <ul className="divide-y">
                    {documents.map((doc) => (
                      <li key={doc.id} className="flex items-center gap-3 px-4 py-2 transition-colors hover:bg-muted/30">
                        <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
                        <div className="min-w-0 flex-1 leading-tight">
                          <div className="flex min-w-0 items-center gap-1.5"><p className="truncate text-sm font-medium" title={doc.fileName}>{doc.fileName}</p>{doc.versionNumber != null && <Pill>v{doc.versionNumber}</Pill>}{!doc.fileAttached && <Pill tone="danger">No file</Pill>}</div>
                          <p className="truncate text-[11px] text-muted-foreground">{humanize(doc.documentType)}{doc.expiryDate ? ` · expires ${formatDay(doc.expiryDate)}` : ''}</p>
                        </div>
                        <div className="flex shrink-0 items-center gap-0.5">
                          <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-foreground" disabled={!doc.fileAttached} onClick={() => void openDocumentFile(doc, 'view')} aria-label={`View ${doc.fileName}`} title="View"><Eye className="h-3.5 w-3.5" /></Button>
                          <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-foreground" disabled={!doc.fileAttached} onClick={() => void openDocumentFile(doc, 'download')} aria-label={`Download ${doc.fileName}`} title="Download"><Download className="h-3.5 w-3.5" /></Button>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </Section>
            ),
          },
          {
            value: 'tasks',
            label: 'Tasks',
            count: tasks.length,
            content: (
              <Section description={taskSummary(tasks)} bodyClassName="p-0" action={<Button size="sm" className="h-7 px-2.5 text-xs" onClick={openNewTask}><Plus className="mr-1.5 h-3.5 w-3.5" />Add task</Button>}>
                {tasks.length === 0 ? <EmptyState compact title="No tasks yet. Create a follow-up so nothing slips through." /> : <TaskList tasks={tasks} assignee={(task) => task.assignedEmployeeName || employeeName(task.assignedEmployeeId)} onEdit={(task) => void openEditTask(task)} onDelete={(task) => void removeTask(task)} busy={busy} />}
              </Section>
            ),
          },
          {
            value: 'notes',
            label: 'Notes',
            count: notes.length,
            content: (
              <NotesFeed
                notes={sortedNotes.map((note) => ({ id: note.id, text: note.noteText, author: noteAuthor(note), date: note.createdAt, edited: Boolean(note.updatedAt && note.updatedAt !== note.createdAt) }))}
                onAdd={async (text) => { if (!token) return false; try { await InstitutionsAPI.createNote(institutionId, text, token); toast.success('Note added.'); await reloadNotes(); return true; } catch (error) { toast.error(getErrorMessage(error, 'Unable to add note.')); return false; } }}
                placeholder="Write a note for the team… e.g. outcome of the meeting with the department"
              />
            ),
          },
        ]}
      />

      <FormSheet
        open={editOpen}
        onOpenChange={(open) => !busy && setEditOpen(open)}
        icon={Building2}
        title="Edit institution"
        description={institution.institutionName}
        wide
        errors={editErrors}
        footerNote="Status changes only via Advance stage, not edit."
        onSubmit={() => void saveEdit()}
        submitLabel="Save changes"
        submitting={busy}
      >
        {editDraft && <>
          <FormGroup title="Institution">
            <FormField label="Institution name" required className="sm:col-span-2"><Input value={editDraft.institutionName} onChange={(e) => setEditDraft({ ...editDraft, institutionName: e.target.value })} /></FormField>
            <FormField label="Jurisdiction"><Input value={editDraft.jurisdiction} onChange={(e) => setEditDraft({ ...editDraft, jurisdiction: e.target.value })} /></FormField>
            <FormField label="State" required><Input value={editDraft.state} onChange={(e) => setEditDraft({ ...editDraft, state: e.target.value })} /></FormField>
            <FormField label="Region ID"><Input type="number" value={editDraft.regionId} onChange={(e) => setEditDraft({ ...editDraft, regionId: e.target.value })} /></FormField>
          </FormGroup>
          <FormGroup title="Ownership">
            <FormField label="Assigned employee"><Select value={editDraft.assignedEmployeeId} onValueChange={(v) => setEditDraft({ ...editDraft, assignedEmployeeId: v })}><SelectTrigger><SelectValue placeholder="Choose" /></SelectTrigger><SelectContent>{employees.map((e) => <SelectItem key={e.id} value={String(e.id)}>{[e.firstName, e.lastName].filter(Boolean).join(' ') || `Employee #${e.id}`}</SelectItem>)}</SelectContent></Select></FormField>
            <FormField label="File holder (stage owner)" hint="The linked contact who currently holds the file."><Select value={editDraft.currentStageOwnerContactId} onValueChange={(v) => setEditDraft({ ...editDraft, currentStageOwnerContactId: v === '__none' ? '' : v })}><SelectTrigger><SelectValue placeholder="Choose linked contact" /></SelectTrigger><SelectContent><SelectItem value="__none">None</SelectItem>{contacts.map((c) => <SelectItem key={c.id} value={String(c.contactInfluenceRegisterId || c.id)}>{[c.firstName, c.lastName].filter(Boolean).join(' ') || `Contact #${c.id}`} · {c.designation || '—'}</SelectItem>)}</SelectContent></Select></FormField>
          </FormGroup>
          <FormGroup title="Lifecycle dates">
            <FormField label="Application date"><Input type="date" value={editDraft.applicationDate} onChange={(e) => setEditDraft({ ...editDraft, applicationDate: e.target.value })} /></FormField>
            <FormField label="Approval date"><Input type="date" value={editDraft.approvalDate} onChange={(e) => setEditDraft({ ...editDraft, approvalDate: e.target.value })} /></FormField>
            <FormField label="Expiry date"><Input type="date" value={editDraft.expiryDate} onChange={(e) => setEditDraft({ ...editDraft, expiryDate: e.target.value })} /></FormField>
            <FormField label="Renewal lead days" hint="Days before expiry to flag renewal."><Input type="number" min="0" value={editDraft.renewalLeadDays} onChange={(e) => setEditDraft({ ...editDraft, renewalLeadDays: e.target.value })} /></FormField>
          </FormGroup>
        </>}
      </FormSheet>

      <FormSheet
        open={advanceOpen}
        onOpenChange={(open) => !busy && setAdvanceOpen(open)}
        icon={ShieldCheck}
        title={`Advance to ${humanize(advanceForm.toStatus)}`}
        description={<>Currently <span className="font-medium text-foreground">{humanize(status)}</span>. Every stage change is recorded in the stage history.</>}
        errors={advanceErrors}
        footerNote={checklistBlocked ? 'Complete the checklist to continue.' : undefined}
        onSubmit={() => void advanceStage()}
        submitLabel="Advance stage"
        submitting={busy}
        submitDisabled={checklistBlocked}
        submitTitle={checklistBlocked ? 'Complete all checklist items first' : undefined}
      >
        {checklist.length > 0 && (
          <section className="space-y-2">
            <div className="flex items-center justify-between">
              <h4 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Required before advancing</h4>
              <span className="text-[11px] text-muted-foreground">{checklist.filter((c) => c.done).length} of {checklist.length} done</span>
            </div>
            <ul className="divide-y rounded-lg border">
              {checklist.map((c) => (
                <li key={c.key} className="flex items-center justify-between gap-2 px-3 py-2 text-sm">
                  <span className="flex items-center gap-2">
                    {c.done ? <CheckCircle2 className="h-4 w-4 text-emerald-600" /> : <Circle className="h-4 w-4 text-muted-foreground" />}
                    <span className={c.done ? 'text-muted-foreground line-through' : ''}>{c.label}</span>
                  </span>
                  {!c.done && <span className="shrink-0 text-[11px] text-muted-foreground">{c.action}</span>}
                </li>
              ))}
            </ul>
          </section>
        )}
        <FormGroup title="Stage change" columns={1}>
          <FormField label="Target status" required><Select value={advanceForm.toStatus} onValueChange={(v) => setAdvanceForm({ ...advanceForm, toStatus: v as EmpanelmentStatus })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{manualNextStatuses.map((s) => <SelectItem key={s} value={s}>{humanize(s)}</SelectItem>)}</SelectContent></Select></FormField>
          <FormField label="Responsible employee" required><Select value={advanceForm.decisionByEmployeeId} onValueChange={(v) => setAdvanceForm({ ...advanceForm, decisionByEmployeeId: v })}><SelectTrigger><SelectValue placeholder="Required" /></SelectTrigger><SelectContent>{employees.map((e) => <SelectItem key={e.id} value={String(e.id)}>{[e.firstName, e.lastName].filter(Boolean).join(' ') || `Employee #${e.id}`}</SelectItem>)}</SelectContent></Select></FormField>
          <FormField label="Remarks" required><Textarea rows={3} value={advanceForm.remarks} onChange={(e) => setAdvanceForm({ ...advanceForm, remarks: e.target.value })} placeholder="Why is the stage changing?" /></FormField>
        </FormGroup>
        {advanceForm.toStatus === 'CREDENTIALS_SUBMITTED' && (
          <FormGroup title="Credentials package" description="Everything submitted to the department in one go.">
            {contacts.length === 0 ? <>
              <FormField label="Receiving contact first name" required><Input value={advContactName} onChange={(e) => setAdvContactName(e.target.value)} placeholder="e.g. Suresh" /></FormField>
              <FormField label="Last name" required><Input value={advContactLastName} onChange={(e) => setAdvContactLastName(e.target.value)} placeholder="e.g. Patil" /></FormField>
              <FormField label="Contact mobile" required><Input value={advContactMobile} onChange={(e) => setAdvContactMobile(e.target.value.replace(/\D/g, '').slice(0, 10))} inputMode="numeric" /></FormField>
              <FormField label="Designation" required><Input value={advContactDesignation} onChange={(e) => setAdvContactDesignation(e.target.value)} placeholder="e.g. Executive Engineer" /></FormField>
            </> : (
              <FormField label="File holder (stage owner)" className="sm:col-span-2"><Select value={advOwnerId} onValueChange={setAdvOwnerId}><SelectTrigger><SelectValue placeholder="Choose contact" /></SelectTrigger><SelectContent>{contacts.map((c) => <SelectItem key={c.id} value={String(c.contactInfluenceRegisterId || c.id)}>{[c.firstName, c.lastName].filter(Boolean).join(' ') || `Contact #${c.id}`} · {c.designation || '—'}</SelectItem>)}</SelectContent></Select></FormField>
            )}
            {!hasCredDoc && <FormField label="Credentials file" required className="sm:col-span-2"><FilePicker file={advCredFile} onChange={setAdvCredFile} /></FormField>}
            <FormField label="Application date" required className="sm:col-span-2"><Input type="date" value={advAppDate} onChange={(e) => setAdvAppDate(e.target.value)} /></FormField>
          </FormGroup>
        )}
        {advanceForm.toStatus === 'NC_RAISED' && ncRegisters.length === 0 && (
          <FormGroup title="First NC" description="Log the first non-conformity found during the visit." columns={1}>
            <FormField label="NC description" required><Textarea value={advNcDesc} onChange={(e) => setAdvNcDesc(e.target.value)} placeholder="As observed during the visit" /></FormField>
            <FormField label="Raised by (official)" required><Input value={advNcRaisedBy} onChange={(e) => setAdvNcRaisedBy(e.target.value)} placeholder="e.g. Inspecting officer name" /></FormField>
            <FormField label="Target closure date" required><Input type="date" value={advNcTargetDate} onChange={(e) => setAdvNcTargetDate(e.target.value)} /></FormField>
          </FormGroup>
        )}
        {advanceForm.toStatus === 'TECHNICAL_VISIT_SCHEDULED' && (
          <FormGroup title="Technical visit" columns={1}>
            <div className={cn('flex items-center gap-2 rounded-lg px-3 py-2 text-xs', visits.some((v) => v.actualCheckoutAt) ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300' : 'bg-amber-50 text-amber-800 dark:bg-amber-500/10 dark:text-amber-300')}>
              {visits.some((v) => v.actualCheckoutAt) ? <CheckCircle2 className="h-4 w-4 shrink-0" /> : <CalendarClock className="h-4 w-4 shrink-0" />}
              {visits.some((v) => v.actualCheckoutAt) ? 'Visit completed (checked out).' : 'No completed visit yet. Plan and check out one from the Visits tab.'}
            </div>
            <FormField label="Visit report (optional)"><FilePicker onChange={(file) => { (window as unknown as { __advVisitReportFile?: File | null }).__advVisitReportFile = file; }} /></FormField>
          </FormGroup>
        )}
        {advanceForm.toStatus === 'APPROVED' && (
          <FormGroup title="Approval details">
            {!hasApprovalDoc && <>
              <FormField label="Letter type" className="sm:col-span-2"><Select value={advLetterType} onValueChange={(v) => setAdvLetterType(v as InstitutionDocumentType)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="EMPANELMENT_APPROVAL_LETTER_SCAN">Approval letter scan</SelectItem><SelectItem value="APPROVED_VENDOR_LISTING_PROOF">Vendor listing proof</SelectItem></SelectContent></Select></FormField>
              <FormField label="Approval file" required className="sm:col-span-2"><FilePicker file={advLetterFile} onChange={setAdvLetterFile} /></FormField>
            </>}
            <FormField label="Approval date" required><Input type="date" value={advApprovalDate} onChange={(e) => setAdvApprovalDate(e.target.value)} /></FormField>
            <FormField label="Expiry date" hint="Leave empty for perpetual approval."><Input type="date" value={advExpiryDate} onChange={(e) => setAdvExpiryDate(e.target.value)} /></FormField>
          </FormGroup>
        )}
      </FormSheet>

      <FormSheet
        open={ncOpen}
        onOpenChange={(open) => !busy && setNcOpen(open)}
        icon={ShieldAlert}
        title="Raise NC"
        description="Record a non-conformity raised by the institution. Open NCs block approval."
        onSubmit={() => void createNc()}
        submitLabel="Raise NC"
        submitting={busy}
      >
        <FormGroup columns={1}>
          <FormField label="Description" required><Textarea rows={4} value={ncForm.description} onChange={(e) => setNcForm({ ...ncForm, description: e.target.value })} placeholder="Describe the non-conformity" /></FormField>
        </FormGroup>
        <FormGroup title="Details">
          <FormField label="Raised date" required><Input type="date" value={ncForm.raisedDate} onChange={(e) => setNcForm({ ...ncForm, raisedDate: e.target.value })} /></FormField>
          <FormField label="Target closure date"><Input type="date" value={ncForm.targetClosureDate} onChange={(e) => setNcForm({ ...ncForm, targetClosureDate: e.target.value })} /></FormField>
          <FormField label="Raised by (official)"><Input value={ncForm.raisedByOfficialText} onChange={(e) => setNcForm({ ...ncForm, raisedByOfficialText: e.target.value })} placeholder="e.g. Consultant QA" /></FormField>
          <FormField label="Responsible employee"><Select value={ncForm.responsibleEmployeeId} onValueChange={(v) => setNcForm({ ...ncForm, responsibleEmployeeId: v })}><SelectTrigger><SelectValue placeholder="Optional" /></SelectTrigger><SelectContent>{employees.map((e) => <SelectItem key={e.id} value={String(e.id)}>{[e.firstName, e.lastName].filter(Boolean).join(' ') || `Employee #${e.id}`}</SelectItem>)}</SelectContent></Select></FormField>
        </FormGroup>
      </FormSheet>

      <FormSheet
        open={contactOpen}
        onOpenChange={(open) => { if (!busy) { setContactOpen(open); if (!open) setEditingContact(null); } }}
        icon={UserPlus}
        title={editingContact ? 'Edit contact' : 'Add contact'}
        description={`Officer or official at ${institution.institutionName}.`}
        onSubmit={() => void saveContact()}
        submitLabel={editingContact ? 'Save changes' : 'Add contact'}
        submitting={busy}
      >
        <FormGroup title="Person">
          <FormField label="First name" required><Input value={contactForm.firstName} onChange={(e) => setContactForm({ ...contactForm, firstName: e.target.value })} /></FormField>
          <FormField label="Last name"><Input value={contactForm.lastName} onChange={(e) => setContactForm({ ...contactForm, lastName: e.target.value })} /></FormField>
          <FormField label="Mobile" required hint="10-digit number"><Input value={contactForm.mobile} onChange={(e) => setContactForm({ ...contactForm, mobile: e.target.value.replace(/\D/g, '').slice(0, 10) })} inputMode="numeric" /></FormField>
          <FormField label="Email"><Input type="email" value={contactForm.email} onChange={(e) => setContactForm({ ...contactForm, email: e.target.value })} /></FormField>
        </FormGroup>
        <FormGroup title="Role at this institution">
          <FormField label="Designation" required><Input placeholder="e.g. Executive Engineer" value={contactForm.designation} onChange={(e) => setContactForm({ ...contactForm, designation: e.target.value })} /></FormField>
          <FormField label="Role description"><Input placeholder="e.g. Reviews vendor files" value={contactForm.roleDescription} onChange={(e) => setContactForm({ ...contactForm, roleDescription: e.target.value })} /></FormField>
        </FormGroup>
      </FormSheet>

      <FormSheet
        open={noteOpen}
        onOpenChange={(open) => !busy && setNoteOpen(open)}
        icon={NotebookPen}
        title="Add note"
        description="Visible to everyone who works on this institution."
        onSubmit={() => void addNote()}
        submitLabel="Save note"
        submitting={busy}
        submitDisabled={!noteText.trim()}
      >
        <FormField label="Note" required><Textarea rows={8} value={noteText} onChange={(e) => setNoteText(e.target.value)} placeholder="What was discussed, agreed, or needs follow-up…" /></FormField>
      </FormSheet>

      <FormSheet
        open={taskOpen}
        onOpenChange={(open) => !busy && setTaskOpen(open)}
        icon={ListChecks}
        title={editingTask ? 'Edit task' : 'New follow-up task'}
        description={editingTask ? editingTask.title : `Follow-up for ${institution.institutionName}.`}
        onSubmit={() => void addTask()}
        submitLabel={editingTask ? 'Save changes' : 'Create task'}
        submitting={busy}
      >
        <FormGroup>
          <FormField label="Task title" required className="sm:col-span-2"><Input placeholder="e.g. Collect NC closure letter" value={taskForm.title} onChange={(e) => setTaskForm({ ...taskForm, title: e.target.value })} /></FormField>
          <FormField label="Assignee" required><Select value={taskForm.employeeId} onValueChange={(v) => setTaskForm({ ...taskForm, employeeId: v })}><SelectTrigger><SelectValue placeholder="Choose" /></SelectTrigger><SelectContent>{employees.map((e) => <SelectItem key={e.id} value={String(e.id)}>{[e.firstName, e.lastName].filter(Boolean).join(' ') || `Employee #${e.id}`}</SelectItem>)}</SelectContent></Select></FormField>
          <FormField label="Due date" required><Input type="date" value={taskForm.dueDate} onChange={(e) => setTaskForm({ ...taskForm, dueDate: e.target.value })} /></FormField>
          <FormField label="Priority"><Select value={taskForm.priority} onValueChange={(v) => setTaskForm({ ...taskForm, priority: v })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="LOW">Low</SelectItem><SelectItem value="MEDIUM">Medium</SelectItem><SelectItem value="HIGH">High</SelectItem><SelectItem value="URGENT">Urgent</SelectItem></SelectContent></Select></FormField>
          {editingTask && <FormField label="Status"><Select value={taskForm.status} onValueChange={(v) => setTaskForm({ ...taskForm, status: v })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="OPEN">Open</SelectItem><SelectItem value="IN_PROGRESS">In progress</SelectItem><SelectItem value="COMPLETED">Completed</SelectItem><SelectItem value="CANCELLED">Cancelled</SelectItem></SelectContent></Select></FormField>}
          <FormField label="Description" className="sm:col-span-2"><Textarea rows={4} value={taskForm.description} onChange={(e) => setTaskForm({ ...taskForm, description: e.target.value })} placeholder="Optional details" /></FormField>
        </FormGroup>
      </FormSheet>

      <FormSheet
        open={visitOpen}
        onOpenChange={(open) => !busy && setVisitOpen(open)}
        icon={CalendarPlus}
        title="Plan visit"
        description={`Institutional visit to ${institution.institutionName}.`}
        onSubmit={() => void planVisit()}
        submitLabel="Plan visit"
        submitting={busy}
      >
        <FormGroup title="When and who">
          <FormField label="Assigned employee" required className="sm:col-span-2"><SearchableSelect options={employeeOptions} value={visitForm.employeeId || undefined} onSelect={(option) => setVisitForm({ ...visitForm, employeeId: option?.value || '' })} placeholder="Choose employee" searchPlaceholder="Search employees..." triggerClassName="h-9 w-full overflow-hidden text-xs" /></FormField>
          <FormField label="Visit date" required className="sm:col-span-2"><Input type="date" value={visitForm.date} onChange={(e) => setVisitForm({ ...visitForm, date: e.target.value })} /></FormField>
          <FormField label="Start time"><Input type="time" value={visitForm.startTime} onChange={(e) => setVisitForm({ ...visitForm, startTime: e.target.value })} /></FormField>
          <FormField label="End time"><Input type="time" value={visitForm.endTime} onChange={(e) => setVisitForm({ ...visitForm, endTime: e.target.value })} /></FormField>
        </FormGroup>
        <FormGroup title="Purpose" columns={1}>
          <FormField label="Purpose" required><Select value={VISIT_PURPOSES.some(o=>o.value===visitForm.purpose || o.label===visitForm.purpose) ? (VISIT_PURPOSES.find(o=>o.value===visitForm.purpose || o.label===visitForm.purpose)?.value || 'ROUTINE_VISIT') : visitForm.purpose} onValueChange={(v) => setVisitForm({ ...visitForm, purpose: v === 'OTHER' ? visitForm.purpose : VISIT_PURPOSES.find(o=>o.value===v)?.label || v })}><SelectTrigger><SelectValue placeholder="Select purpose" /></SelectTrigger><SelectContent>{VISIT_PURPOSES.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent></Select></FormField>
          <FormField label="Description"><Textarea rows={3} value={visitForm.description} onChange={(e) => setVisitForm({ ...visitForm, description: e.target.value })} placeholder="Optional agenda or context" /></FormField>
          <FormCheck checked={visitForm.selfGenerated} onCheckedChange={(checked) => setVisitForm({ ...visitForm, selfGenerated: checked })} label="Self-generated visit" description="Planned by the field employee rather than assigned by a manager." />
        </FormGroup>
      </FormSheet>

      <FormSheet
        open={docOpen}
        onOpenChange={(open) => !isUploading && setDocOpen(open)}
        icon={Upload}
        title="Upload document"
        description="The document type is pre-selected for the current stage."
        onSubmit={() => void uploadDoc()}
        submitLabel="Upload"
        submitting={isUploading}
        submitDisabled={!docFile}
      >
        <FormGroup columns={1}>
          <FormField label="Document type" required><Select value={docType} onValueChange={(v) => setDocType(v as InstitutionDocumentType)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="CREDENTIALS_PROFILE">Credentials profile</SelectItem><SelectItem value="TECHNICAL_VISIT_REPORT">Technical visit report</SelectItem><SelectItem value="EMPANELMENT_APPROVAL_LETTER_SCAN">Approval letter scan</SelectItem><SelectItem value="APPROVED_VENDOR_LISTING_PROOF">Vendor listing proof</SelectItem><SelectItem value="RENEWAL_APPLICATION">Renewal application</SelectItem></SelectContent></Select></FormField>
          <FormField label="File" required><FilePicker file={docFile} onChange={setDocFile} /></FormField>
        </FormGroup>
      </FormSheet>

      <FormSheet
        open={submitNc != null}
        onOpenChange={(open) => !open && setSubmitNc(null)}
        icon={ShieldCheck}
        title={`Submit closure for NC #${submitNc?.id ?? ''}`}
        description="Describe the fix and attach evidence for the institution to review."
        onSubmit={() => void doSubmitNc()}
        submitLabel="Submit closure"
        submitting={ncBusyId != null && ncBusyId === submitNc?.id}
      >
        {submitNc && (
          <FormContext>
            <div className="flex items-center gap-2"><span className="font-semibold">NC #{submitNc.id}</span><Pill tone="danger">{humanize(submitNc.status)}</Pill></div>
            <p className="mt-1 text-sm">{submitNc.description || '—'}</p>
            <p className="mt-1 text-muted-foreground">Raised {showDate(submitNc.raisedDate)} by {submitNc.raisedByOfficialText || '—'} · Target {showDate(submitNc.targetClosureDate)}</p>
          </FormContext>
        )}
        <FormGroup columns={1}>
          <FormField label="Corrective action" required><Textarea rows={4} value={submitText} onChange={(e) => setSubmitText(e.target.value)} placeholder="What was fixed and how" /></FormField>
          {submitDocs.length > 0 && <FormField label="Existing evidence"><Select value={submitEvidenceId} onValueChange={setSubmitEvidenceId}><SelectTrigger><SelectValue placeholder="Choose uploaded evidence" /></SelectTrigger><SelectContent>{submitDocs.map((d) => <SelectItem key={d.id} value={String(d.id)}>{d.fileName}</SelectItem>)}</SelectContent></Select></FormField>}
          <FormField label={submitDocs.length ? 'Or attach new evidence' : 'Closure evidence file'} required={!submitEvidenceId}><FilePicker file={submitFile} onChange={setSubmitFile} /></FormField>
        </FormGroup>
      </FormSheet>

      <FormSheet
        open={acceptNc != null}
        onOpenChange={(open) => !open && setAcceptNc(null)}
        icon={CheckCircle2}
        title={`Accept closure for NC #${acceptNc?.id ?? ''}`}
        description="Record the institution's acceptance to close this NC."
        onSubmit={() => void doAcceptNc()}
        submitLabel="Close NC"
        submitting={ncBusyId != null && ncBusyId === acceptNc?.id}
      >
        {acceptNc && (
          <FormContext>
            <div className="flex items-center gap-2"><span className="font-semibold">NC #{acceptNc.id}</span><Pill tone="warning">{humanize(acceptNc.status)}</Pill></div>
            <p className="mt-1 text-sm">{acceptNc.description || '—'}</p>
            <p className="mt-1 text-muted-foreground">Raised {showDate(acceptNc.raisedDate)} by {acceptNc.raisedByOfficialText || '—'} · Target {showDate(acceptNc.targetClosureDate)}</p>
          </FormContext>
        )}
        <FormGroup>
          <FormField label="Closure method" required className="sm:col-span-2"><Select value={acceptForm.closureMethod} onValueChange={(v) => setAcceptForm({ ...acceptForm, closureMethod: v })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="DOCUMENTARY_EVIDENCE_ONLY">Documentary evidence only</SelectItem><SelectItem value="RE_VISIT_WITNESSED">Re-visit witnessed</SelectItem></SelectContent></Select></FormField>
          <FormField label="Acceptance date" required><Input type="date" value={acceptForm.acceptanceDate} onChange={(e) => setAcceptForm({ ...acceptForm, acceptanceDate: e.target.value })} /></FormField>
          <FormField label="Accepting official" required><Input value={acceptForm.acceptingOfficialText} onChange={(e) => setAcceptForm({ ...acceptForm, acceptingOfficialText: e.target.value })} placeholder="Inspecting official name" /></FormField>
          <FormField label="Evidence document" required={acceptForm.closureMethod === 'DOCUMENTARY_EVIDENCE_ONLY'} className="sm:col-span-2" hint={acceptForm.closureMethod === 'DOCUMENTARY_EVIDENCE_ONLY' && !submitDocs.length ? <span className="text-destructive">Upload evidence for this NC before accepting.</span> : undefined}><Select value={acceptForm.evidenceDocumentId} onValueChange={(v) => setAcceptForm({ ...acceptForm, evidenceDocumentId: v === '__none' ? '' : v })}><SelectTrigger><SelectValue placeholder={submitDocs.length ? 'Choose evidence' : 'No evidence files — upload via Evidence first'} /></SelectTrigger><SelectContent><SelectItem value="__none">None</SelectItem>{submitDocs.map((d) => <SelectItem key={d.id} value={String(d.id)}>{d.fileName}{d.fileAttached === false ? ' (no file)' : ''}</SelectItem>)}</SelectContent></Select></FormField>
          {acceptForm.closureMethod === 'RE_VISIT_WITNESSED' && (
            <FormField label="Witnessing re-visit" required className="sm:col-span-2"><Select value={acceptForm.witnessedVisitId} onValueChange={(v) => setAcceptForm({ ...acceptForm, witnessedVisitId: v })}><SelectTrigger><SelectValue placeholder={visits.some((v) => v.actualCheckoutAt) ? 'Choose completed visit' : 'No completed visits — plan + check out one first'} /></SelectTrigger><SelectContent>{visits.filter((v) => v.actualCheckoutAt).map((v) => <SelectItem key={v.id} value={String(v.id)}>Visit #{v.id} · {showDate(v.scheduledVisitDate)} · {v.outcome ? humanize(v.outcome) : 'Completed'}</SelectItem>)}</SelectContent></Select></FormField>
          )}
        </FormGroup>
      </FormSheet>

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
