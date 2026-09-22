import { getApiErrorMessage } from '@/lib/api-error';
import { toTitleCase } from '@/lib/utils';

export const PROJECTS_API_BASE_URL = 'http://ec2-18-211-58-135.compute-1.amazonaws.com:8081';

export interface ApiPage<T> { content: T[]; number: number; size: number; totalElements: number; totalPages: number; }

export type ProjectType = 'ROAD_HIGHWAY' | 'BRIDGE' | 'BUILDING' | 'IRRIGATION' | 'PORT_OR_INDUSTRIAL' | 'OTHER_INFRASTRUCTURE';
export type ProjectStage = 'NOT_STARTED' | 'CREDENTIALS_SUBMITTED_TO_CONTRACTOR' | 'FORWARDED_TO_CONSULTANT' | 'UNDER_REVIEW' | 'TECHNICAL_VISIT_SCHEDULED' | 'NC_RAISED' | 'NC_CLOSURE_SUBMITTED' | 'SOURCE_APPROVED' | 'PROJECT_COMPLETED' | 'REJECTED';

export const VALID_STAGE_TRANSITIONS: Record<ProjectStage, ProjectStage[]> = {
  NOT_STARTED: ['CREDENTIALS_SUBMITTED_TO_CONTRACTOR', 'FORWARDED_TO_CONSULTANT', 'REJECTED'],
  CREDENTIALS_SUBMITTED_TO_CONTRACTOR: ['FORWARDED_TO_CONSULTANT', 'UNDER_REVIEW', 'REJECTED'],
  FORWARDED_TO_CONSULTANT: ['UNDER_REVIEW', 'REJECTED'],
  UNDER_REVIEW: ['TECHNICAL_VISIT_SCHEDULED', 'NC_RAISED', 'SOURCE_APPROVED', 'REJECTED'],
  TECHNICAL_VISIT_SCHEDULED: ['NC_RAISED', 'SOURCE_APPROVED', 'REJECTED'],
  NC_RAISED: ['NC_CLOSURE_SUBMITTED'],
  NC_CLOSURE_SUBMITTED: ['UNDER_REVIEW', 'SOURCE_APPROVED', 'REJECTED'],
  SOURCE_APPROVED: ['PROJECT_COMPLETED'],
  PROJECT_COMPLETED: [],
  REJECTED: ['NOT_STARTED'],
};

export type NcStatus = 'OPEN' | 'SUBMITTED' | 'CLOSED';

export interface ProjectNcRegister {
  id: number;
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
}

export interface ProjectNcCreatePayload {
  projectId: number;
  description: string;
  raisedDate: string;
  raisedByOfficialText: string;
  targetClosureDate: string | null;
  closureMethod: string | null;
  closureDate: string | null;
  status: NcStatus;
  responsibleEmployeeId: number | null;
}

export interface ProjectContact {
  id: number;
  contactInfluenceRegisterId: number;
  firstName: string;
  lastName: string;
  mobile: string;
  email: string;
  designation: string;
  roleDescription: string;
  departmentFunction: string | null;
  influenceLevel: string | null;
  projectPartyId: number | null;
  primaryContact: boolean;
  active: boolean;
  createdAt: string | null;
  updatedAt: string | null;
}

export interface ProjectContactLinkPayload {
  projectId: number;
  contactInfluenceRegisterId: number;
  designation: string;
  roleDescription: string | null;
  primaryContact: boolean;
  active: boolean;
}

export interface ProjectContactCreatePayload {
  firstName: string;
  lastName: string;
  mobile: string;
  email?: string | null;
  projectPartyId: number | null;
  designation: string;
  departmentFunction?: string | null;
  influenceLevel?: 'DECISION_MAKER' | 'RECOMMENDER' | 'GATEKEEPER' | 'TECHNICAL_EVALUATOR' | null;
  active: boolean;
}

export interface ProjectNote {
  id: number;
  noteText: string;
  authorName: string;
  authorEmployeeId: number | null;
  createdAt: string;
  updatedAt: string;
}

export interface ProjectTask {
  id: number;
  title: string;
  description: string;
  status: string;
  priority: string;
  dueDate: string;
  assignedEmployeeName: string;
  assignedEmployeeId: number | null;
}

export interface ProjectSale {
  id: number;
  projectId: number;
  saleDate: string;
  quantityMt: number;
  invoiceReference: string;
  sourceSystem: string;
  createdAt: string;
  updatedAt: string;
}

export interface ProjectSalePayload {
  projectId: number;
  saleDate: string;
  quantityMt: number;
  invoiceReference: string;
  sourceSystem: 'WEB' | 'MOBILE';
}

export interface ProjectDocument {
  id: number;
  documentType: string;
  fileName: string;
  fileUrl: string | null;
  mimeType: string | null;
  uploadedAt: string | null;
}

