import { getApiErrorMessage } from '@/lib/api-error';
import { toTitleCase } from '@/lib/utils';

export const RETAIL_API_BASE_URL = 'http://ec2-18-211-58-135.compute-1.amazonaws.com:8081';

export interface ApiPage<T> {
  content: T[];
  number: number;
  size: number;
  totalElements: number;
  totalPages: number;
}

export interface RetailClientGroup { id: number; groupName: string; groupType?: string | null; notes?: string | null; active?: boolean }
export type RetailClientGroupType = 'STANDALONE' | 'FAMILY_GROUP' | 'CORPORATE_GROUP';
export interface RetailClientGroupPayload { groupName: string; groupType: RetailClientGroupType; notes?: string | null; active?: boolean }
export interface RetailSalesRegion { id: number; name: string; code?: string | null; active?: boolean }
export interface RetailPinCode { id: number; pinCode: string; regionId: number | null; regionName: string; active?: boolean }
export interface RetailEmployee { id: number; employeeCode: string; firstName: string; lastName: string; role: string; mobile: string; email: string; active?: boolean }
export interface CompetitorBrand { id: number; name: string }
export interface RetailPricing { id: number; competitorBrandId: number; brandName: string; pricePerTon: number; city: string; district: string | null; state: string; pinCode: string; regionId: number | null; regionCode: string | null; regionName: string | null; observationDate: string; remarks: string | null; createdByEmployeeId: number | null; createdByEmployeeName: string; createdAt: string; active: boolean }
export interface RetailPricingPayload { competitorBrandId: number; pricePerTon: number; city: string; district: string; state: string; pinCode: string; observationDate: string; remarks: string | null }
export interface RetailPricingSummary { competitorBrandId: number; brandName: string; city: string | null; avgPrice: number; minPrice: number; maxPrice: number; count: number }

export type RetailAccountStatus = 'PROSPECT' | 'ACTIVE' | 'DORMANT' | 'LOST';
export type RetailClientType = 'DEALER' | 'DISTRIBUTOR';
export type RetailFocusSector = 'RETAIL' | 'GOVERNMENT_PROJECTS' | 'DEVELOPER_PROJECTS' | 'ALL_SECTORS';

export interface RetailAccountCreatePayload {
  accountName: string;
  clientType: RetailClientType;
  gstNumber: string;
  clientGroupId: number | null;
  accountStatus: RetailAccountStatus;
  ownerEmployeeId: number;
  addressVillageArea: string;
  addressTaluka: string;
  addressCity: string;
  addressDistrict: string;
  addressState: string;
  pinCode: string;
  regionId?: number;
  outletLatitude: number;
  outletLongitude: number;
  declaredMonthlySalesMt: number | null;
  focusSector: RetailFocusSector;
  creditTermsDays: number;
  creditLimitAmount: number;
  clientTier: 'A' | 'B' | 'C';
  networkMember: boolean;
  networkOnboardingDate: string | null;
  networkStatus: 'ACTIVE' | 'INACTIVE' | null;
  active: boolean;
}

export interface RetailAccount extends RetailAccountCreatePayload {
  id: number;
  clientGroupName: string;
  ownerEmployeeName: string;
  regionName: string;
  createdAt: string;
  updatedAt: string;
}

export interface MasterContactCreatePayload { firstName: string; lastName: string; mobile: string; email: string | null; dateOfBirth: string | null; anniversaryDate: string | null; active: boolean }
export interface RetailMasterContact { id: number; firstName: string; lastName: string; mobile: string; email: string; dateOfBirth: string; anniversaryDate: string; active?: boolean }
export interface RetailContactLinkPayload { clientAccountId: number; contactInfluenceRegisterId: number; designation: string; roleDescription: string | null; primaryContact: boolean; active: boolean }
export interface RetailContact { id: number; contactInfluenceRegisterId: number; firstName: string; lastName: string; mobile: string; email: string; dateOfBirth: string; anniversaryDate: string; designation: string; roleDescription: string; primaryContact: boolean; active: boolean }
export interface RetailBrandUsagePayload { clientAccountId: number; competitorBrandId: number; employeeId: number; remarks: string | null }
export interface RetailBrandUsage { id: number; competitorBrandId: number; brandName: string; employeeId: number | null; employeeName: string; remarks: string; active: boolean; addedAt: string; removedAt: string }
export interface RetailSale { id: number; saleDate: string; quantityMt: number; invoiceReference: string; sourceSystem: string }
export interface RetailCommercialHistory { id: number; fieldName: string; oldValue: string; newValue: string; changeReason: string; changedBy: string; changedAt: string }
export interface RetailNote { id: number; noteText: string; authorName: string; authorEmployeeId: number | null; createdAt: string; updatedAt: string }
export interface RetailVisit { id: number; scheduledVisitDate: string; scheduledStartTime: string; scheduledEndTime: string; purpose: string; description: string | null; assignedEmployeeId: number | null; assignedEmployeeName: string; outcome: string; discussionSummary: string; nextActionText: string; nextActionDate: string; actualCheckinAt: string; actualCheckoutAt: string }
export interface RetailTask { id: number; clientAccountId: number | null; title: string; description: string; taskType: string; status: 'OPEN' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED'; priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT'; dueDate: string; assignedEmployeeId: number | null; assignedEmployeeName: string }
export interface PlannedVisitPayload { visitType: 'DEALER_VISIT'; clientAccountId: number; institutionId: null; projectId: null; assignedEmployeeId: number; assignedByEmployeeId: number; scheduledVisitDate: string; scheduledStartTime: string; scheduledEndTime: string; scheduledLatitude: number; scheduledLongitude: number; purpose: string; description?: string | null; selfGenerated: boolean }
export interface RetailSalePayload { clientAccountId: number; saleDate: string; quantityMt: number; invoiceReference: string; sourceSystem: string }
export interface RetailTaskPayload { taskTitle: string; taskDescription: string | null; taskType: 'FOLLOW_UP'; status: RetailTask['status']; priority: RetailTask['priority']; assignedToEmployeeId: number; assignedByEmployeeId: number; dueDate: string; clientAccountId: number; visitActivityId: number | null }

