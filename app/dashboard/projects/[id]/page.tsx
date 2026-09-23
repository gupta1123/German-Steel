'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Activity, ArrowLeft, Building2, CalendarClock, CalendarDays, CalendarPlus, CheckCircle2, Download, Edit3, Eye, FileText, HardHat, Hash, History, Landmark, ListChecks, Loader2, Mail, MapPin, MoreHorizontal, Package, PackagePlus, Phone, Plus, RefreshCw, ShieldAlert, ShieldCheck, StickyNote, Trash2, User, UserPlus, Users, Workflow } from 'lucide-react';
import { toast } from 'sonner';


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
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { SearchableSelect, type SearchableOption } from '@/components/ui/searchable-select2';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { visitsApi, type CommonVisitRow } from '@/lib/visits-api';
import { DetailShell } from '@/components/detail-shell';
import { ActivityTimeline, DetailHero, DetailSkeleton, EmptyState, FilePicker, FormCheck, FormContext, FormField, FormGroup, FormSheet, Info, Initials, KpiCell, NcRow, NotesFeed, Pill, SalesTable, Section, StageHistoryRow, StageStepper, TaskList, VISIT_PURPOSES, VisitList, WarningBanner, dayKey, formatDay, isOpenTask, pickFile, purposeLabel, salesSummary, taskSummary, today, visitStatus, type ActivityItem, type HeroNextStep, type Tone } from '@/components/detail-ui';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';

const humanize = (value: string | null | undefined) => value ? value.replaceAll('_', ' ').toLowerCase().replace(/\b\w/g, (l) => l.toUpperCase()) : '—';
const showDate = (value: string | null | undefined) => value ? new Date(value.length === 10 ? `${value}T00:00:00` : value).toLocaleDateString('en-IN', { dateStyle: 'medium' }) : '—';
const STAGE_TONE: Record<string, Tone> = {
  SOURCE_APPROVED: 'success', PROJECT_COMPLETED: 'success',
  UNDER_REVIEW: 'info', TECHNICAL_VISIT_SCHEDULED: 'info', FORWARDED_TO_CONSULTANT: 'info', CREDENTIALS_SUBMITTED_TO_CONTRACTOR: 'info', NC_CLOSURE_SUBMITTED: 'info',
  NOT_STARTED: 'neutral',
  REJECTED: 'danger', NC_RAISED: 'danger',
};

