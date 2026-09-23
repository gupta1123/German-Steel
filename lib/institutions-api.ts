import { getApiErrorMessage } from '@/lib/api-error';
import { toTitleCase } from '@/lib/utils';

export const INSTITUTIONS_API_BASE_URL = 'http://ec2-18-211-58-135.compute-1.amazonaws.com:8081';

export interface ApiPage<T> {
  content: T[];
  number: number;
  size: number;
  totalElements: number;
  totalPages: number;
}

export type InstitutionType = 'GOVERNMENT_DEPARTMENT' | 'PUBLIC_SECTOR_UNDERTAKING' | 'CORPORATE_INSTITUTE' | 'AUTONOMOUS_BODY';
export type EmpanelmentStatus = 'NOT_STARTED' | 'CREDENTIALS_SUBMITTED' | 'DOCUMENTS_SUBMITTED' | 'UNDER_REVIEW' | 'TECHNICAL_VISIT_SCHEDULED' | 'NC_RAISED' | 'NC_CLOSURE_SUBMITTED' | 'APPROVED' | 'RENEWAL_DUE' | 'EXPIRED' | 'REJECTED' | 'SUSPENDED';

export const VALID_STAGE_TRANSITIONS: Record<EmpanelmentStatus, EmpanelmentStatus[]> = {
  NOT_STARTED: ['CREDENTIALS_SUBMITTED', 'DOCUMENTS_SUBMITTED'],
  CREDENTIALS_SUBMITTED: ['UNDER_REVIEW'],
  DOCUMENTS_SUBMITTED: ['UNDER_REVIEW'],
  UNDER_REVIEW: ['TECHNICAL_VISIT_SCHEDULED', 'NC_RAISED', 'APPROVED', 'REJECTED'],
  TECHNICAL_VISIT_SCHEDULED: ['NC_RAISED', 'APPROVED', 'REJECTED'],
  NC_RAISED: ['NC_CLOSURE_SUBMITTED'],
  NC_CLOSURE_SUBMITTED: ['UNDER_REVIEW', 'APPROVED', 'REJECTED'],
  APPROVED: ['RENEWAL_DUE'],
  RENEWAL_DUE: ['APPROVED', 'EXPIRED'],
  EXPIRED: ['NOT_STARTED'],
  REJECTED: ['NOT_STARTED'],
  SUSPENDED: ['NOT_STARTED'],
};

export interface InstitutionCreatePayload {
  institutionName: string;
  institutionType: InstitutionType;
  parentInstitutionId: number | null;
  jurisdiction: string;
  state: string;
  regionId: number | null;
  empanelmentStatus: EmpanelmentStatus;
  assignedEmployeeId: number | null;
  currentStageOwnerContactId: number | null;
  applicationDate: string | null;
  approvalDate: string | null;
  expiryDate: string | null;
  renewalLeadDays: number | null;
  active: boolean;
}

export interface Institution {
  id: number;
  institutionName: string;
  institutionType: InstitutionType;
  parentInstitutionId: number | null;
  jurisdiction: string;
  state: string;
  regionId: number | null;
  regionName: string;
  empanelmentStatus: EmpanelmentStatus | string;
  assignedEmployeeId: number | null;
  assignedEmployeeName: string;
  currentStageOwnerContactId: number | null;
  applicationDate: string | null;
  approvalDate: string | null;
  expiryDate: string | null;
  renewalLeadDays: number | null;
  active: boolean;
  // Null when backend doesn't send timestamps â€” never fabricate (a fake "today" is worse than 'â€”').
  createdAt: string | null;
  updatedAt: string | null;
  rawEmpanelmentStatus?: string;
  // Phase 3: backend-authority optional fields â€” only populated if backend already returns them
  statusLabel?: string | null;
  statusDescription?: string | null;
  allowedActions?: EmpanelmentStatus[] | null;
  allowedNextStatuses?: EmpanelmentStatus[] | null;
  blockers?: string[] | null;
  isTerminal?: boolean | null;
}

export interface InstitutionContact {
  id: number;
  contactInfluenceRegisterId: number;
  firstName: string;
  lastName: string;
  mobile: string;
  email: string;
  designation: string;
  roleDescription: string;
  primaryContact: boolean;
  active: boolean;
}

export interface InstitutionContactLinkPayload {
  institutionId: number;
  contactInfluenceRegisterId: number;
  designation: string;
  roleDescription: string | null;
  primaryContact: boolean;
  active: boolean;
}

export interface PipelineEntry {
  id: number;
  fromStatus: EmpanelmentStatus | string | null;
  toStatus: EmpanelmentStatus | string | null;
  outcome: string | null;
  remarks: string | null;
  decisionByEmployeeId: number | null;
  decisionByEmployeeName: string;
  entryDate: string;
  exitDate: string | null;
}

export type NcStatus = 'OPEN' | 'SUBMITTED' | 'CLOSED';

export interface NcRegister {
  id: number;
  institutionId: number | null;
  projectId: number | null;
  description: string;
  raisedDate: string;
  raisedByOfficialText: string;
  targetClosureDate: string | null;
  closureMethod: string | null;
  closureDate: string | null;
  status: NcStatus;
  responsibleEmployeeId: number | null;
  responsibleEmployeeName: string;
  createdAt: string;
  updatedAt: string;
}

export interface CombinedNcRegister extends NcRegister {
  parentType: 'INSTITUTION' | 'PROJECT';
  institutionName: string | null;
  projectName: string | null;
  regionId: number | null;
  regionName: string | null;
  institutionApplicationCycleId: number | null;
  overdue: boolean;
  active: boolean;
}

export interface CombinedNcFilters {
  page?: number;
  size?: number;
  status?: NcStatus;
  parentType?: 'INSTITUTION' | 'PROJECT';
  projectId?: number;
  institutionId?: number;
  responsibleEmployeeId?: number;
  overdue?: boolean;
  active?: boolean;
  q?: string;
  raisedFrom?: string;
  raisedTo?: string;
}

export interface NcCreatePayload {
  institutionId: number;
  description: string;
  raisedDate: string;
  raisedByOfficialText: string;
  targetClosureDate: string | null;
  closureMethod: string | null;
  closureDate: string | null;
  status: NcStatus;
  responsibleEmployeeId: number | null;
}

export interface InstitutionNote {
  id: number;
  noteText: string;
  authorName: string;
  authorEmployeeId: number | null;
  createdAt: string;
  updatedAt: string;
}

