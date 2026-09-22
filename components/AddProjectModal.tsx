'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AlertCircle, Loader2, MapPin, Navigation, Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';

import { getErrorMessage } from '@/lib/api-error';
import {
  ProjectsAPI,
  type ProjectCreatePayload,
  type ProjectType,
  type ProjectStage,
} from '@/lib/projects-api';
import { InstitutionsAPI, type Institution } from '@/lib/institutions-api';
import { RetailAPI, type RetailEmployee } from '@/lib/retail-api';
import { useUnsavedChanges } from '@/components/unsaved-changes-provider';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

interface AddProjectModalProps {
  isOpen: boolean;
  onClose: () => void;
  token: string;
  onCreated?: () => void;
}

interface ContractorEntry {
  name: string;
  role: 'CONTRACTOR' | 'CONSULTANT';
}

interface ProjectDraft {
  projectName: string;
  institutionId: string;
  locationText: string;
  state: string;
  locationLatitude: string;
  locationLongitude: string;
  projectType: ProjectType;
  estimatedTmtMt: string;
  startDate: string;
  completionDate: string;
  sourceApprovalStatus: ProjectStage;
  approvalLetterReference: string;
  assignedEmployeeId: string;
  contractors: ContractorEntry[];
}

// Must match the backend enum exactly (Enums.java ProjectType).
// INFRASTRUCTURE / INDUSTRIAL / RESIDENTIAL / OTHER are NOT valid and return 400.
const PROJECT_TYPES: { value: ProjectType; label: string }[] = [
  { value: 'ROAD_HIGHWAY', label: 'Road / Highway' },
  { value: 'BRIDGE', label: 'Bridge' },
  { value: 'BUILDING', label: 'Building' },
  { value: 'IRRIGATION', label: 'Irrigation' },
  { value: 'PORT_OR_INDUSTRIAL', label: 'Port or Industrial' },
  { value: 'OTHER_INFRASTRUCTURE', label: 'Other Infrastructure' },
];

const PROJECT_STAGES: { value: ProjectStage; label: string }[] = [
  { value: 'NOT_STARTED', label: 'Not Started' },
  { value: 'CREDENTIALS_SUBMITTED_TO_CONTRACTOR', label: 'Credentials Submitted to Contractor' },
  { value: 'FORWARDED_TO_CONSULTANT', label: 'Forwarded to Consultant' },
  { value: 'UNDER_REVIEW', label: 'Under Review' },
  { value: 'TECHNICAL_VISIT_SCHEDULED', label: 'Technical Visit Scheduled' },
  { value: 'NC_RAISED', label: 'NC Raised' },
  { value: 'NC_CLOSURE_SUBMITTED', label: 'NC Closure Submitted' },
  { value: 'SOURCE_APPROVED', label: 'Source Approved' },
  { value: 'PROJECT_COMPLETED', label: 'Project Completed' },
  { value: 'REJECTED', label: 'Rejected' },
];

const STATES = [
  'Maharashtra', 'Karnataka', 'Gujarat', 'Telangana', 'Tamil Nadu',
  'Delhi', 'Kerala', 'Rajasthan', 'Uttar Pradesh', 'Madhya Pradesh',
  'West Bengal', 'Odisha', 'Andhra Pradesh', 'Punjab', 'Haryana',
];

const createEmptyContractors = (): ContractorEntry[] => [
  { name: '', role: 'CONTRACTOR' },
  { name: '', role: 'CONSULTANT' },
];

const createEmptyDraft = (): ProjectDraft => ({
  projectName: '',
  institutionId: '',
  locationText: '',
  state: '',
  locationLatitude: '',
  locationLongitude: '',
  projectType: 'ROAD_HIGHWAY',
  estimatedTmtMt: '',
  startDate: '',
  completionDate: '',
  sourceApprovalStatus: 'NOT_STARTED',
  approvalLetterReference: '',
  assignedEmployeeId: '',
  contractors: createEmptyContractors(),
});

