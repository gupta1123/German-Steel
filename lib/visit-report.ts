import type { CommonVisitRow, CommonVisitsPage } from './visits-api.ts';

export const VISIT_REPORT_CATEGORIES = ['Shop', 'Site Visit', 'Architect', 'Engineer', 'Builder', 'Others'] as const;
export type VisitReportCategory = (typeof VISIT_REPORT_CATEGORIES)[number];

type VisitReportSource = Partial<CommonVisitRow> & {
  clientType?: unknown;
  customerType?: unknown;
  type?: unknown;
  customerName?: unknown;
  locationTaluka?: unknown;
  taluka?: unknown;
};

export type VisitReportDetail = {
  category: VisitReportCategory;
  customerName: string;
  customerHref: string | null;
  lastVisited: string;
  city: string;
  taluka: string;
  state: string;
  visitCount: number;
  avgIntentLevel: number;
  avgMonthlySales: number;
};

const text = (value: unknown): string => typeof value === 'string' ? value.trim() : '';
const typeKey = (value: unknown): string => text(value).toUpperCase().replace(/[\s-]+/g, '_');
const positiveId = (value: unknown): number | null => {
  const id = typeof value === 'number' || (typeof value === 'string' && value.trim()) ? Number(value) : NaN;
  return Number.isSafeInteger(id) && id > 0 ? id : null;
};

const categoryForType = (value: unknown): VisitReportCategory | null => {
  switch (typeKey(value)) {
    case 'SHOP': case 'DEALER': case 'DEALER_VISIT': case 'RETAIL': case 'RETAIL_ACCOUNT': return 'Shop';
    case 'SITE': case 'SITE_VISIT': case 'PROJECT': case 'PROJECT_SITE_VISIT': return 'Site Visit';
    case 'ARCHITECT': return 'Architect';
    case 'ENGINEER': return 'Engineer';
    case 'BUILDER': return 'Builder';
    default: return null;
  }
};

const relatedCustomer = (row: VisitReportSource) => {
  const retailId = positiveId(row.clientAccountId);
  const institutionId = positiveId(row.institutionId);
  const projectId = positiveId(row.projectId);
  let kind: 'retail' | 'institution' | 'project' | null = null;
  // The visit's parent type is authoritative; never use the visit ID as a customer ID.
  switch (typeKey(row.visitType)) {
    case 'DEALER_VISIT': kind = 'retail'; break;
    case 'INSTITUTIONAL_VISIT': kind = 'institution'; break;
    case 'PROJECT_SITE_VISIT': kind = 'project'; break;
    default:
      if ([retailId, institutionId, projectId].filter(Boolean).length === 1) {
        kind = retailId ? 'retail' : institutionId ? 'institution' : 'project';
      }
  }
  const id = kind === 'retail' ? retailId : kind === 'institution' ? institutionId : kind === 'project' ? projectId : null;
  const parentName = kind === 'retail' ? row.retailAccountName : kind === 'institution' ? row.institutionName : kind === 'project' ? row.projectName : null;
  const path = kind === 'retail' ? 'customers' : kind === 'institution' ? 'institutions' : 'projects';
  return {
    kind,
    href: kind && id ? `/dashboard/${path}/${id}` : null,
    name: text(parentName) || text(row.customerName) || text(row.parentName) || text(row.storeName)
      || (kind && id ? `${kind === 'retail' ? 'Customer' : kind === 'institution' ? 'Institution' : 'Project'} #${id}` : 'Unknown customer'),
  };
};

export const buildVisitReport = (rows: readonly VisitReportSource[]) => {
  const categorizedVisits = Object.fromEntries(VISIT_REPORT_CATEGORIES.map(category => [category, 0])) as Record<VisitReportCategory, number>;
  const details: VisitReportDetail[] = rows.map(row => {
    const customer = relatedCustomer(row);
    const category = categoryForType(row.clientType) || categoryForType(row.customerType)
      || categoryForType(row.visitType) || categoryForType(row.type)
      || (customer.kind === 'retail' ? 'Shop' : customer.kind === 'project' ? 'Site Visit' : 'Others');
    categorizedVisits[category]++;
    return {
      category,
      customerName: customer.name,
      customerHref: customer.href,
      lastVisited: text(row.actualCheckoutAt) || text(row.actualCheckinAt) || text(row.scheduledVisitDate) || text(row.visit_date),
      city: text(row.locationCity) || text(row.city),
      taluka: text(row.locationTaluka) || text(row.taluka),
      state: text(row.locationState) || text(row.state),
      visitCount: 1,
      avgIntentLevel: 0,
      avgMonthlySales: 0,
    };
  });
  return { categorizedVisits, details };
};

/** Load every page once so category counts and drill-down rows use the same snapshot. */
export const loadVisitReportRows = async (loadPage: (page: number) => Promise<CommonVisitsPage>): Promise<CommonVisitRow[]> => {
  const rows: CommonVisitRow[] = [];
  for (let page = 0; ; page++) {
    const result = await loadPage(page);
    if (result.number !== page) throw new Error('The visit list returned an unexpected page. Please generate the report again.');
    rows.push(...result.content);
    if (result.last || result.content.length === 0) return rows;
  }
};