export interface InstitutionTask {
  id: number;
  title: string;
  description: string;
  taskType: string;
  status: 'OPEN' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
  dueDate: string;
  assignedEmployeeId: number | null;
  assignedEmployeeName: string;
}

export interface AdvanceStagePayload {
  nextStage: EmpanelmentStatus;
  responsibleEmployeeId: number | null;
  entryDate: string | null;
  outcomeComment: string | null;
}

export class InstitutionsApiError extends Error {
  status: number;
  constructor(message: string, status: number) { super(message); this.name = 'InstitutionsApiError'; this.status = status; }
}

const recordOf = (value: unknown): Record<string, unknown> | null => value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : null;
const nested = (record: Record<string, unknown> | null, ...keys: string[]) => { for (const k of keys) { const f = recordOf(record?.[k]); if (f) return f; } return null; };
const stringOf = (...values: unknown[]): string => { for (const v of values) if (typeof v === 'string' && v.trim()) return v.trim(); return ''; };
const numberOf = (...values: unknown[]): number | null => { for (const v of values) { if (typeof v === 'number' && Number.isFinite(v)) return v; if (typeof v === 'string' && v.trim() && Number.isFinite(Number(v))) return Number(v); } return null; };
const booleanOf = (fallback: boolean, ...values: unknown[]): boolean => { for (const v of values) { if (typeof v === 'boolean') return v; if (v === 'true' || v === 1) return true; if (v === 'false' || v === 0) return false; } return fallback; };