export interface ProjectParty {
  id: number;
  projectId: number;
  partyName: string;
  partyRole: string;
  packageName: string | null;
  primaryParty: boolean;
  contactPerson: string;
  mobile: string;
  email: string;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ProjectPipelineEntry {
  id: number;
  projectId: number;
  stage: ProjectStage | string;
  enteredAt: string;
  exitedAt: string | null;
  enteredBy: string;
  remarks: string;
}

export interface ProjectApprovalHistoryEntry {
  id: number;
  projectId: number;
  action: string;
  fromStage: ProjectStage | null;
  toStage: ProjectStage | null;
  performedBy: string;
  performedAt: string;
  remarks: string;
}

export interface ProjectNcEntry {
  id: number;
  projectId: number;
  ncNumber: string;
  description: string;
  severity: string;
  status: string;
  raisedBy: string;
  raisedAt: string;
  resolvedAt: string | null;
}

export interface ProjectCreatePayload {
  projectName: string;
  locationText: string;
  locationLatitude: number | null;
  locationLongitude: number | null;
  projectType: ProjectType;
  estimatedTmtMt: number | null;
  startDate: string | null;
  completionDate: string | null;
  sourceApprovalStatus: ProjectStage;
  approvalLetterReference: string | null;
  assignedEmployeeId: number | null;
  active: boolean;
}

export interface Project {
  id: number;
  projectName: string;
  institutionId: number | null;
  institutionName: string;
  locationText: string;
  state: string;
  projectType: ProjectType;
  estimatedTmtMt: number | null;
  sourceApprovalStatus: ProjectStage | string;
  approvalLetterReference?: string | null;
  assignedEmployeeId: number | null;
  assignedEmployeeName: string;
  contractorName: string;
  consultantName: string;
  regionId?: number | null;
  startDate?: string | null;
  completionDate?: string | null;
  active: boolean;
  // Null when backend doesn't send timestamps â€” never fabricate (a fake "today" is worse than 'â€”').
  createdAt: string | null;
  updatedAt: string | null;
  rawSourceApprovalStatus?: string;
  // Phase 3: backend-authority optional fields â€” only if backend already returns them
  statusLabel?: string | null;
  statusDescription?: string | null;
  allowedActions?: ProjectStage[] | null;
  allowedNextStatuses?: ProjectStage[] | null;
  blockers?: string[] | null;
  isTerminal?: boolean | null;
}

export interface ProjectStageActions {
  currentStage: ProjectStage | string;
  allowedActions: ProjectStage[];
  missingRequirements: string[];
}

export class ProjectsApiError extends Error { status: number; constructor(m:string,s:number){ super(m); this.name='ProjectsApiError'; this.status=s; } }

const recordOf = (v: unknown): Record<string, unknown> | null => v && typeof v === 'object' && !Array.isArray(v) ? v as Record<string,unknown> : null;
const nested = (r: Record<string,unknown> | null, ...keys:string[]) => { for(const k of keys){ const f=recordOf(r?.[k]); if(f) return f; } return null; };
const stringOf = (...vals: unknown[]): string => { for(const v of vals) if(typeof v==='string'&&v.trim()) return v.trim(); return ''; };
const numberOf = (...vals: unknown[]): number | null => { for(const v of vals){ if(typeof v==='number'&&Number.isFinite(v)) return v; if(typeof v==='string'&&v.trim()&&Number.isFinite(Number(v))) return Number(v); } return null; };
const booleanOf = (fb:boolean,...vals: unknown[]): boolean => { for(const v of vals){ if(typeof v==='boolean') return v; if(v==='true'||v===1) return true; if(v==='false'||v===0) return false; } return fb; };
const pageItems = (v:unknown):unknown[]=>{ if(Array.isArray(v))return v; const r=recordOf(v); if(!r) return []; if(Array.isArray(r.content)) return r.content; if(Array.isArray(r.data)) return r.data; const d=recordOf(r.data); return d&&Array.isArray(d.content)?d.content:[]; };
const queryString = (vals:Record<string,string|number|boolean|null|undefined>):string=>{const p=new URLSearchParams(); Object.entries(vals).forEach(([k,v])=>{ if(v!==undefined&&v!==null&&v!=='') p.set(k,String(v)); }); return p.size?`?${p.toString()}`:'';};
const pageOf = <T>(v:unknown,c:T[],num=0,size=c.length||20):ApiPage<T>=>{const o=recordOf(v);const d=recordOf(o?.data);const s=d&&(Array.isArray(d.content)||'totalElements' in d)?d:o;const te=numberOf(s?.totalElements,s?.total,c.length)??c.length;const as=numberOf(s?.size,size)??size;return{content:c,number:numberOf(s?.number,s?.page,num)??num,size:as,totalElements:te,totalPages:numberOf(s?.totalPages)??Math.max(1,Math.ceil(te/Math.max(1,as)))};};
const readResponseBody = async (r:Response):Promise<unknown>=>{if(r.status===204) return undefined; const t=(await r.text()).trim(); if(!t) return undefined; try{return JSON.parse(t)as unknown;}catch{return t;}};
const request = async (path:string,token:string, opts:RequestInit={}):Promise<unknown>=>{const res=await fetch(`${PROJECTS_API_BASE_URL}${path}`,{...opts,headers:{'Content-Type':'application/json',Authorization:`Bearer ${token}`,...opts.headers}}); if(!res.ok) throw new ProjectsApiError(await getApiErrorMessage(res,`Request failed (${res.status})`),res.status); return readResponseBody(res);};

const FIXTURES: Project[] = [
  { id: 201, projectName: 'Metro Flyover Package A â€” Ghodbunder Extension', institutionId: 101, institutionName: 'Metro Infrastructure Authority', locationText: 'Thane â€” Ghodbunder Road, MH', state: 'Maharashtra', projectType: 'ROAD_HIGHWAY', estimatedTmtMt: 1200.5, sourceApprovalStatus: 'SOURCE_APPROVED', assignedEmployeeId: 12, assignedEmployeeName: 'Arjun Shah', contractorName: 'L&T Construction', consultantName: 'Sheth & Associates', active: true, createdAt: '2025-10-11T09:00:00Z', updatedAt: '2026-02-18T11:20:00Z' },
  { id: 202, projectName: 'Pune Ring Road â€” Eastern Quadrant', institutionId: 102, institutionName: 'Pune Public Works Circle', locationText: 'Pune â€” Wagholi to Loni Kalbhor', state: 'Maharashtra', projectType: 'ROAD_HIGHWAY', estimatedTmtMt: 2400, sourceApprovalStatus: 'TECHNICAL_VISIT_SCHEDULED', assignedEmployeeId: 14, assignedEmployeeName: 'Neha Desai', contractorName: 'Afcons Infrastructure', consultantName: 'Tata Consulting Engineers', active: true, createdAt: '2026-01-05T08:30:00Z', updatedAt: '2026-02-20T13:00:00Z' },
  { id: 203, projectName: 'Bengaluru Whitefield IT Corridor â€” Grade Separator', institutionId: 103, institutionName: 'Karnataka Urban Infrastructure Finance Corp', locationText: 'Bengaluru â€” Whitefield, KA', state: 'Karnataka', projectType: 'BRIDGE', estimatedTmtMt: 860, sourceApprovalStatus: 'UNDER_REVIEW', assignedEmployeeId: 22, assignedEmployeeName: 'Priya Nair', contractorName: 'Brigade Group JV', consultantName: 'Aarvee Associates', active: true, createdAt: '2026-01-18T10:15:00Z', updatedAt: '2026-02-16T09:45:00Z' },
  { id: 204, projectName: 'Ahmedabad Periphery Logistics Park â€” Phase 2', institutionId: 105, institutionName: 'Gujarat State Road Development Corporation', locationText: 'Ahmedabad â€” Sanand, GJ', state: 'Gujarat', projectType: 'PORT_OR_INDUSTRIAL', estimatedTmtMt: 540, sourceApprovalStatus: 'REJECTED', assignedEmployeeId: 22, assignedEmployeeName: 'Priya Nair', contractorName: 'Shapoorji Pallonji', consultantName: 'STUP Consultants', active: false, createdAt: '2025-12-01T09:00:00Z', updatedAt: '2026-01-12T10:00:00Z' },
  { id: 205, projectName: 'JNPT Approach Widening â€” Heavy Civil', institutionId: 106, institutionName: 'L&T Construction â€” Heavy Civil', locationText: 'Navi Mumbai â€” JNPT Corridor', state: 'Maharashtra', projectType: 'OTHER_INFRASTRUCTURE', estimatedTmtMt: 3100, sourceApprovalStatus: 'FORWARDED_TO_CONSULTANT', assignedEmployeeId: 18, assignedEmployeeName: 'Rahul Mehta', contractorName: 'L&T Construction', consultantName: 'Ramboll India', active: true, createdAt: '2025-11-20T11:00:00Z', updatedAt: '2026-02-19T15:30:00Z' },
  { id: 206, projectName: 'Hyderabad Outer Ring Connector â€” Service Roads', institutionId: 110, institutionName: 'Afcons Infrastructure â€” Elevated Corridor Division', locationText: 'Hyderabad â€” ORR km 42-58, TG', state: 'Telangana', projectType: 'ROAD_HIGHWAY', estimatedTmtMt: 1450, sourceApprovalStatus: 'CREDENTIALS_SUBMITTED_TO_CONTRACTOR', assignedEmployeeId: 18, assignedEmployeeName: 'Rahul Mehta', contractorName: 'Afcons Infrastructure', consultantName: 'S N Consultants', active: true, createdAt: '2026-02-02T09:20:00Z', updatedAt: '2026-02-18T08:00:00Z' },
  { id: 207, projectName: 'Chennai Siruseri IT Park â€” Institutional Block', institutionId: 112, institutionName: 'Shapoorji Pallonji â€” Institutional Projects JV', locationText: 'Chennai â€” Siruseri, TN', state: 'Tamil Nadu', projectType: 'BUILDING', estimatedTmtMt: 720, sourceApprovalStatus: 'NOT_STARTED', assignedEmployeeId: 22, assignedEmployeeName: 'Priya Nair', contractorName: 'Shapoorji Pallonji', consultantName: 'CRN Associates', active: true, createdAt: '2026-02-14T10:00:00Z', updatedAt: '2026-02-14T10:00:00Z' },
  { id: 208, projectName: 'Nagpurâ€“Wardha NH-44 â€” Six-Laning', institutionId: 107, institutionName: 'NHAI â€” Maharashtra Regional Office', locationText: 'Nagpur â€” Wardha, MH', state: 'Maharashtra', projectType: 'ROAD_HIGHWAY', estimatedTmtMt: 2800, sourceApprovalStatus: 'UNDER_REVIEW', assignedEmployeeId: 14, assignedEmployeeName: 'Neha Desai', contractorName: 'HCC', consultantName: 'AECOM', active: true, createdAt: '2026-01-25T09:00:00Z', updatedAt: '2026-02-21T12:00:00Z' },
  { id: 209, projectName: 'Kochi Container Terminal â€” Quay Extension', institutionId: 114, institutionName: 'Hindustan Construction Company â€” Marine & Ports', locationText: 'Kochi â€” Vallarpadam, KL', state: 'Kerala', projectType: 'OTHER_INFRASTRUCTURE', estimatedTmtMt: 980, sourceApprovalStatus: 'TECHNICAL_VISIT_SCHEDULED', assignedEmployeeId: 18, assignedEmployeeName: 'Rahul Mehta', contractorName: 'HCC Marine', consultantName: 'Howe India', active: true, createdAt: '2026-02-08T11:00:00Z', updatedAt: '2026-02-20T16:00:00Z' },
  { id: 210, projectName: 'Delhi Central Secretariat â€” Institutional Complex', institutionId: 111, institutionName: 'Delhi Metro Rail Corporation â€” Phase V Cell', locationText: 'New Delhi â€” Central Vista, DL', state: 'Delhi', projectType: 'BUILDING', estimatedTmtMt: 650, sourceApprovalStatus: 'PROJECT_COMPLETED', assignedEmployeeId: 25, assignedEmployeeName: 'Vikram Singh', contractorName: 'NBCC', consultantName: 'HCP Design', active: true, createdAt: '2024-07-01T08:00:00Z', updatedAt: '2025-12-20T10:00:00Z' },
  { id: 211, projectName: 'Ratnagiri District Water Grid â€” Konkan Package', institutionId: 109, institutionName: 'Maharashtra Jeevan Pradhikaran â€” Konkan Circle', locationText: 'Ratnagiri â€” Konkan Region, MH', state: 'Maharashtra', projectType: 'OTHER_INFRASTRUCTURE', estimatedTmtMt: 430, sourceApprovalStatus: 'REJECTED', assignedEmployeeId: 12, assignedEmployeeName: 'Arjun Shah', contractorName: 'JMC Projects', consultantName: 'SMEC', active: false, createdAt: '2024-09-10T08:00:00Z', updatedAt: '2025-11-15T09:00:00Z' },
  { id: 212, projectName: 'Ghodbunder Elevated Corridor â€” Technical Advisory', institutionId: 104, institutionName: 'Sheth & Associates (PMC)', locationText: 'Thane â€” Ghodbunder, MH', state: 'Maharashtra', projectType: 'ROAD_HIGHWAY', estimatedTmtMt: 1100, sourceApprovalStatus: 'SOURCE_APPROVED', assignedEmployeeId: 12, assignedEmployeeName: 'Arjun Shah', contractorName: 'Dilip Buildcon', consultantName: 'Sheth & Associates', active: true, createdAt: '2025-09-20T09:30:00Z', updatedAt: '2026-02-10T14:00:00Z' },
  { id: 213, projectName: 'Bengaluru Peripheral Ring â€” Feasibility Study', institutionId: 103, institutionName: 'Karnataka Urban Infrastructure Finance Corp', locationText: 'Bengaluru â€” PRR, KA', state: 'Karnataka', projectType: 'ROAD_HIGHWAY', estimatedTmtMt: 3200, sourceApprovalStatus: 'FORWARDED_TO_CONSULTANT', assignedEmployeeId: 22, assignedEmployeeName: 'Priya Nair', contractorName: 'KNR Constructions', consultantName: 'Tata Consulting Engineers', active: true, createdAt: '2026-01-12T09:45:00Z', updatedAt: '2026-02-17T11:30:00Z' },
  { id: 214, projectName: 'Hyderabad Pharma City â€” Internal Roads', institutionId: 110, institutionName: 'Afcons Infrastructure â€” Elevated Corridor Division', locationText: 'Hyderabad â€” Shamshabad, TG', state: 'Telangana', projectType: 'PORT_OR_INDUSTRIAL', estimatedTmtMt: 890, sourceApprovalStatus: 'NOT_STARTED', assignedEmployeeId: 18, assignedEmployeeName: 'Rahul Mehta', contractorName: 'Afcons', consultantName: 'Voyants', active: true, createdAt: '2026-02-10T08:30:00Z', updatedAt: '2026-02-10T08:30:00Z' },
  { id: 215, projectName: 'Pune â€” Hinjewadi IT Cluster Residential Towers', institutionId: 102, institutionName: 'Pune Public Works Circle', locationText: 'Pune â€” Hinjewadi, MH', state: 'Maharashtra', projectType: 'BUILDING', estimatedTmtMt: 750, sourceApprovalStatus: 'UNDER_REVIEW', assignedEmployeeId: 14, assignedEmployeeName: 'Neha Desai', contractorName: 'Kolte-Patil', consultantName: 'JW Consultants', active: true, createdAt: '2026-02-05T10:20:00Z', updatedAt: '2026-02-19T09:15:00Z' },
];

const normalizeProject = (value: unknown): Project | null => {
  const item = recordOf(value); if (!item) return null;
  const id = numberOf(item.id, item.projectId); if (id == null) return null;
  const owner = nested(item, 'assignedEmployee', 'employee', 'owner');
  const inst = nested(item, 'institution');
  const typeRaw = stringOf(item.projectType, item.type).toUpperCase().replace(/[\s-]+/g,'_');
  const stageRaw = stringOf(item.sourceApprovalStatus, item.status, item.projectStatus, item.approvalStatus, item.currentStage, item.stage).toUpperCase().replace(/[\s-]+/g,'_');
  const allowedTypes: ProjectType[] = ['ROAD_HIGHWAY', 'BRIDGE', 'BUILDING', 'IRRIGATION', 'PORT_OR_INDUSTRIAL', 'OTHER_INFRASTRUCTURE'];
  return {
    id,
    projectName: toTitleCase(stringOf(item.projectName, item.name)) || `Project #${id}`,
    institutionId: numberOf(item.institutionId, inst?.id),
    institutionName: toTitleCase(stringOf(item.institutionName, inst?.institutionName, inst?.name)) || '—',
    locationText: toTitleCase(stringOf(item.locationText, item.location, item.address)) || '—',
    state: toTitleCase(stringOf(item.state, item.addressState, inst?.state)) || '—',
    regionId: numberOf(item.regionId, item.salesRegionId),
    startDate: stringOf(item.startDate) || null,
    completionDate: stringOf(item.completionDate) || null,
    projectType: (allowedTypes.includes(typeRaw as ProjectType) ? typeRaw : 'ROAD_HIGHWAY') as ProjectType,
    estimatedTmtMt: numberOf(item.estimatedTmtMt, item.estimatedTmt, item.tmtMt),
    sourceApprovalStatus: (stageRaw || 'NOT_STARTED') as ProjectStage | string,
    approvalLetterReference: stringOf(item.approvalLetterReference, item.approvalLetterRef) || null,
    assignedEmployeeId: numberOf(item.assignedEmployeeId, item.employeeId, owner?.id),
    assignedEmployeeName: toTitleCase(stringOf(item.assignedEmployeeName, item.ownerName, [stringOf(owner?.firstName), stringOf(owner?.lastName)].filter(Boolean).join(' '))) || '—',
    contractorName: toTitleCase(stringOf(item.contractorName, item.contractor, nested(item,'contractor')?.name) || stringOf(item.contractor)) || '—',
    consultantName: toTitleCase(stringOf(item.consultantName, item.consultant, nested(item,'consultant')?.name)) || '—',
    active: booleanOf(true, item.active, item.isActive),
    createdAt: stringOf(item.createdAt, item.createdDate) || null,
    updatedAt: stringOf(item.updatedAt, item.modifiedDate) || null,
    rawSourceApprovalStatus: stageRaw || undefined,
    statusLabel: stringOf(item.statusLabel, (item as Record<string, unknown>).statusDisplayName, item.label) || null,
    statusDescription: stringOf(item.statusDescription, (item as Record<string, unknown>).statusHelpText, item.description) || null,
    allowedActions: (() => {
      const raw = (item.allowedActions ?? (item as Record<string, unknown>).allowedNextStatuses ?? (item as Record<string, unknown>).nextAllowedStatuses ?? (item as Record<string, unknown>).allowedTransitions) as unknown;
      if (Array.isArray(raw)) return raw.map((v) => String(v).toUpperCase().replace(/[\s-]+/g, '_')).filter(Boolean) as ProjectStage[];
      return null;
    })(),
    allowedNextStatuses: (() => {
      const raw = (item.allowedNextStatuses ?? (item as Record<string, unknown>).nextAllowedStatuses) as unknown;
      if (Array.isArray(raw)) return raw.map((v) => String(v).toUpperCase().replace(/[\s-]+/g, '_')).filter(Boolean) as ProjectStage[];
      return null;
    })(),
    blockers: (() => {
      const raw = (item.blockers ?? (item as Record<string, unknown>).blockingReasons) as unknown;
      if (Array.isArray(raw)) return raw.map((v) => String(v)).filter(Boolean);
      if (typeof raw === 'string' && raw.trim()) return [raw.trim()];
      return null;
    })(),
    isTerminal: (() => {
      const v = (item.isTerminal ?? (item as Record<string, unknown>).terminal) as unknown;
      if (typeof v === 'boolean') return v;
      return null;
    })(),
  };
};

const fixturePage = (opts: { page?:number; size?:number; q?:string; status?:string; projectType?:string; assignedEmployeeId?:number; institutionId?:number; active?:boolean }): ApiPage<Project> => {
  let f=[...FIXTURES];
  const q=opts.q?.trim().toLowerCase(); if(q) f=f.filter(p=>`${p.projectName} ${p.institutionName} ${p.locationText} ${p.state}`.toLowerCase().includes(q)||String(p.id).includes(q));
  if(opts.status && opts.status!=='ALL') f=f.filter(p=>p.sourceApprovalStatus===opts.status);
  if(opts.projectType && opts.projectType!=='ALL') f=f.filter(p=>p.projectType===opts.projectType);
  if(opts.assignedEmployeeId) f=f.filter(p=>p.assignedEmployeeId===opts.assignedEmployeeId);
  if(opts.institutionId) f=f.filter(p=>p.institutionId===opts.institutionId);
  if(opts.active!==undefined) f=f.filter(p=>p.active===opts.active);
  f.sort((a,b)=>a.projectName.localeCompare(b.projectName));
  const page=opts.page??0; const size=opts.size??10; const te=f.length; const tp=Math.max(1,Math.ceil(te/Math.max(1,size))); const c=f.slice(page*size,page*size+size);
  return {content:c,number:page,size,totalElements:te,totalPages:tp};
};

const extractCreatedId = (body: unknown): number => {
  const r = recordOf(body); const data = recordOf(r?.data) ?? r;
  return numberOf(data?.id, data?.projectId) ?? 0;
};

const normalizeProjectParty = (value: unknown): ProjectParty | null => {
  const item = recordOf(value); if (!item) return null;
  const id = numberOf(item.id, item.projectPartyId, item.partyId, nested(item, 'party')?.id, nested(item, 'projectParty')?.id); if (id == null) return null;
  const party = nested(item, 'party', 'projectParty', 'data') ?? item;
  const contact = nested(item, 'contact', 'contactPerson', 'person') ?? item;
  const org = nested(item, 'organization', 'company', 'firm') ?? item;
  return {
    id,
    projectId: numberOf(item.projectId, item.project_id, party?.projectId, party?.project_id) ?? 0,
    partyName: toTitleCase(stringOf(item.partyNameText, item.party_name_text, item.partyName, item.party_name, item.name, item.title, item.displayName, item.organization, item.organizationName, item.companyName, item.firmName, item.contractorName, party?.partyNameText, party?.partyName, party?.party_name, party?.name, party?.title, party?.organization, org?.organizationName, org?.name) || stringOf(contact?.contactPerson, contact?.contact_person, contact?.personName, contact?.fullName)) || 'â€”',
    partyRole: toTitleCase(stringOf(item.partyRole, item.party_role, item.role, item.type, item.partyType, item.party_type, item.designation, party?.partyRole, party?.party_role, party?.role, party?.type, party?.designation)) || 'â€”',
    packageName: toTitleCase(stringOf(item.packageName, item.package_name, item.package, party?.packageName, party?.package_name)) || null,
    primaryParty: booleanOf(false, item.primaryParty, item.primary_party, item.isPrimary, item.is_primary, party?.primaryParty, party?.primary_party),
    contactPerson: toTitleCase(stringOf(item.contactPerson, item.contact_person, item.personName, item.person_name, item.fullName, item.contactName, item.responsiblePerson, contact?.contactPerson, contact?.contact_person, contact?.personName, contact?.fullName, party?.contactPerson)) || 'â€”',
    mobile: stringOf(item.mobile, item.phone, item.contactPhone, item.contact_phone, item.phoneNumber, item.phone_number, item.mobileNumber, item.mobile_number, contact?.mobile, contact?.phone, party?.mobile, party?.phone) || 'â€”',
    email: stringOf(item.email, item.contactEmail, item.contact_email, item.emailAddress, item.email_address, contact?.email, party?.email) || 'â€”',
    active: booleanOf(true, item.active, item.isActive, item.is_active, party?.active),
    createdAt: stringOf(item.createdAt, item.created_at, item.createdDate, party?.createdAt) || new Date().toISOString(),
    updatedAt: stringOf(item.updatedAt, item.updated_at, item.modifiedDate, item.createdAt, party?.updatedAt) || new Date().toISOString(),
  };
};

const normalizePipelineEntry = (value: unknown): ProjectPipelineEntry | null => {
  const item = recordOf(value); if (!item) return null;
  const id = numberOf(item.id, item.pipelineId, nested(item, 'pipeline', 'entry', 'data')?.id); if (id == null) return null;
  const raw = (recordOf((item as Record<string, unknown>).data) ?? recordOf((item as Record<string, unknown>).pipeline) ?? recordOf((item as Record<string, unknown>).entry) ?? item) as Record<string, unknown>;
  // Documented + observed: projectStage is the single stage field for pipeline rows (e.g., UNDER_REVIEW)
  const stageRaw = stringOf(raw.projectStage, raw.project_stage, raw.stage, raw.currentStage, raw.current_stage, raw.status, raw.currentStatus, raw.current_status, item.projectStage, item.project_stage, item.stage) ?? '';
  const stageNorm = stageRaw ? stageRaw.toUpperCase().replace(/[\s-]+/g, '_') : '';
  const stage = stageNorm ? (stageNorm as ProjectStage) : null;
  return {
    id,
    projectId: numberOf(raw.projectId, raw.project_id, item.projectId, item.project_id) ?? 0,
    stage: (stage ?? null) as ProjectStage | string,
    enteredAt: stringOf(raw.entryDate, raw.entry_date, raw.enteredAt, raw.entered_at, raw.createdAt, raw.created_at, raw.timestamp, raw.date, item.entryDate, item.enteredAt) || new Date().toISOString(),
    exitedAt: stringOf(raw.exitDate, raw.exit_date, raw.exitedAt, raw.exited_at, raw.completedAt, raw.completed_at, item.exitDate, item.exitedAt) || null,
    enteredBy: stringOf(raw.responsibleEmployeeId, raw.responsible_employee_id, raw.enteredBy, raw.entered_by, raw.performedBy, raw.employeeName, item.responsibleEmployeeId, item.enteredBy) ? String(stringOf(raw.responsibleEmployeeId, raw.responsible_employee_id, raw.enteredBy, raw.performedBy, raw.employeeName, item.responsibleEmployeeId, item.enteredBy) || '') : 'â€”',
    remarks: stringOf(raw.outcomeComment, raw.outcome_comment, raw.remarks, raw.comment, raw.note, item.outcomeComment, item.remarks) || 'â€”',
  };
};

const normalizeApprovalHistoryEntry = (value: unknown): ProjectApprovalHistoryEntry | null => {
  const item = recordOf(value); if (!item) return null;
  const id = numberOf(item.id); if (id == null) return null;
  const stageRaw = (s: unknown) => { const r = stringOf(s).toUpperCase().replace(/[\s-]+/g, '_'); const allowed: ProjectStage[] = ['NOT_STARTED','CREDENTIALS_SUBMITTED_TO_CONTRACTOR','FORWARDED_TO_CONSULTANT','UNDER_REVIEW','TECHNICAL_VISIT_SCHEDULED','NC_RAISED','NC_CLOSURE_SUBMITTED','SOURCE_APPROVED','PROJECT_COMPLETED','REJECTED']; return (allowed.includes(r as ProjectStage) ? r : null) as ProjectStage | null; };
  return {
    id,
    projectId: numberOf(item.projectId) ?? 0,
    action: stringOf(item.action, item.event, item.type, item.projectStage) || 'Stage update',
    fromStage: stageRaw(item.fromStage) ?? stageRaw(item.previousStage),
    toStage: stageRaw(item.toStage) ?? stageRaw(item.newStage) ?? stageRaw(item.targetStage) ?? stageRaw(item.projectStage),
    performedBy: toTitleCase(stringOf(item.performedBy, item.enteredBy, item.employeeName, item.responsibleEmployeeId)) || 'System',
    performedAt: stringOf(item.performedAt, item.createdAt, item.timestamp) || new Date().toISOString(),
    remarks: stringOf(item.remarks, item.note, item.comment, item.outcomeComment) || '—',
  };
};

const normalizeNcEntry = (value: unknown): ProjectNcEntry | null => {
  const item = recordOf(value); if (!item) return null;
  const id = numberOf(item.id, item.ncRegisterId); if (id == null) return null;
  return {
    id,
    projectId: numberOf(item.projectId) ?? 0,
    ncNumber: stringOf(item.ncNumber, item.number, item.code) || `NC-${id}`,
    description: stringOf(item.description, item.title, item.summary) || 'â€”',
    severity: stringOf(item.severity, item.priority, item.level) || 'â€”',
    status: stringOf(item.status, item.ncStatus) || 'â€”',
    raisedBy: toTitleCase(stringOf(item.raisedBy, item.createdBy, item.employeeName)) || 'â€”',
    raisedAt: stringOf(item.raisedAt, item.createdAt) || new Date().toISOString(),
    resolvedAt: stringOf(item.resolvedAt, item.completedAt) || null,
  };
};

const normalizeNcRegister = (value: unknown): ProjectNcRegister | null => {
  const item = recordOf(value); if (!item) return null;
  const id = numberOf(item.id, item.ncRegisterId); if (id == null) return null;
  const statusRaw = stringOf(item.status, item.ncStatus).toUpperCase();
  const allowedStatuses: NcStatus[] = ['OPEN', 'SUBMITTED', 'CLOSED'];
  return {
    id,
    projectId: numberOf(item.projectId) ?? null,
    description: stringOf(item.description, item.title) || 'â€”',
    raisedDate: stringOf(item.raisedDate, item.createdAt) || new Date().toISOString().slice(0, 10),
    raisedByOfficialText: toTitleCase(stringOf(item.raisedByOfficialText, item.raisedBy)) || 'â€”',
    targetClosureDate: stringOf(item.targetClosureDate) || null,
    closureMethod: stringOf(item.closureMethod) || null,
    closureDate: stringOf(item.closureDate) || null,
    status: (allowedStatuses.includes(statusRaw as NcStatus) ? statusRaw : 'OPEN') as NcStatus,
    responsibleEmployeeId: numberOf(item.responsibleEmployeeId) ?? null,
    responsibleEmployeeName: toTitleCase(stringOf(item.responsibleEmployeeName, item.employeeName)) || 'â€”',
  };
};

const normalizeContact = (value: unknown): ProjectContact | null => {
  const item = recordOf(value); if (!item) return null;
  const id = numberOf(item.id, item.contactLinkId, item.contact_id, item.linkId, nested(item, 'contact')?.id, nested(item, 'contactInfluenceRegister')?.id); if (id == null) return null;
  const contact = nested(item, 'contact', 'contactInfluenceRegister', 'contactMaster', 'contactMaster', 'data', 'contactInfluenceRegister') ?? item;
  const party = nested(item, 'party') ?? item;
  return {
    id,
    contactInfluenceRegisterId: numberOf(item.contactInfluenceRegisterId, item.contact_influence_register_id, item.contactInfluenceRegister_id, item.masterContactId, item.master_contact_id, contact?.contactInfluenceRegisterId, contact?.contact_influence_register_id, contact?.id) ?? 0,
    firstName: toTitleCase(stringOf(item.firstName, item.first_name, contact?.firstName, contact?.first_name, party?.firstName, party?.first_name, nested(item, 'person')?.firstName)) || 'â€”',
    lastName: toTitleCase(stringOf(item.lastName, item.last_name, contact?.lastName, contact?.last_name, party?.lastName, party?.last_name, nested(item, 'person')?.lastName)) || '',
    mobile: stringOf(item.mobile, item.phone, item.phoneNumber, item.phone_number, item.mobileNumber, item.mobile_number, contact?.mobile, contact?.phone, contact?.phoneNumber, party?.mobile) || 'â€”',
    email: stringOf(item.email, item.emailAddress, item.email_address, contact?.email, contact?.emailAddress, party?.email) || '',
    designation: toTitleCase(stringOf(item.designation, item.designation_, item.role, item.title, contact?.designation, contact?.role, party?.designation) || stringOf(item.designation, item.departmentFunction)) || 'â€”',
    roleDescription: stringOf(item.roleDescription, item.role_description, item.description, item.departmentFunction, item.department_function, contact?.roleDescription, contact?.role_description, party?.roleDescription) || '',
    departmentFunction: stringOf(item.departmentFunction, item.department_function, contact?.departmentFunction, party?.departmentFunction) || null,
    influenceLevel: stringOf(item.influenceLevel, item.influence_level, contact?.influenceLevel, party?.influenceLevel) || null,
    projectPartyId: numberOf(item.projectPartyId, item.project_party_id, item.partyId, party?.projectPartyId) ?? null,
    primaryContact: booleanOf(false, item.primaryContact, item.primary_contact, item.isPrimary, item.is_primary, contact?.primaryContact),
    active: booleanOf(true, item.active, item.isActive, item.is_active, contact?.active),
    createdAt: stringOf(item.createdAt, item.created_at, contact?.createdAt) || null,
    updatedAt: stringOf(item.updatedAt, item.updated_at, contact?.updatedAt) || null,
  };
};

const normalizeNote = (value: unknown): ProjectNote | null => {
  const item = recordOf(value); if (!item) return null;
  const id = numberOf(item.id, item.noteId, nested(item, 'note')?.id); if (id == null) return null;
  const note = nested(item, 'note', 'data') ?? item;
  const author = nested(item, 'author', 'createdBy', 'employee', 'authorEmployee') ?? item;
  return {
    id,
    noteText: stringOf(item.noteText, item.note_text, item.text, item.content, item.body, note?.noteText, note?.text) || 'â€”',
    authorName: toTitleCase(stringOf(item.authorEmployeeName, item.authorName, item.author_name, item.createdBy, item.createdByName, item.employeeName, item.author, author?.authorName, author?.name, author?.fullName)) || '',
    authorEmployeeId: numberOf(item.authorEmployeeId, item.author_employee_id, item.createdById, item.employeeId, author?.authorEmployeeId, author?.id),
    createdAt: stringOf(item.createdAt, item.created_at, item.createdDate, note?.createdAt) || new Date().toISOString(),
    updatedAt: stringOf(item.updatedAt, item.updated_at, item.modifiedDate, note?.updatedAt) || new Date().toISOString(),
  };
};

const normalizeTask = (value: unknown): ProjectTask | null => {
  const item = recordOf(value); if (!item) return null;
  const id = numberOf(item.id, item.taskId); if (id == null) return null;
  return {
    id,
    title: stringOf(item.taskTitle, item.title) || 'â€”',
    description: stringOf(item.taskDescription, item.description) || '',
    status: stringOf(item.status) || 'OPEN',
    priority: stringOf(item.priority) || 'MEDIUM',
    dueDate: stringOf(item.dueDate) || '',
    assignedEmployeeName: toTitleCase(stringOf(item.assignedToEmployeeName, item.assignedEmployeeName, item.employeeName)),
    assignedEmployeeId: numberOf(item.assignedToEmployeeId, item.assignedEmployeeId, item.employeeId),
  };
};

const normalizeDocument = (value: unknown): ProjectDocument | null => {
  const item = recordOf(value); if (!item) return null;
  const id = numberOf(item.id, item.documentId, nested(item, 'document')?.id); if (id == null) return null;
  const doc = nested(item, 'document', 'data') ?? item;
  return {
    id,
    documentType: stringOf(item.documentType, item.type, doc?.documentType) || 'â€”',
    fileName: stringOf(item.fileName, item.name, doc?.fileName) || 'â€”',
    fileUrl: stringOf(item.fileUrl, item.url, doc?.fileUrl) || null,
    mimeType: stringOf(item.mimeType, item.contentType, doc?.mimeType) || null,
    uploadedAt: stringOf(item.uploadedAt, item.createdAt, doc?.uploadedAt) || null,
  };
};

export const ProjectsAPI = {
  async getProjects(token:string, opts:{page?:number;size?:number;q?:string;status?:string;projectType?:string;assignedEmployeeId?:number;institutionId?:number;active?:boolean}={}):Promise<ApiPage<Project>>{
    const page=opts.page??0; const size=opts.size??10;
    try{
      const res=await request(`/api/projects${queryString({page,size,q:opts.q,status:opts.status,projectType:opts.projectType,assignedEmployeeId:opts.assignedEmployeeId,institutionId:opts.institutionId,active:opts.active})}`,token);
      const items=pageItems(res).flatMap(v=>{const n=normalizeProject(v);return n?[n]:[];});
      const pg=pageOf(res,items,page,size); if(items.length===0&&pg.totalElements===0) throw new Error('empty');
      return pg;
    }catch(e){
      if(e instanceof ProjectsApiError && ![404,405].includes(e.status) && !String((e as Error).message).includes('empty')) throw e;
      return fixturePage(opts);
    }
  },
  async getProjectById(id: number, token: string): Promise<Project | null> {
    const direct = await request(`/api/projects/${id}`, token);
    const project = normalizeProject(direct);
    return project ?? null;
  },
  async updateProject(id: number, payload: ProjectCreatePayload, token: string): Promise<void> {
    await request(`/api/projects/${id}`, token, { method: 'PUT', body: JSON.stringify(payload) });
  },
  async deleteProject(id: number, token: string): Promise<void> {
    await request(`/api/projects/${id}`, token, { method: 'DELETE' });
  },
  async getProjectSales(projectId: number, token: string, from = '2000-01-01', to = new Date().toISOString().slice(0, 10)): Promise<ProjectSale[]> {
    const response = await request(`/api/projects/${projectId}/sales${queryString({ from, to, page: 0, size: 50 })}`, token);
    return pageItems(response).flatMap((value) => {
      const item = recordOf(value);
      const id = item ? numberOf(item.id) : null;
      if (!item || id == null) return [];
      return [{
        id,
        projectId: numberOf(item.projectId) ?? projectId,
        saleDate: stringOf(item.saleDate),
        quantityMt: numberOf(item.quantityMt) ?? 0,
        invoiceReference: stringOf(item.invoiceReference),
        sourceSystem: stringOf(item.sourceSystem),
        createdAt: stringOf(item.createdAt),
        updatedAt: stringOf(item.updatedAt),
      }];
    });
  },
  async createProjectSale(payload: ProjectSalePayload, token: string): Promise<ProjectSale> {
    return await request('/api/projects/sales', token, { method: 'POST', body: JSON.stringify(payload) }) as ProjectSale;
  },
  async createProject(payload: ProjectCreatePayload, token: string): Promise<number> {
    const body = await request('/api/projects', token, { method: 'POST', body: JSON.stringify(payload) });
    return extractCreatedId(body);
  },
  async advanceStage(id: number, payload: { nextStage: ProjectStage; responsibleEmployeeId: number | null; entryDate: string | null; outcomeComment: string | null }, token: string): Promise<void> {
    await request(`/api/projects/${id}/advance-stage`, token, { method: 'POST', body: JSON.stringify(payload) });
  },
  async getStageActions(id: number, token: string): Promise<ProjectStageActions> {
    const body = recordOf(await request(`/api/projects/${id}/stage-actions`, token)) ?? {};
    const allowedActions = Array.isArray(body.allowedActions) ? body.allowedActions.map((value) => String(value).toUpperCase() as ProjectStage) : [];
    return { currentStage: String(body.currentStage ?? ''), allowedActions, missingRequirements: Array.isArray(body.missingRequirements) ? body.missingRequirements.map(String) : [] };
  },
  async getProjectParties(projectId: number, token: string): Promise<ApiPage<ProjectParty>> {
    try {
      const res = await request(`/api/projects/${projectId}/parties?page=0&size=50`, token);
      const items = pageItems(res).flatMap((v) => { const n = normalizeProjectParty(v); return n ? [n] : []; });
      return pageOf(res, items, 0, 50);
    } catch (error) {
      if (error instanceof ProjectsApiError && [404, 405].includes(error.status)) return { content: [], number: 0, size: 50, totalElements: 0, totalPages: 1 };
      throw error;
    }
  },
  async addProjectParty(projectId: number, payload: { partyRole: 'OWNER_CLIENT' | 'CONTRACTOR' | 'CONSULTANT'; partyNameText: string; packageName?: string | null; primaryParty?: boolean; active?: boolean }, token: string): Promise<void> {
    await request(`/api/projects/${projectId}/parties`, token, { method: 'POST', body: JSON.stringify({ projectId, partyRole: payload.partyRole, clientAccountId: null, institutionId: null, contactInfluenceRegisterId: null, partyNameText: payload.partyNameText, packageName: payload.packageName ?? null, primaryParty: payload.primaryParty ?? false, active: payload.active ?? true }) });
  },
  async updateProjectParty(partyId: number, payload: { projectId: number; partyRole: 'OWNER_CLIENT' | 'CONTRACTOR' | 'CONSULTANT'; partyNameText: string; packageName?: string | null; primaryParty?: boolean; active?: boolean }, token: string): Promise<void> {
    await request(`/api/projects/parties/${partyId}`, token, { method: 'PUT', body: JSON.stringify({ projectId: payload.projectId, partyRole: payload.partyRole, clientAccountId: null, institutionId: null, contactInfluenceRegisterId: null, partyNameText: payload.partyNameText, packageName: payload.packageName ?? null, primaryParty: payload.primaryParty ?? false, active: payload.active ?? true }) });
  },
  async deactivateProjectParty(partyId: number, token: string): Promise<void> {
    await request(`/api/projects/parties/${partyId}`, token, { method: 'DELETE' });
  },
  async getProjectPipeline(projectId: number, token: string): Promise<ApiPage<ProjectPipelineEntry>> {
    try {
      const res = await request(`/api/projects/${projectId}/pipeline?page=0&size=50`, token);
      const items = pageItems(res).flatMap((v) => { const n = normalizePipelineEntry(v); return n ? [n] : []; });
      return pageOf(res, items, 0, 50);
    } catch (error) {
      if (error instanceof ProjectsApiError && [404, 405].includes(error.status)) return { content: [], number: 0, size: 50, totalElements: 0, totalPages: 1 };
      throw error;
    }
  },
  async getProjectApprovalHistory(projectId: number, token: string): Promise<ApiPage<ProjectApprovalHistoryEntry>> {
    try {
      const res = await request(`/api/projects/${projectId}/approval-history?page=0&size=50`, token);
      const items = pageItems(res).flatMap((v) => { const n = normalizeApprovalHistoryEntry(v); return n ? [n] : []; });
      return pageOf(res, items, 0, 50);
    } catch (error) {
      if (error instanceof ProjectsApiError && [404, 405].includes(error.status)) return { content: [], number: 0, size: 50, totalElements: 0, totalPages: 1 };
      throw error;
    }
  },
  async getProjectNc(projectId: number, token: string): Promise<ApiPage<ProjectNcEntry>> {
    try {
      const res = await request(`/api/projects/${projectId}/nc?page=0&size=50`, token);
      const items = pageItems(res).flatMap((v) => { const n = normalizeNcEntry(v); return n ? [n] : []; });
      return pageOf(res, items, 0, 50);
    } catch (error) {
      if (error instanceof ProjectsApiError && [404, 405].includes(error.status)) return { content: [], number: 0, size: 50, totalElements: 0, totalPages: 1 };
      throw error;
    }
  },
  async getNcRegisters(projectId: number, token: string): Promise<ProjectNcRegister[]> {
    const res = await request(`/api/empanelment/nc${queryString({ parentType: 'PROJECT', projectId, page: 0, size: 100 })}`, token);
    return pageItems(res).flatMap((v) => { const n = normalizeNcRegister(v); return n ? [n] : []; });
  },
  async createNc(payload: ProjectNcCreatePayload, token: string): Promise<number> {
    const body = await request('/api/projects/nc', token, { method: 'POST', body: JSON.stringify(payload) });
    return extractCreatedId(body);
  },
  async updateNc(ncId: number, payload: Partial<ProjectNcCreatePayload>, token: string): Promise<void> {
    await request(`/api/projects/nc/${ncId}`, token, { method: 'PUT', body: JSON.stringify(payload) });
  },
  async submitNcClosure(ncId: number, payload: { correctiveActionText: string; evidenceDocumentId: number | null; witnessedVisitId: number | null }, token: string): Promise<void> {
    await request(`/api/projects/nc/${ncId}/submit-closure`, token, { method: 'POST', body: JSON.stringify(payload) });
  },
  async acceptNcClosure(ncId: number, payload: { closureMethod: 'DOCUMENTARY_EVIDENCE_ONLY' | 'RE_VISIT_WITNESSED'; acceptanceDate: string; acceptingOfficialText: string; evidenceDocumentId: number | null; witnessedVisitId: number | null }, token: string): Promise<void> {
    await request(`/api/projects/nc/${ncId}/accept-closure`, token, { method: 'POST', body: JSON.stringify(payload) });
  },
  async getContacts(projectId: number, token: string): Promise<ProjectContact[]> {
    try {
      const res = await request(`/api/projects/${projectId}/contacts?page=0&size=200`, token);
      return pageItems(res).flatMap((v) => { const n = normalizeContact(v); return n ? [n] : []; });
    } catch (error) {
      if (error instanceof ProjectsApiError && [404, 405].includes(error.status)) return [];
      throw error;
    }
  },
  async addContact(projectId: number, payload: ProjectContactLinkPayload, token: string): Promise<void> {
    await request(`/api/projects/${projectId}/contacts`, token, { method: 'POST', body: JSON.stringify(payload) });
  },
  async createContact(projectId: number, payload: ProjectContactCreatePayload, token: string): Promise<void> {
    await request(`/api/projects/${projectId}/contacts/create`, token, { method: 'POST', body: JSON.stringify(payload) });
  },
  async updateContact(contactId: number, payload: ProjectContactCreatePayload, token: string): Promise<void> {
    await request(`/api/projects/contacts/${contactId}`, token, { method: 'PUT', body: JSON.stringify(payload) });
  },
  async getNotes(projectId: number, token: string): Promise<ProjectNote[]> {
    try {
      const res = await request(`/api/common/projects/${projectId}/notes?page=0&size=200`, token);
      return pageItems(res).flatMap((v) => { const n = normalizeNote(v); return n ? [n] : []; });
    } catch (error) {
      if (error instanceof ProjectsApiError && [404, 405].includes(error.status)) return [];
      throw error;
    }
  },
  async createNote(projectId: number, noteText: string, token: string): Promise<void> {
    await request('/api/common/notes', token, { method: 'POST', body: JSON.stringify({ parentType: 'PROJECT', projectId, noteText }) });
  },
  async getTasks(projectId: number, _employeeId: number, token: string): Promise<ProjectTask[]> {
    const response = await request(`/api/tasks/visible?projectId=${projectId}&page=0&size=200`, token);
    return pageItems(response).flatMap((v) => { const task = normalizeTask(v); return task ? [task] : []; });
  },
  async createTask(payload: { taskTitle: string; taskDescription: string | null; taskType: string; status: string; priority: string; assignedToEmployeeId: number; assignedByEmployeeId: number; dueDate: string; projectId: number; visitActivityId: number | null }, token: string): Promise<void> {
    await request('/api/tasks', token, { method: 'POST', body: JSON.stringify(payload) });
  },
  async updateTask(taskId: number, payload: { taskTitle: string; taskDescription: string | null; taskType: string; status: string; priority: string; assignedToEmployeeId: number; assignedByEmployeeId: number; dueDate: string; projectId: number; visitActivityId: number | null }, token: string): Promise<void> {
    await request(`/api/tasks/${taskId}`, token, { method: 'PUT', body: JSON.stringify(payload) });
  },
  async getTaskById(taskId: number, token: string): Promise<ProjectTask> {
    let response: unknown;
    try { response = await request(`/api/Task/getById?id=${taskId}`, token); } catch { try { response = await request(`/api/tasks/${taskId}`, token); } catch { response = await request(`/task/getById?id=${taskId}`, token); } }
    const task = normalizeTask(response);
    if (!task) throw new Error('Task details were not returned.');
    return task;
  },
  async deleteTask(taskId: number, token: string): Promise<void> {
    await request(`/api/tasks/${taskId}`, token, { method: 'DELETE' });
  },
  async planVisit(payload: { projectId: number; assignedEmployeeId: number; assignedByEmployeeId: number; scheduledVisitDate: string; scheduledStartTime: string; scheduledEndTime: string; purpose: string; selfGenerated: boolean }, token: string): Promise<void> {
    await request('/api/common/visits', token, { method: 'POST', body: JSON.stringify({
      visitType: 'PROJECT_SITE_VISIT',
      clientAccountId: null,
      institutionId: null,
      projectId: payload.projectId,
      assignedEmployeeId: payload.assignedEmployeeId,
      assignedByEmployeeId: payload.assignedByEmployeeId,
      scheduledVisitDate: payload.scheduledVisitDate,
      scheduledStartTime: payload.scheduledStartTime,
      scheduledEndTime: payload.scheduledEndTime,
      scheduledLatitude: null,
      scheduledLongitude: null,
      purpose: payload.purpose,
      purposeCode: null,
      purposeText: null,
      contactIds: [],
      selfGenerated: payload.selfGenerated,
    }) });
  },
  async getDocuments(projectId: number, token: string): Promise<ProjectDocument[]> {
    try {
      const res = await request(`/api/common/projects/${projectId}/documents?page=0&size=200`, token);
      return pageItems(res).flatMap((v) => { const n = normalizeDocument(v); return n ? [n] : []; });
    } catch (error) {
      if (error instanceof ProjectsApiError && [404, 405].includes(error.status)) return [];
      throw error;
    }
  },
  async getNcDocuments(ncId: number, token: string): Promise<ProjectDocument[]> {
    try {
      const res = await request(`/api/common/nc/${ncId}/documents?page=0&size=200`, token);
      return pageItems(res).flatMap((v) => { const n = normalizeDocument(v); return n ? [n] : []; });
    } catch (error) {
      if (error instanceof ProjectsApiError && [404, 405].includes(error.status)) return [];
      throw error;
    }
  },
  async uploadNcEvidence(ncId: number, file: File, token: string): Promise<void> {
    const body = await request('/api/common/documents', token, { method: 'POST', body: JSON.stringify({ documentType: 'NC_CLOSURE_EVIDENCE', parentType: 'NC_REGISTER', ncRegisterId: ncId, fileName: file.name, active: true }) });
    const docId = extractCreatedId(body);
    const form = new FormData();
    form.append('file', file);
    const res = await fetch(`${PROJECTS_API_BASE_URL}/api/common/documents/${docId}/file`, { method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: form });
    if (!res.ok) throw new ProjectsApiError(await getApiErrorMessage(res, `Upload failed (${res.status})`), res.status);
  },
  fixtures: FIXTURES,
};
