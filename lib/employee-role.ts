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