export class RetailApiError extends Error {
  status: number;
  constructor(message: string, status: number) { super(message); this.name = 'RetailApiError'; this.status = status }
}

const readResponseBody = async (response: Response): Promise<unknown> => {
  if (response.status === 204) return undefined;
  const text = (await response.text()).trim();
  if (!text) return undefined;
  try { return JSON.parse(text) as unknown } catch { return text }
};

const request = async (path: string, token: string, options: RequestInit = {}): Promise<unknown> => {
  const response = await fetch(`${RETAIL_API_BASE_URL}${path}`, {
    ...options,
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}`, ...options.headers },
  });
  if (!response.ok) throw new RetailApiError(await getApiErrorMessage(response, `Request failed (${response.status})`), response.status);
  return readResponseBody(response);
};

const getWithDocumentedFallback = async (paths: string[], token: string): Promise<unknown> => {
  let lastError: unknown;
  for (const path of paths) {
    try { return await request(path, token) } catch (error) {
      lastError = error;
      if (!(error instanceof RetailApiError) || ![404, 405].includes(error.status)) throw error;
    }
  }
  throw lastError instanceof Error ? lastError : new Error('Could not load master data');
};

const recordOf = (value: unknown): Record<string, unknown> | null => value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : null;
const nested = (record: Record<string, unknown> | null, ...keys: string[]) => {
  for (const key of keys) { const found = recordOf(record?.[key]); if (found) return found }
  return null;
};
const pageItems = (value: unknown): unknown[] => {
  if (Array.isArray(value)) return value;
  const record = recordOf(value);
  if (!record) return [];
  if (Array.isArray(record.content)) return record.content;
  if (Array.isArray(record.data)) return record.data;
  const data = recordOf(record.data);
  return data && Array.isArray(data.content) ? data.content : [];
};
const numberOf = (...values: unknown[]): number | null => {
  for (const value of values) {
    if (typeof value === 'number' && Number.isFinite(value)) return value;
    if (typeof value === 'string' && value.trim() && Number.isFinite(Number(value))) return Number(value);
  }
  return null;
};
const stringOf = (...values: unknown[]): string => {
  for (const value of values) {
    if (typeof value === 'string' && value.trim()) return value.trim();
    if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  }
  return '';
};
const booleanOf = (fallback: boolean, ...values: unknown[]): boolean => {
  for (const value of values) {
    if (typeof value === 'boolean') return value;
    if (value === 'true' || value === 1) return true;
    if (value === 'false' || value === 0) return false;
  }
  return fallback;
};
const queryString = (values: Record<string, string | number | boolean | null | undefined>): string => {
  const params = new URLSearchParams();
  Object.entries(values).forEach(([key, value]) => { if (value !== undefined && value !== null && value !== '') params.set(key, String(value)) });
  return params.size ? `?${params.toString()}` : '';
};
const pageOf = <T>(value: unknown, content: T[], number = 0, size = content.length || 20): ApiPage<T> => {
  const outer = recordOf(value); const data = recordOf(outer?.data); const source = data && (Array.isArray(data.content) || 'totalElements' in data) ? data : outer;
  const totalElements = numberOf(source?.totalElements, source?.total, content.length) ?? content.length;
  const actualSize = numberOf(source?.size, size) ?? size;
  return { content, number: numberOf(source?.number, source?.page, number) ?? number, size: actualSize, totalElements, totalPages: numberOf(source?.totalPages) ?? Math.max(1, Math.ceil(totalElements / Math.max(1, actualSize))) };
};
const extractCreatedId = (value: unknown, keys: string[]): number => {
  const direct = numberOf(value); if (direct != null) return direct;
  const record = recordOf(value);
  if (record) {
    for (const key of keys) { const id = numberOf(record[key]); if (id != null) return id }
    if (record.data != null && record.data !== value) return extractCreatedId(record.data, keys);
  }
  throw new Error('The server saved the record but did not return its ID. Refresh before retrying.');
};
const json = (method: 'POST' | 'PUT', body?: unknown): RequestInit => ({ method, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });

const normalizeAccount = (value: unknown): RetailAccount | null => {
  const item = recordOf(value); if (!item) return null;
  const id = numberOf(item.id, item.accountId, item.clientAccountId); if (id == null) return null;
  const owner = nested(item, 'ownerEmployee', 'owner', 'employee'); const group = nested(item, 'clientGroup', 'group'); const region = nested(item, 'region', 'salesRegion');
  const status = stringOf(item.accountStatus, item.status).toUpperCase(); const clientType = stringOf(item.clientType, item.type).toUpperCase(); const sector = stringOf(item.focusSector).toUpperCase(); const tier = stringOf(item.clientTier, item.tier).toUpperCase(); const networkStatus = stringOf(item.networkStatus).toUpperCase();
  return {
    id, accountName: toTitleCase(stringOf(item.accountName, item.name, item.storeName)) || `Customer #${id}`,
    clientType: clientType === 'DISTRIBUTOR' ? 'DISTRIBUTOR' : 'DEALER', gstNumber: stringOf(item.gstNumber, item.gstNo, item.gstin),
    clientGroupId: numberOf(item.clientGroupId, item.groupId, group?.id), clientGroupName: toTitleCase(stringOf(item.clientGroupName, item.groupName, group?.groupName, group?.name)),
    accountStatus: (['PROSPECT', 'ACTIVE', 'DORMANT', 'LOST'].includes(status) ? status : 'PROSPECT') as RetailAccountStatus,
    ownerEmployeeId: numberOf(item.ownerEmployeeId, item.employeeId, owner?.id) ?? 0,
    ownerEmployeeName: toTitleCase(stringOf(item.ownerEmployeeName, item.ownerName, owner?.fullName, [stringOf(owner?.firstName), stringOf(owner?.lastName)].filter(Boolean).join(' '))),
    addressVillageArea: stringOf(item.addressVillageArea, item.villageArea, item.addressLine1), addressTaluka: stringOf(item.addressTaluka, item.taluka, item.subDistrict), addressCity: stringOf(item.addressCity, item.city), addressDistrict: stringOf(item.addressDistrict, item.district), addressState: stringOf(item.addressState, item.state), pinCode: stringOf(item.pinCode, item.pincode),
    regionId: numberOf(item.regionId, item.salesRegionId, region?.id) ?? undefined, regionName: stringOf(item.regionName, item.salesRegionName, region?.name), outletLatitude: numberOf(item.outletLatitude, item.latitude) ?? 0, outletLongitude: numberOf(item.outletLongitude, item.longitude) ?? 0,
    declaredMonthlySalesMt: numberOf(item.declaredMonthlySalesMt, item.monthlySales), focusSector: (['RETAIL', 'GOVERNMENT_PROJECTS', 'DEVELOPER_PROJECTS', 'ALL_SECTORS'].includes(sector) ? sector : 'RETAIL') as RetailFocusSector,
    creditTermsDays: numberOf(item.creditTermsDays) ?? 0, creditLimitAmount: numberOf(item.creditLimitAmount) ?? 0, clientTier: (['A', 'B', 'C'].includes(tier) ? tier : 'B') as 'A' | 'B' | 'C', networkMember: booleanOf(false, item.networkMember), networkOnboardingDate: stringOf(item.networkOnboardingDate) || null, networkStatus: (['ACTIVE', 'INACTIVE'].includes(networkStatus) ? networkStatus : null) as 'ACTIVE' | 'INACTIVE' | null, active: booleanOf(true, item.active), createdAt: stringOf(item.createdAt, item.createdDate), updatedAt: stringOf(item.updatedAt, item.modifiedDate),
  };
};