const validateDraft = (draft: ProjectDraft): string[] => {
  const errors: string[] = [];
  if (!draft.projectName.trim()) errors.push('Project name is required.');
  if (!draft.locationText.trim()) errors.push('Location is required.');
  if (!draft.state.trim()) errors.push('State is required.');
  if (!draft.locationLatitude.trim() || !draft.locationLongitude.trim()) errors.push('Latitude and longitude are required — capture via Use my location.');
  if (draft.estimatedTmtMt.trim()) {
    const v = Number(draft.estimatedTmtMt);
    if (!Number.isFinite(v) || v < 0) errors.push('Estimated TMT must be zero or a positive number.');
  }
  if (draft.locationLatitude.trim()) {
    const v = Number(draft.locationLatitude);
    if (!Number.isFinite(v) || v < -90 || v > 90) errors.push('Latitude must be between -90 and 90.');
  }
  if (draft.locationLongitude.trim()) {
    const v = Number(draft.locationLongitude);
    if (!Number.isFinite(v) || v < -180 || v > 180) errors.push('Longitude must be between -180 and 180.');
  }
  if (draft.startDate && draft.completionDate && new Date(draft.completionDate) < new Date(draft.startDate)) {
    errors.push('Completion date cannot be before start date.');
  }
  const filledContractors = draft.contractors.filter((c) => c.name.trim());
  if (filledContractors.length === 0) errors.push('At least one contractor or consultant is required.');
  const names = filledContractors.map((c) => c.name.trim().toLowerCase());
  const dupes = names.filter((n, i) => names.indexOf(n) !== i);
  if (dupes.length > 0) errors.push(`Duplicate contractor/consultant names: ${[...new Set(dupes)].join(', ')}.`);
  return errors;
};

