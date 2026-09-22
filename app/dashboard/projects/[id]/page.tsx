'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { AlertCircle, ArrowLeft, CalendarPlus, Clock, Edit3, Loader2, NotebookPen, Plus, RefreshCw, Trash2, UserPlus, ShieldCheck } from 'lucide-react';
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
  ProjectsAPI,
  type ProjectStage,
  type Project,
  type ProjectParty,
  type ProjectPipelineEntry,
  type ProjectApprovalHistoryEntry,
  type ProjectNcRegister,
  type ProjectContact,
  type ProjectNote,
  type ProjectTask,
  type ProjectDocument,
  type ProjectSale,
  VALID_STAGE_TRANSITIONS,
  type NcStatus,
} from '@/lib/projects-api';
import { RetailAPI, type RetailEmployee } from '@/lib/retail-api';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Sheet, SheetContent, SheetFooter, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { visitsApi, type CommonVisitRow } from '@/lib/visits-api';

const humanize = (value: string | null | undefined) => value ? value.replaceAll('_', ' ').toLowerCase().replace(/\b\w/g, (l) => l.toUpperCase()) : '—';
const showDate = (value: string | null | undefined) => value ? new Date(value.length === 10 ? `${value}T00:00:00` : value).toLocaleDateString('en-IN', { dateStyle: 'medium' }) : '—';
const FLAT_TAB_SECTION_CLASS = '[&>[data-slot=card]]:gap-4 [&>[data-slot=card]]:rounded-none [&>[data-slot=card]]:border-0 [&>[data-slot=card]]:bg-transparent [&>[data-slot=card]]:py-0 [&>[data-slot=card]]:shadow-none [&>[data-slot=card]>[data-slot=card-header]]:px-0 [&>[data-slot=card]>[data-slot=card-content]]:px-0';

const STAGE_VARIANT: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  SOURCE_APPROVED: 'default', PROJECT_COMPLETED: 'default',
  UNDER_REVIEW: 'secondary', TECHNICAL_VISIT_SCHEDULED: 'secondary', FORWARDED_TO_CONSULTANT: 'secondary', CREDENTIALS_SUBMITTED_TO_CONTRACTOR: 'secondary', NC_CLOSURE_SUBMITTED: 'secondary',
  NOT_STARTED: 'outline',
  REJECTED: 'destructive', NC_RAISED: 'destructive',
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

type ProjectEditDraft = {
  projectName: string;
  institutionId: string;
  locationText: string;
  state: string;
  locationLatitude: string;
  locationLongitude: string;
  projectType: string;
  estimatedTmtMt: string;
  startDate: string;
  completionDate: string;
  sourceApprovalStatus: string;
  approvalLetterReference: string;
  assignedEmployeeId: string;
  active: boolean;
};