const normalizeContact = (value: unknown): RetailContact | null => {
  const item = recordOf(value); if (!item) return null; const master = nested(item, 'contactInfluenceRegister', 'contact', 'contactMaster'); const id = numberOf(item.id, item.contactLinkId, item.retailContactId); if (id == null) return null;
  return { id, contactInfluenceRegisterId: numberOf(item.contactInfluenceRegisterId, item.contactId, master?.id) ?? 0, firstName: toTitleCase(stringOf(item.firstName, master?.firstName)), lastName: toTitleCase(stringOf(item.lastName, master?.lastName)), mobile: stringOf(item.mobile, item.primaryContactNumber, master?.mobile), email: stringOf(item.email, master?.email), dateOfBirth: stringOf(item.dateOfBirth, master?.dateOfBirth), anniversaryDate: stringOf(item.anniversaryDate, master?.anniversaryDate), designation: toTitleCase(stringOf(item.designation)), roleDescription: stringOf(item.roleDescription), primaryContact: booleanOf(false, item.primaryContact, item.isPrimary), active: booleanOf(true, item.active) };
};

const normalizeEmployee = (value: unknown): RetailEmployee | null => {
  const item = recordOf(value); if (!item) return null; const id = numberOf(item.id, item.employeeId); if (id == null) return null;
  return { id, employeeCode: stringOf(item.employeeCode, item.code), firstName: toTitleCase(stringOf(item.firstName)), lastName: toTitleCase(stringOf(item.lastName)), role: stringOf(item.role, item.employeeRole), mobile: stringOf(item.mobile, item.primaryContact), email: stringOf(item.email), active: typeof item.active === 'boolean' ? item.active : undefined };
};

