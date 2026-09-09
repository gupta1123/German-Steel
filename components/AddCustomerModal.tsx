"use client";

import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Crosshair,
  Loader2,
  Plus,
  Trash2,
} from 'lucide-react';
import { toast } from 'sonner';

import { getErrorMessage } from '@/lib/api-error';
import { isManagerRoleValue } from '@/lib/auth';
import {
  buildRetailAccountPayload,
  createEmptyRetailAccountDraft,
  type RetailAccountDraft,
  validateRetailAccountDraft,
} from '@/lib/retail-account';
import {
  RetailAPI,
  type CompetitorBrand,
  type RetailClientGroup,
  type RetailEmployee,
  type RetailPinCode,
  type RetailSalesRegion,
} from '@/lib/retail-api';
import { useUnsavedChanges } from '@/components/unsaved-changes-provider';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
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
import { SearchableSelect, type SearchableOption } from '@/components/ui/searchable-select2';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';

interface AddCustomerModalProps {
  isOpen: boolean;
  onClose: () => void;
  token: string;
  employeeId: number | null;
  onCustomerAdded?: () => void;
  userRole?: string;
  userData?: Record<string, unknown>;
}

interface ContactDraft {
  key: string;
  firstName: string;
  lastName: string;
  designation: string;
  roleDescription: string;
  mobile: string;
  email: string;
  dateOfBirth: string;
  anniversaryDate: string;
  primaryContact: boolean;
}

type TabId = 'account' | 'address' | 'commercial' | 'network' | 'contacts' | 'brands' | 'review';

const TAB_ORDER: TabId[] = ['account', 'address', 'commercial', 'network', 'contacts', 'brands', 'review'];

