'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AlertCircle, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

import { getErrorMessage } from '@/lib/api-error';
import {
  InstitutionsAPI,
  type InstitutionCreatePayload,
  type InstitutionType,
} from '@/lib/institutions-api';
import type { RetailEmployee } from '@/lib/retail-api';
import { useUnsavedChanges } from '@/components/unsaved-changes-provider';
import { Button } from '@/components/ui/button';
import { SearchableSelect, type SearchableOption } from '@/components/ui/searchable-select2';
import { Sheet, SheetContent, SheetFooter, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

interface AddInstitutionModalProps {
  isOpen: boolean;
  onClose: () => void;
  token: string;
  onCreated?: () => void;
}

interface InstitutionDraft {
  institutionName: string;
  institutionType: InstitutionType;
  parentInstitutionId: string;
  jurisdiction: string;
  state: string;
  regionId: string;
  assignedEmployeeId: string;
  applicationDate: string;
  approvalDate: string;
  expiryDate: string;
  renewalLeadDays: string;
}

// Must match the backend enum exactly (Enums.java InstitutionType).
// PSU / PRIVATE_INSTITUTION / CONTRACTOR / CONSULTANT / OTHER are NOT valid and return 400.
const INSTITUTION_TYPES: { value: InstitutionType; label: string }[] = [
  { value: 'GOVERNMENT_DEPARTMENT', label: 'Government Department' },
  { value: 'PUBLIC_SECTOR_UNDERTAKING', label: 'Public Sector Undertaking' },
  { value: 'CORPORATE_INSTITUTE', label: 'Corporate Institute' },
  { value: 'AUTONOMOUS_BODY', label: 'Autonomous Body' },
];

const INDIAN_STATES = [
  'Andhra Pradesh', 'Arunachal Pradesh', 'Assam', 'Bihar', 'Chhattisgarh', 'Goa', 'Gujarat', 'Haryana',
  'Himachal Pradesh', 'Jharkhand', 'Karnataka', 'Kerala', 'Madhya Pradesh', 'Maharashtra', 'Manipur',
  'Meghalaya', 'Mizoram', 'Nagaland', 'Odisha', 'Punjab', 'Rajasthan', 'Sikkim', 'Tamil Nadu', 'Telangana',
  'Tripura', 'Uttar Pradesh', 'Uttarakhand', 'West Bengal', 'Andaman and Nicobar Islands', 'Chandigarh',
  'Dadra and Nagar Haveli and Daman and Diu', 'Delhi', 'Jammu and Kashmir', 'Ladakh', 'Lakshadweep', 'Puducherry',
] as const;

const createEmptyDraft = (): InstitutionDraft => ({
  institutionName: '',
  institutionType: 'GOVERNMENT_DEPARTMENT',
  parentInstitutionId: '',
  jurisdiction: '',
  state: '',
  regionId: '',
  assignedEmployeeId: '',
  applicationDate: '',
  approvalDate: '',
  expiryDate: '',
  renewalLeadDays: '',
});

const validateDraft = (draft: InstitutionDraft): string[] => {
  const errors: string[] = [];
  if (!draft.institutionName.trim()) errors.push('Institution name is required.');
  if (!draft.state.trim()) errors.push('State is required.');
  if (!draft.regionId) errors.push('Sales region is required.');
  if (!draft.assignedEmployeeId) errors.push('Assigned salesperson is required.');
  if (draft.renewalLeadDays.trim() && (Number(draft.renewalLeadDays) < 0 || !Number.isFinite(Number(draft.renewalLeadDays)))) {
    errors.push('Renewal lead days must be zero or a positive number.');
  }
  if (draft.applicationDate && draft.approvalDate && new Date(draft.approvalDate) < new Date(draft.applicationDate)) {
    errors.push('Approval date cannot be before application date.');
  }
  if (draft.approvalDate && draft.expiryDate && new Date(draft.expiryDate) < new Date(draft.approvalDate)) {
    errors.push('Expiry date cannot be before approval date.');
  }
  return errors;
};

const AddInstitutionModal: React.FC<AddInstitutionModalProps> = ({ isOpen, onClose, token, onCreated }) => {
  const router = useRouter();
  const [draft, setDraft] = useState<InstitutionDraft>(createEmptyDraft);
  const [employees, setEmployees] = useState<RetailEmployee[]>([]);
  const [regions, setRegions] = useState<{ id: number; name: string }[]>([]);
  const [parents, setParents] = useState<{ id: number; institutionName: string }[]>([]);
  const [isLoadingMasters, setIsLoadingMasters] = useState(false);
  const [masterWarnings, setMasterWarnings] = useState<string[]>([]);
  const [submitErrors, setSubmitErrors] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [createdId, setCreatedId] = useState<number | null>(null);
  const [hasUserChanges, setHasUserChanges] = useState(false);
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
    setMasterWarnings([]);
    const load = async () => {
      const warnings: string[] = [];
      try {
        const { RetailAPI } = await import('@/lib/retail-api');
        const list = await RetailAPI.getEmployees(token);
        if (!cancelled) setEmployees(list);
      } catch { if (!cancelled) warnings.push('Salesperson list could not be loaded.'); }
      try {
        const regs = await InstitutionsAPI.getRegions(token);
        if (!cancelled) setRegions(regs.map((r) => ({ id: r.id, name: r.name })));
      } catch { if (!cancelled) warnings.push('Sales regions could not be loaded.'); }
      try {
        const page = await InstitutionsAPI.getInstitutions(token, { page: 0, size: 100, active: true });
        if (!cancelled) setParents(page.content.map((i) => ({ id: i.id, institutionName: i.institutionName })));
      } catch { if (!cancelled) warnings.push('Parent institutions could not be loaded.'); }
      if (!cancelled) { setMasterWarnings(warnings); setIsLoadingMasters(false); }
    };
    void load();
    return () => { cancelled = true; };
  }, [isOpen, token]);

  const touch = () => { setHasUserChanges(true); setSubmitErrors([]); };
  const updateDraft = <K extends keyof InstitutionDraft>(field: K, value: InstitutionDraft[K]) => { touch(); setDraft((prev) => ({ ...prev, [field]: value })); };

  const employeeOptions = useMemo<SearchableOption[]>(() =>
    employees.map((e) => ({ value: String(e.id), label: [e.firstName, e.lastName].filter(Boolean).join(' ') || `Employee #${e.id}` }))
      .sort((a, b) => a.label.localeCompare(b.label)),
    [employees]);

  const regionOptions = useMemo<SearchableOption[]>(() =>
    regions.map((r) => ({ value: String(r.id), label: r.name })).sort((a, b) => a.label.localeCompare(b.label)),
    [regions]);

  const parentOptions = useMemo<SearchableOption[]>(() =>
    parents.map((p) => ({ value: String(p.id), label: p.institutionName })).sort((a, b) => a.label.localeCompare(b.label)),
    [parents]);

  const stateOptions = useMemo<SearchableOption[]>(() =>
    INDIAN_STATES.map((s) => ({ value: s, label: s })), []);

  const handleSubmit = async () => {
    const errors = validateDraft(draft);
    if (!token) errors.unshift('Your login session is missing. Sign in again.');
    if (errors.length) { setSubmitErrors(errors); return; }

    setIsSubmitting(true);
    setSubmitErrors([]);
    try {
      const payload: InstitutionCreatePayload = {
        institutionName: draft.institutionName.trim(),
        institutionType: draft.institutionType,
        parentInstitutionId: draft.parentInstitutionId ? Number(draft.parentInstitutionId) : null,
        jurisdiction: draft.jurisdiction.trim(),
        state: draft.state.trim(),
        regionId: draft.regionId ? Number(draft.regionId) : null,
        empanelmentStatus: 'NOT_STARTED',
        assignedEmployeeId: draft.assignedEmployeeId ? Number(draft.assignedEmployeeId) : null,
        currentStageOwnerContactId: null,
        applicationDate: draft.applicationDate || null,
        approvalDate: draft.approvalDate || null,
        expiryDate: draft.expiryDate || null,
        renewalLeadDays: draft.renewalLeadDays ? Number(draft.renewalLeadDays) : null,
        active: true,
      };

      const id = await InstitutionsAPI.createInstitution(payload, token);
      setCreatedId(id);
      setHasUserChanges(false);
      markSaved();
      toast.success('Institution created.', { duration: 3000 });
      router.push(`/dashboard/institutions/${id}`);
      onCreated?.();
      onClose();
    } catch (error) {
      const message = getErrorMessage(error, 'Unable to create institution.');
      setSubmitErrors([message]);
      toast.error(message, { duration: 5000 });
    } finally {
      setIsSubmitting(false);
    }
  };

  const closeImmediately = () => { setHasUserChanges(false); markSaved(); onClose(); };
  const handleCloseRequest = () => requestDiscard(closeImmediately);

  return (
    <Sheet open={isOpen} onOpenChange={(open) => !open && handleCloseRequest()}>
      <SheetContent className="flex w-full flex-col sm:max-w-2xl">
        <SheetHeader className="border-b pb-4">
          <SheetTitle>Create Institution</SheetTitle>
        </SheetHeader>

        <div className="min-h-0 flex-1 overflow-y-auto px-1 py-4">
        {masterWarnings.length > 0 && (
          <div className="mb-4 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
            <div className="flex gap-2">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              <div>{masterWarnings.map((w) => <p key={w}>{w}</p>)}</div>
            </div>
          </div>
        )}

        {submitErrors.length > 0 && (
          <div className="mb-4 rounded-lg border border-destructive/40 bg-destructive/5 p-4 text-sm text-destructive">
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
            <p className="font-semibold">Institution #{createdId} was created as Not Started.</p>
            <p className="mt-1 text-muted-foreground">Navigating to the detail page…</p>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <Label>Institution Name <span className="text-destructive">*</span></Label>
              <Input value={draft.institutionName} onChange={(e) => updateDraft('institutionName', e.target.value)} placeholder="e.g. PWD Circle, Municipal Corporation" />
            </div>
            <div>
              <Label>Institution Type <span className="text-destructive">*</span></Label>
              <Select value={draft.institutionType} onValueChange={(v) => updateDraft('institutionType', v as InstitutionType)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{INSTITUTION_TYPES.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Label>Assigned Salesperson <span className="text-destructive">*</span></Label>
              <SearchableSelect
                value={draft.assignedEmployeeId}
                options={employeeOptions}
                onSelect={(o) => updateDraft('assignedEmployeeId', o?.value ?? '')}
                placeholder="Select salesperson"
                searchPlaceholder="Search employees..."
                emptyMessage="No employees available"
                loading={isLoadingMasters && employeeOptions.length === 0}
                allowClear
                triggerClassName="w-full"
                contentClassName="w-[var(--radix-popover-trigger-width)]"
                required
              />
            </div>
            <div className="sm:col-span-2">
              <Label>Jurisdiction</Label>
              <Input value={draft.jurisdiction} onChange={(e) => updateDraft('jurisdiction', e.target.value)} placeholder="e.g. Mumbai Metro Region (optional)" />
            </div>
            <div>
              <Label>State <span className="text-destructive">*</span></Label>
              <SearchableSelect
                value={draft.state}
                options={stateOptions}
                onSelect={(o) => updateDraft('state', o?.value ?? '')}
                placeholder="Select state"
                searchPlaceholder="Search states..."
                emptyMessage="No matching state"
                triggerClassName="w-full"
                contentClassName="w-[var(--radix-popover-trigger-width)]"
                required
              />
            </div>
            <div>
              <Label>Sales Region <span className="text-destructive">*</span></Label>
              <SearchableSelect
                value={draft.regionId}
                options={regionOptions}
                onSelect={(o) => updateDraft('regionId', o?.value ?? '')}
                placeholder="Select region"
                searchPlaceholder="Search regions..."
                emptyMessage="No regions available"
                loading={isLoadingMasters && regionOptions.length === 0}
                allowClear
                triggerClassName="w-full"
                contentClassName="w-[var(--radix-popover-trigger-width)]"
                required
              />
            </div>
            <div className="sm:col-span-2">
              <Label>Parent Institution</Label>
              <SearchableSelect
                value={draft.parentInstitutionId}
                options={parentOptions}
                onSelect={(o) => updateDraft('parentInstitutionId', o?.value ?? '')}
                placeholder="No parent (optional)"
                searchPlaceholder="Search institutions..."
                emptyMessage="No institutions available"
                loading={isLoadingMasters && parentOptions.length === 0}
                allowClear
                triggerClassName="w-full"
                contentClassName="w-[var(--radix-popover-trigger-width)]"
              />
            </div>
            <div>
              <Label>Application Date</Label>
              <Input type="date" value={draft.applicationDate} onChange={(e) => updateDraft('applicationDate', e.target.value)} />
            </div>
            <div>
              <Label>Renewal Lead Days</Label>
              <Input type="number" min="0" value={draft.renewalLeadDays} onChange={(e) => updateDraft('renewalLeadDays', e.target.value)} placeholder="e.g. 30" />
            </div>
            <p className="text-xs text-muted-foreground sm:col-span-2">Status starts as Not Started. Approval / expiry dates are set via Advance Stage, not here.</p>
          </div>
        )}
        </div>

        <SheetFooter className="flex-row items-center justify-end gap-3 border-t pt-4">
          {createdId != null ? (
            <Button onClick={closeImmediately}>Close</Button>
          ) : (
            <>
              <Button variant="outline" onClick={handleCloseRequest} disabled={isSubmitting}>Cancel</Button>
              <Button onClick={handleSubmit} disabled={isSubmitting || createdId != null}>
                {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Create Institution
              </Button>
            </>
          )}
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
};

export default AddInstitutionModal;