const normalizeBrandUsage = (value: unknown): RetailBrandUsage | null => {
  const item = recordOf(value); if (!item) return null; const brand = nested(item, 'competitorBrand', 'brand'); const employee = nested(item, 'employee', 'addedByEmployee', 'addedBy'); const id = numberOf(item.id, item.brandUsageId, item.clientBrandUsageId); if (id == null) return null;
  const brandId = numberOf(item.competitorBrandId, brand?.id) ?? 0;
  return { id, competitorBrandId: brandId, brandName: toTitleCase(stringOf(item.brandName, item.competitorBrandName, brand?.name, brand?.brandName)) || `Brand #${brandId || '?'}`, employeeId: numberOf(item.employeeId, item.addedByEmployeeId, item.addedBy, employee?.id), employeeName: toTitleCase(stringOf(item.employeeName, item.addedByEmployeeName, employee?.fullName, [stringOf(employee?.firstName), stringOf(employee?.lastName)].filter(Boolean).join(' '))), remarks: stringOf(item.remarks), active: booleanOf(true, item.active), addedAt: stringOf(item.addedAt, item.createdAt), removedAt: stringOf(item.removedAt, item.endedAt) };
};

const normalizeGeneric = <T>(value: unknown, builder: (item: Record<string, unknown>, id: number) => T): T | null => { const item = recordOf(value); if (!item) return null; const id = numberOf(item.id); return id == null ? null : builder(item, id) };

