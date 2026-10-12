export interface EmployeeAccessRole {
  employeeRole: string;
  displayName: string;
  accessDescription: string;
}

// The backend role master still says "Empanelment", "Institutional/Projects" and "/" separators.
// The product term is "Institution", so labels are normalised here.
export const FIELD_EXECUTIVE_ROLE_LABELS: Record<string, string> = {
  RETAIL_FE: 'Field Executive (Retail)',
  EMPANELMENT_FE: 'Field Executive (Institution)',
  PROJECT_FE: 'Field Executive (Project)',
  RETAIL_EMPANELMENT_FE: 'Field Executive (Retail + Institution)',
  RETAIL_PROJECT_FE: 'Field Executive (Retail + Project)',
  INSTITUTION_PROJECT_FE: 'Field Executive (Institution + Project)',
  DUAL_FE: 'Field Executive (Retail + Institution + Project)',
};

export const FIELD_EXECUTIVE_ROLE_DESCRIPTIONS: Record<string, string> = {
  RETAIL_FE: 'Retail accounts and visits in own zone.',
  EMPANELMENT_FE: 'Assigned institution accounts and visits.',
  PROJECT_FE: 'Assigned project accounts and visits.',
  RETAIL_EMPANELMENT_FE: 'Retail accounts and visits in own zone, plus assigned institution accounts and visits.',
  RETAIL_PROJECT_FE: 'Retail accounts and visits in own zone, plus assigned project accounts and visits.',
  INSTITUTION_PROJECT_FE: 'Assigned institution and project accounts and visits.',
  DUAL_FE: 'Retail, institution and project accounts and visits in own zone.',
};

export function normalizeFieldOfficerRoles(response: unknown): EmployeeAccessRole[] {
  const body = response as { content?: unknown[] } | null;
  const items = Array.isArray(response) ? response : Array.isArray(body?.content) ? body.content : [];
  const roles = items.flatMap(value => {
    if (!value || typeof value !== 'object') return [];
    const item = value as Record<string, unknown>;
    const employeeRole = typeof item.employeeRole === 'string' ? item.employeeRole.trim() : '';
    if (item.active === false || !employeeRole.endsWith('_FE')) return [];
    return [{ employeeRole, displayName: FIELD_EXECUTIVE_ROLE_LABELS[employeeRole] ?? (typeof item.displayName === 'string' && item.displayName.trim() ? item.displayName.trim() : employeeRole), accessDescription: FIELD_EXECUTIVE_ROLE_DESCRIPTIONS[employeeRole] ?? (typeof item.accessDescription === 'string' ? item.accessDescription : '') }];
  });
  return [...new Map(roles.map(role => [role.employeeRole, role])).values()];
}

export async function fetchFieldOfficerRoles(baseUrl: string, token: string, signal?: AbortSignal): Promise<EmployeeAccessRole[]> {
  const items: EmployeeAccessRole[] = [];
  let totalPages = 1;
  for (let page = 0; page < totalPages; page++) {
    const response = await fetch(`${baseUrl}/api/access-control/roles?page=${page}&size=100`, { headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' }, signal });
    if (!response.ok) throw new Error(`Unable to load roles (${response.status}).`);
    const body = await response.json();
    items.push(...normalizeFieldOfficerRoles(body));
    if (page === 0 && Number.isInteger(body?.totalPages) && body.totalPages > 0) totalPages = body.totalPages;
  }
  return [...new Map(items.map(role => [role.employeeRole, role])).values()];
}