const createContactDraft = (primaryContact = false): ContactDraft => ({
  key: typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random()}`,
  firstName: '',
  lastName: '',
  designation: '',
  roleDescription: '',
  mobile: '',
  email: '',
  dateOfBirth: '',
  anniversaryDate: '',
  primaryContact,
});

const isContactStarted = (contact: ContactDraft): boolean => [
  contact.firstName,
  contact.lastName,
  contact.designation,
  contact.roleDescription,
  contact.mobile,
  contact.email,
  contact.dateOfBirth,
  contact.anniversaryDate,
].some((value) => value.trim() !== '');

const validateContacts = (contacts: ContactDraft[]): string[] => {
  const errors: string[] = [];
  const startedContacts = contacts.filter(isContactStarted);

  if (startedContacts.length === 0) return ['Add at least one customer contact.'];

  startedContacts.forEach((contact, index) => {
    const label = `Contact ${index + 1}`;
    const mobile = contact.mobile.replace(/\D/g, '');
    if (!contact.firstName.trim()) errors.push(`${label}: first name is required.`);
    if (!contact.designation.trim()) errors.push(`${label}: designation / role is required.`);
    if (mobile.length !== 10) errors.push(`${label}: mobile number must contain exactly 10 digits.`);
    if (contact.email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contact.email.trim())) {
      errors.push(`${label}: enter a valid email address.`);
    }
  });

  if (startedContacts.filter((contact) => contact.primaryContact).length !== 1) {
    errors.push('Choose exactly one primary contact.');
  }

  return errors;
};

const Field = ({
  label,
  required = false,
  hint,
  children,
}: {
  label: string;
  required?: boolean;
  hint?: string;
  children: React.ReactNode;
}) => (
  <div className="space-y-1.5">
    <Label>
      {label}
      {required && <span className="ml-1 text-destructive">*</span>}
    </Label>
    {children}
    {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
  </div>
);

const SectionIntro = ({ title, text }: { title: string; text: string }) => (
  <div className="rounded-lg border bg-muted/35 p-3">
    <p className="font-medium">{title}</p>
    <p className="mt-1 text-xs leading-5 text-muted-foreground">{text}</p>
  </div>
);

const AddCustomerModal: React.FC<AddCustomerModalProps> = ({
  isOpen,
  onClose,
  token,
  employeeId,
  onCustomerAdded,
  userRole,
  userData,
}) => {
  const [activeTab, setActiveTab] = useState<TabId>('account');
  const [draft, setDraft] = useState<RetailAccountDraft>(() => createEmptyRetailAccountDraft(employeeId));
  const [contacts, setContacts] = useState<ContactDraft[]>(() => [createContactDraft(true)]);
  const [selectedBrandIds, setSelectedBrandIds] = useState<number[]>([]);
  const [brandRemarks, setBrandRemarks] = useState('');
  const [employees, setEmployees] = useState<RetailEmployee[]>([]);
  const [groups, setGroups] = useState<RetailClientGroup[]>([]);
  const [regions, setRegions] = useState<RetailSalesRegion[]>([]);
  const [pinCodes, setPinCodes] = useState<RetailPinCode[]>([]);
  const [brands, setBrands] = useState<CompetitorBrand[]>([]);
  const [masterWarnings, setMasterWarnings] = useState<string[]>([]);
  const [isLoadingMasters, setIsLoadingMasters] = useState(false);
  const [isLocating, setIsLocating] = useState(false);
  const [locationMessage, setLocationMessage] = useState<string | null>(null);
  const [submitErrors, setSubmitErrors] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [hasUserChanges, setHasUserChanges] = useState(false);
  const [createdAccountId, setCreatedAccountId] = useState<number | null>(null);
  const [postCreateFailures, setPostCreateFailures] = useState<string[]>([]);
  const wasOpenRef = useRef(false);
  const { markSaved, requestDiscard } = useUnsavedChanges(
    isOpen && hasUserChanges && createdAccountId == null,
    'You have unsaved customer details. Discard them?',
  );

  const resetForm = () => {
    setActiveTab('account');
    setDraft(createEmptyRetailAccountDraft(employeeId));
    setContacts([createContactDraft(true)]);
    setSelectedBrandIds([]);
    setBrandRemarks('');
    setSubmitErrors([]);
    setMasterWarnings([]);
    setLocationMessage(null);
    setHasUserChanges(false);
    setCreatedAccountId(null);
    setPostCreateFailures([]);
  };

  useEffect(() => {
    if (isOpen && !wasOpenRef.current) resetForm();
    wasOpenRef.current = isOpen;
    // Reset only when a fresh dialog session opens.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen || !token) return;
    let cancelled = false;

    const loadMasters = async () => {
      setIsLoadingMasters(true);
      setMasterWarnings([]);

      const employeeRequest = async () => {
        const managerEmployeeId = Number(userData?.employeeId ?? employeeId);
        if (isManagerRoleValue(userRole) && Number.isFinite(managerEmployeeId)) {
          return RetailAPI.getEmployees(token, { managerId: managerEmployeeId });
        }
        return RetailAPI.getEmployees(token);
      };

      const [employeeResult, groupResult, regionResult, pinResult] = await Promise.allSettled([
        employeeRequest(),
        RetailAPI.getClientGroups(token),
        RetailAPI.getSalesRegions(token),
        RetailAPI.getPinCodes(token),
      ]);

      if (cancelled) return;
      const warnings: string[] = [];

      if (employeeResult.status === 'fulfilled') setEmployees(employeeResult.value);
      else warnings.push('Salesperson list could not be loaded.');

      if (groupResult.status === 'fulfilled') setGroups(groupResult.value.filter((group) => group.active !== false));
      else warnings.push('Client groups could not be loaded; you can create the account without a group.');

      if (regionResult.status === 'fulfilled') setRegions(regionResult.value.filter((region) => region.active !== false));
      else warnings.push('Sales regions could not be loaded; the server will derive the region from the PIN code.');

      if (pinResult.status === 'fulfilled') setPinCodes(pinResult.value.filter((pinCode) => pinCode.active !== false));
      else warnings.push('PIN master could not be loaded; the server will validate the PIN code when saved.');

      setBrands([]);
      warnings.push('The new API document does not include a competitor-brand master endpoint, so brand selection is unavailable during creation.');

      setMasterWarnings(warnings);
      setIsLoadingMasters(false);
    };

    void loadMasters();
    return () => {
      cancelled = true;
    };
  }, [isOpen, token, userRole, userData?.employeeId, employeeId]);

  const touch = () => {
    setHasUserChanges(true);
    setSubmitErrors([]);
  };

  const updateDraft = <K extends keyof RetailAccountDraft>(field: K, value: RetailAccountDraft[K]) => {
    touch();
    setDraft((previous) => ({ ...previous, [field]: value }));
  };

  const matchedPinCode = useMemo(() => {
    const pin = draft.pinCode.trim();
    return pin ? pinCodes.find((item) => item.pinCode === pin) ?? null : null;
  }, [draft.pinCode, pinCodes]);

  useEffect(() => {
    const derivedRegionId = matchedPinCode?.regionId == null ? '' : String(matchedPinCode.regionId);
    setDraft((previous) => previous.regionId === derivedRegionId
      ? previous
      : { ...previous, regionId: derivedRegionId });
  }, [matchedPinCode]);

  const derivedRegionName = useMemo(() => {
    if (!matchedPinCode) return '';
    return matchedPinCode.regionName
      || regions.find((region) => region.id === matchedPinCode.regionId)?.name
      || (matchedPinCode.regionId == null ? '' : `Region #${matchedPinCode.regionId}`);
  }, [matchedPinCode, regions]);

  const employeeOptions = useMemo<SearchableOption[]>(() => employees
    .map((employee) => {
      const name = [employee.firstName, employee.lastName].filter(Boolean).join(' ').trim();
      return {
        value: String(employee.id),
        label: `${name || `Employee #${employee.id}`}${employee.role ? ` - ${employee.role}` : ''}`,
      };
    })
    .sort((left, right) => left.label.localeCompare(right.label)), [employees]);

  const groupOptions = useMemo<SearchableOption[]>(() => groups
    .map((group) => ({
      value: String(group.id),
      label: `${group.groupName}${group.groupType ? ` - ${group.groupType.replaceAll('_', ' ')}` : ''}`,
    }))
    .sort((left, right) => left.label.localeCompare(right.label)), [groups]);

  const updateContact = (key: string, field: keyof Omit<ContactDraft, 'key'>, value: string | boolean) => {
    touch();
    setContacts((previous) => previous.map((contact) => {
      if (field === 'primaryContact' && value === true) {
        return { ...contact, primaryContact: contact.key === key };
      }
      return contact.key === key ? { ...contact, [field]: value } : contact;
    }));
  };

  const addContact = () => {
    touch();
    setContacts((previous) => [...previous, createContactDraft(false)]);
  };

  const removeContact = (key: string) => {
    touch();
    setContacts((previous) => {
      const remaining = previous.filter((contact) => contact.key !== key);
      if (remaining.length === 0) return [createContactDraft(true)];
      if (!remaining.some((contact) => contact.primaryContact)) {
        return remaining.map((contact, index) => ({ ...contact, primaryContact: index === 0 }));
      }
      return remaining;
    });
  };

  const toggleBrand = (brandId: number, checked: boolean) => {
    touch();
    setSelectedBrandIds((previous) => checked
      ? [...new Set([...previous, brandId])]
      : previous.filter((id) => id !== brandId));
  };

  const captureLocation = () => {
    if (!navigator.geolocation) {
      setLocationMessage('Location capture is not supported by this browser.');
      return;
    }

    setIsLocating(true);
    setLocationMessage(null);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        touch();
        setDraft((previous) => ({
          ...previous,
          outletLatitude: position.coords.latitude.toFixed(7),
          outletLongitude: position.coords.longitude.toFixed(7),
        }));
        setLocationMessage(`Location captured (about ${Math.round(position.coords.accuracy)} m accuracy).`);
        setIsLocating(false);
      },
      (error) => {
        setLocationMessage(error.message || 'Could not capture the outlet location.');
        setIsLocating(false);
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 },
    );
  };

  const closeImmediately = () => {
    setHasUserChanges(false);
    markSaved();
    onClose();
  };

  const handleCloseRequest = () => requestDiscard(closeImmediately);

  const moveTab = (direction: -1 | 1) => {
    const currentIndex = TAB_ORDER.indexOf(activeTab);
    const nextIndex = Math.min(TAB_ORDER.length - 1, Math.max(0, currentIndex + direction));
    setActiveTab(TAB_ORDER[nextIndex]);
  };

  const handleSubmit = async () => {
    const accountErrors = validateRetailAccountDraft(draft);
    if (pinCodes.length > 0 && !matchedPinCode) {
      accountErrors.push('Choose an active PIN code from the PIN master.');
    }
    const contactErrors = validateContacts(contacts);
    const allErrors = [...accountErrors, ...contactErrors];
    if (!token) allErrors.unshift('Your login session is missing. Sign in again before saving.');

    if (allErrors.length > 0) {
      setSubmitErrors(allErrors);
      setActiveTab(accountErrors.length === 0 && contactErrors.length > 0 ? 'contacts' : 'account');
      return;
    }

    setIsSubmitting(true);
    setSubmitErrors([]);
    const failures: string[] = [];

    try {
      const accountId = await RetailAPI.createAccount(buildRetailAccountPayload(draft), token);

      for (const contact of contacts.filter(isContactStarted)) {
        const contactName = [contact.firstName, contact.lastName].filter(Boolean).join(' ');
        try {
          const contactId = await RetailAPI.createMasterContact({
            firstName: contact.firstName.trim(),
            lastName: contact.lastName.trim(),
            mobile: contact.mobile.replace(/\D/g, ''),
            email: contact.email.trim() || null,
            dateOfBirth: contact.dateOfBirth || null,
            anniversaryDate: contact.anniversaryDate || null,
            active: true,
          }, token);

          await RetailAPI.linkContact({
            clientAccountId: accountId,
            contactInfluenceRegisterId: contactId,
            designation: contact.designation.trim(),
            roleDescription: contact.roleDescription.trim() || null,
            primaryContact: contact.primaryContact,
            active: true,
          }, token);
        } catch (error) {
          failures.push(`${contactName || 'Contact'}: ${getErrorMessage(error, 'could not be linked')}`);
        }
      }

      const brandEmployeeId = employeeId ?? Number(draft.ownerEmployeeId);
      for (const brandId of selectedBrandIds) {
        const brandName = brands.find((brand) => brand.id === brandId)?.name ?? `Brand #${brandId}`;
        try {
          await RetailAPI.addBrandUsage({
            clientAccountId: accountId,
            competitorBrandId: brandId,
            employeeId: brandEmployeeId,
            remarks: brandRemarks.trim() || null,
          }, token);
        } catch (error) {
          failures.push(`${brandName}: ${getErrorMessage(error, 'brand usage could not be linked')}`);
        }
      }

      setCreatedAccountId(accountId);
      setPostCreateFailures(failures);
      setHasUserChanges(false);
      markSaved();
      onCustomerAdded?.();

      if (failures.length > 0) {
        setActiveTab('review');
        toast.warning('Customer account created with some follow-up items.', { duration: 5000 });
      } else {
        toast.success('Customer account created successfully.', { duration: 3000 });
        onClose();
      }
    } catch (error) {
      const message = getErrorMessage(error, 'Unable to create the customer account.');
      setSubmitErrors([message]);
      setActiveTab('review');
      toast.error(message, { duration: 5000 });
    } finally {
      setIsSubmitting(false);
    }
  };

  const selectedOwner = employeeOptions.find((option) => option.value === draft.ownerEmployeeId)?.label || 'Not selected';
  const selectedGroup = groupOptions.find((option) => option.value === draft.clientGroupId)?.label || 'No group';
  const selectedBrands = brands.filter((brand) => selectedBrandIds.includes(brand.id));
  const activeContacts = contacts.filter(isContactStarted);

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && handleCloseRequest()}>
      <DialogContent className="flex max-h-[92vh] flex-col overflow-hidden p-0 sm:max-w-4xl">
        <DialogHeader className="border-b px-6 pb-4 pt-6">
          <DialogTitle>Create Retail Customer</DialogTitle>
          <DialogDescription>
            Add a dealer or distributor account using the German TMT retail process.
          </DialogDescription>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as TabId)} className="flex min-h-0 flex-1 flex-col">
          <div className="border-b px-4 py-3 sm:px-6">
            <TabsList className="grid h-auto w-full grid-cols-4 gap-1 lg:grid-cols-7">
              <TabsTrigger value="account">Account</TabsTrigger>
              <TabsTrigger value="address">Address</TabsTrigger>
              <TabsTrigger value="commercial">Commercial</TabsTrigger>
              <TabsTrigger value="network">Network</TabsTrigger>
              <TabsTrigger value="contacts">Contacts</TabsTrigger>
              <TabsTrigger value="brands">Brands</TabsTrigger>
              <TabsTrigger value="review">Review</TabsTrigger>
            </TabsList>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto px-4 py-5 sm:px-6">
            {masterWarnings.length > 0 && (
              <div className="mb-4 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
                <div className="flex gap-2">
                  <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                  <div>{masterWarnings.map((warning) => <p key={warning}>{warning}</p>)}</div>
                </div>
              </div>
            )}

            {submitErrors.length > 0 && activeTab !== 'review' && (
              <div className="mb-4 rounded-lg border border-destructive/40 bg-destructive/5 p-4 text-sm text-destructive">
                <div className="flex gap-2">
                  <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                  <div>
                    <p className="font-medium">Please fix the following:</p>
                    <ul className="mt-2 list-disc space-y-1 pl-5">
                      {submitErrors.map((error) => <li key={error}>{error}</li>)}
                    </ul>
                  </div>
                </div>
              </div>
            )}

            <TabsContent value="account" className="m-0 space-y-5">
              <SectionIntro
                title="Account identity"
                text="The account ID is generated by the server. GST is validated on save and is not used as the record key."
              />
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Client Firm Name" required>
                  <Input value={draft.accountName} onChange={(event) => updateDraft('accountName', event.target.value)} placeholder="e.g. Shree Steel Dadar Branch" />
                </Field>
                <Field label="GST Number" required hint="15-character GSTIN; duplicate validation happens on save.">
                  <Input value={draft.gstNumber} onChange={(event) => updateDraft('gstNumber', event.target.value.toUpperCase().slice(0, 15))} placeholder="27ABCDE1234F1Z5" className="uppercase" />
                </Field>
                <Field label="Client Type" required>
                  <Select value={draft.clientType} onValueChange={(value) => updateDraft('clientType', value as RetailAccountDraft['clientType'])}>
                    <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="DEALER">Dealer</SelectItem>
                      <SelectItem value="DISTRIBUTOR">Distributor</SelectItem>
                    </SelectContent>
                  </Select>
                </Field>
                <Field label="Account Status" required>
                  <Select value={draft.accountStatus} onValueChange={(value) => updateDraft('accountStatus', value as RetailAccountDraft['accountStatus'])}>
                    <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="PROSPECT">Prospect</SelectItem>
                      <SelectItem value="ACTIVE">Active</SelectItem>
                      <SelectItem value="DORMANT">Dormant</SelectItem>
                      <SelectItem value="LOST">Lost</SelectItem>
                    </SelectContent>
                  </Select>
                </Field>
                <Field label="Assigned Salesperson (Account Owner)" required>
                  <SearchableSelect
                    triggerId="retail-owner"
                    value={draft.ownerEmployeeId}
                    options={employeeOptions}
                    onSelect={(option) => updateDraft('ownerEmployeeId', option?.value ?? '')}
                    placeholder="Select a salesperson"
                    searchPlaceholder="Search employees..."
                    emptyMessage="No employees available"
                    loading={isLoadingMasters && employeeOptions.length === 0}
                    triggerClassName="w-full"
                    contentClassName="w-[var(--radix-popover-trigger-width)]"
                    required
                  />
                </Field>
                <Field label="Client Group" hint="Optional in the current API. Use it to link related branches; it can also be assigned later.">
                  <SearchableSelect
                    triggerId="retail-group"
                    value={draft.clientGroupId}
                    options={groupOptions}
                    onSelect={(option) => updateDraft('clientGroupId', option?.value ?? '')}
                    placeholder="No group"
                    searchPlaceholder="Search client groups..."
                    emptyMessage="No client groups available"
                    loading={isLoadingMasters && groupOptions.length === 0}
                    allowClear
                    triggerClassName="w-full"
                    contentClassName="w-[var(--radix-popover-trigger-width)]"
                  />
                </Field>
              </div>
            </TabsContent>

            <TabsContent value="address" className="m-0 space-y-5">
              <SectionIntro
                title="Outlet address and visit location"
                text="Sales region is derived from the PIN master, not from the district. GPS coordinates are required for visit check-in verification."
              />
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Village / Area" required><Input value={draft.addressVillageArea} onChange={(event) => updateDraft('addressVillageArea', event.target.value)} /></Field>
                <Field label="Taluka" required><Input value={draft.addressTaluka} onChange={(event) => updateDraft('addressTaluka', event.target.value)} /></Field>
                <Field label="City" required><Input value={draft.addressCity} onChange={(event) => updateDraft('addressCity', event.target.value)} /></Field>
                <Field label="District" required><Input value={draft.addressDistrict} onChange={(event) => updateDraft('addressDistrict', event.target.value)} /></Field>
                <Field label="State" required><Input value={draft.addressState} onChange={(event) => updateDraft('addressState', event.target.value)} /></Field>
                <Field label="PIN Code" required hint={pinCodes.length > 0 ? 'Enter an active PIN from the master list.' : 'The backend will validate and derive its region.'}>
                  <Input
                    value={draft.pinCode}
                    onChange={(event) => updateDraft('pinCode', event.target.value.replace(/\D/g, '').slice(0, 6))}
                    inputMode="numeric"
                    list="retail-pin-codes"
                    placeholder="400001"
                  />
                  <datalist id="retail-pin-codes">{pinCodes.map((pinCode) => <option key={pinCode.id} value={pinCode.pinCode} />)}</datalist>
                </Field>
                <Field label="Sales Region" hint="Read-only and derived only from the selected PIN code.">
                  <Input value={derivedRegionName} readOnly placeholder={draft.pinCode ? 'No matching PIN found' : 'Enter PIN code first'} />
                </Field>
                <div className="hidden sm:block" />
                <Field label="Outlet Latitude" required>
                  <Input value={draft.outletLatitude} onChange={(event) => updateDraft('outletLatitude', event.target.value)} inputMode="decimal" placeholder="18.9388000" />
                </Field>
                <Field label="Outlet Longitude" required>
                  <Input value={draft.outletLongitude} onChange={(event) => updateDraft('outletLongitude', event.target.value)} inputMode="decimal" placeholder="72.8354000" />
                </Field>
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <Button type="button" variant="outline" onClick={captureLocation} disabled={isLocating}>
                  {isLocating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Crosshair className="mr-2 h-4 w-4" />}
                  Capture Current Location
                </Button>
                {locationMessage && <p className="text-xs text-muted-foreground">{locationMessage}</p>}
              </div>
            </TabsContent>

            <TabsContent value="commercial" className="m-0 space-y-5">
              <SectionIntro
                title="Commercial profile"
                text="These values describe the opportunity and agreed terms. Future changes are recorded by the backend in commercial history."
              />
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Declared Monthly Sales (MT/month)" hint="Optional; enter the amount stated by the client.">
                  <Input value={draft.declaredMonthlySalesMt} onChange={(event) => updateDraft('declaredMonthlySalesMt', event.target.value)} type="number" min="0" step="0.01" />
                </Field>
                <Field label="Focus Sector" required>
                  <Select value={draft.focusSector} onValueChange={(value) => updateDraft('focusSector', value as RetailAccountDraft['focusSector'])}>
                    <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="RETAIL">Retail</SelectItem>
                      <SelectItem value="GOVERNMENT_PROJECTS">Government Projects</SelectItem>
                      <SelectItem value="DEVELOPER_PROJECTS">Developer Projects</SelectItem>
                      <SelectItem value="ALL_SECTORS">All Sectors</SelectItem>
                    </SelectContent>
                  </Select>
                </Field>
                <Field label="Credit Terms (Days)" required>
                  <Input value={draft.creditTermsDays} onChange={(event) => updateDraft('creditTermsDays', event.target.value)} type="number" min="0" step="1" />
                </Field>
                <Field label="Credit Limit Amount" required>
                  <Input value={draft.creditLimitAmount} onChange={(event) => updateDraft('creditLimitAmount', event.target.value)} type="number" min="0" step="0.01" />
                </Field>
                <Field label="Client Tier" required hint="Tier A, B, or C drives visit planning and reminders.">
                  <Select value={draft.clientTier} onValueChange={(value) => updateDraft('clientTier', value as RetailAccountDraft['clientTier'])}>
                    <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="A">A</SelectItem>
                      <SelectItem value="B">B</SelectItem>
                      <SelectItem value="C">C</SelectItem>
                    </SelectContent>
                  </Select>
                </Field>
              </div>
            </TabsContent>

            <TabsContent value="network" className="m-0 space-y-5">
              <SectionIntro
                title="German TMT network"
                text="A prospect becomes a network member after commercial terms are agreed and onboarding begins. Network date and status are required only for members."
              />
              <div className="flex items-center justify-between rounded-lg border p-4">
                <div>
                  <Label htmlFor="network-member">German TMT Network Member</Label>
                  <p className="mt-1 text-xs text-muted-foreground">Turn on when the account has formally joined the network.</p>
                </div>
                <Switch id="network-member" checked={draft.networkMember} onCheckedChange={(checked) => updateDraft('networkMember', checked)} />
              </div>
              {draft.networkMember ? (
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="Onboarding Date" required>
                    <Input type="date" value={draft.networkOnboardingDate} onChange={(event) => updateDraft('networkOnboardingDate', event.target.value)} />
                  </Field>
                  <Field label="Network Status" required>
                    <Select value={draft.networkStatus} onValueChange={(value) => updateDraft('networkStatus', value as RetailAccountDraft['networkStatus'])}>
                      <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="ACTIVE">Active</SelectItem>
                        <SelectItem value="INACTIVE">Inactive</SelectItem>
                      </SelectContent>
                    </Select>
                  </Field>
                </div>
              ) : (
                <p className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
                  Onboarding date and network status will be sent as empty, as required by the API.
                </p>
              )}
            </TabsContent>

            <TabsContent value="contacts" className="m-0 space-y-4">
              <SectionIntro
                title="Contacts linked to this account"
                text="Contacts are separate records so a branch can have more than one person over time. Exactly one active contact must be primary."
              />
              {contacts.map((contact, index) => (
                <div key={contact.key} className="space-y-4 rounded-lg border p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="font-medium">Contact {index + 1}</p>
                      <label className="mt-1 flex cursor-pointer items-center gap-2 text-xs text-muted-foreground">
                        <Checkbox checked={contact.primaryContact} onCheckedChange={(checked) => updateContact(contact.key, 'primaryContact', checked === true)} />
                        Primary contact
                      </label>
                    </div>
                    <Button type="button" variant="ghost" size="icon" onClick={() => removeContact(contact.key)} aria-label={`Remove contact ${index + 1}`}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <Field label="First Name" required><Input value={contact.firstName} onChange={(event) => updateContact(contact.key, 'firstName', event.target.value)} /></Field>
                    <Field label="Last Name"><Input value={contact.lastName} onChange={(event) => updateContact(contact.key, 'lastName', event.target.value)} /></Field>
                    <Field label="Designation / Role" required><Input value={contact.designation} onChange={(event) => updateContact(contact.key, 'designation', event.target.value)} placeholder="e.g. Owner" /></Field>
                    <Field label="Role Description"><Input value={contact.roleDescription} onChange={(event) => updateContact(contact.key, 'roleDescription', event.target.value)} placeholder="e.g. Primary purchase decision maker" /></Field>
                    <Field label="Mobile Number" required>
                      <Input value={contact.mobile} onChange={(event) => updateContact(contact.key, 'mobile', event.target.value.replace(/\D/g, '').slice(0, 10))} inputMode="numeric" />
                    </Field>
                    <Field label="Email Address"><Input type="email" value={contact.email} onChange={(event) => updateContact(contact.key, 'email', event.target.value)} /></Field>
                    <Field label="Date of Birth"><Input type="date" value={contact.dateOfBirth} onChange={(event) => updateContact(contact.key, 'dateOfBirth', event.target.value)} /></Field>
                    <Field label="Date of Anniversary"><Input type="date" value={contact.anniversaryDate} onChange={(event) => updateContact(contact.key, 'anniversaryDate', event.target.value)} /></Field>
                  </div>
                </div>
              ))}
              <Button type="button" variant="outline" onClick={addContact}><Plus className="mr-2 h-4 w-4" /> Add Another Contact</Button>
            </TabsContent>

            <TabsContent value="brands" className="m-0 space-y-5">
              <SectionIntro
                title="Other brands stocked"
                text="Choose from the brand master so this information remains reportable. This step is optional during account creation."
              />
              {isLoadingMasters && brands.length === 0 ? (
                <div className="flex items-center gap-2 py-8 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Loading brands...</div>
              ) : brands.length === 0 ? (
                <p className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">No brands are available. Brand usage can be added later from the customer account.</p>
              ) : (
                <div className="grid max-h-72 gap-2 overflow-y-auto rounded-lg border p-3 sm:grid-cols-2">
                  {brands.map((brand) => (
                    <label key={brand.id} className="flex cursor-pointer items-center gap-3 rounded-md border p-3 hover:bg-muted/50">
                      <Checkbox checked={selectedBrandIds.includes(brand.id)} onCheckedChange={(checked) => toggleBrand(brand.id, checked === true)} />
                      <span className="text-sm">{brand.name}</span>
                    </label>
                  ))}
                </div>
              )}
              <Field label="Brand Usage Remarks" hint="The same onboarding remark is attached to each selected brand.">
                <Textarea
                  value={brandRemarks}
                  onChange={(event) => {
                    touch();
                    setBrandRemarks(event.target.value);
                  }}
                  placeholder="e.g. Client uses these brands for 8 mm and 10 mm TMT."
                />
              </Field>
            </TabsContent>

            <TabsContent value="review" className="m-0 space-y-5">
              {createdAccountId != null ? (
                <div className={`rounded-lg border p-5 ${postCreateFailures.length ? 'border-amber-300 bg-amber-50' : 'border-emerald-300 bg-emerald-50'}`}>
                  <div className="flex gap-3">
                    <CheckCircle2 className={`mt-0.5 h-5 w-5 shrink-0 ${postCreateFailures.length ? 'text-amber-700' : 'text-emerald-700'}`} />
                    <div>
                      <p className="font-semibold">Customer account #{createdAccountId} was created.</p>
                      {postCreateFailures.length > 0 ? (
                        <>
                          <p className="mt-1 text-sm">The account is safe, but these linked records need follow-up:</p>
                          <ul className="mt-2 list-disc space-y-1 pl-5 text-sm">
                            {postCreateFailures.map((failure) => <li key={failure}>{failure}</li>)}
                          </ul>
                          <p className="mt-3 text-xs">Do not submit this account again; add the missing contact or brand from its detail page.</p>
                        </>
                      ) : (
                        <p className="mt-1 text-sm">All contacts and brand links were saved successfully.</p>
                      )}
                    </div>
                  </div>
                </div>
              ) : (
                <>
                  <SectionIntro
                    title="Review before creating"
                    text="The account is created first, followed by its master contacts, account-contact links, and selected brand-usage records."
                  />
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="rounded-lg border p-4">
                      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Account</p>
                      <p className="mt-2 font-medium">{draft.accountName || 'Not entered'}</p>
                      <p className="text-sm text-muted-foreground">{draft.clientType} - {draft.accountStatus}</p>
                      <p className="mt-2 text-sm">GST: {draft.gstNumber || 'Not entered'}</p>
                      <p className="text-sm">Owner: {selectedOwner}</p>
                      <p className="text-sm">Group: {selectedGroup}</p>
                    </div>
                    <div className="rounded-lg border p-4">
                      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Address</p>
                      <p className="mt-2 text-sm">{[
                        draft.addressVillageArea,
                        draft.addressTaluka,
                        draft.addressCity,
                        draft.addressDistrict,
                        draft.addressState,
                      ].filter(Boolean).join(', ') || 'Not entered'}</p>
                      <p className="mt-2 text-sm">PIN: {draft.pinCode || 'Not entered'}</p>
                      <p className="text-sm">Region: {derivedRegionName || 'Derived by backend'}</p>
                    </div>
                    <div className="rounded-lg border p-4">
                      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Commercial & Network</p>
                      <p className="mt-2 text-sm">Monthly sales: {draft.declaredMonthlySalesMt || 'Not declared'} MT</p>
                      <p className="text-sm">Credit: {draft.creditTermsDays || '0'} days / {draft.creditLimitAmount || '0'}</p>
                      <p className="text-sm">Tier {draft.clientTier} - {draft.focusSector.replaceAll('_', ' ')}</p>
                      <p className="text-sm">Network member: {draft.networkMember ? `${draft.networkStatus} since ${draft.networkOnboardingDate || 'date missing'}` : 'No'}</p>
                    </div>
                    <div className="rounded-lg border p-4">
                      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Linked Records</p>
                      <p className="mt-2 text-sm">Contacts: {activeContacts.length}</p>
                      <p className="text-sm">Primary: {activeContacts.find((contact) => contact.primaryContact)?.firstName || 'Not selected'}</p>
                      <p className="text-sm">Brands: {selectedBrands.length ? selectedBrands.map((brand) => brand.name).join(', ') : 'None selected'}</p>
                    </div>
                  </div>
                </>
              )}

              {submitErrors.length > 0 && (
                <div className="rounded-lg border border-destructive/40 bg-destructive/5 p-4 text-sm text-destructive">
                  <div className="flex gap-2">
                    <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                    <div>
                      <p className="font-medium">Please fix the following:</p>
                      <ul className="mt-2 list-disc space-y-1 pl-5">{submitErrors.map((error) => <li key={error}>{error}</li>)}</ul>
                    </div>
                  </div>
                </div>
              )}

              {createdAccountId == null && (
                <p className="text-xs text-muted-foreground">
                  Notes and remarks are timestamped records and should be added after creation from the customer detail page, not stored as one overwritable account field.
                </p>
              )}
            </TabsContent>
          </div>

          <DialogFooter className="flex-row items-center justify-between gap-3 border-t px-4 py-4 sm:px-6">
            {createdAccountId != null ? (
              <Button type="button" className="ml-auto" onClick={closeImmediately}>Close</Button>
            ) : (
              <>
                <div className="flex gap-2">
                  <Button type="button" variant="outline" onClick={handleCloseRequest} disabled={isSubmitting}>Cancel</Button>
                  {activeTab !== 'account' && (
                    <Button type="button" variant="outline" onClick={() => moveTab(-1)} disabled={isSubmitting}>
                      <ChevronLeft className="mr-1 h-4 w-4" /> Back
                    </Button>
                  )}
                </div>
                {activeTab === 'review' ? (
                  <Button type="button" onClick={handleSubmit} disabled={isSubmitting}>
                    {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Create Customer
                  </Button>
                ) : (
                  <Button type="button" onClick={() => moveTab(1)}>Next <ChevronRight className="ml-1 h-4 w-4" /></Button>
                )}
              </>
            )}
          </DialogFooter>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
};

export default AddCustomerModal;