export const RetailAPI = {
  async getClientGroups(token: string): Promise<RetailClientGroup[]> {
    const response = await request('/api/retail/groups?page=0&size=200', token);
    return pageItems(response).flatMap((value) => { const item = recordOf(value); const id = numberOf(item?.id, item?.clientGroupId, item?.groupId); const groupName = stringOf(item?.groupName, item?.name); return id == null || !groupName ? [] : [{ id, groupName, groupType: stringOf(item?.groupType, item?.type) || null, notes: stringOf(item?.notes) || null, active: typeof item?.active === 'boolean' ? item.active : undefined }] });
  },
  async createClientGroup(payload: RetailClientGroupPayload, token: string): Promise<number> {
    return extractCreatedId(await request('/api/retail/groups', token, json('POST', payload)), ['id', 'groupId', 'clientGroupId']);
  },
  async updateClientGroup(groupId: number, payload: RetailClientGroupPayload, token: string): Promise<void> {
    await request(`/api/retail/groups/${groupId}`, token, json('PUT', payload));
  },
  async deactivateClientGroup(groupId: number, token: string): Promise<void> {
    await request(`/api/retail/groups/${groupId}`, token, { method: 'DELETE' });
  },
  async getGroupBranches(groupId: number, token: string): Promise<RetailAccount[]> {
    const response = await request(`/api/retail/groups/${groupId}/branches?page=0&size=200`, token);
    return pageItems(response).flatMap((value) => { const account = normalizeAccount(value); return account ? [account] : [] });
  },
  async assignAccountGroup(accountId: number, clientGroupId: number, token: string): Promise<void> {
    await request(`/api/retail/accounts/${accountId}/group`, token, json('POST', { clientGroupId }));
  },
  async getSalesRegions(token: string): Promise<RetailSalesRegion[]> {
    const response = await getWithDocumentedFallback(['/api/common/sales-regions', '/api/common/regions?page=0&size=200'], token);
    return pageItems(response).flatMap((value) => { const item = recordOf(value); const id = numberOf(item?.id, item?.regionId, item?.salesRegionId); const name = stringOf(item?.name, item?.regionName, item?.salesRegionName); return id == null || !name ? [] : [{ id, name, code: stringOf(item?.code, item?.regionCode) || null, active: typeof item?.active === 'boolean' ? item.active : undefined }] });
  },
  async getPinCodes(token: string): Promise<RetailPinCode[]> {
    const response = await getWithDocumentedFallback(['/api/common/pincodes', '/api/common/pin-codes?page=0&size=500'], token);
    return pageItems(response).flatMap((value) => { const item = recordOf(value); const region = nested(item, 'region', 'salesRegion'); const pinCode = stringOf(item?.pinCode, item?.pincode, item?.code); const rawId = numberOf(item?.id, item?.pinCodeId, item?.pincodeId); return !pinCode ? [] : [{ id: rawId ?? Number(pinCode), pinCode, regionId: numberOf(item?.regionId, item?.salesRegionId, region?.id), regionName: stringOf(item?.regionName, item?.salesRegionName, region?.name, region?.regionName), active: typeof item?.active === 'boolean' ? item.active : undefined }] });
  },
  async createSalesRegion(payload: { code: string; name: string; centerLatitude?: number | null; centerLongitude?: number | null; active?: boolean }, token: string): Promise<number> {
    return extractCreatedId(await request('/api/common/regions', token, json('POST', payload)), ['id', 'regionId', 'salesRegionId']);
  },
  async updateSalesRegion(regionId: number, payload: { code: string; name: string; centerLatitude?: number | null; centerLongitude?: number | null; active?: boolean }, token: string): Promise<void> {
    await request(`/api/common/regions/${regionId}`, token, json('PUT', payload));
  },
  async deactivateSalesRegion(regionId: number, token: string): Promise<void> {
    await request(`/api/common/regions/${regionId}`, token, { method: 'DELETE' });
  },
  async createPinCode(payload: { pinCode: string; regionId: number; active?: boolean }, token: string): Promise<string> {
    const body = await request('/api/common/pin-codes', token, json('POST', payload));
    const r = recordOf(body);
    return stringOf(r?.pinCode, r?.pincode) || payload.pinCode;
  },
  async updatePinCode(pinCode: string, payload: { pinCode: string; regionId: number; active?: boolean }, token: string): Promise<void> {
    await request(`/api/common/pin-codes/${encodeURIComponent(pinCode)}`, token, json('PUT', payload));
  },
  async deactivatePinCode(pinCode: string, token: string): Promise<void> {
    await request(`/api/common/pin-codes/${encodeURIComponent(pinCode)}`, token, { method: 'DELETE' });
  },
  async getEmployees(token: string, options: { managerId?: number; role?: string; q?: string } = {}): Promise<RetailEmployee[]> {
    const response = await request(`/api/common/employees${queryString({ active: true, page: 0, size: 500, ...options })}`, token);
    return pageItems(response).flatMap((value) => { const employee = normalizeEmployee(value); return employee ? [employee] : [] });
  },
  async getAccounts(token: string, options: { page?: number; size?: number; q?: string; regionId?: number; ownerEmployeeId?: number; active?: boolean; accountStatus?: string; clientType?: string } = {}): Promise<ApiPage<RetailAccount>> {
    const page = options.page ?? 0; const size = options.size ?? 20;
    // Send both canonical and alias keys — backend is case-sensitive and ignores unknown params.
    const response = await request(
      `/api/retail/accounts${queryString({
        page,
        size,
        q: options.q,
        regionId: options.regionId,
        ownerEmployeeId: options.ownerEmployeeId,
        active: options.active,
        accountStatus: options.accountStatus,
        status: options.accountStatus,
        clientType: options.clientType,
        type: options.clientType,
      })}`,
      token,
    );
    const items = pageItems(response).flatMap((value) => { const account = normalizeAccount(value); return account ? [account] : [] });
    // If backend ignores status/type, filter client-side as fallback but preserve pagination totals from filtered set.
    const filtered = items.filter((a) => {
      if (options.accountStatus && options.accountStatus !== 'ALL' && a.accountStatus !== options.accountStatus) return false;
      if (options.clientType && options.clientType !== 'ALL' && a.clientType !== options.clientType) return false;
      return true;
    });
    // When fallback filtering removes rows, it means backend ignored the param. In that case patch the page to reflect filtered content
    // so UI count stays correct for single-page data; for multi-page we still return server page but caller will handle export via server.
    const pageResult = pageOf(response, items, page, size);
    if (filtered.length !== items.length && pageResult.totalElements === items.length) {
      return { ...pageResult, content: filtered };
    }
    return pageResult.content.length === filtered.length ? pageResult : { ...pageResult, content: filtered };
  },
  async getAccountById(accountId: number, token: string): Promise<RetailAccount | null> {
    try {
      const response = await request(`/api/retail/accounts/${accountId}`, token);
      return normalizeAccount(response);
    } catch {
      return null;
    }
  },
  async createAccount(payload: RetailAccountCreatePayload, token: string): Promise<number> { return extractCreatedId(await request('/api/retail/accounts', token, json('POST', payload)), ['id', 'accountId', 'clientAccountId']) },
  async updateAccount(accountId: number, payload: RetailAccountCreatePayload, token: string): Promise<void> { await request(`/api/retail/accounts/${accountId}`, token, json('PUT', payload)) },
  async deleteAccount(accountId: number, token: string): Promise<void> { await request(`/api/retail/accounts/${accountId}`, token, { method: 'DELETE' }) },
  async updateMonthlySales(accountId: number, declaredMonthlySalesMt: number, changeReason: string, token: string): Promise<void> { await request(`/api/retail/accounts/${accountId}/monthly-sales`, token, json('PUT', { declaredMonthlySalesMt, changeReason })) },
  async createMasterContact(payload: MasterContactCreatePayload, token: string): Promise<number> { return extractCreatedId(await request('/api/common/contacts', token, json('POST', payload)), ['id', 'contactId', 'contactInfluenceRegisterId']) },
  async updateMasterContact(contactId: number, payload: MasterContactCreatePayload, token: string): Promise<void> { await request(`/api/common/contacts/${contactId}`, token, json('PUT', payload)) },
  async linkContact(payload: RetailContactLinkPayload, token: string): Promise<void> { await request('/api/retail/contacts', token, json('POST', payload)) },
  async getContacts(accountId: number, token: string): Promise<RetailContact[]> { const response = await request(`/api/retail/accounts/${accountId}/contacts?page=0&size=200`, token); return pageItems(response).flatMap((value) => { const contact = normalizeContact(value); return contact ? [contact] : [] }) },
  async getMasterContacts(token: string): Promise<RetailMasterContact[]> {
    const response = await request('/api/common/contacts?page=0&size=500', token);
    return pageItems(response).flatMap((value) => { const item = recordOf(value); const id = numberOf(item?.id, item?.contactId); if (id == null) return []; return [{ id, firstName: toTitleCase(stringOf(item?.firstName)), lastName: toTitleCase(stringOf(item?.lastName)), mobile: stringOf(item?.mobile, item?.primaryContact), email: stringOf(item?.email), dateOfBirth: stringOf(item?.dateOfBirth), anniversaryDate: stringOf(item?.anniversaryDate), active: typeof item?.active === 'boolean' ? item.active : undefined }] });
  },
  async updateContact(contactId: number, payload: RetailContactLinkPayload, token: string): Promise<void> { await request(`/api/retail/contacts/${contactId}`, token, json('PUT', payload)) },
  async deleteContact(contactId: number, token: string): Promise<void> { await request(`/api/retail/contacts/${contactId}`, token, { method: 'DELETE' }) },
  async addBrandUsage(payload: RetailBrandUsagePayload, token: string): Promise<void> { await request('/api/retail/brands', token, json('POST', payload)) },
  async getActiveBrands(accountId: number, token: string): Promise<RetailBrandUsage[]> { const response = await request(`/api/retail/accounts/${accountId}/brands/active?page=0&size=200`, token); return pageItems(response).flatMap((value) => { const usage = normalizeBrandUsage(value); return usage ? [usage] : [] }) },
  async getBrandHistory(accountId: number, token: string): Promise<RetailBrandUsage[]> { const response = await request(`/api/retail/accounts/${accountId}/brands/history?page=0&size=200`, token); return pageItems(response).flatMap((value) => { const usage = normalizeBrandUsage(value); return usage ? [usage] : [] }) },
  async removeBrandUsage(brandUsageId: number, employeeId: number, token: string): Promise<void> { await request(`/api/retail/brands/${brandUsageId}/remove${queryString({ employeeId })}`, token, { method: 'POST' }) },
  async getCompetitorBrands(token: string): Promise<CompetitorBrand[]> {
    const response = await request('/api/common/competitor-brands?page=0&size=200', token);
    return pageItems(response).flatMap((value) => { const item = recordOf(value); const id = numberOf(item?.id, item?.brandId); const name = stringOf(item?.name, item?.brandName); return id == null || !name ? [] : [{ id, name }] });
  },
  async createCompetitorBrand(name: string, token: string): Promise<number> {
    return extractCreatedId(await request('/api/common/competitor-brands', token, json('POST', { name, active: true })), ['id', 'brandId']);
  },
  async getCommercialHistory(accountId: number, token: string): Promise<RetailCommercialHistory[]> {
    const response = await request(`/api/retail/accounts/${accountId}/commercial-history?page=0&size=200`, token);
    return pageItems(response).flatMap((value) => { const entry = normalizeGeneric(value, (item, id) => ({ id, fieldName: toTitleCase(stringOf(item.fieldName, item.field, item.changeType).replaceAll('_', ' ')), oldValue: stringOf(item.oldValue, item.previousValue), newValue: stringOf(item.newValue, item.currentValue), changeReason: stringOf(item.changeReason, item.reason, item.remarks), changedBy: toTitleCase(stringOf(item.changedByName, item.employeeName, item.changedBy)), changedAt: stringOf(item.changedAt, item.createdAt) })); return entry ? [entry] : [] });
  },
  async getSales(accountId: number, token: string, from?: string, to?: string): Promise<RetailSale[]> {
    const response = await request(`/api/retail/accounts/${accountId}/sales${queryString({ from: from ?? '2000-01-01', to: to ?? new Date().toISOString().slice(0, 10), page: 0, size: 200 })}`, token);
    return pageItems(response).flatMap((value) => { const sale = normalizeGeneric(value, (item, id) => ({ id, saleDate: stringOf(item.saleDate, item.date), quantityMt: numberOf(item.quantityMt, item.quantity) ?? 0, invoiceReference: stringOf(item.invoiceReference, item.invoiceNumber), sourceSystem: stringOf(item.sourceSystem, item.source) })); return sale ? [sale] : [] });
  },
  async createSale(payload: RetailSalePayload, token: string): Promise<void> { await request('/api/retail/sales', token, json('POST', payload)) },
  async getNotes(accountId: number, token: string): Promise<RetailNote[]> {
    const response = await request(`/api/common/retail-clients/${accountId}/notes?page=0&size=200`, token);
    return pageItems(response).flatMap((value) => { const note = normalizeGeneric(value, (item, id) => ({ id, noteText: stringOf(item.noteText, item.text, item.note), authorName: toTitleCase(stringOf(item.authorEmployeeName, item.authorName, item.createdByName, item.createdBy)), authorEmployeeId: numberOf(item.authorEmployeeId, item.createdByEmployeeId), createdAt: stringOf(item.createdAt, item.createdDate), updatedAt: stringOf(item.updatedAt, item.updatedDate, item.lastCorrectedAt, item.createdAt) })); return note ? [note] : [] });
  },
  async createNote(accountId: number, noteText: string, token: string): Promise<void> { await request('/api/common/notes', token, json('POST', { parentType: 'RETAIL_CLIENT', clientAccountId: accountId, noteText })) },
  async updateNote(noteId: number, noteText: string, token: string, correctionReason?: string): Promise<void> { await request(`/api/common/notes/${noteId}`, token, json('PUT', { noteText, correctionReason: correctionReason?.trim() || 'Corrected from retail detail' })) },
  async getVisits(accountId: number, token: string): Promise<RetailVisit[]> {
    const response = await request(`/api/common/retail-clients/${accountId}/visits?page=0&size=200`, token);
    return pageItems(response).flatMap((value) => { const visit = normalizeGeneric(value, (item, id) => ({ id, scheduledVisitDate: stringOf(item.scheduledVisitDate, item.visitDate), scheduledStartTime: stringOf(item.scheduledStartTime, item.startTime), scheduledEndTime: stringOf(item.scheduledEndTime, item.endTime), purpose: stringOf(item.purpose, item.visitPurpose), description: stringOf(item.description) || null, assignedEmployeeId: numberOf(item.assignedEmployeeId, item.employeeId), assignedEmployeeName: toTitleCase(stringOf(item.assignedEmployeeName, item.employeeName)), outcome: stringOf(item.outcome), discussionSummary: stringOf(item.discussionSummary), nextActionText: stringOf(item.nextActionText), nextActionDate: stringOf(item.nextActionDate), actualCheckinAt: stringOf(item.actualCheckinAt), actualCheckoutAt: stringOf(item.actualCheckoutAt) })); return visit ? [visit] : [] });
  },
  async createVisit(payload: PlannedVisitPayload, token: string): Promise<void> { await request('/api/common/visits', token, json('POST', payload)) },
  async getTasks(accountId: number, _employeeId: number, token: string): Promise<RetailTask[]> {
    const response = await request(`/api/tasks/visible${queryString({ clientAccountId: accountId, page: 0, size: 200 })}`, token);
    return pageItems(response).flatMap((value) => { const task = normalizeGeneric(value, (item, id) => ({ id, clientAccountId: numberOf(item.clientAccountId), title: stringOf(item.title, item.taskTitle), description: stringOf(item.description, item.taskDescription), taskType: stringOf(item.taskType, item.type), status: (stringOf(item.status).toUpperCase() || 'OPEN') as RetailTask['status'], priority: (stringOf(item.priority).toUpperCase() || 'MEDIUM') as RetailTask['priority'], dueDate: stringOf(item.dueDate, item.targetDate), assignedEmployeeId: numberOf(item.assignedToEmployeeId, item.assignedEmployeeId, item.employeeId), assignedEmployeeName: toTitleCase(stringOf(item.assignedToEmployeeName, item.assignedEmployeeName, item.employeeName)) })); return task ? [task] : [] });
  },
  async createTask(payload: RetailTaskPayload, token: string): Promise<void> { await request('/api/tasks', token, json('POST', payload)) },
  async updateTask(taskId: number, payload: RetailTaskPayload, token: string): Promise<void> { await request(`/api/tasks/${taskId}`, token, json('PUT', payload)) },
  async getTaskById(taskId: number, token: string): Promise<RetailTask> {
    let response: unknown;
    try { response = await request(`/api/Task/getById?id=${taskId}`, token); } catch { try { response = await request(`/api/tasks/${taskId}`, token); } catch { response = await request(`/task/getById?id=${taskId}`, token); } }
    const task = normalizeGeneric(response, (item, id) => ({ id, clientAccountId: numberOf(item.clientAccountId), title: stringOf(item.title, item.taskTitle), description: stringOf(item.description, item.taskDescription), taskType: stringOf(item.taskType, item.type), status: (stringOf(item.status).toUpperCase() || 'OPEN') as RetailTask['status'], priority: (stringOf(item.priority).toUpperCase() || 'MEDIUM') as RetailTask['priority'], dueDate: stringOf(item.dueDate, item.targetDate), assignedEmployeeId: numberOf(item.assignedToEmployeeId, item.assignedEmployeeId, item.employeeId), assignedEmployeeName: toTitleCase(stringOf(item.assignedToEmployeeName, item.assignedEmployeeName, item.employeeName)) }));
    if (!task) throw new Error('Task details were not returned.');
    return task;
  },
  async getPricing(token: string, options: { page?: number; size?: number; from?: string; to?: string; competitorBrandId?: number; city?: string; assignedEmployeeId?: number } = {}): Promise<ApiPage<RetailPricing>> {
    const page = options.page ?? 0; const size = options.size ?? 50;
    const response = await request(`/api/retail/pricing${queryString({ ...options, page, size })}`, token);
    const items = pageItems(response).flatMap((value) => { const item = recordOf(value); const id = numberOf(item?.id); if (id == null || !item) return []; return [{ id, competitorBrandId: numberOf(item.competitorBrandId) ?? 0, brandName: stringOf(item.brandName), pricePerTon: numberOf(item.pricePerTon) ?? 0, city: stringOf(item.city), district: stringOf(item.district) || null, state: stringOf(item.state), pinCode: stringOf(item.pinCode), regionId: numberOf(item.regionId), regionCode: stringOf(item.regionCode) || null, regionName: stringOf(item.regionName) || null, observationDate: stringOf(item.observationDate), remarks: stringOf(item.remarks) || null, createdByEmployeeId: numberOf(item.createdByEmployeeId), createdByEmployeeName: stringOf(item.createdByEmployeeName), createdAt: stringOf(item.createdAt), active: booleanOf(true, item.active) }]; });
    return pageOf(response, items, page, size);
  },
  async getPricingSummary(token: string, options: { from?: string; to?: string; city?: string; groupBy?: 'brand' | 'city' } = {}): Promise<RetailPricingSummary[]> {
    const response = await request(`/api/retail/pricing/summary${queryString({ ...options, groupBy: options.groupBy ?? 'brand' })}`, token);
    return (Array.isArray(response) ? response : []).flatMap((value) => { const item = recordOf(value); if (!item) return []; return [{ competitorBrandId: numberOf(item.competitorBrandId) ?? 0, brandName: stringOf(item.brandName), city: stringOf(item.city) || null, avgPrice: numberOf(item.avgPrice) ?? 0, minPrice: numberOf(item.minPrice) ?? 0, maxPrice: numberOf(item.maxPrice) ?? 0, count: numberOf(item.count) ?? 0 }]; });
  },
  async createPricing(payload: RetailPricingPayload, token: string): Promise<void> { await request('/api/retail/pricing', token, json('POST', payload)) },
  async updatePricing(pricingId: number, payload: Partial<RetailPricingPayload>, token: string): Promise<void> { await request(`/api/retail/pricing/${pricingId}`, token, json('PUT', payload)) },
  async deleteTask(taskId: number, token: string): Promise<void> { await request(`/api/tasks/${taskId}`, token, { method: 'DELETE' }) },
  async onboardNetwork(accountId: number, payload: { joiningDate: string; commercialAgreementConfirmed: boolean; firstOrderDate: string; firstOrderReference: string; firstOrderSource?: string; reason?: string }, token: string): Promise<void> {
    await request(`/api/retail/accounts/${accountId}/network/onboard`, token, json('POST', payload));
  },
  async leaveNetwork(accountId: number, payload: { leaveDate: string; reason: string }, token: string): Promise<void> {
    await request(`/api/retail/accounts/${accountId}/network/leave`, token, json('POST', payload));
  },
  async getNetworkEvents(accountId: number, token: string): Promise<{ id: number; eventType: string; joiningDate?: string; leaveDate?: string; reason?: string; createdAt?: string }[]> {
    const response = await request(`/api/retail/accounts/${accountId}/network-events?page=0&size=100`, token);
    return pageItems(response).flatMap((value) => { const event = normalizeGeneric(value, (item, id) => ({ id, eventType: stringOf(item.eventType, item.type), joiningDate: stringOf(item.joiningDate), leaveDate: stringOf(item.leaveDate), reason: stringOf(item.reason), createdAt: stringOf(item.createdAt, item.createdDate) })); return event ? [event] : [] });
  },
};
