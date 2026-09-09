import type { RetailAccount, RetailAccountCreatePayload } from '@/lib/retail-api';

export const GSTIN_PATTERN = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/;

export interface RetailAccountDraft {
  accountName: string;
  clientType: RetailAccountCreatePayload['clientType'];
  gstNumber: string;
  clientGroupId: string;
  accountStatus: RetailAccountCreatePayload['accountStatus'];
  ownerEmployeeId: string;
  addressVillageArea: string;
  addressTaluka: string;
  addressCity: string;
  addressDistrict: string;
  addressState: string;
  pinCode: string;
  regionId: string;
  outletLatitude: string;
  outletLongitude: string;
  declaredMonthlySalesMt: string;
  focusSector: RetailAccountCreatePayload['focusSector'];
  creditTermsDays: string;
  creditLimitAmount: string;
  clientTier: RetailAccountCreatePayload['clientTier'];
  networkMember: boolean;
  networkOnboardingDate: string;
  networkStatus: 'ACTIVE' | 'INACTIVE';
}

export const createEmptyRetailAccountDraft = (employeeId?: number | null): RetailAccountDraft => ({
  accountName: '',
  clientType: 'DEALER',
  gstNumber: '',
  clientGroupId: '',
  accountStatus: 'PROSPECT',
  ownerEmployeeId: employeeId == null ? '' : String(employeeId),
  addressVillageArea: '',
  addressTaluka: '',
  addressCity: '',
  addressDistrict: '',
  addressState: '',
  pinCode: '',
  regionId: '',
  outletLatitude: '',
  outletLongitude: '',
  declaredMonthlySalesMt: '',
  focusSector: 'RETAIL',
  creditTermsDays: '0',
  creditLimitAmount: '0',
  clientTier: 'B',
  networkMember: false,
  networkOnboardingDate: '',
  networkStatus: 'ACTIVE',
});

export const createRetailAccountDraft = (account: RetailAccount): RetailAccountDraft => ({
  accountName: account.accountName,
  clientType: account.clientType,
  gstNumber: account.gstNumber,
  clientGroupId: account.clientGroupId == null ? '' : String(account.clientGroupId),
  accountStatus: account.accountStatus,
  ownerEmployeeId: account.ownerEmployeeId ? String(account.ownerEmployeeId) : '',
  addressVillageArea: account.addressVillageArea,
  addressTaluka: account.addressTaluka,
  addressCity: account.addressCity,
  addressDistrict: account.addressDistrict,
  addressState: account.addressState,
  pinCode: account.pinCode,
  regionId: account.regionId == null ? '' : String(account.regionId),
  outletLatitude: String(account.outletLatitude),
  outletLongitude: String(account.outletLongitude),
  declaredMonthlySalesMt: account.declaredMonthlySalesMt == null ? '' : String(account.declaredMonthlySalesMt),
  focusSector: account.focusSector,
  creditTermsDays: String(account.creditTermsDays),
  creditLimitAmount: String(account.creditLimitAmount),
  clientTier: account.clientTier,
  networkMember: account.networkMember,
  networkOnboardingDate: account.networkOnboardingDate ?? '',
  networkStatus: account.networkStatus ?? 'ACTIVE',
});

const isFiniteNumber = (value: string): boolean => value.trim() !== '' && Number.isFinite(Number(value));