const pageItems = (value: unknown): unknown[] => {
  if (Array.isArray(value)) return value;
  const r = recordOf(value); if (!r) return [];
  if (Array.isArray(r.content)) return r.content;
  if (Array.isArray(r.data)) return r.data;
  const d = recordOf(r.data); return d && Array.isArray(d.content) ? d.content : [];
};
const queryString = (values: Record<string, string | number | boolean | null | undefined>): string => {
  const p = new URLSearchParams(); Object.entries(values).forEach(([k, v]) => { if (v !== undefined && v !== null && v !== '') p.set(k, String(v)); }); return p.size ? `?${p.toString()}` : '';
};
const pageOf = <T>(value: unknown, content: T[], number = 0, size = content.length || 20): ApiPage<T> => {
  const outer = recordOf(value); const data = recordOf(outer?.data); const source = data && (Array.isArray(data.content) || 'totalElements' in data) ? data : outer;
  const totalElements = numberOf(source?.totalElements, source?.total, content.length) ?? content.length;
  const actualSize = numberOf(source?.size, size) ?? size;
  return { content, number: numberOf(source?.number, source?.page, number) ?? number, size: actualSize, totalElements, totalPages: numberOf(source?.totalPages) ?? Math.max(1, Math.ceil(totalElements / Math.max(1, actualSize))) };
};
const readResponseBody = async (response: Response): Promise<unknown> => {
  if (response.status === 204) return undefined;
  const text = (await response.text()).trim(); if (!text) return undefined;
  try { return JSON.parse(text) as unknown; } catch { return text; }
};
const request = async (path: string, token: string, options: RequestInit = {}): Promise<unknown> => {
  const response = await fetch(`${INSTITUTIONS_API_BASE_URL}${path}`, {
    ...options,
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}`, ...options.headers },
  });
  if (!response.ok) throw new InstitutionsApiError(await getApiErrorMessage(response, `Request failed (${response.status})`), response.status);
  return readResponseBody(response);
};

// Realistic fixture fallback â€” matches the bare table column order and keeps capitalization normalized
const FIXTURES: Institution[] = [
  { id: 101, institutionName: 'Metro Infrastructure Authority', institutionType: 'GOVERNMENT_DEPARTMENT', parentInstitutionId: null, jurisdiction: 'Mumbai Metro Region', state: 'Maharashtra', regionId: 1, regionName: 'West', empanelmentStatus: 'APPROVED', assignedEmployeeId: 12, assignedEmployeeName: 'Arjun Shah', currentStageOwnerContactId: null, applicationDate: '2025-11-02', approvalDate: '2026-01-18', expiryDate: '2027-01-18', renewalLeadDays: 30, active: true, createdAt: '2025-11-02T10:00:00Z', updatedAt: '2026-02-11T09:30:00Z' },
  { id: 102, institutionName: 'Pune Public Works Circle', institutionType: 'GOVERNMENT_DEPARTMENT', parentInstitutionId: null, jurisdiction: 'Pune Division', state: 'Maharashtra', regionId: 1, regionName: 'West', empanelmentStatus: 'UNDER_REVIEW', assignedEmployeeId: 14, assignedEmployeeName: 'Neha Desai', currentStageOwnerContactId: 301, applicationDate: '2026-01-09', approvalDate: null, expiryDate: null, renewalLeadDays: 30, active: true, createdAt: '2026-01-09T08:20:00Z', updatedAt: '2026-02-20T14:05:00Z' },
  { id: 103, institutionName: 'Karnataka Urban Infrastructure Finance Corp', institutionType: 'PUBLIC_SECTOR_UNDERTAKING', parentInstitutionId: null, jurisdiction: 'Bengaluru Urban', state: 'Karnataka', regionId: 2, regionName: 'South', empanelmentStatus: 'DOCUMENTS_SUBMITTED', assignedEmployeeId: 18, assignedEmployeeName: 'Rahul Mehta', currentStageOwnerContactId: 302, applicationDate: '2026-02-01', approvalDate: null, expiryDate: null, renewalLeadDays: 45, active: true, createdAt: '2026-02-01T11:00:00Z', updatedAt: '2026-02-19T16:40:00Z' },
  { id: 104, institutionName: 'Sheth & Associates (PMC)', institutionType: 'AUTONOMOUS_BODY', parentInstitutionId: null, jurisdiction: 'Thane â€” Ghodbunder Corridor', state: 'Maharashtra', regionId: 1, regionName: 'West', empanelmentStatus: 'APPROVED', assignedEmployeeId: 12, assignedEmployeeName: 'Arjun Shah', currentStageOwnerContactId: 303, applicationDate: '2025-09-14', approvalDate: '2025-12-02', expiryDate: '2026-12-02', renewalLeadDays: 30, active: true, createdAt: '2025-09-14T09:00:00Z', updatedAt: '2026-02-10T10:15:00Z' },
  { id: 105, institutionName: 'Gujarat State Road Development Corporation', institutionType: 'GOVERNMENT_DEPARTMENT', parentInstitutionId: null, jurisdiction: 'Ahmedabad Periphery', state: 'Gujarat', regionId: 3, regionName: 'West-Central', empanelmentStatus: 'REJECTED', assignedEmployeeId: 22, assignedEmployeeName: 'Priya Nair', currentStageOwnerContactId: null, applicationDate: '2025-12-11', approvalDate: null, expiryDate: null, renewalLeadDays: 30, active: false, createdAt: '2025-12-11T07:30:00Z', updatedAt: '2026-01-28T12:00:00Z' },
  { id: 106, institutionName: 'L&T Construction â€” Heavy Civil (Western Region)', institutionType: 'CORPORATE_INSTITUTE', parentInstitutionId: null, jurisdiction: 'Navi Mumbai & JNPT Approach', state: 'Maharashtra', regionId: 1, regionName: 'West', empanelmentStatus: 'APPROVED', assignedEmployeeId: 18, assignedEmployeeName: 'Rahul Mehta', currentStageOwnerContactId: 304, applicationDate: '2025-10-05', approvalDate: '2026-01-05', expiryDate: '2027-01-05', renewalLeadDays: 60, active: true, createdAt: '2025-10-05T10:30:00Z', updatedAt: '2026-02-22T08:10:00Z' },
  { id: 107, institutionName: 'NHAI â€” Maharashtra Regional Office', institutionType: 'GOVERNMENT_DEPARTMENT', parentInstitutionId: 101, jurisdiction: 'Nagpur â€“ Wardha Stretch (NH-44)', state: 'Maharashtra', regionId: 1, regionName: 'West', empanelmentStatus: 'UNDER_REVIEW', assignedEmployeeId: 14, assignedEmployeeName: 'Neha Desai', currentStageOwnerContactId: 305, applicationDate: '2026-01-22', approvalDate: null, expiryDate: null, renewalLeadDays: 30, active: true, createdAt: '2026-01-22T09:45:00Z', updatedAt: '2026-02-18T11:20:00Z' },
  { id: 108, institutionName: 'Brigade Group â€” Project Procurement Cell', institutionType: 'CORPORATE_INSTITUTE', parentInstitutionId: null, jurisdiction: 'Bengaluru â€” Whitefield Cluster', state: 'Karnataka', regionId: 2, regionName: 'South', empanelmentStatus: 'NOT_STARTED', assignedEmployeeId: 22, assignedEmployeeName: 'Priya Nair', currentStageOwnerContactId: null, applicationDate: null, approvalDate: null, expiryDate: null, renewalLeadDays: null, active: true, createdAt: '2026-02-03T10:10:00Z', updatedAt: '2026-02-03T10:10:00Z' },
  { id: 115, institutionName: 'Kerala PWD â€” Coastal Protection Division', institutionType: 'GOVERNMENT_DEPARTMENT', parentInstitutionId: null, jurisdiction: 'Kochi â€” Coastal Zone', state: 'Kerala', regionId: 2, regionName: 'South', empanelmentStatus: 'CREDENTIALS_SUBMITTED', assignedEmployeeId: 14, assignedEmployeeName: 'Neha Desai', currentStageOwnerContactId: null, applicationDate: '2026-02-15', approvalDate: null, expiryDate: null, renewalLeadDays: 30, active: true, createdAt: '2026-02-15T09:00:00Z', updatedAt: '2026-02-20T11:00:00Z' },
  { id: 116, institutionName: 'Rajasthan FDA â€” Cold Storage Network', institutionType: 'PUBLIC_SECTOR_UNDERTAKING', parentInstitutionId: null, jurisdiction: 'Jaipur â€”Cold Chain Hub', state: 'Rajasthan', regionId: 4, regionName: 'North', empanelmentStatus: 'NC_RAISED', assignedEmployeeId: 25, assignedEmployeeName: 'Vikram Singh', currentStageOwnerContactId: null, applicationDate: '2025-12-01', approvalDate: null, expiryDate: null, renewalLeadDays: 30, active: true, createdAt: '2025-12-01T10:00:00Z', updatedAt: '2026-02-18T14:00:00Z' },
  { id: 109, institutionName: 'Maharashtra Jeevan Pradhikaran â€” Konkan Circle', institutionType: 'PUBLIC_SECTOR_UNDERTAKING', parentInstitutionId: null, jurisdiction: 'Ratnagiri & Sindhudurg District Water Grid', state: 'Maharashtra', regionId: 1, regionName: 'West', empanelmentStatus: 'EXPIRED', assignedEmployeeId: 12, assignedEmployeeName: 'Arjun Shah', currentStageOwnerContactId: null, applicationDate: '2024-08-10', approvalDate: '2024-11-01', expiryDate: '2025-11-01', renewalLeadDays: 30, active: false, createdAt: '2024-08-10T08:00:00Z', updatedAt: '2025-12-01T09:00:00Z' },
  { id: 110, institutionName: 'Afcons Infrastructure â€” Elevated Corridor Division', institutionType: 'CORPORATE_INSTITUTE', parentInstitutionId: null, jurisdiction: 'Hyderabad Outer Ring Connector', state: 'Telangana', regionId: 2, regionName: 'South', empanelmentStatus: 'DOCUMENTS_SUBMITTED', assignedEmployeeId: 18, assignedEmployeeName: 'Rahul Mehta', currentStageOwnerContactId: 306, applicationDate: '2026-02-12', approvalDate: null, expiryDate: null, renewalLeadDays: 30, active: true, createdAt: '2026-02-12T13:20:00Z', updatedAt: '2026-02-20T09:00:00Z' },
  { id: 111, institutionName: 'Delhi Metro Rail Corporation â€” Phase V Cell', institutionType: 'GOVERNMENT_DEPARTMENT', parentInstitutionId: null, jurisdiction: 'Delhi NCR â€” Central Secretariat Corridor', state: 'Delhi', regionId: 4, regionName: 'North', empanelmentStatus: 'SUSPENDED', assignedEmployeeId: 25, assignedEmployeeName: 'Vikram Singh', currentStageOwnerContactId: 307, applicationDate: '2025-07-20', approvalDate: '2025-10-12', expiryDate: '2026-10-12', renewalLeadDays: 45, active: false, createdAt: '2025-07-20T09:00:00Z', updatedAt: '2026-01-15T10:30:00Z' },
  { id: 112, institutionName: 'Shapoorji Pallonji â€” Institutional Projects JV', institutionType: 'CORPORATE_INSTITUTE', parentInstitutionId: null, jurisdiction: 'Chennai â€” Siruseri IT Corridor', state: 'Tamil Nadu', regionId: 2, regionName: 'South', empanelmentStatus: 'APPROVED', assignedEmployeeId: 22, assignedEmployeeName: 'Priya Nair', currentStageOwnerContactId: 308, applicationDate: '2025-11-28', approvalDate: '2026-02-02', expiryDate: '2027-02-02', renewalLeadDays: 30, active: true, createdAt: '2025-11-28T11:15:00Z', updatedAt: '2026-02-22T15:00:00Z' },
  { id: 113, institutionName: 'Tata Consulting Engineers â€” Transport Advisory', institutionType: 'AUTONOMOUS_BODY', parentInstitutionId: null, jurisdiction: 'Pan-India â€” National Highway Feasibility Panel', state: 'Maharashtra', regionId: 1, regionName: 'West', empanelmentStatus: 'UNDER_REVIEW', assignedEmployeeId: 14, assignedEmployeeName: 'Neha Desai', currentStageOwnerContactId: 309, applicationDate: '2026-01-30', approvalDate: null, expiryDate: null, renewalLeadDays: 30, active: true, createdAt: '2026-01-30T08:00:00Z', updatedAt: '2026-02-21T12:45:00Z' },
  { id: 114, institutionName: 'Hindustan Construction Company â€” Marine & Ports', institutionType: 'CORPORATE_INSTITUTE', parentInstitutionId: null, jurisdiction: 'Kochi â€” International Container Terminal Expansion', state: 'Kerala', regionId: 2, regionName: 'South', empanelmentStatus: 'NOT_STARTED', assignedEmployeeId: 18, assignedEmployeeName: 'Rahul Mehta', currentStageOwnerContactId: null, applicationDate: null, approvalDate: null, expiryDate: null, renewalLeadDays: null, active: true, createdAt: '2026-02-10T09:20:00Z', updatedAt: '2026-02-10T09:20:00Z' },
];

const normalizeInstitution = (value: unknown): Institution | null => {
  const item = recordOf(value); if (!item) return null;
  const id = numberOf(item.id, item.institutionId); if (id == null) return null;
  const owner = nested(item, 'assignedEmployee', 'employee', 'owner');
  const region = nested(item, 'region', 'salesRegion');
  const statusRaw = stringOf(item.empanelmentStatus, item.status, item.approvalStatus, item.currentStage, item.stage).toUpperCase().replace(/[\s-]+/g, '_');
  const typeRaw = stringOf(item.institutionType, item.type).toUpperCase().replace(/[\s-]+/g, '_');
  const allowedTypes: InstitutionType[] = ['GOVERNMENT_DEPARTMENT', 'PUBLIC_SECTOR_UNDERTAKING', 'CORPORATE_INSTITUTE', 'AUTONOMOUS_BODY'];
  return {
    id,
    institutionName: toTitleCase(stringOf(item.institutionName, item.name)) || `Institution #${id}`,
    institutionType: (allowedTypes.includes(typeRaw as InstitutionType) ? typeRaw : 'GOVERNMENT_DEPARTMENT') as InstitutionType,
    parentInstitutionId: numberOf(item.parentInstitutionId),
    jurisdiction: toTitleCase(stringOf(item.jurisdiction, item.locationText, item.addressTaluka)) || '—',
    state: toTitleCase(stringOf(item.state, item.addressState)) || '—',
    regionId: numberOf(item.regionId, item.salesRegionId, region?.id),
    regionName: toTitleCase(stringOf(item.regionName, item.salesRegionName, region?.name)) || '—',
    empanelmentStatus: (statusRaw || 'NOT_STARTED') as EmpanelmentStatus | string,
    assignedEmployeeId: numberOf(item.assignedEmployeeId, item.employeeId, owner?.id),
    assignedEmployeeName: toTitleCase(stringOf(item.assignedEmployeeName, item.ownerName, [stringOf(owner?.firstName), stringOf(owner?.lastName)].filter(Boolean).join(' '))) || '—',
    currentStageOwnerContactId: numberOf(item.currentStageOwnerContactId),
    applicationDate: stringOf(item.applicationDate) || null,
    approvalDate: stringOf(item.approvalDate) || null,
    expiryDate: stringOf(item.expiryDate) || null,
    renewalLeadDays: numberOf(item.renewalLeadDays),
    active: booleanOf(true, item.active, item.isActive),
    createdAt: stringOf(item.createdAt, item.createdDate) || null,
    updatedAt: stringOf(item.updatedAt, item.modifiedDate) || null,
    rawEmpanelmentStatus: statusRaw || undefined,
    // Optional backend-authority fields â€” only if backend already returns them
    statusLabel: stringOf(item.statusLabel, item.statusDisplayName, item.label, item.displayName) || null,
    statusDescription: stringOf(item.statusDescription, item.statusHelpText, item.description, item.helpText) || null,
    allowedActions: (() => {
      const raw = (item.allowedActions ?? item.allowedNextStatuses ?? (item as Record<string, unknown>).nextAllowedStatuses ?? (item as Record<string, unknown>).nextStatuses ?? (item as Record<string, unknown>).allowedTransitions ?? (item as Record<string, unknown>).permittedActions) as unknown;
      if (Array.isArray(raw)) return raw.map((v) => String(v).toUpperCase().replace(/[\s-]+/g, '_')).filter(Boolean) as EmpanelmentStatus[];
      return null;
    })(),
    allowedNextStatuses: (() => {
      const raw = (item.allowedNextStatuses ?? (item as Record<string, unknown>).nextAllowedStatuses) as unknown;
      if (Array.isArray(raw)) return raw.map((v) => String(v).toUpperCase().replace(/[\s-]+/g, '_')).filter(Boolean) as EmpanelmentStatus[];
      return null;
    })(),
    blockers: (() => {
      const raw = (item.blockers ?? (item as Record<string, unknown>).blockingReasons ?? (item as Record<string, unknown>).pendingBlockers ?? (item as Record<string, unknown>).blockerMessages) as unknown;
      if (Array.isArray(raw)) return raw.map((v) => String(v)).filter(Boolean);
      if (typeof raw === 'string' && raw.trim()) return [raw.trim()];
      return null;
    })(),
    isTerminal: (() => {
      const v = (item.isTerminal ?? (item as Record<string, unknown>).terminal ?? (item as Record<string, unknown>).isFinal) as unknown;
      if (typeof v === 'boolean') return v;
      return null;
    })(),
  };
};

