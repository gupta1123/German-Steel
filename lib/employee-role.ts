export type EmployeeRoleCategory = 'admin' | 'field-officer' | 'regional-manager' | 'other';

const normalizeEmployeeRoleValue = (role: unknown) =>
  String(role ?? '')
    .trim()
    .toLowerCase()
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ');

export const getEmployeeRoleCategory = (role: unknown): EmployeeRoleCategory => {
  const normalizedRole = normalizeEmployeeRoleValue(role);

  if (
    normalizedRole === 'admin' ||
    normalizedRole === 'role admin' ||
    normalizedRole === 'ho admin'
  ) return 'admin';
  if (
    normalizedRole.includes('field officer') ||
    normalizedRole === 'retail fe' ||
    normalizedRole === 'institution project fe' ||
    normalizedRole === 'dual fe' ||
    ['empanelment fe', 'project fe', 'retail empanelment fe', 'retail project fe'].includes(normalizedRole)
  ) return 'field-officer';
  if (
    normalizedRole.includes('manager') ||
    normalizedRole === 'zonal supervisor'
  ) return 'regional-manager';
  return 'other';
};

export const getEmployeeRoleLabel = (role: unknown): string => {
  const category = getEmployeeRoleCategory(role);

  if (category === 'admin') return 'Admin';
  if (category === 'field-officer') return 'Field Officer';
  if (category === 'regional-manager') return 'Supervisor';

  const fallback = String(role ?? '').trim();
  return fallback || 'Employee';
};

const FULL_ROLE_LABELS: Record<string, string> = {
  RETAIL_FE: 'Field Executive (Retail)',
  EMPANELMENT_FE: 'Field Executive (Institution)',
  PROJECT_FE: 'Field Executive (Project)',
  RETAIL_EMPANELMENT_FE: 'Field Executive (Retail + Institution)',
  RETAIL_PROJECT_FE: 'Field Executive (Retail + Project)',
  INSTITUTION_PROJECT_FE: 'Field Executive (Institution + Project)',
  DUAL_FE: 'Field Executive (Retail + Institution + Project)',
  ZONAL_SUPERVISOR: 'Zonal Supervisor',
  MANAGER: 'Manager',
  HO_ADMIN: 'Head Office Admin',
};

/** Exact role for display in lists; falls back to the broad label for unknown values. */
export const getEmployeeFullRoleLabel = (role: unknown): string => {
  const code = String(role ?? '').trim().toUpperCase().replace(/^ROLE[_\s-]+/, '').replace(/[\s-]+/g, '_');
  return FULL_ROLE_LABELS[code] ?? getEmployeeRoleLabel(role);
};

export const isAdminEmployeeRole = (role: unknown) => getEmployeeRoleCategory(role) === 'admin';

/** Match the employee form's option values, not their display labels. */
export const getEmployeeRoleFormValue = (role: unknown): string => {
  const category = getEmployeeRoleCategory(role);
  const normalized = String(role ?? '').trim().toUpperCase().replace(/^ROLE[_\s-]+/, '').replace(/[\s-]+/g, '_');
  if (normalized === 'ZONAL_SUPERVISOR') return 'Supervisor';
  if (category === 'regional-manager') return 'Manager';
  if (category === 'field-officer') return 'Field Officer';
  // Do not silently reassign an unsupported or missing role.
  return String(role ?? '').trim();
};

/** Account roles can identify an admin even when the employee job role is blank. */
export const isAdminEmployee = (employee: { role?: unknown; userDto?: { roles?: unknown } | null }) => {
  const roles = [employee.role, employee.userDto?.roles].flatMap(value =>
    Array.isArray(value) ? value : String(value ?? '').split(/[,;|]/));
  return roles.some(isAdminEmployeeRole);
};