export const validateRetailAccountDraft = (draft: RetailAccountDraft): string[] => {
  const errors: string[] = [];
  const requiredFields: Array<[string, string]> = [
    [draft.accountName, 'Client firm name'],
    [draft.gstNumber, 'GST number'],
    [draft.ownerEmployeeId, 'Assigned salesperson'],
    [draft.addressVillageArea, 'Village / area'],
    [draft.addressTaluka, 'Taluka'],
    [draft.addressCity, 'City'],
    [draft.addressDistrict, 'District'],
    [draft.addressState, 'State'],
    [draft.pinCode, 'PIN code'],
    [draft.outletLatitude, 'Outlet latitude'],
    [draft.outletLongitude, 'Outlet longitude'],
    [draft.creditTermsDays, 'Credit terms'],
    [draft.creditLimitAmount, 'Credit limit'],
  ];

  requiredFields.forEach(([value, label]) => {
    if (!value.trim()) errors.push(`${label} is required.`);
  });

  if (draft.gstNumber.trim() && !GSTIN_PATTERN.test(draft.gstNumber.trim().toUpperCase())) {
    errors.push('GST number must be a valid 15-character GSTIN.');
  }

  if (draft.pinCode.trim() && !/^\d{6}$/.test(draft.pinCode.trim())) {
    errors.push('PIN code must contain exactly 6 digits.');
  }

  if (isFiniteNumber(draft.outletLatitude) && (Number(draft.outletLatitude) < -90 || Number(draft.outletLatitude) > 90)) {
    errors.push('Outlet latitude must be between -90 and 90.');
  }

  if (isFiniteNumber(draft.outletLongitude) && (Number(draft.outletLongitude) < -180 || Number(draft.outletLongitude) > 180)) {
    errors.push('Outlet longitude must be between -180 and 180.');
  }

  if (draft.outletLatitude.trim() && !isFiniteNumber(draft.outletLatitude)) {
    errors.push('Outlet latitude must be a number.');
  }

  if (draft.outletLongitude.trim() && !isFiniteNumber(draft.outletLongitude)) {
    errors.push('Outlet longitude must be a number.');
  }

  if (draft.declaredMonthlySalesMt.trim() && (!isFiniteNumber(draft.declaredMonthlySalesMt) || Number(draft.declaredMonthlySalesMt) < 0)) {
    errors.push('Declared monthly sales must be zero or more.');
  }

  if (draft.creditTermsDays.trim() && (!/^\d+$/.test(draft.creditTermsDays) || Number(draft.creditTermsDays) < 0)) {
    errors.push('Credit terms must be a whole number of days, zero or more.');
  }

  if (draft.creditLimitAmount.trim() && (!isFiniteNumber(draft.creditLimitAmount) || Number(draft.creditLimitAmount) < 0)) {
    errors.push('Credit limit must be zero or more.');
  }

  if (draft.networkMember && !draft.networkOnboardingDate) {
    errors.push('Network onboarding date is required for a German TMT network member.');
  }

  return errors;
};

export const buildRetailAccountPayload = (draft: RetailAccountDraft): RetailAccountCreatePayload => ({
  accountName: draft.accountName.trim(),
  clientType: draft.clientType,
  gstNumber: draft.gstNumber.trim().toUpperCase(),
  clientGroupId: draft.clientGroupId ? Number(draft.clientGroupId) : null,
  accountStatus: draft.accountStatus,
  ownerEmployeeId: Number(draft.ownerEmployeeId),
  addressVillageArea: draft.addressVillageArea.trim(),
  addressTaluka: draft.addressTaluka.trim(),
  addressCity: draft.addressCity.trim(),
  addressDistrict: draft.addressDistrict.trim(),
  addressState: draft.addressState.trim(),
  pinCode: draft.pinCode.trim(),
  ...(draft.regionId ? { regionId: Number(draft.regionId) } : {}),
  outletLatitude: Number(draft.outletLatitude),
  outletLongitude: Number(draft.outletLongitude),
  declaredMonthlySalesMt: draft.declaredMonthlySalesMt.trim()
    ? Number(draft.declaredMonthlySalesMt)
    : null,
  focusSector: draft.focusSector,
  creditTermsDays: Number(draft.creditTermsDays),
  creditLimitAmount: Number(draft.creditLimitAmount),
  clientTier: draft.clientTier,
  networkMember: draft.networkMember,
  networkOnboardingDate: draft.networkMember ? draft.networkOnboardingDate : null,
  networkStatus: draft.networkMember ? draft.networkStatus : null,
  active: true,
});