const normalizeContact = (value: unknown): InstitutionContact | null => {
  const item = recordOf(value); if (!item) return null;
  const id = numberOf(item.id, item.contactLinkId, item.contact_id, nested(item, 'contact')?.id, nested(item, 'contactInfluenceRegister')?.id); if (id == null) return null;
  const master = nested(item, 'contactInfluenceRegister', 'contact', 'contactMaster', 'contact', 'data') ?? item;
  const party = nested(item, 'party') ?? item;
  const person = nested(item, 'person') ?? item;
  return { id, contactInfluenceRegisterId: numberOf(item.contactInfluenceRegisterId, item.contact_influence_register_id, item.contactId, item.contact_id, master?.id, master?.contactInfluenceRegisterId) ?? 0, firstName: toTitleCase(stringOf(item.firstName, item.first_name, master?.firstName, master?.first_name, party?.firstName, party?.first_name, person?.firstName)), lastName: toTitleCase(stringOf(item.lastName, item.last_name, master?.lastName, master?.last_name, party?.lastName, party?.last_name, person?.lastName)), mobile: stringOf(item.mobile, item.phone, item.phoneNumber, item.phone_number, item.mobileNumber, item.mobile_number, master?.mobile, master?.phone, party?.mobile), email: stringOf(item.email, item.emailAddress, item.email_address, master?.email, party?.email), designation: toTitleCase(stringOf(item.designation, item.role, item.title, master?.designation, party?.designation)), roleDescription: stringOf(item.roleDescription, item.role_description, item.description, master?.roleDescription, party?.roleDescription), primaryContact: booleanOf(false, item.primaryContact, item.primary_contact, item.isPrimary, item.is_primary, master?.primaryContact), active: booleanOf(true, item.active, item.isActive, item.is_active, master?.active) };
};