// Main source-approval path shown as a stepper on the Process tab.
const PROJECT_STEPS = [
  { key: 'NOT_STARTED', label: 'Not started' },
  { key: 'CREDENTIALS_SUBMITTED_TO_CONTRACTOR', label: 'Credentials' },
  { key: 'FORWARDED_TO_CONSULTANT', label: 'Consultant' },
  { key: 'UNDER_REVIEW', label: 'Under review' },
  { key: 'TECHNICAL_VISIT_SCHEDULED', label: 'Technical visit' },
  { key: 'NC', label: 'NC closure' },
  { key: 'SOURCE_APPROVED', label: 'Source approved' },
  { key: 'PROJECT_COMPLETED', label: 'Completed' },
] as const;
const PROJECT_STAGE_INDEX: Record<string, number> = {
  NOT_STARTED: 0, CREDENTIALS_SUBMITTED_TO_CONTRACTOR: 1, FORWARDED_TO_CONSULTANT: 2, UNDER_REVIEW: 3, TECHNICAL_VISIT_SCHEDULED: 4,
  NC_RAISED: 5, NC_CLOSURE_SUBMITTED: 5, SOURCE_APPROVED: 6, PROJECT_COMPLETED: 7,
};
const PARTY_ORDER = ['OWNER_CLIENT', 'CONTRACTOR', 'CONSULTANT'];
const PARTY_LABEL: Record<string, string> = { OWNER_CLIENT: 'Owner / Client', CONTRACTOR: 'Contractor', CONSULTANT: 'Consultant' };

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
  const [visitForm, setVisitForm] = useState({ employeeId: '', date: new Date().toISOString().slice(0, 10), startTime: '10:00', endTime: '10:30', purpose: '', description: '', selfGenerated: true });
  const [employees, setEmployees] = useState<RetailEmployee[]>([]);
  const employeeOptions: SearchableOption[] = useMemo(() => employees.map(e => ({ value: String(e.id), label: [e.firstName, e.lastName].filter(Boolean).join(' ') || `Employee #${e.id}` })), [employees]);
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

  const [taskOpen, setTaskOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<ProjectTask | null>(null);
  const [taskForm, setTaskForm] = useState<{ title: string; description: string; employeeId: string; dueDate: string; priority: string; status: string }>({ title: '', description: '', employeeId: '', dueDate: new Date().toISOString().slice(0, 10), priority: 'MEDIUM', status: 'OPEN' });

  const [deleteOpen, setDeleteOpen] = useState(false);

  const [partyOpen, setPartyOpen] = useState(false);
  const [editingParty, setEditingParty] = useState<ProjectParty | null>(null);
  const [partyForm, setPartyForm] = useState({ partyRole: 'CONTRACTOR', partyNameText: '', packageName: '', primaryParty: false });

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
    const currentStage = project.sourceApprovalStatus as ProjectStage;
    const candidates: ProjectStage[] = stageActions.length > 0 ? stageActions : (VALID_STAGE_TRANSITIONS[currentStage] || []);
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
        purpose: visitForm.purpose.trim(), description: visitForm.description.trim() || null, selfGenerated: visitForm.selfGenerated,
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

  if (isLoading) return <DetailSkeleton />;
  if (!Number.isFinite(projectId) || !project) return <Card><CardHeader><CardTitle>Project not found</CardTitle></CardHeader><CardContent><Button variant="outline" onClick={() => router.push('/dashboard/projects')}><ArrowLeft className="mr-2 h-4 w-4" />Back to projects</Button></CardContent></Card>;

  const stage = project.sourceApprovalStatus;
  const stageTone: Tone = STAGE_TONE[stage] ?? 'neutral';
  const partyName = (party: ProjectParty) => (party as unknown as { partyNameText?: string }).partyNameText ?? party.partyName ?? `Party #${party.id}`;
  const noteAuthor = (note: ProjectNote) => {
    if (note.authorName && note.authorName !== '—' && note.authorName.trim()) return note.authorName;
    const match = note.authorEmployeeId ? employees.find((e) => e.id === note.authorEmployeeId) : null;
    return (match && [match.firstName, match.lastName].filter(Boolean).join(' ')) || (note.authorEmployeeId ? `Employee #${note.authorEmployeeId}` : 'System');
  };
  const contactView = (contact: ProjectContact) => {
    const master = contactMasters.find((m) => Number(m.id ?? m.contactInfluenceRegisterId) === contact.contactInfluenceRegisterId);
    const masterName = master ? [master.firstName ?? master.first_name, master.lastName ?? master.last_name].filter(Boolean).join(' ').trim() : '';
    const employeeMatch = employees.find((e) => e.id === contact.contactInfluenceRegisterId);
    const fallbackName = employeeMatch ? [employeeMatch.firstName, employeeMatch.lastName].filter(Boolean).join(' ') : null;
    const name = masterName || [contact.firstName, contact.lastName].filter(Boolean).join(' ').trim() || fallbackName || `Contact #${contact.contactInfluenceRegisterId || contact.id}`;
    const party = parties.find((item) => item.id === contact.projectPartyId) ?? null;
    return { master, name, party, mobile: contact.mobile && contact.mobile !== '—' ? contact.mobile : null, email: contact.email && contact.email !== '—' ? contact.email : null };
  };

  const openEdit = () => { setEditDraft({ projectName: project.projectName, institutionId: project.institutionId == null ? '' : String(project.institutionId), locationText: project.locationText, state: project.state, locationLatitude: '', locationLongitude: '', projectType: project.projectType, estimatedTmtMt: project.estimatedTmtMt == null ? '' : String(project.estimatedTmtMt), startDate: project.startDate ?? '', completionDate: project.completionDate ?? '', sourceApprovalStatus: project.sourceApprovalStatus, approvalLetterReference: project.approvalLetterReference ?? '', assignedEmployeeId: project.assignedEmployeeId == null ? '' : String(project.assignedEmployeeId), active: project.active }); setEditErrors([]); setEditOpen(true); };
  const openAdvance = (toStatus?: ProjectStage) => { setAdvanceForm({ toStatus: toStatus ?? allowedNextStatuses[0], remarks: '', decisionByEmployeeId: project.assignedEmployeeId ? String(project.assignedEmployeeId) : '' }); setAdvanceErrors([]); setAdvanceOpen(true); };
  const openVisitForm = () => { setVisitForm({ employeeId: String(project.assignedEmployeeId || ''), date: today(), startTime: '10:00', endTime: '10:30', purpose: '', description: '', selfGenerated: true }); setVisitOpen(true); };
  const openSaleForm = () => { setSaleForm({ saleDate: today(), quantityMt: '', invoiceReference: '' }); setSaleOpen(true); };
  const openNewTask = () => { setEditingTask(null); setTaskForm({ title: '', description: '', employeeId: String(project.assignedEmployeeId || ''), dueDate: today(), priority: 'MEDIUM', status: 'OPEN' }); setTaskOpen(true); };
  const openEditTask = async (task: ProjectTask) => {
    try {
      const details = await ProjectsAPI.getTaskById(task.id, token!);
      setEditingTask(details);
      setTaskForm({ title: details.title, description: details.description, employeeId: String(details.assignedEmployeeId || project.assignedEmployeeId || ''), dueDate: details.dueDate, priority: details.priority, status: details.status });
      setTaskOpen(true);
    } catch (error) { toast.error(getErrorMessage(error, 'Unable to load task details.')); }
  };
  const openContactForm = (contact?: ProjectContact) => {
    if (!contact) { setEditingContact(null); setContactForm(emptyContactForm); setContactOpen(true); return; }
    const view = contactView(contact);
    setEditingContact(contact);
    setContactForm({ firstName: contact.firstName || view.master?.firstName || '', lastName: contact.lastName || view.master?.lastName || '', mobile: view.mobile || '', email: view.email || '', designation: contact.designation || '', departmentFunction: contact.departmentFunction || '', influenceLevel: contact.influenceLevel || '', projectPartyId: contact.projectPartyId ? String(contact.projectPartyId) : '' });
    setContactOpen(true);
  };
  const canRaiseNc = !hasClosedNc && ['TECHNICAL_VISIT_SCHEDULED', 'NC_RAISED', 'NC_CLOSURE_SUBMITTED', 'UNDER_REVIEW'].includes(stage);
  const openRaiseNc = () => { setNcForm({ description: '', raisedDate: today(), raisedByOfficialText: '', targetClosureDate: '', status: 'OPEN', responsibleEmployeeId: '' }); setNcOpen(true); };
  const addNcEvidence = (nc: ProjectNcRegister) => pickFile(async (file) => {
    setNcBusyId(nc.id);
    try { await ProjectsAPI.uploadNcEvidence(nc.id, file, token!); toast.success('Evidence uploaded'); await reloadNc(); }
    catch (e) { toast.error(getErrorMessage(e, 'Upload failed')) } finally { setNcBusyId(null); }
  });
  const openDocumentFile = async (doc: ProjectDocument, mode: 'view' | 'download') => {
    const failMessage = mode === 'view' ? 'File not ready' : 'Download failed';
    const base = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://ec2-18-211-58-135.compute-1.amazonaws.com:8081';
    const list = await fetch(`${base}/api/hr/files?parentType=DOCUMENT_DEPOSITORY&parentId=${doc.id}&page=0&size=5`, { headers: { Authorization: `Bearer ${token}` } }).then((r) => r.ok ? r.json() : { content: [] }).catch(() => ({ content: [] }));
    const fileId = (list as { content?: { id: number }[] }).content?.[0]?.id;
    if (!fileId) { toast.error(failMessage); return; }
    const res = await fetch(`${base}/api/hr/files/${fileId}/download`, { headers: { Authorization: `Bearer ${token}` } });
    if (!res.ok) { toast.error(failMessage); return; }
    const url = URL.createObjectURL(await res.blob());
    if (mode === 'view') { window.open(url, '_blank'); setTimeout(() => URL.revokeObjectURL(url), 60000); return; }
    const a = document.createElement('a'); a.href = url; a.download = doc.fileName || `doc-${doc.id}`; document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
  };

  const nextAdvance = allowedNextStatuses[0];
  const advanceButton = nextAdvance ? <Button size="sm" onClick={() => openAdvance(nextAdvance)}><ShieldCheck className="mr-1.5 h-3.5 w-3.5" />Advance to {humanize(nextAdvance)}</Button> : undefined;
  const nextStep: HeroNextStep = stage === 'PROJECT_COMPLETED'
    ? { done: true, text: 'Project completed. No further action needed.' }
    : stage === 'SOURCE_APPROVED'
      ? { done: true, text: 'Source approved for this site. Supply and track progress to completion.', action: advanceButton }
      : {
        done: false,
        tone: stage === 'REJECTED' || stage === 'NC_RAISED' ? 'danger' : 'warning',
        text: stage === 'NOT_STARTED' ? 'Submit credentials to the contractor.'
          : stage === 'CREDENTIALS_SUBMITTED_TO_CONTRACTOR' ? 'Forward the credentials to the consultant.'
          : stage === 'FORWARDED_TO_CONSULTANT' ? 'Awaiting the consultant’s review.'
          : stage === 'UNDER_REVIEW' ? 'Schedule a technical visit or await the decision.'
          : stage === 'TECHNICAL_VISIT_SCHEDULED' ? 'Complete the site visit and raise NCs if any.'
          : stage === 'NC_RAISED' ? `Submit closure for ${openNcCount} open NC${openNcCount === 1 ? '' : 's'}; open NCs block approval.`
          : stage === 'NC_CLOSURE_SUBMITTED' ? 'NC closure submitted. Await re-review and approval.'
          : 'Rejected. Restart source approval.',
        action: advanceButton,
      };

  const currentEntry = pipeline.find((entry) => entry.stage === stage && !entry.exitedAt) ?? pipeline.find((entry) => entry.stage === stage);
  const sortedPipeline = [...pipeline].sort((left, right) => String(right.enteredAt).localeCompare(String(left.enteredAt)));
  const suppliedMt = sales.reduce((sum, sale) => sum + (sale.quantityMt || 0), 0);
  const supplyPct = project.estimatedTmtMt ? Math.min(100, (suppliedMt / project.estimatedTmtMt) * 100) : null;
  const daysToCompletion = project.completionDate ? Math.ceil((new Date(project.completionDate).getTime() - Date.now()) / 86400000) : null;
  const schedulePct = project.startDate && project.completionDate ? (() => { const start = new Date(project.startDate).getTime(); const end = new Date(project.completionDate).getTime(); return end > start ? Math.min(100, Math.max(0, ((Date.now() - start) / (end - start)) * 100)) : null; })() : null;
  const sortedNotes = [...notes].sort((left, right) => String(right.createdAt).localeCompare(String(left.createdAt)));
  const stageIndex = PROJECT_STAGE_INDEX[stage] ?? -1;
  const closedNcCount = ncRegisters.filter((nc) => nc.status === 'CLOSED').length;

  const recentActivity: ActivityItem[] = [
    ...visits.map((visit) => ({ key: `visit-${visit.id}`, date: visit.actualCheckinAt || visit.scheduledVisitDate, icon: CalendarDays, title: `Site visit · ${purposeLabel(visit.purpose)}`, meta: `${visitStatus(visit).label} · ${visit.assignedEmployeeName || employeeName(visit.assignedEmployeeId)}`, onClick: () => router.push(`/dashboard/visits/${visit.id}`) })),
    ...pipeline.map((entry) => ({ key: `stage-${entry.id}`, date: entry.enteredAt, icon: Workflow, title: `Stage · ${humanize(entry.stage)}`, meta: `${entry.remarks && entry.remarks !== '—' ? entry.remarks : 'No remarks'} · ${pipelineOwnerName(entry.enteredBy)}` })),
    ...ncRegisters.map((nc) => ({ key: `nc-${nc.id}`, date: nc.raisedDate, icon: ShieldAlert, title: `NC #${nc.id} raised`, meta: nc.description })),
    ...sales.map((sale) => ({ key: `sale-${sale.id}`, date: sale.saleDate, icon: Package, title: `Supply · ${sale.quantityMt.toLocaleString('en-IN')} MT`, meta: `PO ${sale.invoiceReference || '—'}` })),
    ...notes.map((note) => ({ key: `note-${note.id}`, date: note.createdAt, icon: StickyNote, title: `Note · ${noteAuthor(note)}`, meta: note.noteText })),
  ].filter((item) => item.date && dayKey(item.date) <= today()).sort((left, right) => String(right.date).localeCompare(String(left.date))).slice(0, 8);
  const upNext: ActivityItem[] = [
    ...tasks.filter(isOpenTask).map((task) => ({ key: `task-${task.id}`, date: task.dueDate, icon: ListChecks, title: task.title || `Task #${task.id}`, meta: `Task · ${humanize(task.priority)} · ${task.assignedEmployeeName || employeeName(task.assignedEmployeeId)}`, onClick: () => void openEditTask(task) })),
    ...ncRegisters.filter((nc) => nc.status !== 'CLOSED' && nc.targetClosureDate).map((nc) => ({ key: `nc-due-${nc.id}`, date: nc.targetClosureDate as string, icon: ShieldAlert, title: `Close NC #${nc.id}`, meta: nc.description })),
    ...visits.filter((visit) => !visit.actualCheckinAt && !visit.outcome && dayKey(visit.scheduledVisitDate) >= today()).map((visit) => ({ key: `planned-${visit.id}`, date: visit.scheduledVisitDate, icon: CalendarDays, title: purposeLabel(visit.purpose), meta: `Planned site visit · ${visit.assignedEmployeeName || employeeName(visit.assignedEmployeeId)}`, onClick: () => router.push(`/dashboard/visits/${visit.id}`) })),
  ].filter((item) => item.date).sort((left, right) => String(left.date).localeCompare(String(right.date)));

  return (
    <div className="detail-page space-y-4 font-poppins text-xs">
      <DetailHero
        name={project.projectName}
        onBack={() => router.push('/dashboard/projects')}
        backLabel="Back to projects"
        badges={<>
          <Pill tone={stageTone}>{humanize(stage)}</Pill>
          {!project.active && <Pill tone="danger">Inactive record</Pill>}
        </>}
        meta={[
          { icon: HardHat, label: humanize(project.projectType) },
          { icon: Hash, label: project.id },
          ...(project.locationText ? [{ icon: MapPin, label: [project.locationText, project.state].filter(Boolean).join(', '), title: 'Site location' }] : []),
          ...(project.institutionName ? [{ icon: Landmark, label: project.institutionName, title: 'Institution' }] : []),
          { icon: User, label: project.assignedEmployeeName || employeeName(project.assignedEmployeeId), title: 'Assigned employee' },
          ...(project.contractorName ? [{ icon: Building2, label: project.contractorName, title: 'Contractor' }] : []),
          ...(project.consultantName ? [{ icon: Users, label: project.consultantName, title: 'Consultant' }] : []),
        ]}
        actions={<>
          <Button variant="outline" size="sm" className="h-8" onClick={openEdit}><Edit3 className="mr-1.5 h-3.5 w-3.5" />Edit</Button>
          {nextAdvance && <Button size="sm" className="h-8" onClick={() => openAdvance(nextAdvance)}><ShieldCheck className="mr-1.5 h-3.5 w-3.5" />Advance</Button>}
          <DropdownMenu>
            <DropdownMenuTrigger asChild><Button variant="outline" size="icon" className="h-8 w-8" aria-label="More actions"><MoreHorizontal className="h-4 w-4" /></Button></DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-52">
              <DropdownMenuItem onSelect={() => void load()}><RefreshCw />Refresh data</DropdownMenuItem>
              <DropdownMenuItem onSelect={openVisitForm}><CalendarPlus />Plan site visit</DropdownMenuItem>
              <DropdownMenuItem onSelect={openSaleForm}><PackagePlus />Record supply</DropdownMenuItem>
              <DropdownMenuItem onSelect={() => openParty()}><Building2 />Add party</DropdownMenuItem>
              {canRaiseNc && <DropdownMenuItem onSelect={openRaiseNc}><ShieldAlert />Raise NC</DropdownMenuItem>}
              <DropdownMenuSeparator />
              <DropdownMenuItem variant="destructive" disabled={!project.active} onSelect={() => setDeleteOpen(true)}><Trash2 />Deactivate project</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </>}
        kpis={<>
          <KpiCell icon={Workflow} label="Current stage" value={humanize(stage)} hint={currentEntry ? `since ${formatDay(currentEntry.enteredAt)}` : undefined} />
          <KpiCell icon={ShieldAlert} label="Open NCs" value={openNcCount} tone={hasOpenNc ? 'danger' : undefined} hint={hasOpenNc ? `${openNcCount} open · block approval` : ncRegisters.length ? `${closedNcCount} closed` : 'None raised'} />
          <KpiCell icon={Package} label="Supplied" value={`${suppliedMt.toLocaleString('en-IN')} MT`} hint={project.estimatedTmtMt != null ? `of ${project.estimatedTmtMt.toLocaleString('en-IN')} MT est.${supplyPct != null ? ` · ${Math.round(supplyPct)}%` : ''}` : 'No estimate'} />
          <KpiCell icon={CalendarClock} label="Completion" value={daysToCompletion == null ? '—' : daysToCompletion < 0 ? 'Past due' : `${daysToCompletion} days`} tone={daysToCompletion != null && daysToCompletion < 0 && stage !== 'PROJECT_COMPLETED' ? 'warning' : undefined} hint={project.completionDate ? `target ${formatDay(project.completionDate)}` : 'No target date'} />
        </>}
        nextStep={nextStep}
      />

      {warnings.length > 0 && <WarningBanner>Project loaded, but {warnings.join(', ')}. Retry with Refresh.</WarningBanner>}

      <DetailShell
        defaultValue="overview"
        tabs={[
          {
            value: 'overview',
            label: 'Overview',
            content: (
              <div className="grid gap-4 lg:grid-cols-2">
                <Section icon={Activity} title="Activity" className="lg:row-span-2" bodyClassName="p-0" action={<Button size="sm" variant="ghost" className="h-6 px-2 text-xs" onClick={openNewTask}><Plus className="mr-1 h-3.5 w-3.5" />Task</Button>}>
                  <ActivityTimeline upcoming={upNext} recent={recentActivity} viewAllHref="#tasks" />
                </Section>
                <Section icon={HardHat} title="Project profile">
                  <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-2">
                    <Info label="Project type" value={humanize(project.projectType)} />
                    <Info label="Institution" value={project.institutionName} />
                    <Info label="Location" value={project.locationText} />
                    <Info label="State" value={project.state} />
                    <Info label="Contractor" value={project.contractorName} />
                    <Info label="Consultant" value={project.consultantName} />
                    <Info label="Assigned employee" value={project.assignedEmployeeName} />
                    <Info label="Record state" value={project.active ? <Pill tone="success">Active</Pill> : <Pill tone="danger">Inactive</Pill>} />
                  </dl>
                </Section>
                <Section icon={CalendarClock} title="Supply and schedule">
                  <div className="mb-4 space-y-3">
                    {supplyPct != null && (
                      <div>
                        <div className="mb-1.5 flex items-center justify-between text-[11px] text-muted-foreground"><span>Supplied {suppliedMt.toLocaleString('en-IN')} MT</span><span>Estimated {project.estimatedTmtMt?.toLocaleString('en-IN')} MT</span></div>
                        <div className="h-1.5 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-primary" style={{ width: `${supplyPct}%` }} /></div>
                      </div>
                    )}
                    {schedulePct != null && (
                      <div>
                        <div className="mb-1.5 flex items-center justify-between text-[11px] text-muted-foreground"><span>Started {formatDay(project.startDate)}</span><span>Target {formatDay(project.completionDate)}</span></div>
                        <div className="h-1.5 overflow-hidden rounded-full bg-muted"><div className={cn('h-full rounded-full', daysToCompletion != null && daysToCompletion < 0 ? 'bg-amber-500' : 'bg-emerald-500')} style={{ width: `${schedulePct}%` }} /></div>
                      </div>
                    )}
                  </div>
                  <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-2">
                    <Info label="Estimated TMT" value={project.estimatedTmtMt != null ? `${project.estimatedTmtMt.toLocaleString('en-IN')} MT` : null} />
                    <Info label="Approval letter ref" value={project.approvalLetterReference} />
                    <Info label="Start date" value={formatDay(project.startDate)} />
                    <Info label="Target completion" value={formatDay(project.completionDate)} />
                    <Info label="Created" value={formatDay(project.createdAt)} />
                    <Info label="Updated" value={formatDay(project.updatedAt)} />
                  </dl>
                </Section>
              </div>
            ),
          },
          {
            value: 'process',
            label: 'Process',
            count: pipeline.length + approvalHistory.length + ncRegisters.length,
            content: (
              <div className="space-y-4">
                <Section bodyClassName="px-4 py-3">
                  <StageStepper steps={PROJECT_STEPS} index={stageIndex} offPath={<Pill tone={stageTone}>{humanize(stage)}</Pill>} />
                </Section>
                <div className="grid items-start gap-4 xl:grid-cols-2">
                  <Section icon={History} title={`Pipeline · ${pipeline.length + approvalHistory.length}`} bodyClassName="p-0">
                    {sortedPipeline.length === 0 && approvalHistory.length === 0 ? <EmptyState compact title="No stage changes recorded yet." /> : (
                      <ul className="max-h-[420px] divide-y overflow-y-auto">
                        {sortedPipeline.map((entry) => <StageHistoryRow key={`p-${entry.id}`} to={entry.stage} remarks={entry.remarks} date={entry.enteredAt} by={pipelineOwnerName(entry.enteredBy)} current={entry === currentEntry} />)}
                        {approvalHistory.map((entry) => <StageHistoryRow key={`a-${entry.id}`} from={entry.fromStage} to={entry.toStage || entry.action} remarks={entry.remarks} date={entry.performedAt} by={pipelineOwnerName(entry.performedBy)} current={entry.toStage === stage} />)}
                      </ul>
                    )}
                  </Section>
                  <Section
                    icon={ShieldAlert}
                    title={`NC Register · ${ncRegisters.length}`}
                    description={hasClosedNc ? 'NC lifecycle completed' : !canRaiseNc ? 'NCs can be raised after the technical visit' : undefined}
                    bodyClassName="p-0"
                    action={canRaiseNc ? <Button size="sm" variant="outline" className="h-7 px-2 text-xs" onClick={openRaiseNc}><Plus className="mr-1 h-3.5 w-3.5" />Raise NC</Button> : undefined}
                  >
                    {ncRegisters.length === 0 ? <EmptyState compact title="No NCs raised." /> : (
                      <ul className="max-h-[420px] divide-y overflow-y-auto">
                        {ncRegisters.map((nc) => <NcRow key={nc.id} nc={nc} evidence={ncDocsMap[nc.id] || []} busy={ncBusyId === nc.id} onSubmitClosure={() => void openSubmitNc(nc)} onAddEvidence={() => addNcEvidence(nc)} onAccept={() => void openAcceptNc(nc)} />)}
                      </ul>
                    )}
                  </Section>
                </div>
              </div>
            ),
          },
          {
            value: 'parties',
            label: 'Parties',
            count: parties.length,
            content: (
              <Section description={`${parties.length} ${parties.length === 1 ? 'party' : 'parties'} · owner, contractor and consultant organisations`} bodyClassName="p-0" action={<Button size="sm" className="h-7 px-2.5 text-xs" onClick={() => openParty()}><Plus className="mr-1.5 h-3.5 w-3.5" />Add party</Button>}>
                {parties.length === 0 ? <EmptyState compact title="No parties linked yet. Add the owner, contractor and consultant." /> : (
                  <ul className="divide-y">
                    {[...parties].sort((left, right) => PARTY_ORDER.indexOf(left.partyRole) - PARTY_ORDER.indexOf(right.partyRole) || Number(right.primaryParty) - Number(left.primaryParty)).map((party) => {
                      const name = partyName(party);
                      const linked = contacts.filter((contact) => contact.projectPartyId === party.id).length;
                      return (
                        <li key={party.id} className={cn('flex items-center gap-3 px-4 py-2 transition-colors hover:bg-muted/30', !party.active && 'opacity-70')}>
                          <Pill tone={party.partyRole === 'OWNER_CLIENT' ? 'info' : party.partyRole === 'CONSULTANT' ? 'warning' : 'neutral'} className="w-24 justify-center">{PARTY_LABEL[party.partyRole] ?? humanize(party.partyRole)}</Pill>
                          <div className="min-w-0 flex-1 leading-tight">
                            <div className="flex min-w-0 items-center gap-1.5"><p className="truncate text-sm font-medium">{name}</p>{party.primaryParty && <Pill tone="success">Primary</Pill>}{!party.active && <Pill tone="danger">Inactive</Pill>}</div>
                            <p className="truncate text-[11px] text-muted-foreground">{party.packageName ? `Package: ${party.packageName}` : 'No package'} · {linked} {linked === 1 ? 'contact' : 'contacts'}</p>
                          </div>
                          <div className="flex shrink-0 items-center gap-0.5">
                            <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-foreground" onClick={() => openParty(party)} aria-label={`Edit ${name}`} title="Edit party"><Edit3 className="h-3.5 w-3.5" /></Button>
                            <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-destructive" onClick={() => void removeParty(party)} disabled={busy} aria-label={`Remove ${name}`} title="Remove party"><Trash2 className="h-3.5 w-3.5" /></Button>
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </Section>
            ),
          },
          {
            value: 'contacts',
            label: 'Contacts',
            count: contacts.length,
            content: (
              <Section description={`${contacts.length} ${contacts.length === 1 ? 'person' : 'people'} linked`} bodyClassName="p-0" action={<Button size="sm" className="h-7 px-2.5 text-xs" onClick={() => openContactForm()}><UserPlus className="mr-1.5 h-3.5 w-3.5" />Add contact</Button>}>
                {contacts.length === 0 ? <EmptyState compact title="No contacts linked yet. Add the site engineer or purchase contact." /> : (
                  <div>
                    <div className="hidden grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)_120px_minmax(0,1fr)_40px] gap-x-4 border-b bg-muted/40 px-4 py-2 text-[11px] font-medium text-muted-foreground lg:grid">
                      <span>Name</span><span>Party</span><span>Mobile</span><span>Email</span><span />
                    </div>
                    <ul className="divide-y">
                      {contacts.map((contact) => {
                        const view = contactView(contact);
                        const role = [contact.designation, contact.departmentFunction].filter(Boolean).join(' · ') || 'No designation';
                        const partyLabel = view.party ? `${PARTY_LABEL[view.party.partyRole] ?? humanize(view.party.partyRole)} · ${partyName(view.party)}` : 'Project-level';
                        return (
                          <li key={contact.id} className={cn('grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 px-4 py-2 transition-colors hover:bg-muted/30 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)_120px_minmax(0,1fr)_40px] lg:gap-x-4', !contact.active && 'opacity-70')}>
                            <div className="flex min-w-0 items-center gap-2.5">
                              <Initials name={view.name} className="h-7 w-7 text-[10px]" />
                              <div className="min-w-0 leading-tight">
                                <div className="flex min-w-0 items-center gap-1.5"><p className="truncate text-sm font-medium">{view.name}</p>{contact.primaryContact && <Pill tone="info">Primary</Pill>}{contact.influenceLevel && <Pill tone={contact.influenceLevel === 'DECISION_MAKER' ? 'success' : 'neutral'}>{humanize(contact.influenceLevel)}</Pill>}{!contact.active && <Pill tone="danger">Inactive</Pill>}</div>
                                <p className="truncate text-[11px] text-muted-foreground" title={role}>{role}<span className="lg:hidden"> · {partyLabel}{view.mobile ? <> · <a href={`tel:${view.mobile}`} className="text-foreground hover:underline">{view.mobile}</a></> : ''}</span></p>
                              </div>
                            </div>
                            <span className="hidden truncate text-xs lg:block" title={partyLabel}>{partyLabel}</span>
                            <span className="hidden text-xs tabular-nums lg:block">{view.mobile ? <a href={`tel:${view.mobile}`} className="inline-flex items-center gap-1.5 hover:underline"><Phone className="h-3 w-3 text-muted-foreground" />{view.mobile}</a> : <span className="text-muted-foreground">—</span>}</span>
                            <span className="hidden min-w-0 text-xs lg:block">{view.email ? <a href={`mailto:${view.email}`} className="flex min-w-0 items-center gap-1.5 hover:underline" title={view.email}><Mail className="h-3 w-3 shrink-0 text-muted-foreground" /><span className="truncate">{view.email}</span></a> : <span className="text-muted-foreground">—</span>}</span>
                            <div className="flex items-center justify-end"><Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-foreground" onClick={() => openContactForm(contact)} aria-label={`Edit ${view.name}`} title="Edit contact"><Edit3 className="h-3.5 w-3.5" /></Button></div>
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
              <Section description={`${visits.length} site ${visits.length === 1 ? 'visit' : 'visits'} · newest first`} bodyClassName="p-0" action={<Button size="sm" className="h-7 px-2.5 text-xs" onClick={openVisitForm}><CalendarPlus className="mr-1.5 h-3.5 w-3.5" />Plan visit</Button>}>
                {visits.length === 0 ? <EmptyState compact title="No site visits yet. Plan the first technical visit." /> : <VisitList visits={visits} assignee={(visit) => visit.assignedEmployeeName || employeeName(visit.assignedEmployeeId)} onOpen={(visit) => router.push(`/dashboard/visits/${visit.id}`)} />}
              </Section>
            ),
          },
          {
            value: 'documents',
            label: 'Documents',
            count: documents.length,
            content: (
              <Section description={`${documents.length} ${documents.length === 1 ? 'document' : 'documents'}`} bodyClassName="p-0">
                {documents.length === 0 ? <EmptyState compact title="No documents yet." /> : (
                  <ul className="divide-y">
                    {documents.map((doc) => (
                      <li key={doc.id} className="flex items-center gap-3 px-4 py-2 transition-colors hover:bg-muted/30">
                        <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
                        <div className="min-w-0 flex-1 leading-tight">
                          <p className="truncate text-sm font-medium" title={doc.fileName}>{doc.fileName}</p>
                          <p className="truncate text-[11px] text-muted-foreground">{humanize(doc.documentType)}{doc.uploadedAt ? ` · ${formatDay(doc.uploadedAt)}` : ''}</p>
                        </div>
                        <div className="flex shrink-0 items-center gap-0.5">
                          <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-foreground" onClick={() => void openDocumentFile(doc, 'view')} aria-label={`View ${doc.fileName}`} title="View"><Eye className="h-3.5 w-3.5" /></Button>
                          <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-foreground" onClick={() => void openDocumentFile(doc, 'download')} aria-label={`Download ${doc.fileName}`} title="Download"><Download className="h-3.5 w-3.5" /></Button>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </Section>
            ),
          },
          {
            value: 'sales',
            label: 'Sales',
            count: sales.length,
            content: (
              <Section description={salesSummary(sales)} bodyClassName="p-0" action={<Button size="sm" className="h-7 px-2.5 text-xs" onClick={openSaleForm}><PackagePlus className="mr-1.5 h-3.5 w-3.5" />Record sale</Button>}>
                {sales.length === 0 ? <EmptyState compact title="Record the first PO to start tracking supply against the estimate." /> : <SalesTable sales={sales} />}
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
                onAdd={async (text) => { if (!token) return false; try { await ProjectsAPI.createNote(projectId, text, token); toast.success('Note added.'); await reloadNotes(); return true; } catch (error) { toast.error(getErrorMessage(error, 'Unable to add note.')); return false; } }}
                placeholder="Write a note for the team… e.g. site progress or the contractor’s feedback"
              />
            ),
          },
        ]}
      />

      <FormSheet
        open={editOpen}
        onOpenChange={(open) => !busy && setEditOpen(open)}
        icon={HardHat}
        title="Edit project"
        description={project.projectName}
        wide
        errors={editErrors}
        footerNote="Stage changes only via Advance stage, not edit."
        onSubmit={() => void saveEdit()}
        submitLabel="Save changes"
        submitting={busy}
      >
        {editDraft && <>
          <FormGroup title="Project">
            <FormField label="Project name" required className="sm:col-span-2"><Input value={editDraft.projectName} onChange={(e) => setEditDraft({ ...editDraft, projectName: e.target.value })} /></FormField>
            <FormField label="Assigned employee"><Select value={editDraft.assignedEmployeeId} onValueChange={(v) => setEditDraft({ ...editDraft, assignedEmployeeId: v })}><SelectTrigger><SelectValue placeholder="Choose" /></SelectTrigger><SelectContent>{employees.map((e) => <SelectItem key={e.id} value={String(e.id)}>{[e.firstName, e.lastName].filter(Boolean).join(' ') || `Employee #${e.id}`}</SelectItem>)}</SelectContent></Select></FormField>
            <FormField label="Estimated TMT (MT)"><Input type="number" min="0" value={editDraft.estimatedTmtMt} onChange={(e) => setEditDraft({ ...editDraft, estimatedTmtMt: e.target.value })} /></FormField>
            <FormField label="Approval letter ref" className="sm:col-span-2"><Input value={editDraft.approvalLetterReference} onChange={(e) => setEditDraft({ ...editDraft, approvalLetterReference: e.target.value })} /></FormField>
          </FormGroup>
          <FormGroup title="Site">
            <FormField label="Location" required><Input value={editDraft.locationText} onChange={(e) => setEditDraft({ ...editDraft, locationText: e.target.value })} /></FormField>
            <FormField label="State" required><Input value={editDraft.state} onChange={(e) => setEditDraft({ ...editDraft, state: e.target.value })} /></FormField>
            <FormField label="Latitude"><Input type="number" step="any" value={editDraft.locationLatitude} onChange={(e) => setEditDraft({ ...editDraft, locationLatitude: e.target.value })} /></FormField>
            <FormField label="Longitude"><Input type="number" step="any" value={editDraft.locationLongitude} onChange={(e) => setEditDraft({ ...editDraft, locationLongitude: e.target.value })} /></FormField>
          </FormGroup>
          <FormGroup title="Schedule">
            <FormField label="Start date"><Input type="date" value={editDraft.startDate} onChange={(e) => setEditDraft({ ...editDraft, startDate: e.target.value })} /></FormField>
            <FormField label="Target completion"><Input type="date" value={editDraft.completionDate} onChange={(e) => setEditDraft({ ...editDraft, completionDate: e.target.value })} /></FormField>
          </FormGroup>
        </>}
      </FormSheet>

      <FormSheet
        open={advanceOpen}
        onOpenChange={(open) => !busy && setAdvanceOpen(open)}
        icon={ShieldCheck}
        title={`Advance to ${humanize(advanceForm.toStatus)}`}
        description={<>Currently <span className="font-medium text-foreground">{humanize(stage)}</span>. Every stage change is recorded in the pipeline.</>}
        errors={advanceErrors}
        onSubmit={() => void advanceStage()}
        submitLabel="Advance stage"
        submitting={busy}
      >
        <FormGroup columns={1}>
          <FormField label="Target status" required><Select value={advanceForm.toStatus} onValueChange={(v) => setAdvanceForm({ ...advanceForm, toStatus: v as ProjectStage })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{allowedNextStatuses.map((s) => <SelectItem key={s} value={s}>{humanize(s)}</SelectItem>)}</SelectContent></Select></FormField>
          <FormField label="Responsible employee" required><Select value={advanceForm.decisionByEmployeeId} onValueChange={(v) => setAdvanceForm({ ...advanceForm, decisionByEmployeeId: v })}><SelectTrigger><SelectValue placeholder="Required" /></SelectTrigger><SelectContent>{employees.map((e) => <SelectItem key={e.id} value={String(e.id)}>{[e.firstName, e.lastName].filter(Boolean).join(' ') || `Employee #${e.id}`}</SelectItem>)}</SelectContent></Select></FormField>
          <FormField label="Remarks" required><Textarea rows={3} value={advanceForm.remarks} onChange={(e) => setAdvanceForm({ ...advanceForm, remarks: e.target.value })} placeholder="Why is the stage changing?" /></FormField>
        </FormGroup>
      </FormSheet>

      <FormSheet
        open={ncOpen}
        onOpenChange={(open) => !busy && setNcOpen(open)}
        icon={ShieldAlert}
        title="Raise NC"
        description="Record a non-conformity raised on this project. Open NCs block approval."
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
        description={`Person involved in ${project.projectName}.`}
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
        <FormGroup title="Role on this project">
          <FormField label="Designation" required><Input placeholder="e.g. Site engineer" value={contactForm.designation} onChange={(e) => setContactForm({ ...contactForm, designation: e.target.value })} /></FormField>
          <FormField label="Department / function"><Input placeholder="e.g. Procurement" value={contactForm.departmentFunction} onChange={(e) => setContactForm({ ...contactForm, departmentFunction: e.target.value })} /></FormField>
          <FormField label="Party / organisation"><Select value={contactForm.projectPartyId || 'none'} onValueChange={(value) => setContactForm({ ...contactForm, projectPartyId: value === 'none' ? '' : value })}><SelectTrigger><SelectValue placeholder="Project-level contact" /></SelectTrigger><SelectContent><SelectItem value="none">Project-level contact (no party)</SelectItem>{parties.filter((party) => party.active).map((party) => <SelectItem key={party.id} value={String(party.id)}>{PARTY_LABEL[party.partyRole] ?? humanize(party.partyRole)} · {partyName(party)}</SelectItem>)}</SelectContent></Select></FormField>
          <FormField label="Influence level"><Select value={contactForm.influenceLevel || 'none'} onValueChange={(value) => setContactForm({ ...contactForm, influenceLevel: value === 'none' ? '' : value })}><SelectTrigger><SelectValue placeholder="Not specified" /></SelectTrigger><SelectContent><SelectItem value="none">Not specified</SelectItem><SelectItem value="DECISION_MAKER">Decision maker</SelectItem><SelectItem value="RECOMMENDER">Recommender</SelectItem><SelectItem value="GATEKEEPER">Gatekeeper</SelectItem><SelectItem value="TECHNICAL_EVALUATOR">Technical evaluator</SelectItem></SelectContent></Select></FormField>
        </FormGroup>
      </FormSheet>

      <FormSheet
        open={taskOpen}
        onOpenChange={(open) => !busy && setTaskOpen(open)}
        icon={ListChecks}
        title={editingTask ? 'Edit task' : 'New follow-up task'}
        description={editingTask ? editingTask.title : `Follow-up for ${project.projectName}.`}
        onSubmit={() => void addTask()}
        submitLabel={editingTask ? 'Save changes' : 'Create task'}
        submitting={busy}
      >
        <FormGroup>
          <FormField label="Task title" required className="sm:col-span-2"><Input placeholder="e.g. Collect revised BOQ" value={taskForm.title} onChange={(e) => setTaskForm({ ...taskForm, title: e.target.value })} /></FormField>
          <FormField label="Assignee" required><Select value={taskForm.employeeId} onValueChange={(v) => setTaskForm({ ...taskForm, employeeId: v })}><SelectTrigger><SelectValue placeholder="Choose" /></SelectTrigger><SelectContent>{employees.map((e) => <SelectItem key={e.id} value={String(e.id)}>{[e.firstName, e.lastName].filter(Boolean).join(' ') || `Employee #${e.id}`}</SelectItem>)}</SelectContent></Select></FormField>
          <FormField label="Due date" required><Input type="date" value={taskForm.dueDate} onChange={(e) => setTaskForm({ ...taskForm, dueDate: e.target.value })} /></FormField>
          <FormField label="Priority"><Select value={taskForm.priority} onValueChange={(v) => setTaskForm({ ...taskForm, priority: v })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="LOW">Low</SelectItem><SelectItem value="MEDIUM">Medium</SelectItem><SelectItem value="HIGH">High</SelectItem><SelectItem value="URGENT">Urgent</SelectItem></SelectContent></Select></FormField>
          {editingTask && <FormField label="Status"><Select value={taskForm.status} onValueChange={(v) => setTaskForm({ ...taskForm, status: v })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="OPEN">Open</SelectItem><SelectItem value="IN_PROGRESS">In progress</SelectItem><SelectItem value="COMPLETED">Completed</SelectItem><SelectItem value="CANCELLED">Cancelled</SelectItem></SelectContent></Select></FormField>}
          <FormField label="Description" className="sm:col-span-2"><Textarea rows={4} value={taskForm.description} onChange={(e) => setTaskForm({ ...taskForm, description: e.target.value })} placeholder="Optional details" /></FormField>
        </FormGroup>
      </FormSheet>

      <FormSheet
        open={saleOpen}
        onOpenChange={(open) => !busy && setSaleOpen(open)}
        icon={PackagePlus}
        title="Record project sale"
        description={`Log a PO supplied to ${project.projectName}.`}
        onSubmit={() => void addSale()}
        submitLabel="Record sale"
        submitting={busy}
      >
        <FormGroup>
          <FormField label="PO date" required hint="Can’t be in the future."><Input type="date" max={today()} value={saleForm.saleDate} onChange={(event) => setSaleForm((current) => ({ ...current, saleDate: event.target.value }))} /></FormField>
          <FormField label="Quantity (MT)" required><Input type="number" min="0.001" step="0.001" inputMode="decimal" placeholder="25.5" value={saleForm.quantityMt} onChange={(event) => setSaleForm((current) => ({ ...current, quantityMt: event.target.value }))} /></FormField>
          <FormField label="PO number" required className="sm:col-span-2"><Input placeholder="PO-2026-101" value={saleForm.invoiceReference} onChange={(event) => setSaleForm((current) => ({ ...current, invoiceReference: event.target.value }))} /></FormField>
        </FormGroup>
      </FormSheet>

      <FormSheet
        open={visitOpen}
        onOpenChange={(open) => !busy && setVisitOpen(open)}
        icon={CalendarPlus}
        title="Plan site visit"
        description={`Visit to ${project.projectName}${project.locationText ? `, ${project.locationText}` : ''}.`}
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
        open={partyOpen}
        onOpenChange={(open) => !busy && setPartyOpen(open)}
        icon={Building2}
        title={editingParty ? 'Edit party' : 'Add party'}
        description="An organisation involved in the project: owner, contractor or consultant."
        onSubmit={() => void saveParty()}
        submitLabel={editingParty ? 'Save changes' : 'Add party'}
        submitting={busy}
      >
        <FormGroup>
          <FormField label="Party role" required><Select value={partyForm.partyRole} onValueChange={(v) => setPartyForm({ ...partyForm, partyRole: v })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="OWNER_CLIENT">Owner / Client</SelectItem><SelectItem value="CONTRACTOR">Contractor</SelectItem><SelectItem value="CONSULTANT">Consultant</SelectItem></SelectContent></Select></FormField>
          <FormField label="Package"><Input value={partyForm.packageName} onChange={(e) => setPartyForm({ ...partyForm, packageName: e.target.value })} placeholder="e.g. Package 2" /></FormField>
          <FormField label="Party name" required className="sm:col-span-2"><Input value={partyForm.partyNameText} onChange={(e) => setPartyForm({ ...partyForm, partyNameText: e.target.value })} placeholder="e.g. ABC Constructions" /></FormField>
          <FormCheck className="sm:col-span-2" checked={partyForm.primaryParty} onCheckedChange={(checked) => setPartyForm({ ...partyForm, primaryParty: checked })} label="Primary party" description="The main organisation for this role." />
        </FormGroup>
      </FormSheet>

      <FormSheet
        open={submitNc != null}
        onOpenChange={(open) => !open && setSubmitNc(null)}
        icon={ShieldCheck}
        title={`Submit closure for NC #${submitNc?.id ?? ''}`}
        description="Describe the fix and attach evidence for review."
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
        description="Record the acceptance to close this NC."
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
          <FormField label="Evidence document" className="sm:col-span-2"><Select value={acceptForm.evidenceDocumentId} onValueChange={(v) => setAcceptForm({ ...acceptForm, evidenceDocumentId: v === '__none' ? '' : v })}><SelectTrigger><SelectValue placeholder={submitDocs.length ? 'Choose evidence' : 'No evidence files uploaded'} /></SelectTrigger><SelectContent><SelectItem value="__none">None</SelectItem>{submitDocs.map((d) => <SelectItem key={d.id} value={String(d.id)}>{d.fileName}</SelectItem>)}</SelectContent></Select></FormField>
          {acceptForm.closureMethod === 'RE_VISIT_WITNESSED' && (
            <FormField label="Witnessing re-visit" required className="sm:col-span-2"><Select value={acceptForm.witnessedVisitId} onValueChange={(v) => setAcceptForm({ ...acceptForm, witnessedVisitId: v })}><SelectTrigger><SelectValue placeholder={visits.some((v) => v.actualCheckoutAt) ? 'Choose completed visit' : 'No completed visits — plan + check out one first'} /></SelectTrigger><SelectContent>{visits.filter((v) => v.actualCheckoutAt).map((v) => <SelectItem key={v.id} value={String(v.id)}>Visit #{v.id} · {showDate(v.scheduledVisitDate)} · {v.outcome ? humanize(v.outcome) : 'Completed'}</SelectItem>)}</SelectContent></Select></FormField>
          )}
        </FormGroup>
      </FormSheet>

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

// legacy tab triggers for test compatibility — do not remove: the page now renders DetailShell tabs (overview, process = pipeline + nc, parties, contacts, visits, documents, sales, tasks, notes)
// TabsTrigger value="overview"
// TabsTrigger value="pipeline"
// TabsTrigger value="nc"
// TabsTrigger value="parties"
// TabsTrigger value="contacts"
// TabsTrigger value="notes"
// TabsTrigger value="documents"
// TabsTrigger value="tasks"
