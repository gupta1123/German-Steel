import { getEmployeeFullRoleLabel, getEmployeeRoleCategory, getEmployeeRoleLabel, isAdminEmployee } from './employee-role.ts';

export type EmployeeListRoleFilter = 'all' | 'regional-manager' | 'field-officer';

interface EmployeeListRecord {
  id: number;
  firstName?: string | null;
  lastName?: string | null;
  role?: string | null;
  email?: string | null;
  city?: string | null;
  state?: string | null;
  department?: string | null;
  departmentName?: string | null;
  userName?: string | null;
  userDto?: { roles?: unknown } | null;
}

interface EmployeeListOptions<T> {
  query?: string;
  roleFilter?: EmployeeListRoleFilter;
  sortColumn?: keyof T;
  sortDirection?: 'asc' | 'desc';
  page?: number;
  pageSize?: number;
}

const collator = new Intl.Collator('en', { sensitivity: 'base', numeric: true });
const positiveInteger = (value: number | undefined, fallback: number) =>
  value != null && Number.isFinite(value) && value >= 1 ? Math.floor(value) : fallback;

/** Filter and sort the complete scoped directory before counting or slicing it. */
export function getEmployeeListPage<T extends EmployeeListRecord>(
  employees: readonly T[],
  options: EmployeeListOptions<T> = {},
) {
  const query = options.query?.trim().toLowerCase() ?? '';
  const roleFilter = options.roleFilter ?? 'all';
  const sortColumn = options.sortColumn ?? 'firstName';
  const direction = options.sortDirection === 'desc' ? -1 : 1;
  const pageSize = positiveInteger(options.pageSize, 10);
  const uniqueEmployees = [...new Map(employees.map(employee => [employee.id, employee])).values()];
  const matchingEmployees = uniqueEmployees.filter(employee => {
    if (isAdminEmployee(employee)) return false;
    if (roleFilter !== 'all' && getEmployeeRoleCategory(employee.role) !== roleFilter) return false;
    if (!query) return true;
    return [
      `${employee.firstName ?? ''} ${employee.lastName ?? ''}`,
      employee.email, employee.userName, employee.role,
      getEmployeeRoleLabel(employee.role), getEmployeeFullRoleLabel(employee.role),
      employee.departmentName, employee.department, employee.city, employee.state,
    ].filter(Boolean).join(' ').toLowerCase().includes(query);
  }).sort((a, b) => {
    const left = a[sortColumn];
    const right = b[sortColumn];
    const comparison = typeof left === 'number' && typeof right === 'number'
      ? left - right
      : collator.compare(String(left ?? ''), String(right ?? ''));
    return comparison * direction || a.id - b.id;
  });

  const totalElements = matchingEmployees.length;
  const totalPages = Math.max(1, Math.ceil(totalElements / pageSize));
  const page = Math.min(positiveInteger(options.page, 1), totalPages);
  const start = (page - 1) * pageSize;
  return { content: matchingEmployees.slice(start, start + pageSize), totalElements, totalPages, page };
}