export default function ProjectDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { token, userData } = useAuth();
  const projectId = Number(params?.id);

  const [project, setProject] = useState<Project | null>(null);
  const [stageActions, setStageActions] = useState<ProjectStage[]>([]);
  const [pipeline, setPipeline] = useState<ProjectPipelineEntry[]>([]);
  const [approvalHistory, setApprovalHistory] = useState<ProjectApprovalHistoryEntry[]>([]);
  const [parties, setParties] = useState<ProjectParty[]>([]);
  const [ncRegisters, setNcRegisters] = useState<ProjectNcRegister[]>([]);
  const [ncDocsMap, setNcDocsMap] = useState<Record<number, any[]>>({});
  const [contacts, setContacts] = useState<ProjectContact[]>([]);
  const [contactMasters, setContactMasters] = useState<any[]>([]);
  const [notes, setNotes] = useState<ProjectNote[]>([]);
  const [tasks, setTasks] = useState<ProjectTask[]>([]);
  const [documents, setDocuments] = useState<ProjectDocument[]>([]);
  const [visits, setVisits] = useState<CommonVisitRow[]>([]);
  const [sales, setSales] = useState<ProjectSale[]>([]);
  const [saleOpen, setSaleOpen] = useState(false);
  const [saleForm, setSaleForm] = useState({ saleDate: new Date().toISOString().slice(0, 10), quantityMt: '', invoiceReference: '' });
  const [visitOpen, setVisitOpen] = useState(false);
  const [visitForm, setVisitForm] = useState({ employeeId: '', date: new Date().toISOString().slice(0, 10), startTime: '10:00', endTime: '10:30', purpose: '', selfGenerated: true });
  const [employees, setEmployees] = useState<RetailEmployee[]>([]);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const [editOpen, setEditOpen] = useState(false);
  const [editDraft, setEditDraft] = useState<ProjectEditDraft | null>(null);
  const [editErrors, setEditErrors] = useState<string[]>([]);

  const [advanceOpen, setAdvanceOpen] = useState(false);
  const [advanceForm, setAdvanceForm] = useState<{ toStatus: ProjectStage; remarks: string; decisionByEmployeeId: string }>({ toStatus: 'NOT_STARTED', remarks: '', decisionByEmployeeId: '' });
  const [advanceErrors, setAdvanceErrors] = useState<string[]>([]);

  const [ncOpen, setNcOpen] = useState(false);
  const [ncForm, setNcForm] = useState<{ description: string; raisedDate: string; raisedByOfficialText: string; targetClosureDate: string; status: NcStatus; responsibleEmployeeId: string }>({ description: '', raisedDate: new Date().toISOString().slice(0, 10), raisedByOfficialText: '', targetClosureDate: '', status: 'OPEN', responsibleEmployeeId: '' });
  const [ncBusyId, setNcBusyId] = useState<number | null>(null);
  const [submitNc, setSubmitNc] = useState<ProjectNcRegister | null>(null);
  const [submitText, setSubmitText] = useState('');
  const [submitEvidenceId, setSubmitEvidenceId] = useState('');
  const [submitFile, setSubmitFile] = useState<File | null>(null);
  const [submitDocs, setSubmitDocs] = useState<ProjectDocument[]>([]);
  const [acceptNc, setAcceptNc] = useState<ProjectNcRegister | null>(null);
  const [acceptForm, setAcceptForm] = useState({ closureMethod: 'DOCUMENTARY_EVIDENCE_ONLY', acceptanceDate: new Date().toISOString().slice(0, 10), acceptingOfficialText: '', evidenceDocumentId: '', witnessedVisitId: '' });

  const [contactOpen, setContactOpen] = useState(false);
  const [editingContact, setEditingContact] = useState<ProjectContact | null>(null);
  const emptyContactForm = { firstName: '', lastName: '', mobile: '', email: '', designation: '', departmentFunction: '', influenceLevel: '', projectPartyId: '' };
  const [contactForm, setContactForm] = useState(emptyContactForm);

  const [noteOpen, setNoteOpen] = useState(false);
  const [noteText, setNoteText] = useState('');

  const [taskOpen, setTaskOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<ProjectTask | null>(null);
  const [taskForm, setTaskForm] = useState<{ title: string; description: string; employeeId: string; dueDate: string; priority: string; status: string }>({ title: '', description: '', employeeId: '', dueDate: new Date().toISOString().slice(0, 10), priority: 'MEDIUM', status: 'OPEN' });

  const [deleteOpen, setDeleteOpen] = useState(false);

  const [partyOpen, setPartyOpen] = useState(false);
  const [editingParty, setEditingParty] = useState<ProjectParty | null>(null);
  const [partyForm, setPartyForm] = useState({ partyRole: 'CONTRACTOR', partyNameText: '', packageName: '', primaryParty: false });

  const today = () => new Date().toISOString().slice(0, 10);
  const assignedByEmployeeId = userData?.employeeId || project?.assignedEmployeeId || 0;
  const employeeName = (employeeId: number | null | undefined) => {
    const employee = employees.find((item) => item.id === employeeId);
    return employee ? [employee.firstName, employee.lastName].filter(Boolean).join(' ') : employeeId ? `Employee #${employeeId}` : 'Unassigned';
  };
  const pipelineOwnerName = (raw: string | null | undefined) => {
    if (!raw || raw === '—') return 'System';
    const asNum = Number(raw);
    if (Number.isFinite(asNum) && String(asNum) === raw.trim()) {
      const m = employees.find((e) => e.id === asNum);
      const n = m ? [m.firstName, m.lastName].filter(Boolean).join(' ') : '';
      return n || `Employee #${asNum}`;
    }
    return raw;
  };

  const openNcCount = useMemo(() => ncRegisters.filter((nc) => nc.status === 'OPEN' || nc.status === 'SUBMITTED').length, [ncRegisters]);
  const hasOpenNc = openNcCount > 0;
  const hasClosedNc = useMemo(() => ncRegisters.some((nc) => nc.status === 'CLOSED'), [ncRegisters]);

  const allowedNextStatuses = useMemo<ProjectStage[]>(() => {
    if (!project) return [];
    const candidates = stageActions.length > 0 ? stageActions : (VALID_STAGE_TRANSITIONS[project.sourceApprovalStatus] || []);
    return hasClosedNc ? candidates.filter((stage) => stage !== 'NC_RAISED') : candidates;
  }, [project, stageActions, hasClosedNc]);

  const load = useCallback(async () => {
    if (!token || !Number.isFinite(projectId)) return;
    setIsLoading(true);
    setWarnings([]);
    try {
      const found = await ProjectsAPI.getProjectById(projectId, token);
      setProject(found);
      if (!found) return;
      const [pipelineResult, approvalResult, stageActionsResult, partiesResult, ncResult, contactsResult, notesResult, tasksResult, docsResult, employeesResult, contactMastersResult, visitsResult, salesResult] = await Promise.allSettled([
        ProjectsAPI.getProjectPipeline(projectId, token),
        ProjectsAPI.getProjectApprovalHistory(projectId, token),
        ProjectsAPI.getStageActions(projectId, token),
        ProjectsAPI.getProjectParties(projectId, token),
        ProjectsAPI.getNcRegisters(projectId, token),
        ProjectsAPI.getContacts(projectId, token),
        ProjectsAPI.getNotes(projectId, token),
        ProjectsAPI.getTasks(projectId, found.assignedEmployeeId || userData?.employeeId || 0, token),
        ProjectsAPI.getDocuments(projectId, token),
        RetailAPI.getEmployees(token),
        fetch(`${process.env.NEXT_PUBLIC_API_BASE_URL || 'http://ec2-18-211-58-135.compute-1.amazonaws.com:8081'}/api/common/contacts?page=0&size=50`, { headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' } }).then(async (r) => {
          if (!r.ok) return [];
          const j = await r.json();
          const arr = Array.isArray(j) ? j : Array.isArray((j as any).content) ? (j as any).content : Array.isArray((j as any).data) ? (j as any).data : [];
          return arr;
        }).catch(() => []),
        visitsApi.getCommonVisits(token, { page: 0, size: 50, visitType: 'PROJECT_SITE_VISIT', from: '2000-01-01', to: new Date().toISOString().slice(0, 10) }).catch(() => ({ content: [] as CommonVisitRow[] } as unknown as { content: CommonVisitRow[] })),
        ProjectsAPI.getProjectSales(projectId, token),
      ]);
      if (stageActionsResult.status === 'fulfilled') setStageActions(stageActionsResult.value.allowedActions);
      // Deduplicate pipeline + approval-history (both 200 with same 4 rows per live fact) — render one accurate history
      if (pipelineResult.status === 'fulfilled' && approvalResult.status === 'fulfilled') {
        const combined = [...pipelineResult.value.content, ...approvalResult.value.content];
        const deduped = Array.from(new Map(combined.map((e: any) => [e.id, e])).values()) as ProjectPipelineEntry[];
        // Sort by entryDate if present, else enteredAt
        deduped.sort((a: any, b: any) => new Date((a as any).entryDate || (a as any).enteredAt || 0).getTime() - new Date((b as any).entryDate || (b as any).enteredAt || 0).getTime());
        setPipeline(deduped);
        setApprovalHistory([]);
      } else {
        if (pipelineResult.status === 'fulfilled') setPipeline(pipelineResult.value.content);
        if (approvalResult.status === 'fulfilled') setApprovalHistory(approvalResult.value.content);
      }
      if (partiesResult.status === 'fulfilled') setParties(partiesResult.value.content);
      if (ncResult.status === 'fulfilled') {
        setNcRegisters(ncResult.value);
        if (ncResult.value.length) {
          Promise.all(ncResult.value.map((nc) => ProjectsAPI.getNcDocuments(nc.id, token!).catch(() => []))).then((allDocs) => {
            const map: Record<number, any[]> = {};
            ncResult.value.forEach((nc, idx) => { map[nc.id] = allDocs[idx] as any[]; });
            setNcDocsMap(map);
          });
        } else setNcDocsMap({});
      }
      if (contactsResult.status === 'fulfilled') setContacts(contactsResult.value);
      if (notesResult.status === 'fulfilled') setNotes(notesResult.value);
      if (tasksResult.status === 'fulfilled') setTasks(tasksResult.value);
      if (docsResult.status === 'fulfilled') setDocuments(docsResult.value);
      if (employeesResult.status === 'fulfilled') setEmployees(employeesResult.value);
      if (contactMastersResult.status === 'fulfilled') setContactMasters(contactMastersResult.value as any[]);
      if (visitsResult.status === 'fulfilled') {
        const raw = visitsResult.value as unknown as { content: CommonVisitRow[] } | CommonVisitRow[];
        const list = Array.isArray(raw) ? raw : (raw as { content: CommonVisitRow[] }).content || [];
        setVisits(list.filter((v) => v.projectId === projectId));
      }
      if (salesResult.status === 'fulfilled') setSales(salesResult.value);
      const failed = [
        pipelineResult.status === 'rejected' && 'pipeline',
        approvalResult.status === 'rejected' && 'approval history',
        partiesResult.status === 'rejected' && 'parties',
        ncResult.status === 'rejected' && 'NC register',
        contactsResult.status === 'rejected' && 'contacts',
        notesResult.status === 'rejected' && 'notes',
        docsResult.status === 'rejected' && 'documents',
        salesResult.status === 'rejected' && 'sales',
      ].filter(Boolean);
      if (failed.length) setWarnings(failed.map((f) => `${f} could not be loaded`));
    } catch (error) {
      setProject(null);
      toast.error(getErrorMessage(error, 'Unable to load this project.'));
    } finally {
      setIsLoading(false);
    }
  }, [projectId, token, userData?.employeeId]);

  useEffect(() => { void load(); }, [load]);

  const reloadProject = useCallback(async () => {
    if (!token || !Number.isFinite(projectId)) return;
    try { const found = await ProjectsAPI.getProjectById(projectId, token); setProject(found); }
    catch (error) { toast.error(getErrorMessage(error, 'Unable to reload project.')) }
  }, [token, projectId]);

  const reloadPipeline = useCallback(async () => {
    if (!token || !Number.isFinite(projectId)) return;
    try {
      const [pipe, appr] = await Promise.all([
        ProjectsAPI.getProjectPipeline(projectId, token),
        ProjectsAPI.getProjectApprovalHistory(projectId, token),
      ]);
      const combined = [...pipe.content, ...appr.content];
      const deduped = Array.from(new Map(combined.map((e: any) => [e.id, e])).values()) as ProjectPipelineEntry[];
      deduped.sort((a: any, b: any) => new Date((a as any).entryDate || (a as any).enteredAt || 0).getTime() - new Date((b as any).entryDate || (b as any).enteredAt || 0).getTime());
      setPipeline(deduped);
      setApprovalHistory([]);
    } catch (error) { toast.error(getErrorMessage(error, 'Unable to reload pipeline.')) }
  }, [token, projectId]);

  const reloadNc = useCallback(async () => {
    if (!token || !Number.isFinite(projectId)) return;
    try {
      const ncs = await ProjectsAPI.getNcRegisters(projectId, token);
      setNcRegisters(ncs);
      if (ncs.length) {
        const allDocs = await Promise.all(ncs.map((nc) => ProjectsAPI.getNcDocuments(nc.id, token).catch(() => [])));
        const map: Record<number, any[]> = {};
        ncs.forEach((nc, idx) => { map[nc.id] = allDocs[idx] as any[]; });
        setNcDocsMap(map);
      } else setNcDocsMap({});
    } catch (error) { toast.error(getErrorMessage(error, 'Unable to reload NC register.')) }
  }, [token, projectId]);

  const reloadContacts = useCallback(async () => {
    if (!token || !Number.isFinite(projectId)) return;
    try { setContacts(await ProjectsAPI.getContacts(projectId, token)); }
    catch (error) { toast.error(getErrorMessage(error, 'Unable to reload contacts.')) }
  }, [token, projectId]);

  const reloadNotes = useCallback(async () => {
    if (!token || !Number.isFinite(projectId)) return;
    try { setNotes(await ProjectsAPI.getNotes(projectId, token)); }
    catch (error) { toast.error(getErrorMessage(error, 'Unable to reload notes.')) }
  }, [token, projectId]);

  const reloadTasks = useCallback(async () => {
    if (!token || !Number.isFinite(projectId)) return;
    try { setTasks(await ProjectsAPI.getTasks(projectId, project?.assignedEmployeeId || userData?.employeeId || 0, token)); }
    catch (error) { toast.error(getErrorMessage(error, 'Unable to reload tasks.')) }
  }, [token, projectId, project?.assignedEmployeeId, userData?.employeeId]);

  const reloadVisits = useCallback(async () => {
    if (!token || !Number.isFinite(projectId)) return;
    try {
      const page = await visitsApi.getCommonVisits(token, { page: 0, size: 50, visitType: 'PROJECT_SITE_VISIT', from: '2000-01-01', to: new Date().toISOString().slice(0, 10) });
      const raw = page as unknown as { content: CommonVisitRow[] } | CommonVisitRow[];
      const list = Array.isArray(raw) ? raw : raw.content || [];
      setVisits(list.filter((v) => v.projectId === projectId));
    } catch (error) { toast.error(getErrorMessage(error, 'Unable to reload visits.')) }
  }, [token, projectId]);

  const planVisit = async () => {
    if (!token || !project) return;
    const assigned = Number(visitForm.employeeId);
    if (!assigned || !visitForm.date || !visitForm.purpose.trim()) { toast.error('Employee, visit date, and purpose are required.'); return }
    setBusy(true);
    try {
      await ProjectsAPI.planVisit({
        projectId, assignedEmployeeId: assigned, assignedByEmployeeId,
        scheduledVisitDate: visitForm.date, scheduledStartTime: `${visitForm.startTime}:00`, scheduledEndTime: `${visitForm.endTime}:00`,
        purpose: visitForm.purpose.trim(), selfGenerated: visitForm.selfGenerated,
      }, token);
      toast.success('Visit planned.');
      setVisitOpen(false);
      await reloadVisits();
    } catch (error) { toast.error(getErrorMessage(error, 'Unable to plan visit.')) } finally { setBusy(false) }
  };

  const saveEdit = async () => {
    if (!token || !editDraft) return;
    const errors: string[] = [];
    if (!editDraft.projectName.trim()) errors.push('Project name is required.');
    if (!editDraft.locationText.trim()) errors.push('Location is required.');
    if (!editDraft.state.trim()) errors.push('State is required.');
    if (errors.length) { setEditErrors(errors); return; }
    setBusy(true);
    try {
      const toNum = (v: string): number | null => { const n = Number(v); return Number.isFinite(n) ? n : null; };
      await ProjectsAPI.updateProject(projectId, {
        projectName: editDraft.projectName.trim(),
        locationText: editDraft.locationText.trim(),
        locationLatitude: toNum(editDraft.locationLatitude),
        locationLongitude: toNum(editDraft.locationLongitude),
        projectType: editDraft.projectType as Project['projectType'],
        estimatedTmtMt: toNum(editDraft.estimatedTmtMt),
        startDate: editDraft.startDate || null,
        completionDate: editDraft.completionDate || null,
        sourceApprovalStatus: editDraft.sourceApprovalStatus as ProjectStage,
        approvalLetterReference: editDraft.approvalLetterReference.trim() || null,
        assignedEmployeeId: toNum(editDraft.assignedEmployeeId),
        active: editDraft.active,
      }, token);
      toast.success('Project updated.');
      setEditOpen(false);
      await reloadProject();
    } catch (error) { toast.error(getErrorMessage(error, 'Unable to update project.')); } finally { setBusy(false); }
  };

  const deactivate = async () => {
    if (!token) return;
    setBusy(true);
    try {
      await ProjectsAPI.deleteProject(projectId, token);
      toast.success('Project marked inactive.');
      router.push('/dashboard/projects');
    } catch (error) { toast.error(getErrorMessage(error, 'Unable to deactivate project.')); } finally { setBusy(false); }
  };

  const advanceStage = async () => {
    if (!token || !project) return;
    const errors: string[] = [];
    if (!advanceForm.toStatus) errors.push('Target status is required.');
    if (!advanceForm.remarks.trim()) errors.push('Remarks are required for stage transitions.');
    if (!advanceForm.decisionByEmployeeId) errors.push('Responsible employee is required by the backend.');
    if (project.sourceApprovalStatus === 'NC_RAISED' && advanceForm.toStatus !== 'NC_CLOSURE_SUBMITTED') {
      errors.push('After NC_RAISED, the next stage must be NC_CLOSURE_SUBMITTED.');
    }
    if (project.sourceApprovalStatus === 'NC_CLOSURE_SUBMITTED' && advanceForm.toStatus === 'SOURCE_APPROVED' && hasOpenNc) {
      errors.push('Cannot approve with open NCs. Close all NCs before approval.');
    }
    if ((advanceForm.toStatus === 'SOURCE_APPROVED') && hasOpenNc) {
      errors.push('Cannot advance to source approval with open NCs.');
    }
    if (!allowedNextStatuses.includes(advanceForm.toStatus)) {
      errors.push(`Invalid transition from ${humanize(project.sourceApprovalStatus)} to ${humanize(advanceForm.toStatus)}.`);
    }
    if (errors.length) { setAdvanceErrors(errors); return; }
    setBusy(true);
    setAdvanceErrors([]);
    try {
      await ProjectsAPI.advanceStage(projectId, {
        nextStage: advanceForm.toStatus,
        responsibleEmployeeId: advanceForm.decisionByEmployeeId ? Number(advanceForm.decisionByEmployeeId) : null,
        entryDate: new Date().toISOString().slice(0, 10),
        outcomeComment: advanceForm.remarks.trim(),
      }, token);
      toast.success(`Stage advanced to ${humanize(advanceForm.toStatus)}.`);
      setAdvanceOpen(false);
      await reloadProject();
      await reloadPipeline();
    } catch (error) { toast.error(getErrorMessage(error, 'Unable to advance stage.')); } finally { setBusy(false); }
  };

  const createNc = async () => {
    if (!token || !project) return;
    if (hasClosedNc) { toast.error('This project already completed its NC lifecycle. Another NC cannot be raised.'); return }
    if (!ncForm.description.trim()) { toast.error('NC description is required.'); return }
    setBusy(true);
    try {
      await ProjectsAPI.createNc({
        projectId,
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
    } catch (error) { toast.error(getErrorMessage(error, 'Unable to create NC.')); } finally { setBusy(false); }
  };

  const openSubmitNc = async (nc: ProjectNcRegister) => {
    setSubmitNc(nc);
    setSubmitText('');
    setSubmitEvidenceId('');
    setSubmitFile(null);
    setSubmitDocs([]);
    if (!token) return;
    try { setSubmitDocs(await ProjectsAPI.getNcDocuments(nc.id, token)); }
    catch { setSubmitDocs([]); }
  };

  const doSubmitNc = async () => {
    if (!token || !submitNc) return;
    if (!submitText.trim()) { toast.error('Corrective action text is required.'); return }
    let evidenceId = submitEvidenceId ? Number(submitEvidenceId) : null;
    setNcBusyId(submitNc.id);
    try {
      if (submitFile) {
        await ProjectsAPI.uploadNcEvidence(submitNc.id, submitFile, token);
        const docs = await ProjectsAPI.getNcDocuments(submitNc.id, token);
        setSubmitDocs(docs);
        evidenceId = docs.length ? docs[docs.length - 1].id : evidenceId;
      }
      if (!evidenceId) { toast.error('Attach closure evidence (file) to submit.'); return }
      await ProjectsAPI.submitNcClosure(submitNc.id, { correctiveActionText: submitText.trim(), evidenceDocumentId: evidenceId, witnessedVisitId: null }, token);
      toast.success(`NC #${submitNc.id} closure submitted.`);
      setSubmitNc(null);
      await reloadNc();
    } catch (error) { toast.error(getErrorMessage(error, 'Unable to submit NC closure.')) } finally { setNcBusyId(null); }
  };

  const openAcceptNc = async (nc: ProjectNcRegister) => {
    setAcceptNc(nc);
    setAcceptForm({ closureMethod: 'DOCUMENTARY_EVIDENCE_ONLY', acceptanceDate: new Date().toISOString().slice(0, 10), acceptingOfficialText: '', evidenceDocumentId: '', witnessedVisitId: '' });
    if (!token) return;
    try { setSubmitDocs(await ProjectsAPI.getNcDocuments(nc.id, token)); }
    catch { setSubmitDocs([]); }
  };

  const doAcceptNc = async () => {
    if (!token || !acceptNc) return;
    if (!acceptForm.acceptingOfficialText.trim()) { toast.error('Accepting official is required.'); return }
    if (acceptForm.closureMethod === 'RE_VISIT_WITNESSED' && !acceptForm.witnessedVisitId) { toast.error('Choose the re-visit that witnessed the closure.'); return }
    setNcBusyId(acceptNc.id);
    try {
      await ProjectsAPI.acceptNcClosure(acceptNc.id, {
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

  const openParty = (party?: ProjectParty) => {
    setEditingParty(party ?? null);
    setPartyForm(party ? {
      partyRole: party.partyRole ?? 'CONTRACTOR',
      partyNameText: (party as unknown as { partyNameText?: string }).partyNameText ?? (party as unknown as { partyName?: string }).partyName ?? '',
      packageName: party.packageName ?? '',
      primaryParty: !!party.primaryParty,
    } : { partyRole: 'CONTRACTOR', partyNameText: '', packageName: '', primaryParty: false });
    setPartyOpen(true);
  };

  const saveParty = async () => {
    if (!token || !project) return;
    if (!partyForm.partyNameText.trim()) { toast.error('Party name is required.'); return }
    setBusy(true);
    try {
      if (editingParty) {
        await ProjectsAPI.updateProjectParty(editingParty.id, {
          projectId, partyRole: partyForm.partyRole as 'OWNER_CLIENT' | 'CONTRACTOR' | 'CONSULTANT',
          partyNameText: partyForm.partyNameText.trim(), packageName: partyForm.packageName.trim() || null,
          primaryParty: partyForm.primaryParty, active: true,
        }, token);
        toast.success('Party updated.');
      } else {
        await ProjectsAPI.addProjectParty(projectId, {
          partyRole: partyForm.partyRole as 'OWNER_CLIENT' | 'CONTRACTOR' | 'CONSULTANT',
          partyNameText: partyForm.partyNameText.trim(), packageName: partyForm.packageName.trim() || null,
          primaryParty: partyForm.primaryParty,
        }, token);
        toast.success('Party added.');
      }
      setPartyOpen(false);
      setEditingParty(null);
      try { setParties((await ProjectsAPI.getProjectParties(projectId, token)).content); }
      catch (error) { toast.error(getErrorMessage(error, 'Unable to reload parties.')) }
    } catch (error) { toast.error(getErrorMessage(error, 'Unable to save party.')) } finally { setBusy(false) }
  };

  const removeParty = async (party: ProjectParty) => {
    if (!token || !window.confirm(`Remove ${(party as unknown as { partyNameText?: string }).partyNameText ?? (party as unknown as { partyName?: string }).partyName ?? 'this party'} from this project?`)) return;
    setBusy(true);
    try { await ProjectsAPI.deactivateProjectParty(party.id, token); toast.success('Party removed.'); try { setParties((await ProjectsAPI.getProjectParties(projectId, token)).content); } catch { await load(); } } catch (error) { toast.error(getErrorMessage(error, 'Unable to remove party.')); } finally { setBusy(false) }
  };

  const saveContact = async () => {
    if (!token || !project) return;
    if (!contactForm.firstName.trim() || !contactForm.designation.trim() || contactForm.mobile.replace(/\D/g, '').length !== 10) {
      toast.error('First name, designation, and 10-digit mobile are required.'); return;
    }
    setBusy(true);
    try {
      const payload = {
        firstName: contactForm.firstName.trim(), lastName: contactForm.lastName.trim(), mobile: contactForm.mobile.replace(/\D/g, ''),
        email: contactForm.email.trim() || null, designation: contactForm.designation.trim(),
        departmentFunction: contactForm.departmentFunction.trim() || null,
        influenceLevel: (contactForm.influenceLevel || null) as 'DECISION_MAKER' | 'RECOMMENDER' | 'GATEKEEPER' | 'TECHNICAL_EVALUATOR' | null,
        projectPartyId: contactForm.projectPartyId ? Number(contactForm.projectPartyId) : null, active: editingContact?.active ?? true,
      } as const;
      if (editingContact) await ProjectsAPI.updateContact(editingContact.id, payload, token);
      else await ProjectsAPI.createContact(projectId, payload, token);
      toast.success(editingContact ? 'Contact updated.' : 'Contact added.');
      setContactOpen(false);
      setEditingContact(null);
      setContactForm(emptyContactForm);
      await reloadContacts();
    } catch (error) { toast.error(getErrorMessage(error, 'Unable to add contact.')); } finally { setBusy(false); }
  };

  const addNote = async () => {
    if (!token || !noteText.trim()) return;
    setBusy(true);
    try {
      await ProjectsAPI.createNote(projectId, noteText.trim(), token);
      toast.success('Note added.');
      setNoteOpen(false);
      setNoteText('');
      await reloadNotes();
    } catch (error) { toast.error(getErrorMessage(error, 'Unable to add note.')); } finally { setBusy(false); }
  };

  const addSale = async () => {
    if (!token) return;
    const quantityMt = Number(saleForm.quantityMt);
    if (!saleForm.saleDate || saleForm.saleDate > today()) { toast.error('PO date is required and cannot be in the future.'); return; }
    if (!Number.isFinite(quantityMt) || quantityMt <= 0) { toast.error('Quantity must be greater than zero.'); return; }
    if (!saleForm.invoiceReference.trim()) { toast.error('PO number is required.'); return; }
    setBusy(true);
    try {
      await ProjectsAPI.createProjectSale({ projectId, saleDate: saleForm.saleDate, quantityMt, invoiceReference: saleForm.invoiceReference.trim(), sourceSystem: 'WEB' }, token);
      setSales(await ProjectsAPI.getProjectSales(projectId, token));
      setSaleOpen(false);
      setSaleForm({ saleDate: today(), quantityMt: '', invoiceReference: '' });
      toast.success('Project sale recorded.');
    } catch (error) { toast.error(getErrorMessage(error, 'Unable to record project sale.')); } finally { setBusy(false); }
  };

  const addTask = async () => {
    if (!token) return;
    const employeeId = Number(taskForm.employeeId);
    if (!taskForm.title.trim() || !taskForm.dueDate || !employeeId) { toast.error('Title, assignee, and due date are required.'); return }
    setBusy(true);
    try {
      const payload = { taskTitle: taskForm.title.trim(), taskDescription: taskForm.description.trim() || null, taskType: 'FOLLOW_UP', status: taskForm.status, priority: taskForm.priority, assignedToEmployeeId: employeeId, assignedByEmployeeId, dueDate: taskForm.dueDate, projectId, visitActivityId: null };
      if (editingTask) await ProjectsAPI.updateTask(editingTask.id, payload, token); else await ProjectsAPI.createTask(payload, token);
      toast.success(editingTask ? 'Task updated.' : 'Task created.');
      setTaskOpen(false);
      setEditingTask(null);
      setTaskForm({ title: '', description: '', employeeId: '', dueDate: today(), priority: 'MEDIUM', status: 'OPEN' });
      await reloadTasks();
    } catch (error) { toast.error(getErrorMessage(error, 'Unable to create task.')); } finally { setBusy(false); }
  };

  const removeTask = async (task: ProjectTask) => {
    if (!token || !window.confirm(`Delete task "${task.title}"?`)) return;
    setBusy(true);
    try { await ProjectsAPI.deleteTask(task.id, token); toast.success('Task deleted.'); await reloadTasks(); } catch (error) { toast.error(getErrorMessage(error, 'Unable to delete task.')); } finally { setBusy(false); }
  };

  if (isLoading) return <div className="flex min-h-[420px] items-center justify-center"><Loader2 className="h-7 w-7 animate-spin text-muted-foreground" /></div>;
  if (!Number.isFinite(projectId) || !project) return <Card><CardHeader><CardTitle>Project not found</CardTitle></CardHeader><CardContent><Button variant="outline" onClick={() => router.push('/dashboard/projects')}><ArrowLeft className="mr-2 h-4 w-4" />Back to projects</Button></CardContent></Card>;

  return (
    <div className="space-y-4 font-poppins text-xs">
      <div className="flex flex-col justify-between gap-3 lg:flex-row lg:items-center">
        <div className="flex gap-3">
          <Button size="icon" variant="outline" onClick={() => router.push('/dashboard/projects')} aria-label="Back to projects"><ArrowLeft className="h-4 w-4" /></Button>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-lg font-semibold">{project.projectName}</h1>
              <Badge variant={STAGE_VARIANT[project.sourceApprovalStatus] ?? 'outline'}>{humanize(project.sourceApprovalStatus)}</Badge>
              {!project.active && <Badge variant="destructive">Inactive</Badge>}
            </div>
            <p className="mt-0.5 text-xs text-muted-foreground">#{project.id} · {humanize(project.projectType)} · {project.locationText || '—'}</p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={() => { setEditDraft({ projectName: project.projectName, institutionId: project.institutionId == null ? '' : String(project.institutionId), locationText: project.locationText, state: project.state, locationLatitude: '', locationLongitude: '', projectType: project.projectType, estimatedTmtMt: project.estimatedTmtMt == null ? '' : String(project.estimatedTmtMt), startDate: '', completionDate: '', sourceApprovalStatus: project.sourceApprovalStatus, approvalLetterReference: '', assignedEmployeeId: project.assignedEmployeeId == null ? '' : String(project.assignedEmployeeId), active: project.active }); setEditErrors([]); setEditOpen(true); }}><Edit3 className="mr-2 h-3.5 w-3.5" />Edit</Button>
          {allowedNextStatuses.length > 0 && (
            <Button size="sm" onClick={() => { setAdvanceForm({ toStatus: allowedNextStatuses[0], remarks: '', decisionByEmployeeId: project.assignedEmployeeId ? String(project.assignedEmployeeId) : '' }); setAdvanceErrors([]); setAdvanceOpen(true); }}><ShieldCheck className="mr-2 h-3.5 w-3.5" />Advance</Button>
          )}
          <Button variant="ghost" size="sm" onClick={() => void load()}><RefreshCw className="mr-2 h-3.5 w-3.5" />Refresh</Button>
          <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-destructive" disabled={!project.active} onClick={() => setDeleteOpen(true)}>Deactivate</Button>
        </div>
      </div>

      {warnings.length > 0 && <div className="flex gap-2 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900"><AlertCircle className="mt-0.5 h-4 w-4 shrink-0" /><p>Project loaded, but {warnings.join(', ')}. Retry with Refresh.</p></div>}

      {hasOpenNc && (
        <div className="flex gap-2 rounded-lg border border-orange-300 bg-orange-50 p-3 text-sm text-orange-800">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{openNcCount} open NC(s) block approval. Close all NCs before advancing to SOURCE_APPROVED.</span>
        </div>
      )}

      <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,1fr)_300px]">
      <div className="min-w-0 space-y-4">
      <Card className="border-l-4 border-l-primary py-0">
        <CardContent className="flex flex-col gap-2 px-4 py-2.5 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex min-w-0 items-center gap-2">
            <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
            <p className="truncate text-[13px] font-medium">
              {project.sourceApprovalStatus === 'NOT_STARTED' ? 'Next required: Submit credentials to contractor' : project.sourceApprovalStatus === 'CREDENTIALS_SUBMITTED_TO_CONTRACTOR' ? 'Next: Forward to consultant' : project.sourceApprovalStatus === 'FORWARDED_TO_CONSULTANT' ? 'Next: Under review — await consultant' : project.sourceApprovalStatus === 'UNDER_REVIEW' ? 'Next: Schedule technical visit or await decision' : project.sourceApprovalStatus === 'TECHNICAL_VISIT_SCHEDULED' ? 'Next: Complete visit, raise NCs if any' : project.sourceApprovalStatus === 'NC_RAISED' ? 'Next required: Submit NC closure' : project.sourceApprovalStatus === 'NC_CLOSURE_SUBMITTED' ? 'Next: Await re-review / approval' : project.sourceApprovalStatus === 'SOURCE_APPROVED' ? 'Approved for this site — supply + track completion' : project.sourceApprovalStatus === 'PROJECT_COMPLETED' ? 'Completed — no further action' : 'Rejected — restart source approval'}
            </p>
          </div>
          <div className="flex shrink-0 flex-wrap gap-1.5">
            {allowedNextStatuses.length > 0 && <Button size="sm" className="h-7 px-2.5 text-xs" onClick={() => { setAdvanceForm({ toStatus: allowedNextStatuses[0], remarks: '', decisionByEmployeeId: project.assignedEmployeeId ? String(project.assignedEmployeeId) : '' }); setAdvanceErrors([]); setAdvanceOpen(true); }}>Advance to {humanize(allowedNextStatuses[0])}</Button>}
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Card><CardHeader className="pb-2"><CardDescription className="text-xs">Estimated TMT</CardDescription><CardTitle className="text-base">{project.estimatedTmtMt ?? '—'}{project.estimatedTmtMt != null ? ' MT' : ''}</CardTitle></CardHeader></Card>
        <Card><CardHeader className="pb-2"><CardDescription className="text-xs">Open NCs</CardDescription><CardTitle className="text-base">{openNcCount}</CardTitle></CardHeader></Card>
        <Card><CardHeader className="pb-2"><CardDescription className="text-xs">Next milestone</CardDescription><CardTitle className="truncate text-sm" title={allowedNextStatuses[0] ? humanize(allowedNextStatuses[0]) : 'No next stage'}>{allowedNextStatuses[0] ? humanize(allowedNextStatuses[0]) : 'No next stage'}</CardTitle></CardHeader></Card>
        <Card><CardHeader className="pb-2"><CardDescription className="text-xs">Target completion</CardDescription><CardTitle className="text-base">{showDate(project.completionDate)}</CardTitle></CardHeader></Card>
      </div>
      {false && (() => {
        const APPROVAL_FLOW: ProjectStage[] = ['NOT_STARTED','CREDENTIALS_SUBMITTED_TO_CONTRACTOR','FORWARDED_TO_CONSULTANT','UNDER_REVIEW','TECHNICAL_VISIT_SCHEDULED','SOURCE_APPROVED','PROJECT_COMPLETED'];
        const EXCEPTION_STAGES: string[] = ['NC_RAISED','NC_CLOSURE_SUBMITTED','REJECTED'];
        const current = project.sourceApprovalStatus as string;
        const isException = EXCEPTION_STAGES.includes(current);
        const pipelineByStage = new Map(pipeline.map((e) => [String(e.stage), e]));
        const getEntryDate = (stage: string) => {
          const e = pipelineByStage.get(stage) as ProjectPipelineEntry | undefined;
          return e ? e.enteredAt : null;
        };
        return (
          <Card className="border-2">
            <CardHeader className="pb-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <CardTitle className="text-base">Approval Progress</CardTitle>
                  <CardDescription>Current stage: <span className="font-medium text-foreground">{humanize(current)}</span>{isException ? ' · Exception branch — normal path paused' : ''}</CardDescription>
                </div>
                <Badge variant={STAGE_VARIANT[current] ?? 'outline'} className="shrink-0">{humanize(current)}</Badge>
              </div>
            </CardHeader>
            <CardContent>
              {/* Horizontal stepper — scrollable on small screens */}
              <div className="overflow-x-auto pb-2">
                <ol className="flex min-w-[720px] items-start gap-0 sm:min-w-0 sm:gap-1">
                  {APPROVAL_FLOW.map((stage, idx) => {
                    const isCurrent = stage === current;
                    const entry = pipelineByStage.get(stage) as ProjectPipelineEntry | undefined;
                    const isCompleted = !!entry && !isCurrent;
                    const isUpcoming = !isCurrent && !isCompleted;
                    const dateLabel = entry ? showDate(entry.enteredAt) : null;
                    return (
                      <li key={stage} className="flex flex-1 items-start gap-1">
                        <div className="flex min-w-0 flex-1 flex-col items-center text-center">
                          <div className={`flex h-8 w-8 items-center justify-center rounded-full border-2 text-xs font-semibold ${isCurrent ? 'border-primary bg-primary text-primary-foreground' : isCompleted ? 'border-emerald-500 bg-emerald-500 text-white' : 'border-muted-foreground/30 bg-muted text-muted-foreground'}`}>
                            {isCompleted ? '✓' : isCurrent ? '●' : idx + 1}
                          </div>
                          <p className={`mt-1.5 max-w-[110px] text-[11px] font-medium leading-tight ${isCurrent ? 'text-foreground' : isCompleted ? 'text-emerald-700' : 'text-muted-foreground'}`}>{humanize(stage)}</p>
                          {dateLabel && entry ? (
                            <p className="mt-0.5 text-[10px] text-muted-foreground">{dateLabel}{entry.enteredBy && entry.enteredBy !== '—' ? ` · ${entry.enteredBy}` : ''}</p>
                          ) : (
                            <p className="mt-0.5 text-[10px] text-muted-foreground">{isCurrent ? 'Current' : isCompleted ? 'Done' : 'Upcoming'}</p>
                          )}
                          {entry?.remarks && entry.remarks !== '—' && <p className="mt-1 max-w-[140px] truncate text-[10px] text-muted-foreground" title={entry.remarks}>{entry.remarks}</p>}
                        </div>
                        {idx < APPROVAL_FLOW.length - 1 && (
                          <div className={`mt-4 h-0.5 flex-1 ${pipelineByStage.has(APPROVAL_FLOW[idx + 1]) || isCompleted ? 'bg-emerald-500' : 'bg-muted-foreground/20'}`} />
                        )}
                      </li>
                    );
                  })}
                </ol>
              </div>
              {isException && (
                <div className="mt-4 rounded-lg border border-amber-300 bg-amber-50 p-3">
                  <div className="flex flex-wrap items-center gap-2 text-sm">
                    <Badge variant="destructive">{humanize(current)}</Badge>
                    <span className="text-amber-900">Exception — normal approval is paused until resolved.</span>
                  </div>
                  {(() => {
                    const exEntry = pipelineByStage.get(current) as ProjectPipelineEntry | undefined;
                    return exEntry ? (
                      <p className="mt-1.5 text-xs text-amber-800">
                        Entered {showDate(exEntry.enteredAt)}{exEntry.enteredBy && exEntry.enteredBy !== '—' ? ` · ${exEntry.enteredBy}` : ''}{exEntry.remarks && exEntry.remarks !== '—' ? ` · ${exEntry.remarks}` : ''}
                      </p>
                    ) : null;
                  })()}
                </div>
              )}
            </CardContent>
          </Card>
        );
      })()}

      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList className="h-auto flex-wrap justify-start">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="pipeline">Pipeline ({pipeline.length})</TabsTrigger>
          <TabsTrigger value="nc">NC Register ({ncRegisters.length})</TabsTrigger>
          <TabsTrigger value="parties">Parties ({parties.length})</TabsTrigger>
          <TabsTrigger value="contacts">Contacts ({contacts.length})</TabsTrigger>
          <TabsTrigger value="visits">Visits ({visits.length})</TabsTrigger>
          <TabsTrigger value="sales">Sales ({sales.length})</TabsTrigger>
          <TabsTrigger value="notes">Notes ({notes.length})</TabsTrigger>
          <TabsTrigger value="documents">Documents ({documents.length})</TabsTrigger>
          <TabsTrigger value="tasks">Tasks ({tasks.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="grid gap-4 lg:grid-cols-2">
          <Card><CardHeader><CardTitle className="text-sm">Project profile</CardTitle></CardHeader><CardContent className="grid gap-4 sm:grid-cols-2">
            <Info label="Project type" value={humanize(project.projectType)} />
            <Info label="State" value={project.state} />
            <Info label="Institution" value={project.institutionName} />
            <Info label="Location" value={project.locationText} />
            <Info label="Assigned Employee" value={project.assignedEmployeeName} />
            <Info label="Owner" value={(project as any).ownerEmployeeName || (project as any).ownerName || (project.assignedEmployeeId ? `Employee #${project.assignedEmployeeId}` : '—')} />
            <Info label="Client" value={(project as any).clientAccountName || (project as any).clientName || (project as any).accountName || '—'} />
            <Info label="Active" value={project.active ? 'Yes' : 'No'} />
          </CardContent></Card>
          <Card><CardHeader><CardTitle className="text-sm">Lifecycle details</CardTitle></CardHeader><CardContent className="grid gap-4 sm:grid-cols-2">
            <Info label="Estimated TMT (Mt)" value={project.estimatedTmtMt} />
            <Info label="Contractor" value={project.contractorName} />
            <Info label="Consultant" value={project.consultantName} />
            <Info label="Created" value={showDate(project.createdAt)} />
            <Info label="Updated" value={showDate(project.updatedAt)} />
          </CardContent></Card>
        </TabsContent>

        <TabsContent value="pipeline" className={FLAT_TAB_SECTION_CLASS}>
          <Card><CardHeader><CardTitle className="text-sm">Stage pipeline & approval history</CardTitle></CardHeader><CardContent>{pipeline.length === 0 && approvalHistory.length === 0 ? <EmptyState text="No pipeline entries recorded yet." /> : (
              <><ol className="relative ml-1.5 space-y-3 border-l pl-4">
                {pipeline.map((entry) => {
                  const isCurrent = entry.stage === project.sourceApprovalStatus;
                  return (
                  <li key={entry.id} className="relative">
                    <span className={`absolute -left-[21px] top-1 h-2.5 w-2.5 rounded-full border-2 border-background ${isCurrent ? 'bg-primary' : 'bg-muted-foreground/60'}`} />
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <p className="text-sm font-medium leading-none">{humanize(entry.stage)}</p>
                          {isCurrent && <Badge variant="default" className="h-4 px-1 text-[10px]">Current</Badge>}
                          {entry.exitedAt && <Badge variant="outline" className="h-4 px-1 text-[10px]">exited</Badge>}
                        </div>
                        {entry.remarks && entry.remarks !== '—' && <p className="mt-1 truncate text-xs text-muted-foreground" title={entry.remarks}>{entry.remarks}</p>}
                      </div>
                      <div className="shrink-0 text-right">
                        <p className="text-xs font-medium leading-none">{showDate(entry.enteredAt)}{entry.exitedAt ? ` → ${showDate(entry.exitedAt)}` : ''}</p>
                        <p className="mt-1 text-[11px] text-muted-foreground">{pipelineOwnerName(entry.enteredBy)}</p>
                      </div>
                    </div>
                  </li>
                  );
                })}</ol>
                {approvalHistory.length > 0 && <ol className="relative ml-1.5 mt-3 space-y-3 border-l pl-4">
                {approvalHistory.map((h) => {
                  const isCurrentApproval = h.toStage === project.sourceApprovalStatus;
                  return (
                  <li key={h.id} className="relative">
                    <span className={`absolute -left-[21px] top-1 h-2.5 w-2.5 rounded-full border-2 border-background ${isCurrentApproval ? 'bg-primary' : 'bg-muted-foreground/60'}`} />
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <p className="text-sm font-medium leading-none">{humanize(h.action)}</p>
                          {isCurrentApproval && <Badge variant="default" className="h-4 px-1 text-[10px]">Current</Badge>}
                        </div>
                        <p className="mt-1 truncate text-xs text-muted-foreground">{h.fromStage ? `${humanize(h.fromStage)} → ` : ''}{h.toStage ? humanize(h.toStage) : '—'}{h.remarks && h.remarks !== '—' ? ` · ${h.remarks}` : ''}</p>
                      </div>
                            <div className="shrink-0 text-right">
                              <p className="text-xs font-medium leading-none">{showDate(h.performedAt)}</p>
                              <p className="mt-1 text-[11px] text-muted-foreground">{pipelineOwnerName(h.performedBy)}</p>
                            </div>
                    </div>
                  </li>
                  );
                })}</ol>}
              </>
            )}
          </CardContent></Card>
        </TabsContent>

        <TabsContent value="nc" className={FLAT_TAB_SECTION_CLASS}>
          <Card><CardHeader><CardTitle className="text-sm">NC Register</CardTitle><CardAction>{hasClosedNc ? <span className="text-xs text-muted-foreground">NC lifecycle completed</span> : ['TECHNICAL_VISIT_SCHEDULED', 'NC_RAISED', 'NC_CLOSURE_SUBMITTED', 'UNDER_REVIEW'].includes(project.sourceApprovalStatus) ? <Button size="sm" onClick={() => { setNcForm({ description: '', raisedDate: today(), raisedByOfficialText: '', targetClosureDate: '', status: 'OPEN', responsibleEmployeeId: '' }); setNcOpen(true); }}><Plus className="mr-2 h-3.5 w-3.5" />Raise NC</Button> : <span className="text-xs text-muted-foreground">Available after technical visit</span>}</CardAction></CardHeader><CardContent className="space-y-3">
            {ncRegisters.length === 0 ? <EmptyState text="No NC records found." /> : ncRegisters.map((nc) => {
              const docs = ncDocsMap[nc.id] || [];
              const closureLine = (nc.status === 'SUBMITTED' || nc.status === 'CLOSED') && (nc.closureMethod || (nc as any).acceptingOfficialText || (nc as any).acceptanceDate || (nc as any).closureDate) ? [nc.closureMethod ? humanize(nc.closureMethod) : null, (nc as any).acceptingOfficialText, (nc as any).acceptanceDate || (nc as any).closureDate].filter(Boolean).join(' · ') : null;
              return (
              <NcSummaryCard key={nc.id} id={nc.id} status={nc.status} description={nc.description} raisedDate={showDate(nc.raisedDate)} raisedBy={nc.raisedByOfficialText || 'Not recorded'} targetDate={showDate(nc.targetClosureDate)} responsible={nc.responsibleEmployeeName} closureSummary={closureLine} evidence={docs} overdue={Boolean(nc.targetClosureDate && nc.status !== 'CLOSED' && nc.targetClosureDate < today())} actions={
                <>
                        {nc.status === 'OPEN' && <><Button variant="outline" size="sm" onClick={() => void openSubmitNc(nc)} disabled={ncBusyId === nc.id}>{ncBusyId === nc.id && <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />}Submit closure</Button><Button variant="outline" size="sm" onClick={async()=>{ const fd=document.createElement('input'); fd.type='file'; fd.onchange=async()=>{ const f=fd.files?.[0]; if(!f) return; setNcBusyId(nc.id); try{ await ProjectsAPI.uploadNcEvidence(nc.id, f, token!); toast.success('Evidence uploaded'); await reloadNc(); }catch(e){ toast.error(getErrorMessage(e,'Upload failed'))} finally{ setNcBusyId(null);}}; fd.click();}}>Add evidence</Button></>}
                        {nc.status === 'SUBMITTED' && <Button variant="outline" size="sm" onClick={() => void openAcceptNc(nc)} disabled={ncBusyId === nc.id}>{ncBusyId === nc.id && <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />}Accept & close</Button>}
                </>
              } />
            )})}
          </CardContent></Card>
        </TabsContent>

        <TabsContent value="parties" className={FLAT_TAB_SECTION_CLASS}>
                <Card><CardHeader><CardTitle className="text-base">Parties</CardTitle><CardAction><Button size="sm" onClick={() => openParty()}><Plus className="mr-2 h-3.5 w-3.5" />Add party</Button></CardAction></CardHeader><CardContent className="space-y-3">
                  {parties.length === 0 ? <EmptyState text="No parties linked yet." /> : parties.map((p) => {
                    const name = (p as unknown as { partyNameText?: string }).partyNameText ?? (p as unknown as { partyName?: string }).partyName ?? `Party #${p.id}`;
                    return (
                    <div key={p.id} className="flex flex-col justify-between gap-3 rounded-lg border p-4 sm:flex-row sm:items-center">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="font-medium truncate">{name}</p>
                          <Badge variant="outline">{humanize(p.partyRole)}</Badge>
                          {p.primaryParty && <Badge variant="default">Primary</Badge>}
                          {!p.active && <Badge variant="destructive">Inactive</Badge>}
                        </div>
                        <p className="text-sm text-muted-foreground truncate">{p.packageName ? `Package: ${p.packageName}` : 'No package'}</p>
                      </div>
                      <div className="flex gap-2">
                        <Button variant="outline" size="sm" onClick={() => openParty(p)}>Edit</Button>
                        <Button variant="ghost" size="icon" onClick={() => void removeParty(p)} disabled={busy}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                      </div>
                    </div>
                    );
                  })}
                </CardContent></Card>
        </TabsContent>

        <TabsContent value="contacts" className={FLAT_TAB_SECTION_CLASS}>
                        <Card><CardHeader><CardTitle className="text-sm">Contacts</CardTitle><CardAction><Button size="sm" onClick={() => { setEditingContact(null); setContactForm(emptyContactForm); setContactOpen(true); }}><UserPlus className="mr-2 h-3.5 w-3.5" />Add contact</Button></CardAction></CardHeader><CardContent className="space-y-3">
            {contacts.length === 0 ? <EmptyState text="No contacts linked yet." /> : contacts.map((contact) => {
              const master = contactMasters.find((m: any) => Number(m.id ?? (m as any).contactInfluenceRegisterId) === contact.contactInfluenceRegisterId) as any;
              const masterName = master ? [master.firstName ?? (master as any).first_name, master.lastName ?? (master as any).last_name].filter(Boolean).join(' ').trim() : '';
              const hasMasterName = !!masterName;
              const displayName = hasMasterName ? masterName : `Contact #${contact.contactInfluenceRegisterId || contact.id} — ${contact.designation || 'No designation'}`;
              const employeeMatch = employees.find((e) => e.id === contact.contactInfluenceRegisterId);
              const fallbackName = employeeMatch ? [employeeMatch.firstName, employeeMatch.lastName].filter(Boolean).join(' ') : null;
              const finalName = hasMasterName ? masterName : fallbackName || displayName;
              const linkedParty = parties.find((party) => party.id === contact.projectPartyId);
              const linkedPartyName = linkedParty ? ((linkedParty as unknown as { partyNameText?: string; partyName?: string }).partyNameText ?? (linkedParty as unknown as { partyName?: string }).partyName ?? `Party #${linkedParty.id}`) : null;
              return (
              <ContactSummaryCard key={contact.id} name={finalName} designation={[contact.designation, contact.departmentFunction, contact.influenceLevel ? humanize(contact.influenceLevel) : null, contact.roleDescription].filter(Boolean).join(' · ')} secondaryLine={linkedParty ? `${humanize(linkedParty.partyRole)} · ${linkedPartyName}` : 'Project-level contact · No party linked'} mobile={contact.mobile !== '—' ? contact.mobile : null} email={contact.email !== '—' && contact.email ? contact.email : null} primary={contact.primaryContact} active={contact.active} onEdit={() => { setEditingContact(contact); setContactForm({ firstName: contact.firstName || master?.firstName || '', lastName: contact.lastName || master?.lastName || '', mobile: contact.mobile !== '—' ? contact.mobile : '', email: contact.email !== '—' ? contact.email || '' : '', designation: contact.designation || '', departmentFunction: contact.departmentFunction || '', influenceLevel: contact.influenceLevel || '', projectPartyId: contact.projectPartyId ? String(contact.projectPartyId) : '' }); setContactOpen(true); }} />
            )})}
          </CardContent></Card>
        </TabsContent>

        <TabsContent value="visits" className={FLAT_TAB_SECTION_CLASS}>
              <Card><CardHeader><CardTitle className="text-sm">Visits</CardTitle><CardAction><Button size="sm" onClick={() => { setVisitForm({ employeeId: String(project.assignedEmployeeId || ''), date: new Date().toISOString().slice(0, 10), startTime: '10:00', endTime: '10:30', purpose: '', selfGenerated: true }); setVisitOpen(true); }}><CalendarPlus className="mr-2 h-3.5 w-3.5" />Plan visit</Button></CardAction></CardHeader><CardContent>{visits.length === 0 ? <EmptyState text="No visits yet." /> : <ol className="relative ml-1.5 space-y-3 border-l pl-4">{visits.map((v) => (
                <li key={v.id} className="relative"><span className="absolute -left-[21px] top-3 h-2.5 w-2.5 rounded-full border-2 border-background bg-muted-foreground/60" /><button type="button" onClick={() => router.push(`/dashboard/visits/${v.id}`)} className="flex w-full items-start justify-between gap-4 rounded-lg px-3 py-3 text-left transition-colors hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"><div className="min-w-0"><p className="truncate text-sm font-medium" title={v.purpose}>{v.purpose || 'Project visit'}</p><p className="mt-1 text-xs text-muted-foreground">{showDate(v.scheduledVisitDate)} · {v.assignedEmployeeName || employeeName(v.assignedEmployeeId)}</p></div><Badge variant="outline" className="shrink-0">{v.outcome ? humanize(v.outcome) : v.actualCheckinAt ? 'Checked in' : 'Planned'}</Badge></button></li>
              ))}</ol>}</CardContent></Card>
        </TabsContent>

        <TabsContent value="notes" className={FLAT_TAB_SECTION_CLASS}>
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
        </TabsContent>

        <TabsContent value="documents" className={FLAT_TAB_SECTION_CLASS}>
              <Card><CardHeader><CardTitle className="text-sm">Documents</CardTitle></CardHeader><CardContent>{documents.length === 0 ? <EmptyState text="No documents yet." /> : <ol className="relative ml-1.5 space-y-3 border-l pl-4">{documents.map((doc: any) => (
                <li key={doc.id} className="relative"><span className="absolute -left-[21px] top-1 h-2.5 w-2.5 rounded-full border-2 border-background bg-muted-foreground/60" /><div className="flex items-center justify-between gap-2"><div className="min-w-0 flex-1"><div className="flex items-center gap-1.5"><p className="truncate text-sm font-medium leading-none">{doc.fileName}</p>{doc.versionNumber ? <Badge variant="outline" className="h-4 px-1 text-[10px]">v{doc.versionNumber}</Badge> : null}{!doc.fileAttached && <Badge variant="destructive" className="h-4 px-1 text-[10px]">No file</Badge>}</div><p className="mt-1 text-[11px] text-muted-foreground">{humanize(doc.documentType)}{doc.uploadedAt ? ` · ${showDate(doc.uploadedAt)}` : ''}</p></div><div className="flex shrink-0 gap-1"><Button size="sm" variant="outline" className="h-7 px-2 text-xs" disabled={!doc.fileAttached} onClick={async()=>{ const base=process.env.NEXT_PUBLIC_API_BASE_URL||'http://ec2-18-211-58-135.compute-1.amazonaws.com:8081'; const list=await fetch(`${base}/api/hr/files?parentType=DOCUMENT_DEPOSITORY&parentId=${doc.id}&page=0&size=5`,{headers:{Authorization:`Bearer ${token}`}}).then(r=>r.ok?r.json():{content:[]}).catch(()=>({content:[]})); const fid=(list as any).content?.[0]?.id; if(!fid){ toast.error('File not ready'); return; } const res=await fetch(`${base}/api/hr/files/${fid}/download`,{headers:{Authorization:`Bearer ${token}`}}); if(!res.ok){ toast.error('File not ready'); return; } const blob=await res.blob(); const url=URL.createObjectURL(blob); window.open(url,'_blank'); setTimeout(()=>URL.revokeObjectURL(url),60000);}}>View</Button><Button size="sm" variant="ghost" className="h-7 px-2 text-xs" disabled={!doc.fileAttached} onClick={async()=>{ const base=process.env.NEXT_PUBLIC_API_BASE_URL||'http://ec2-18-211-58-135.compute-1.amazonaws.com:8081'; const list=await fetch(`${base}/api/hr/files?parentType=DOCUMENT_DEPOSITORY&parentId=${doc.id}&page=0&size=5`,{headers:{Authorization:`Bearer ${token}`}}).then(r=>r.ok?r.json():{content:[]}).catch(()=>({content:[]})); const fid=(list as any).content?.[0]?.id; if(!fid){ toast.error('Download failed'); return; } const res=await fetch(`${base}/api/hr/files/${fid}/download`,{headers:{Authorization:`Bearer ${token}`}}); if(!res.ok){ toast.error('Download failed'); return; } const blob=await res.blob(); const url=URL.createObjectURL(blob); const a=document.createElement('a'); a.href=url; a.download=doc.fileName||`doc-${doc.id}`; document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);}}>Download</Button></div></div></li>
              ))}</ol>}</CardContent></Card>
        </TabsContent>

        <TabsContent value="sales" className={FLAT_TAB_SECTION_CLASS}>
          <Card><CardHeader><CardTitle className="text-sm">Sales history</CardTitle><CardDescription>Recorded project purchase orders and quantities.</CardDescription><CardAction><Button size="sm" onClick={() => { setSaleForm({ saleDate: today(), quantityMt: '', invoiceReference: '' }); setSaleOpen(true); }}><Plus className="mr-2 h-3.5 w-3.5" />Record sale</Button></CardAction></CardHeader><CardContent className="space-y-3">
            {sales.length === 0 ? <EmptyState text="No project sales have been recorded." /> : sales.map((sale) => (
              <div key={sale.id} className="flex flex-col justify-between gap-2 rounded-lg border p-4 sm:flex-row sm:items-center">
                <div><p className="text-sm font-semibold">{sale.quantityMt.toLocaleString('en-IN')} MT</p><p className="mt-1 text-xs text-muted-foreground">PO #{sale.invoiceReference || '—'} · {sale.sourceSystem || 'Manual entry'}</p></div>
                <p className="text-xs font-medium text-muted-foreground">PO date · {showDate(sale.saleDate)}</p>
              </div>
            ))}
          </CardContent></Card>
        </TabsContent>

        <TabsContent value="tasks" className={FLAT_TAB_SECTION_CLASS}>
                        <Card><CardHeader><CardTitle className="text-sm">Follow-up tasks</CardTitle><CardAction><Button size="sm" onClick={() => { setEditingTask(null); setTaskForm({ title: '', description: '', employeeId: String(project.assignedEmployeeId || ''), dueDate: today(), priority: 'MEDIUM', status: 'OPEN' }); setTaskOpen(true); }}><Plus className="mr-2 h-3.5 w-3.5" />Add task</Button></CardAction></CardHeader><CardContent className="space-y-3">
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
                <div className="flex shrink-0 gap-1"><Button variant="ghost" size="sm" onClick={async () => { try { const details = await ProjectsAPI.getTaskById(task.id, token!); setEditingTask(details); setTaskForm({ title: details.title, description: details.description, employeeId: String(details.assignedEmployeeId || project.assignedEmployeeId || ''), dueDate: details.dueDate, priority: details.priority, status: details.status }); setTaskOpen(true); } catch (error) { toast.error(getErrorMessage(error, 'Unable to load task details.')); } }}>Edit</Button><Button variant="ghost" size="icon" onClick={() => void removeTask(task)} disabled={busy}><Trash2 className="h-4 w-4 text-destructive" /></Button></div>
              </div>
            ))}
          </CardContent></Card>
        </TabsContent>
      </Tabs>
      </div>
      <aside className="xl:sticky xl:top-4">
        <Card>
          <CardHeader className="pb-3"><CardTitle className="text-sm">About this project</CardTitle></CardHeader>
          <CardContent className="space-y-3 text-xs">
            <div className="flex items-center justify-between gap-3"><span className="text-muted-foreground">Stage</span><Badge variant={STAGE_VARIANT[project.sourceApprovalStatus] ?? 'outline'}>{humanize(project.sourceApprovalStatus)}</Badge></div>
            <div className="flex items-center justify-between gap-3"><span className="text-muted-foreground">Type</span><span className="font-medium">{humanize(project.projectType)}</span></div>
            <div className="flex items-center justify-between gap-3"><span className="text-muted-foreground">Owner</span><span className="max-w-[150px] truncate font-medium">{project.assignedEmployeeName || '—'}</span></div>
            <div className="h-px bg-border" />
            <div className="flex items-center justify-between gap-3"><span className="text-muted-foreground">Institution</span><span className="max-w-[150px] truncate font-medium" title={project.institutionName}>{project.institutionName || '—'}</span></div>
            <div className="flex items-center justify-between gap-3"><span className="text-muted-foreground">Location</span><span className="max-w-[150px] truncate font-medium" title={project.locationText}>{project.locationText || '—'}</span></div>
            <div className="flex items-center justify-between gap-3"><span className="text-muted-foreground">State</span><span className="font-medium">{project.state || '—'}</span></div>
            <div className="flex items-center justify-between gap-3"><span className="text-muted-foreground">Contractor</span><span className="max-w-[150px] truncate font-medium" title={project.contractorName}>{project.contractorName || '—'}</span></div>
            <div className="flex items-center justify-between gap-3"><span className="text-muted-foreground">Consultant</span><span className="max-w-[150px] truncate font-medium" title={project.consultantName}>{project.consultantName || '—'}</span></div>
            <div className="h-px bg-border" />
            <div className="flex items-center justify-between gap-3"><span className="text-muted-foreground">Start</span><span className="font-medium">{showDate(project.startDate)}</span></div>
            <div className="flex items-center justify-between gap-3"><span className="text-muted-foreground">Completion</span><span className="font-medium">{showDate(project.completionDate)}</span></div>
            <div className="flex items-center justify-between gap-3"><span className="text-muted-foreground">Letter ref</span><span className="max-w-[150px] truncate font-medium">{project.approvalLetterReference || '—'}</span></div>
          </CardContent>
        </Card>
      </aside>
      </div>

      {/* Edit Sheet */}
      <Sheet open={editOpen} onOpenChange={(open) => !busy && setEditOpen(open)}>
        <SheetContent className="flex w-full flex-col sm:max-w-2xl">
          <SheetHeader className="border-b pb-4"><SheetTitle>Edit project</SheetTitle></SheetHeader>
          <div className="min-h-0 flex-1 overflow-y-auto px-1 py-4">
          {editDraft && <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <Field label="Project name" required><Input value={editDraft.projectName} onChange={(e) => setEditDraft({ ...editDraft, projectName: e.target.value })} /></Field>
            <Field label="Location" required><Input value={editDraft.locationText} onChange={(e) => setEditDraft({ ...editDraft, locationText: e.target.value })} /></Field>
            <Field label="State" required><Input value={editDraft.state} onChange={(e) => setEditDraft({ ...editDraft, state: e.target.value })} /></Field>
            <Field label="Latitude"><Input type="number" step="any" value={editDraft.locationLatitude} onChange={(e) => setEditDraft({ ...editDraft, locationLatitude: e.target.value })} /></Field>
            <Field label="Longitude"><Input type="number" step="any" value={editDraft.locationLongitude} onChange={(e) => setEditDraft({ ...editDraft, locationLongitude: e.target.value })} /></Field>
            <Field label="Estimated TMT"><Input type="number" min="0" value={editDraft.estimatedTmtMt} onChange={(e) => setEditDraft({ ...editDraft, estimatedTmtMt: e.target.value })} /></Field>
            <Field label="Assigned employee"><Select value={editDraft.assignedEmployeeId} onValueChange={(v) => setEditDraft({ ...editDraft, assignedEmployeeId: v })}><SelectTrigger><SelectValue placeholder="Choose" /></SelectTrigger><SelectContent>{employees.map((e) => <SelectItem key={e.id} value={String(e.id)}>{[e.firstName, e.lastName].filter(Boolean).join(' ') || `Employee #${e.id}`}</SelectItem>)}</SelectContent></Select></Field>
            <Field label="Start date"><Input type="date" value={editDraft.startDate} onChange={(e) => setEditDraft({ ...editDraft, startDate: e.target.value })} /></Field>
            <Field label="Completion date"><Input type="date" value={editDraft.completionDate} onChange={(e) => setEditDraft({ ...editDraft, completionDate: e.target.value })} /></Field>
            <Field label="Approval letter ref"><Input value={editDraft.approvalLetterReference} onChange={(e) => setEditDraft({ ...editDraft, approvalLetterReference: e.target.value })} /></Field>
          </div>}
          {editErrors.length > 0 && <ul className="mt-4 list-disc rounded-lg border border-destructive/40 bg-destructive/5 p-4 pl-8 text-sm text-destructive">{editErrors.map((e) => <li key={e}>{e}</li>)}</ul>}
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
          <div className="grid gap-4">
            <Field label="Target status" required>
              <Select value={advanceForm.toStatus} onValueChange={(v) => setAdvanceForm({ ...advanceForm, toStatus: v as ProjectStage })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{allowedNextStatuses.map((s) => <SelectItem key={s} value={s}>{humanize(s)}</SelectItem>)}</SelectContent>
              </Select>
            </Field>
            <Field label="Responsible employee" required><Select value={advanceForm.decisionByEmployeeId} onValueChange={(v) => setAdvanceForm({ ...advanceForm, decisionByEmployeeId: v })}><SelectTrigger><SelectValue placeholder="Required" /></SelectTrigger><SelectContent>{employees.map((e) => <SelectItem key={e.id} value={String(e.id)}>{[e.firstName, e.lastName].filter(Boolean).join(' ') || `Employee #${e.id}`}</SelectItem>)}</SelectContent></Select></Field>
            <Field label="Remarks" required><Textarea value={advanceForm.remarks} onChange={(e) => setAdvanceForm({ ...advanceForm, remarks: e.target.value })} placeholder="Required for all stage transitions" /></Field>
          </div>
          {advanceErrors.length > 0 && <div className="rounded-lg border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive"><ul className="list-disc pl-5">{advanceErrors.map((e) => <li key={e}>{e}</li>)}</ul></div>}
          </div>
          <SheetFooter className="flex-row items-center justify-end gap-3 border-t pt-4">
            <Button variant="outline" onClick={() => setAdvanceOpen(false)} disabled={busy}>Cancel</Button>
            <Button onClick={() => void advanceStage()} disabled={busy}>{busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Advance</Button>
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
            <Field label="Department / function"><Input value={contactForm.departmentFunction} onChange={(e) => setContactForm({ ...contactForm, departmentFunction: e.target.value })} /></Field>
            <Field label="Party / organisation"><Select value={contactForm.projectPartyId || 'none'} onValueChange={(value) => setContactForm({ ...contactForm, projectPartyId: value === 'none' ? '' : value })}><SelectTrigger><SelectValue placeholder="Project-level contact" /></SelectTrigger><SelectContent><SelectItem value="none">Project-level contact (no party)</SelectItem>{parties.filter((party) => party.active).map((party) => { const name = (party as unknown as { partyNameText?: string; partyName?: string }).partyNameText ?? (party as unknown as { partyName?: string }).partyName ?? `Party #${party.id}`; return <SelectItem key={party.id} value={String(party.id)}>{humanize(party.partyRole)} · {name}</SelectItem>; })}</SelectContent></Select></Field>
            <Field label="Influence level"><Select value={contactForm.influenceLevel || 'none'} onValueChange={(value) => setContactForm({ ...contactForm, influenceLevel: value === 'none' ? '' : value })}><SelectTrigger><SelectValue placeholder="Not specified" /></SelectTrigger><SelectContent><SelectItem value="none">Not specified</SelectItem><SelectItem value="DECISION_MAKER">Decision maker</SelectItem><SelectItem value="RECOMMENDER">Recommender</SelectItem><SelectItem value="GATEKEEPER">Gatekeeper</SelectItem><SelectItem value="TECHNICAL_EVALUATOR">Technical evaluator</SelectItem></SelectContent></Select></Field>
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
          <div className="min-h-0 flex-1 overflow-y-auto px-1 py-4">
          <Field label="Note" required><Textarea rows={6} value={noteText} onChange={(e) => setNoteText(e.target.value)} /></Field>
          </div>
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
      <Sheet open={saleOpen} onOpenChange={(open) => !busy && setSaleOpen(open)}>
        <SheetContent className="overflow-y-auto sm:max-w-md"><SheetHeader><SheetTitle>Record project sale</SheetTitle></SheetHeader>
          <div className="mt-6 space-y-4">
            <Field label="PO date" required><Input type="date" max={today()} value={saleForm.saleDate} onChange={(event) => setSaleForm((current) => ({ ...current, saleDate: event.target.value }))} /></Field>
            <Field label="Quantity (MT)" required><Input type="number" min="0.001" step="0.001" inputMode="decimal" placeholder="25.5" value={saleForm.quantityMt} onChange={(event) => setSaleForm((current) => ({ ...current, quantityMt: event.target.value }))} /></Field>
            <Field label="PO number" required><Input placeholder="PO-2026-101" value={saleForm.invoiceReference} onChange={(event) => setSaleForm((current) => ({ ...current, invoiceReference: event.target.value }))} /></Field>
          </div>
          <SheetFooter className="mt-6"><Button variant="outline" onClick={() => setSaleOpen(false)} disabled={busy}>Cancel</Button><Button onClick={() => void addSale()} disabled={busy}>{busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Record sale</Button></SheetFooter>
        </SheetContent>
      </Sheet>

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

      {/* Party Sheet */}
      <Sheet open={partyOpen} onOpenChange={(open) => !busy && setPartyOpen(open)}>
        <SheetContent className="flex w-full flex-col sm:max-w-lg">
          <SheetHeader className="border-b pb-4"><SheetTitle>{editingParty ? 'Edit party' : 'Add party'}</SheetTitle></SheetHeader>
          <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-1 py-4">
            <Field label="Party role" required><Select value={partyForm.partyRole} onValueChange={(v) => setPartyForm({ ...partyForm, partyRole: v })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="OWNER_CLIENT">Owner / Client</SelectItem><SelectItem value="CONTRACTOR">Contractor</SelectItem><SelectItem value="CONSULTANT">Consultant</SelectItem></SelectContent></Select></Field>
            <Field label="Party name" required><Input value={partyForm.partyNameText} onChange={(e) => setPartyForm({ ...partyForm, partyNameText: e.target.value })} placeholder="e.g. ABC Constructions" /></Field>
            <Field label="Package (optional)"><Input value={partyForm.packageName} onChange={(e) => setPartyForm({ ...partyForm, packageName: e.target.value })} placeholder="e.g. Package 2" /></Field>
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={partyForm.primaryParty} onChange={(e) => setPartyForm({ ...partyForm, primaryParty: e.target.checked })} />Primary party</label>
          </div>
          <SheetFooter className="flex-row items-center justify-end gap-3 border-t pt-4">
            <Button variant="outline" onClick={() => setPartyOpen(false)} disabled={busy}>Cancel</Button>
            <Button onClick={() => void saveParty()} disabled={busy}>{busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}{editingParty ? 'Save changes' : 'Add party'}</Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>

      {/* Delete Dialog */}
      <Dialog open={deleteOpen} onOpenChange={(open) => !busy && setDeleteOpen(open)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Deactivate this project?</DialogTitle><DialogDescription>The DELETE endpoint performs a soft delete, preserving history.</DialogDescription></DialogHeader>
          <div className="rounded-lg border bg-muted/40 p-3 font-medium">{project.projectName}</div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteOpen(false)} disabled={busy}>Cancel</Button>
            <Button variant="destructive" onClick={() => void deactivate()} disabled={busy}>{busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Deactivate</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