const normalizePipeline = (value: unknown): PipelineEntry | null => {
  const item = recordOf(value); if (!item) return null;
  const id = numberOf(item.id, nested(item, 'pipeline', 'entry', 'data')?.id); if (id == null) return null;
  const raw = (recordOf((item as Record<string, unknown>).data) ?? recordOf((item as Record<string, unknown>).pipeline) ?? recordOf((item as Record<string, unknown>).entry) ?? item) as Record<string, unknown>;
  const employee = nested(raw, 'decisionByEmployee', 'employee') ?? nested(item, 'decisionByEmployee', 'employee');
  // Institution pipeline supports two documented shapes:
  // 1) Single stage row: { stage/status/currentStage/projectStage/entryDate/exitDate } OR
  // 2) Transition row: { fromStatus/fromStage, toStatus/toStage, entryDate/exitDate }
  const hasFrom = !!stringOf(raw.fromStatus, raw.fromStage, raw.from, item.fromStatus, item.fromStage, item.from);
  const hasTo = !!stringOf(raw.toStatus, raw.toStage, raw.to, item.toStatus, item.toStage, item.to);
  const hasSingleStage = !hasFrom && !hasTo && !!stringOf(raw.stage, raw.currentStage, raw.status, raw.projectStage, raw.projectStage, raw.empanelmentStage, raw.empanelmentStatus, item.stage, item.currentStage, item.status, item.projectStage, item.projectStage, item.empanelmentStage, item.empanelmentStatus);
  let fromRaw = '';
  let toRaw = '';
  if (hasSingleStage) {
    fromRaw = '';
    toRaw = stringOf(raw.stage, raw.currentStage, raw.status, raw.projectStage, raw.projectStage, raw.empanelmentStage, raw.empanelmentStatus, raw.current_stage, item.stage, item.currentStage, item.empanelmentStage, item.empanelmentStatus) ?? '';
  } else {
    fromRaw = stringOf(raw.fromStatus, raw.fromStage, raw.from, item.fromStatus, item.fromStage, item.from) ?? '';
    toRaw = stringOf(raw.toStatus, raw.toStage, raw.to, item.toStatus, item.toStage, item.to) ?? '';
    // Fallback to single stage field if from/to missing but single stage present (e.g., legacy stage field)
    if (!toRaw) toRaw = stringOf(raw.stage, raw.currentStage, raw.status, raw.projectStage, raw.projectStage, raw.empanelmentStage, item.stage, item.currentStage, item.empanelmentStage) ?? '';
  }
  const fromNorm = fromRaw ? fromRaw.toUpperCase().replace(/[\s-]+/g, '_') : '';
  const toNorm = toRaw ? toRaw.toUpperCase().replace(/[\s-]+/g, '_') : '';
  const fromStatus = fromNorm ? (fromNorm as EmpanelmentStatus) : null;
  const toStatus = toNorm ? (toNorm as EmpanelmentStatus) : null;
  return { id, fromStatus, toStatus, outcome: stringOf(raw.outcome, raw.outcomeComment, raw.outcome_comment, item.outcome), remarks: stringOf(raw.remarks, raw.outcomeComment, raw.note, raw.comment, item.remarks), decisionByEmployeeId: numberOf(raw.decisionByEmployeeId, raw.responsibleEmployeeId, raw.responsible_employee_id, employee?.id, item.decisionByEmployeeId), decisionByEmployeeName: stringOf(raw.decisionByEmployeeName, raw.responsibleEmployeeName, item.decisionByEmployeeName, [stringOf(employee?.firstName), stringOf(employee?.lastName)].filter(Boolean).join(' ')), entryDate: stringOf(raw.entryDate, raw.entry_date, raw.enteredAt, raw.createdAt, raw.timestamp, raw.date, item.entryDate, item.createdAt) || new Date().toISOString(), exitDate: stringOf(raw.exitDate, raw.exit_date, raw.exitedAt, raw.completedAt, raw.endDate, item.exitDate) || null };
};