const AddProjectModal: React.FC<AddProjectModalProps> = ({ isOpen, onClose, token, onCreated }) => {
  const router = useRouter();
  const [draft, setDraft] = useState<ProjectDraft>(createEmptyDraft);
  const [employees, setEmployees] = useState<RetailEmployee[]>([]);
  const [institutions, setInstitutions] = useState<Institution[]>([]);
  const [isLoadingMasters, setIsLoadingMasters] = useState(false);
  const [masterLoadError, setMasterLoadError] = useState<string | null>(null);
  const [submitErrors, setSubmitErrors] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [createdId, setCreatedId] = useState<number | null>(null);
  const [hasUserChanges, setHasUserChanges] = useState(false);
  const [isLocating, setIsLocating] = useState(false);
  const [geoError, setGeoError] = useState<string | null>(null);
  const wasOpenRef = useRef(false);
  const formSessionIdRef = useRef('');
  const { markSaved, requestDiscard } = useUnsavedChanges(isOpen && hasUserChanges && createdId == null);

  const resetForm = () => {
    formSessionIdRef.current = typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
    setDraft(createEmptyDraft());
    setSubmitErrors([]);
    setCreatedId(null);
    setHasUserChanges(false);
  };

  useEffect(() => {
    if (isOpen && !wasOpenRef.current) resetForm();
    wasOpenRef.current = isOpen;
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen || !token) return;
    let cancelled = false;
    setIsLoadingMasters(true);
    setMasterLoadError(null);
    Promise.all([
      RetailAPI.getEmployees(token),
      InstitutionsAPI.getInstitutions(token, { page: 0, size: 200 }),
    ]).then(([empList, instRes]) => {
      if (!cancelled) {
        setEmployees(empList);
        setInstitutions(instRes.content);
      }
    }).catch(() => {
      if (!cancelled) setMasterLoadError('Could not load employees or institutions.');
    }).finally(() => {
      if (!cancelled) setIsLoadingMasters(false);
    });
    return () => { cancelled = true; };
  }, [isOpen, token]);

  const touch = () => { setHasUserChanges(true); setSubmitErrors([]); setGeoError(null); };
  const updateDraft = <K extends keyof ProjectDraft>(field: K, value: ProjectDraft[K]) => { touch(); setDraft((prev) => ({ ...prev, [field]: value })); };

  const handleInstitutionChange = (value: string) => {
    touch();
    setDraft((prev) => {
      const next: ProjectDraft = { ...prev, institutionId: value };
      // Automatic lat/long filling from documented institution data if it already contains coordinates.
      // Only fill when user has not manually entered coordinates (both empty) and selected institution has documented coordinates.
      const isLatEmpty = !prev.locationLatitude.trim();
      const isLngEmpty = !prev.locationLongitude.trim();
      if (isLatEmpty && isLngEmpty && value) {
        const inst = institutions.find((ins) => String(ins.id) === value) as unknown as Record<string, unknown> | undefined;
        if (inst) {
          const latCandidate = inst.locationLatitude ?? inst.houseLatitude ?? inst.latitude ?? (inst as Record<string, unknown>).lat;
          const lngCandidate = inst.locationLongitude ?? inst.houseLongitude ?? inst.longitude ?? (inst as Record<string, unknown>).lng ?? (inst as Record<string, unknown>).lon;
          const latNum = typeof latCandidate === 'number' ? latCandidate : typeof latCandidate === 'string' && latCandidate.trim() ? Number(latCandidate) : null;
          const lngNum = typeof lngCandidate === 'number' ? lngCandidate : typeof lngCandidate === 'string' && lngCandidate.trim() ? Number(lngCandidate) : null;
          if (latNum != null && Number.isFinite(latNum) && lngNum != null && Number.isFinite(lngNum)) {
            next.locationLatitude = String(latNum);
            next.locationLongitude = String(lngNum);
          }
        }
      }
      return next;
    });
  };

  const handleUseMyLocation = () => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      setGeoError('Geolocation is not supported in this browser.');
      return;
    }
    setIsLocating(true);
    setGeoError(null);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude, longitude } = pos.coords;
        // Do not silently overwrite manually entered coordinates unless user explicitly clicks this button — this IS explicit user action.
        setDraft((prev) => ({ ...prev, locationLatitude: String(latitude), locationLongitude: String(longitude) }));
        touch();
        setIsLocating(false);
      },
      (err) => {
        setIsLocating(false);
        if (err.code === 1) setGeoError('Location permission denied. Please allow access or enter coordinates manually.');
        else if (err.code === 2) setGeoError('Location unavailable. Please enter coordinates manually.');
        else if (err.code === 3) setGeoError('Location request timed out. Please try again or enter manually.');
        else setGeoError(err.message || 'Unable to get location. Please enter manually.');
      },
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 0 }
    );
  };

  const updateContractor = (index: number, field: keyof ContractorEntry, value: string) => {
    touch();
    setDraft((prev) => {
      const next = [...prev.contractors];
      next[index] = { ...next[index], [field]: value };
      return { ...prev, contractors: next };
    });
  };

  const addContractor = () => {
    touch();
    setDraft((prev) => ({ ...prev, contractors: [...prev.contractors, { name: '', role: 'CONTRACTOR' }] }));
  };

  const removeContractor = (index: number) => {
    touch();
    setDraft((prev) => ({ ...prev, contractors: prev.contractors.filter((_, i) => i !== index) }));
  };

  const employeeOptions = useMemo(() =>
    employees.map((e) => ({ value: String(e.id), label: [e.firstName, e.lastName].filter(Boolean).join(' ') || `Employee #${e.id}` }))
      .sort((a, b) => a.label.localeCompare(b.label)),
    [employees]);

  const handleSubmit = async () => {
    const errors = validateDraft(draft);
    if (!token) errors.unshift('Your login session is missing. Sign in again.');
    if (errors.length) { setSubmitErrors(errors); return; }

    setIsSubmitting(true);
    setSubmitErrors([]);
    try {
      const payload: ProjectCreatePayload = {
        projectName: draft.projectName.trim(),
        locationText: draft.locationText.trim(),
        locationLatitude: draft.locationLatitude ? Number(draft.locationLatitude) : null,
        locationLongitude: draft.locationLongitude ? Number(draft.locationLongitude) : null,
        projectType: draft.projectType,
        estimatedTmtMt: draft.estimatedTmtMt ? Number(draft.estimatedTmtMt) : null,
        startDate: draft.startDate || null,
        completionDate: draft.completionDate || null,
        sourceApprovalStatus: draft.sourceApprovalStatus,
        approvalLetterReference: draft.approvalLetterReference.trim() || null,
        assignedEmployeeId: draft.assignedEmployeeId ? Number(draft.assignedEmployeeId) : null,
        active: true,
      };

      const id = await ProjectsAPI.createProject(payload, token);
      const partyFailures: string[] = [];
      for (const c of draft.contractors.filter((x) => x.name.trim())) {
        try {
          await ProjectsAPI.addProjectParty(id, {
            partyRole: c.role === 'CONSULTANT' ? 'CONSULTANT' : 'CONTRACTOR',
            partyNameText: c.name.trim(),
          }, token);
        } catch (error) {
          partyFailures.push(`${c.name.trim()}: ${getErrorMessage(error, 'could not be linked')}`);
        }
      }
      setCreatedId(id);
      setHasUserChanges(false);
      markSaved();
      if (partyFailures.length > 0) {
        setSubmitErrors(partyFailures);
        toast.warning('Project created but some parties could not be linked.', { duration: 5000 });
        return;
      }
      toast.success('Project created.', { duration: 3000 });
      router.push(`/dashboard/projects/${id}`);
      onCreated?.();
      onClose();
    } catch (error) {
      const message = getErrorMessage(error, 'Unable to create project.');
      setSubmitErrors([message]);
      toast.error(message, { duration: 5000 });
    } finally {
      setIsSubmitting(false);
    }
  };

  const closeImmediately = () => { setHasUserChanges(false); markSaved(); onClose(); };
  const handleCloseRequest = () => requestDiscard(closeImmediately);

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && handleCloseRequest()}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>Create Project</DialogTitle>
          <DialogDescription>
            Add a project using the documented payload. Stage starts as Not Started. At least one contractor or consultant is required.
          </DialogDescription>
        </DialogHeader>

        {submitErrors.length > 0 && (
          <div className="rounded-lg border border-destructive/40 bg-destructive/5 p-4 text-sm text-destructive">
            <div className="flex gap-2">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              <div>
                <p className="font-medium">Please fix the following:</p>
                <ul className="mt-2 list-disc space-y-1 pl-5">{submitErrors.map((e) => <li key={e}>{e}</li>)}</ul>
              </div>
            </div>
          </div>
        )}

        {createdId != null ? (
          <div className="rounded-lg border border-emerald-300 bg-emerald-50 p-5 text-sm">
            <p className="font-semibold">Project #{createdId} was created.</p>
            <p className="mt-1 text-muted-foreground">Navigating to project detail…</p>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Section: Project Basics */}
            <section className="space-y-3 rounded-lg border bg-card p-4">
              <div className="space-y-1">
                <h3 className="text-sm font-semibold leading-none">Project basics</h3>
                <p className="text-xs text-muted-foreground">Core identity and classification</p>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="sm:col-span-2 space-y-1.5">
                  <Label>Project Name <span className="text-destructive">*</span></Label>
                  <Input value={draft.projectName} onChange={(e) => updateDraft('projectName', e.target.value)} placeholder="e.g. Metro Flyover Package A" className="h-9" />
                </div>
                <div className="space-y-1.5">
                  <Label>Project Type <span className="text-destructive">*</span></Label>
                  <Select value={draft.projectType} onValueChange={(v) => updateDraft('projectType', v as ProjectType)}>
                    <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                    <SelectContent>{PROJECT_TYPES.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Estimated TMT (Mt)</Label>
                  <Input type="number" min="0" step="any" value={draft.estimatedTmtMt} onChange={(e) => updateDraft('estimatedTmtMt', e.target.value)} placeholder="e.g. 1200.5" className="h-9" />
                </div>
              </div>
            </section>

            {/* Section: Location */}
            <section className="space-y-3 rounded-lg border bg-card p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="space-y-1">
                  <h3 className="flex items-center gap-1.5 text-sm font-semibold leading-none"><MapPin className="h-3.5 w-3.5 text-muted-foreground" /> Location</h3>
                  <p className="text-xs text-muted-foreground">Where the project is situated; coordinates help map & distance</p>
                </div>
                <Button type="button" variant="outline" size="sm" className="h-8 shrink-0 text-xs" onClick={handleUseMyLocation} disabled={isLocating}>
                  {isLocating ? <Loader2 className="mr-1.5 h-3 w-3 animate-spin" /> : <Navigation className="mr-1.5 h-3 w-3" />}
                  {isLocating ? 'Locating…' : 'Use my location'}
                </Button>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="sm:col-span-2 space-y-1.5">
                  <Label>Location <span className="text-destructive">*</span></Label>
                  <Input value={draft.locationText} onChange={(e) => updateDraft('locationText', e.target.value)} placeholder="e.g. Thane — Ghodbunder Road" className="h-9" />
                </div>
                <div className="space-y-1.5">
                  <Label>State <span className="text-destructive">*</span></Label>
                  <Select value={draft.state} onValueChange={(v) => updateDraft('state', v)}>
                    <SelectTrigger className="h-9">
                      <SelectValue placeholder={isLoadingMasters ? 'Loading…' : 'Select state'} />
                    </SelectTrigger>
                    <SelectContent>{STATES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <Label>Latitude <span className="text-destructive">*</span></Label>
                  <Input type="number" step="any" min="-90" max="90" value={draft.locationLatitude} onChange={(e) => updateDraft('locationLatitude', e.target.value)} placeholder="e.g. 19.076" className="h-9" />
                </div>
                <div className="space-y-1.5">
                  <Label>Longitude <span className="text-destructive">*</span></Label>
                  <Input type="number" step="any" min="-180" max="180" value={draft.locationLongitude} onChange={(e) => updateDraft('locationLongitude', e.target.value)} placeholder="e.g. 72.8777" className="h-9" />
                </div>
              </div>
              {geoError && <p className="text-xs text-destructive">{geoError}</p>}
              <p className="text-[11px] text-muted-foreground">Coordinates are required — capture at the project site via “Use my location” or enter manually.</p>
            </section>

            {/* Section: Parties / Contractors */}
            <section className="space-y-3 rounded-lg border bg-card p-4">
              <div className="flex items-center justify-between gap-2">
                <div className="space-y-1">
                  <h3 className="text-sm font-semibold leading-none">Parties / Contractors</h3>
                  <p className="text-xs text-muted-foreground">At least one contractor or consultant <span className="text-destructive">*</span></p>
                </div>
                <Button type="button" variant="outline" size="sm" className="h-8 text-xs" onClick={addContractor}>
                  <Plus className="mr-1 h-3 w-3" /> Add
                </Button>
              </div>
              <div className="space-y-3">
                {draft.contractors.map((c, i) => (
                  <div key={i} className="flex flex-col gap-2 sm:flex-row sm:items-center">
                    <Input
                      value={c.name}
                      onChange={(e) => updateContractor(i, 'name', e.target.value)}
                      placeholder={c.role === 'CONTRACTOR' ? 'Contractor name *' : 'Consultant name *'}
                      className="h-9 flex-1"
                    />
                    <div className="flex items-center gap-2">
                      <Select value={c.role} onValueChange={(v) => updateContractor(i, 'role', v)}>
                        <SelectTrigger className="h-9 w-full sm:w-36"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="CONTRACTOR">Contractor</SelectItem>
                          <SelectItem value="CONSULTANT">Consultant</SelectItem>
                        </SelectContent>
                      </Select>
                      {draft.contractors.length > 1 ? (
                        <Button type="button" variant="ghost" size="icon" className="h-9 w-9 shrink-0 text-muted-foreground hover:text-destructive" onClick={() => removeContractor(i)} aria-label="Remove">
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      ) : (
                        <span className="hidden sm:inline-block w-9" />
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </section>

            {/* Section: Assignment */}
            <section className="space-y-3 rounded-lg border bg-card p-4">
              <div className="space-y-1">
                <h3 className="text-sm font-semibold leading-none">Assignment</h3>
                <p className="text-xs text-muted-foreground">Owner responsible for delivery</p>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label>Assigned Employee</Label>
                  <Select value={draft.assignedEmployeeId} onValueChange={(v) => updateDraft('assignedEmployeeId', v)}>
                    <SelectTrigger className="h-9">
                      <SelectValue placeholder={isLoadingMasters ? 'Loading…' : masterLoadError || 'Select owner'} />
                    </SelectTrigger>
                    <SelectContent>{employeeOptions.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              </div>
            </section>

            {/* Section: Dates */}
            <section className="space-y-3 rounded-lg border bg-card p-4">
              <div className="space-y-1">
                <h3 className="text-sm font-semibold leading-none">Dates</h3>
                <p className="text-xs text-muted-foreground">Schedule and completion window</p>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label>Start Date</Label>
                  <Input type="date" value={draft.startDate} onChange={(e) => updateDraft('startDate', e.target.value)} className="h-9" />
                </div>
                <div className="space-y-1.5">
                  <Label>Completion Date</Label>
                  <Input type="date" value={draft.completionDate} onChange={(e) => updateDraft('completionDate', e.target.value)} className="h-9" />
                </div>
              </div>
            </section>

            {/* Section: Approval details */}
            <section className="space-y-3 rounded-lg border bg-card p-4">
              <div className="space-y-1">
                <h3 className="text-sm font-semibold leading-none">Approval details</h3>
                <p className="text-xs text-muted-foreground">Reference information — stage starts as Not Started</p>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label>Approval Letter Reference</Label>
                  <Input value={draft.approvalLetterReference} onChange={(e) => updateDraft('approvalLetterReference', e.target.value)} placeholder="Optional reference" className="h-9" />
                </div>
              </div>
            </section>
          </div>
        )}

        <DialogFooter>
          {createdId != null ? (
            <Button onClick={closeImmediately}>Close</Button>
          ) : (
            <>
              <Button variant="outline" onClick={handleCloseRequest} disabled={isSubmitting}>Cancel</Button>
              <Button onClick={handleSubmit} disabled={isSubmitting || createdId != null}>
                {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Create Project
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default AddProjectModal;
