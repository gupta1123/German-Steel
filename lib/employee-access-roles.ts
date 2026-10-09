export interface EmployeeAccessRole {
  employeeRole: string;
  displayName: string;
  accessDescription: string;
}

export function normalizeFieldOfficerRoles(response: unknown): EmployeeAccessRole[] {
  const body = response as { content?: unknown[] } | null;
  const items = Array.isArray(response) ? response : Array.isArray(body?.content) ? body.content : [];
  const roles = items.flatMap(value => {
    if (!value || typeof value !== 'object') return [];
    const item = value as Record<string, unknown>;
    const employeeRole = typeof item.employeeRole === 'string' ? item.employeeRole.trim() : '';
    if (item.active === false || !employeeRole.endsWith('_FE')) return [];
    return [{ employeeRole, displayName: typeof item.displayName === 'string' && item.displayName.trim() ? item.displayName.trim() : employeeRole, accessDescription: typeof item.accessDescription === 'string' ? item.accessDescription : '' }];
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