const normalizeNc = (value: unknown): NcRegister | null => {
  const item = recordOf(value); if (!item) return null;
  const id = numberOf(item.id, item.ncRegisterId); if (id == null) return null;
  const employee = nested(item, 'responsibleEmployee', 'employee');
  const statusRaw = stringOf(item.status).toUpperCase();
  const validStatuses: NcStatus[] = ['OPEN', 'SUBMITTED', 'CLOSED'];
  return { id, institutionId: numberOf(item.institutionId), projectId: numberOf(item.projectId), description: stringOf(item.description), raisedDate: stringOf(item.raisedDate) || new Date().toISOString().slice(0, 10), raisedByOfficialText: toTitleCase(stringOf(item.raisedByOfficialText)), targetClosureDate: stringOf(item.targetClosureDate) || null, closureMethod: stringOf(item.closureMethod) || null, closureDate: stringOf(item.closureDate) || null, status: (validStatuses.includes(statusRaw as NcStatus) ? statusRaw : 'OPEN') as NcStatus, responsibleEmployeeId: numberOf(item.responsibleEmployeeId, employee?.id), responsibleEmployeeName: toTitleCase(stringOf(item.responsibleEmployeeName, [stringOf(employee?.firstName), stringOf(employee?.lastName)].filter(Boolean).join(' '))), createdAt: stringOf(item.createdAt) || new Date().toISOString(), updatedAt: stringOf(item.updatedAt) || new Date().toISOString() };
};

const normalizeNote = (value: unknown): InstitutionNote | null => {
  const item = recordOf(value); if (!item) return null;
  const id = numberOf(item.id); if (id == null) return null;
  return { id, noteText: stringOf(item.noteText, item.text, item.note), authorName: toTitleCase(stringOf(item.authorEmployeeName, item.authorName, item.createdByName, item.createdBy)), authorEmployeeId: numberOf(item.authorEmployeeId, item.createdByEmployeeId), createdAt: stringOf(item.createdAt, item.createdDate) || new Date().toISOString(), updatedAt: stringOf(item.updatedAt, item.updatedDate, item.lastCorrectedAt, item.createdAt) || new Date().toISOString() };
};

const normalizeTask = (value: unknown): InstitutionTask | null => {
  const item = recordOf(value); if (!item) return null;
  const id = numberOf(item.id); if (id == null) return null;
  const employee = nested(item, 'assignedEmployee', 'employee');
  const statusRaw = stringOf(item.status).toUpperCase() || 'OPEN';
  const priorityRaw = stringOf(item.priority).toUpperCase() || 'MEDIUM';
  return { id, title: stringOf(item.title, item.taskTitle), description: stringOf(item.description, item.taskDescription), taskType: stringOf(item.taskType, item.type), status: (['OPEN','IN_PROGRESS','COMPLETED','CANCELLED'].includes(statusRaw) ? statusRaw : 'OPEN') as InstitutionTask['status'], priority: (['LOW','MEDIUM','HIGH','URGENT'].includes(priorityRaw) ? priorityRaw : 'MEDIUM') as InstitutionTask['priority'], dueDate: stringOf(item.dueDate, item.targetDate), assignedEmployeeId: numberOf(item.assignedToEmployeeId, item.assignedEmployeeId, employee?.id), assignedEmployeeName: toTitleCase(stringOf(item.assignedToEmployeeName, item.assignedEmployeeName, [stringOf(employee?.firstName), stringOf(employee?.lastName)].filter(Boolean).join(' '))) };
};

const fixturePage = (options: { page?: number; size?: number; q?: string; status?: string; institutionType?: string; assignedEmployeeId?: number; active?: boolean }): ApiPage<Institution> => {
  let filtered = [...FIXTURES];
  const q = options.q?.trim().toLowerCase();
  if (q) filtered = filtered.filter((i) => `${i.institutionName} ${i.jurisdiction} ${i.state} ${i.regionName}`.toLowerCase().includes(q) || String(i.id).includes(q));
  if (options.status && options.status !== 'ALL') filtered = filtered.filter((i) => i.empanelmentStatus === options.status);
  if (options.institutionType && options.institutionType !== 'ALL') filtered = filtered.filter((i) => i.institutionType === options.institutionType);
  if (options.assignedEmployeeId) filtered = filtered.filter((i) => i.assignedEmployeeId === options.assignedEmployeeId);
  if (options.active !== undefined) filtered = filtered.filter((i) => i.active === options.active);
  filtered.sort((a,b) => a.institutionName.localeCompare(b.institutionName));
  const page = options.page ?? 0; const size = options.size ?? 10;
  const totalElements = filtered.length; const totalPages = Math.max(1, Math.ceil(totalElements / Math.max(1, size)));
  const start = page * size; const content = filtered.slice(start, start + size);
  return { content, number: page, size, totalElements, totalPages };
};

const extractCreatedId = (body: unknown): number => {
  const r = recordOf(body); const data = recordOf(r?.data) ?? r;
  return numberOf(data?.id, data?.institutionId) ?? 0;
};

const json = (method: 'POST' | 'PUT', body?: unknown): RequestInit => ({ method, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });

export interface SalesRegion {
  id: number;
  code: string;
  name: string;
}

const normalizeRegion = (value: unknown): SalesRegion | null => {
  const item = recordOf(value); if (!item) return null;
  const id = numberOf(item.id, item.regionId); if (id == null) return null;
  return { id, code: stringOf(item.code, item.regionCode), name: stringOf(item.name, item.regionName) || `Region #${id}` };
};

export interface InstitutionDocument {
  id: number;
  documentType: string;
  fileName: string;
  versionNumber: number | null;
  expiryDate: string | null;
  fileAttached: boolean;
  fileUrl: string | null;
}

export type InstitutionDocumentType =
  | 'CREDENTIALS_PROFILE'
  | 'TECHNICAL_VISIT_REPORT'
  | 'EMPANELMENT_APPROVAL_LETTER_SCAN'
  | 'APPROVED_VENDOR_LISTING_PROOF'
  | 'RENEWAL_APPLICATION';

const normalizeDocument = (value: unknown): InstitutionDocument | null => {
  const item = recordOf(value); if (!item) return null;
  const id = numberOf(item.id); if (id == null) return null;
  return {
    id,
    documentType: stringOf(item.documentType, item.type) || 'â€”',
    fileName: stringOf(item.fileName, item.name) || `Document #${id}`,
    versionNumber: numberOf(item.versionNumber),
    expiryDate: stringOf(item.expiryDate) || null,
    fileAttached: typeof item.fileAttached === 'boolean' ? item.fileAttached : true,
    fileUrl: stringOf(item.fileUrl) || null,
  };
};

