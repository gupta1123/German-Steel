export type EmployeeRoleCategory = 'admin' | 'field-officer' | 'regional-manager' | 'other';

const normalizeEmployeeRoleValue = (role: unknown) =>
  String(role ?? '')
    .trim()
    .toLowerCase()
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ');

export const getEmployeeRoleCategory = (role: unknown): EmployeeRoleCategory => {
  const normalizedRole = normalizeEmployeeRoleValue(role);

  if (normalizedRole === 'admin' || normalizedRole === 'role admin') return 'admin';
  if (normalizedRole.includes('field officer')) return 'field-officer';
  if (normalizedRole.includes('manager')) return 'regional-manager';
  return 'other';
};

export const getEmployeeRoleLabel = (role: unknown): string => {
  const category = getEmployeeRoleCategory(role);

  if (category === 'admin') return 'Admin';
  if (category === 'field-officer') return 'Field Officer';
  if (category === 'regional-manager') return 'Regional Manager';

  const fallback = String(role ?? '').trim();
  return fallback || 'Employee';
};

export const isAdminEmployeeRole = (role: unknown) => getEmployeeRoleCategory(role) === 'admin';

/** Match the employee form's option values, not their display labels. */
export const getEmployeeRoleFormValue = (role: unknown): string => {
  const category = getEmployeeRoleCategory(role);
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