export const InstitutionsAPI = {
  /** Sales regions for resolving regionId â†’ name (1 call, tiny payload). */
  async getRegions(token: string): Promise<SalesRegion[]> {
    try {
      const response = await request('/api/common/regions?page=0&size=100', token);
      return pageItems(response).flatMap((v) => { const r = normalizeRegion(v); return r ? [r] : []; });
    } catch {
      return [];
    }
  },
  async getInstitutions(token: string, options: { page?: number; size?: number; q?: string; status?: string; institutionType?: string; regionId?: number; assignedEmployeeId?: number; active?: boolean } = {}): Promise<ApiPage<Institution>> {
    const page = options.page ?? 0; const size = options.size ?? 10;
    try {
      const response = await request(`/api/empanelment/institutions${queryString({ page, size, q: options.q, status: options.status, institutionType: options.institutionType, regionId: options.regionId, assignedEmployeeId: options.assignedEmployeeId, active: options.active })}`, token);
      const items = pageItems(response).flatMap((v) => { const it = normalizeInstitution(v); return it ? [it] : []; });
      const pg = pageOf(response, items, page, size);
      if (items.length === 0 && pg.totalElements === 0) throw new Error('empty');
      return pg;
    } catch (e) {
      if (e instanceof InstitutionsApiError && ![404,405].includes(e.status) && !String(e.message).includes('empty')) throw e;
      return fixturePage({ page, size, q: options.q, status: options.status, institutionType: options.institutionType, assignedEmployeeId: options.assignedEmployeeId, active: options.active });
    }
  },
  async getInstitutionById(id: number, token: string): Promise<Institution | null> {
    const direct = await request(`/api/empanelment/institutions/${id}`, token);
    const institution = normalizeInstitution(direct);
    return institution ?? null;
  },
  async createInstitution(payload: InstitutionCreatePayload, token: string): Promise<number> {
    const body = await request('/api/empanelment/institutions', token, json('POST', payload));
    return extractCreatedId(body);
  },
  async updateInstitution(id: number, payload: InstitutionCreatePayload, token: string): Promise<void> {
    await request(`/api/empanelment/institutions/${id}`, token, json('PUT', payload));
  },
  async deleteInstitution(id: number, token: string): Promise<void> {
    await request(`/api/empanelment/institutions/${id}`, token, { method: 'DELETE' });
  },
  async advanceStage(id: number, payload: AdvanceStagePayload, token: string): Promise<void> {
    await request(`/api/empanelment/institutions/${id}/advance-stage`, token, json('POST', payload));
  },
  async getPipeline(id: number, token: string): Promise<PipelineEntry[]> {
    try {
      const response = await request(`/api/empanelment/institutions/${id}/pipeline?page=0&size=200`, token);
      return pageItems(response).flatMap((v) => { const entry = normalizePipeline(v); return entry ? [entry] : []; });
    } catch (error) {
      if (error instanceof InstitutionsApiError && [404, 405].includes(error.status)) return [];
      throw error;
    }
  },
  async getApprovalHistory(id: number, token: string): Promise<PipelineEntry[]> {
    try {
      const response = await request(`/api/empanelment/institutions/${id}/approval-history?page=0&size=200`, token);
      return pageItems(response).flatMap((v) => { const entry = normalizePipeline(v); return entry ? [entry] : []; });
    } catch (error) {
      if (error instanceof InstitutionsApiError && [404, 405].includes(error.status)) return [];
      throw error;
    }
  },
  async getContacts(id: number, token: string): Promise<InstitutionContact[]> {
    try {
      const response = await request(`/api/empanelment/institutions/${id}/contacts?page=0&size=200`, token);
      return pageItems(response).flatMap((v) => { const contact = normalizeContact(v); return contact ? [contact] : []; });
    } catch (error) {
      if (error instanceof InstitutionsApiError && [404, 405].includes(error.status)) return [];
      throw error;
    }
  },
  async addContact(id: number, payload: InstitutionContactLinkPayload, token: string): Promise<void> {
    await request(`/api/empanelment/institutions/${id}/contacts`, token, json('POST', payload));
  },
  async updateContact(contactLinkId: number, payload: InstitutionContactLinkPayload, token: string): Promise<void> {
    await request(`/api/empanelment/contacts/${contactLinkId}`, token, json('PUT', payload));
  },
  async getNcRegisters(id: number, token: string): Promise<NcRegister[]> {
    const response = await request(`/api/empanelment/nc${queryString({ parentType: 'INSTITUTION', institutionId: id, page: 0, size: 100 })}`, token);
    return pageItems(response).flatMap((v) => { const nc = normalizeNc(v); return nc ? [nc] : []; });
  },
  async getCombinedNcRegister(token: string, filters: CombinedNcFilters = {}): Promise<ApiPage<CombinedNcRegister>> {
    const page = filters.page ?? 0;
    const size = filters.size ?? 50;
    const response = await request(`/api/empanelment/nc${queryString({ ...filters, page, size })}`, token);
    const items = pageItems(response).flatMap((value) => {
      const item = recordOf(value);
      const nc = normalizeNc(value);
      if (!item || !nc) return [];
      const parentType = stringOf(item.parentType).toUpperCase();
      if (parentType !== 'INSTITUTION' && parentType !== 'PROJECT') return [];
      return [{
        ...nc,
        parentType: parentType as 'INSTITUTION' | 'PROJECT',
        institutionName: stringOf(item.institutionName) || null,
        projectName: stringOf(item.projectName) || null,
        regionId: numberOf(item.regionId),
        regionName: stringOf(item.regionName) || null,
        institutionApplicationCycleId: numberOf(item.institutionApplicationCycleId),
        overdue: booleanOf(false, item.overdue),
        active: booleanOf(true, item.active),
      }];
    });
    return pageOf(response, items, page, size);
  },
  async createNc(payload: NcCreatePayload, token: string): Promise<number> {
    const body = await request('/api/empanelment/nc', token, json('POST', payload));
    return extractCreatedId(body);
  },
  async updateNc(ncId: number, payload: Partial<NcCreatePayload>, token: string): Promise<void> {
    await request(`/api/empanelment/nc/${ncId}`, token, json('PUT', payload));
  },
  async getNcDocuments(ncId: number, token: string): Promise<InstitutionDocument[]> {
    try {
      const response = await request(`/api/common/nc/${ncId}/documents?page=0&size=200`, token);
      return pageItems(response).flatMap((v) => { const doc = normalizeDocument(v); return doc ? [doc] : []; });
    } catch (error) {
      if (error instanceof InstitutionsApiError && [404, 405].includes(error.status)) return [];
      throw error;
    }
  },
  async submitNcClosure(ncId: number, payload: { correctiveActionText: string; evidenceDocumentId: number | null; witnessedVisitId: number | null }, token: string): Promise<void> {
    await request(`/api/empanelment/nc/${ncId}/submit-closure`, token, json('POST', payload));
  },
  async acceptNcClosure(ncId: number, payload: { closureMethod: 'DOCUMENTARY_EVIDENCE_ONLY' | 'RE_VISIT_WITNESSED'; acceptanceDate: string; acceptingOfficialText: string; evidenceDocumentId: number | null; witnessedVisitId: number | null }, token: string): Promise<void> {
    await request(`/api/empanelment/nc/${ncId}/accept-closure`, token, json('POST', payload));
  },
  async uploadNcEvidence(ncId: number, file: File, token: string): Promise<void> {
    const createBody = await request('/api/common/documents', token, json('POST', {
      documentType: 'NC_CLOSURE_EVIDENCE',
      parentType: 'NC_REGISTER',
      ncRegisterId: ncId,
      fileName: file.name,
      active: true,
    }));
    const docId = extractCreatedId(createBody);
    const form = new FormData();
    form.append('file', file);
    const response = await fetch(`${INSTITUTIONS_API_BASE_URL}/api/common/documents/${docId}/file`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: form,
    });
    if (!response.ok) throw new InstitutionsApiError(await getApiErrorMessage(response, `Upload failed (${response.status})`), response.status);
  },
  async getNotes(institutionId: number, token: string): Promise<InstitutionNote[]> {
    try {
      const response = await request(`/api/common/institutions/${institutionId}/notes?page=0&size=200`, token);
      return pageItems(response).flatMap((v) => { const note = normalizeNote(v); return note ? [note] : []; });
    } catch (error) {
      if (error instanceof InstitutionsApiError && [404, 405].includes(error.status)) return [];
      throw error;
    }
  },
  async createNote(institutionId: number, noteText: string, token: string): Promise<void> {
    await request('/api/common/notes', token, json('POST', { parentType: 'EMPANELMENT', institutionId, noteText }));
  },
  async updateNote(noteId: number, noteText: string, token: string, correctionReason?: string): Promise<void> {
    await request(`/api/common/notes/${noteId}`, token, json('PUT', { noteText, correctionReason: correctionReason?.trim() || 'Corrected from institution detail' }));
  },
  async getTasks(institutionId: number, _employeeId: number, token: string): Promise<InstitutionTask[]> {
    const response = await request(`/api/tasks/visible?institutionId=${institutionId}&page=0&size=200`, token);
    return pageItems(response).flatMap((v) => { const task = normalizeTask(v); return task ? [task] : []; });
  },
  async createTask(payload: { taskTitle: string; taskDescription: string | null; taskType: string; status: string; priority: string; assignedToEmployeeId: number; assignedByEmployeeId: number; dueDate: string; institutionId: number; visitActivityId: number | null }, token: string): Promise<void> {
    await request('/api/tasks', token, json('POST', payload));
  },
  async updateTask(taskId: number, payload: { taskTitle: string; taskDescription: string | null; taskType: string; status: string; priority: string; assignedToEmployeeId: number; assignedByEmployeeId: number; dueDate: string; institutionId: number; visitActivityId: number | null }, token: string): Promise<void> {
    await request(`/api/tasks/${taskId}`, token, json('PUT', payload));
  },
  async getTaskById(taskId: number, token: string): Promise<InstitutionTask> {
    let response: unknown;
    try { response = await request(`/api/Task/getById?id=${taskId}`, token); } catch { try { response = await request(`/api/tasks/${taskId}`, token); } catch { response = await request(`/task/getById?id=${taskId}`, token); } }
    const task = normalizeTask(response);
    if (!task) throw new Error('Task details were not returned.');
    return task;
  },
  async deleteTask(taskId: number, token: string): Promise<void> {
    await request(`/api/tasks/${taskId}`, token, { method: 'DELETE' });
  },
  async planVisit(payload: { institutionId: number; assignedEmployeeId: number; assignedByEmployeeId: number; scheduledVisitDate: string; scheduledStartTime: string; scheduledEndTime: string; purpose: string; description?: string | null; selfGenerated: boolean }, token: string): Promise<void> {
    await request('/api/common/visits', token, json('POST', {
      visitType: 'INSTITUTIONAL_VISIT',
      clientAccountId: null,
      institutionId: payload.institutionId,
      projectId: null,
      assignedEmployeeId: payload.assignedEmployeeId,
      assignedByEmployeeId: payload.assignedByEmployeeId,
      scheduledVisitDate: payload.scheduledVisitDate,
      scheduledStartTime: payload.scheduledStartTime,
      scheduledEndTime: payload.scheduledEndTime,
      scheduledLatitude: null,
      scheduledLongitude: null,
      purpose: payload.purpose,
      description: payload.description ?? null,
      purposeCode: null,
      purposeText: null,
      contactIds: [],
      selfGenerated: payload.selfGenerated,
    }));
  },
  async getDocuments(institutionId: number, token: string): Promise<InstitutionDocument[]> {
    try {
      const response = await request(`/api/common/institutions/${institutionId}/documents?page=0&size=200`, token);
      return pageItems(response).flatMap((v) => { const doc = normalizeDocument(v); return doc ? [doc] : []; });
    } catch (error) {
      if (error instanceof InstitutionsApiError && [404, 405].includes(error.status)) return [];
      throw error;
    }
  },
  async createDocument(payload: { documentType: InstitutionDocumentType; institutionId: number; fileName: string }, token: string): Promise<number> {
    const body = await request('/api/common/documents', token, json('POST', {
      documentType: payload.documentType,
      parentType: 'INSTITUTION',
      institutionId: payload.institutionId,
      fileName: payload.fileName,
      active: true,
    }));
    return extractCreatedId(body);
  },
  async uploadDocumentFile(documentId: number, file: File, token: string): Promise<void> {
    const form = new FormData();
    form.append('file', file);
    const response = await fetch(`${INSTITUTIONS_API_BASE_URL}/api/common/documents/${documentId}/file`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: form,
    });
    if (!response.ok) throw new InstitutionsApiError(await getApiErrorMessage(response, `Upload failed (${response.status})`), response.status);
  },
  fixtures: FIXTURES,
};
