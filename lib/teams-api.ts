import { getApiErrorMessage } from '@/lib/api-error';

const TEAMS_API_BASE_URL = 'http://ec2-18-211-58-135.compute-1.amazonaws.com:8081';
const PAGE_SIZE = 500;

type EmployeeUpdatePayload = Record<string, unknown>;

export interface TeamEmployee {
  id: number;
  firstName: string;
  lastName: string;
  employeeCode: string;
  city: string;
  role: string;
  status: string;
  active: boolean;
  teamId: number | null;
  managerId: number | null;
  updatePayload: EmployeeUpdatePayload;
}

export interface CrmTeam {
  id: number;
  teamName: string;
  teamCode: string;
  officeManagerId: number | null;
  officeManagerName: string;
  employees: TeamEmployee[];
}

export interface TeamInput {
  teamName: string;
  teamCode: string;
  officeManagerId: number;
}

export class TeamsApiError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = 'TeamsApiError';
    this.status = status;
  }
}

const recordOf = (value: unknown): Record<string, unknown> | null => (
  value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null
);

const nested = (record: Record<string, unknown> | null, ...keys: string[]) => {
  for (const key of keys) {
    const value = recordOf(record?.[key]);
    if (value) return value;
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

const numberOf = (...values: unknown[]): number | null => {
  for (const value of values) {
    if (typeof value === 'number' && Number.isFinite(value)) return value;
    if (typeof value === 'string' && value.trim() && Number.isFinite(Number(value))) {
      return Number(value);
    }
  }
  return null;
};

const booleanOf = (fallback: boolean, ...values: unknown[]): boolean => {
  for (const value of values) {
    if (typeof value === 'boolean') return value;
    if (value === 'true' || value === 1) return true;
    if (value === 'false' || value === 0) return false;
  }
  return fallback;
};

const sourceRecord = (value: unknown): Record<string, unknown> | null => {
  const outer = recordOf(value);
  const data = recordOf(outer?.data);
  return data ?? outer;
};

const pageItems = (value: unknown): unknown[] => {
  if (Array.isArray(value)) return value;
  const source = sourceRecord(value);
  if (!source) return [];
  if (Array.isArray(source.content)) return source.content;
  if (Array.isArray(source.data)) return source.data;
  if (Array.isArray(source.items)) return source.items;
  if (Array.isArray(source.results)) return source.results;
  return [];
};

const pageCount = (value: unknown): number => {
  const source = sourceRecord(value);
  return Math.max(1, numberOf(source?.totalPages, source?.pageCount) ?? 1);
};

const numberArrayOf = (value: unknown): number[] => (
  Array.isArray(value)
    ? value.flatMap((item) => {
      const numericValue = numberOf(item, recordOf(item)?.id);
      return numericValue == null ? [] : [numericValue];
    })
    : []
);

const readResponseBody = async (response: Response): Promise<unknown> => {
  if (response.status === 204) return undefined;
  const text = (await response.text()).trim();
  if (!text) return undefined;
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return text;
  }
};

const request = async (
  path: string,
  token: string,
  init: RequestInit = {},
): Promise<unknown> => {
  const response = await fetch(`${TEAMS_API_BASE_URL}${path}`, {
    ...init,
    cache: 'no-store',
    headers: {
      Accept: 'application/json',
      Authorization: `Bearer ${token}`,
      ...(init.body ? { 'Content-Type': 'application/json' } : {}),
      ...init.headers,
    },
  });

  if (!response.ok) {
    throw new TeamsApiError(
      await getApiErrorMessage(response, `Request failed (${response.status})`),
      response.status,
    );
  }

  return readResponseBody(response);
};

const fetchAllPages = async (
  buildPath: (page: number) => string,
  token: string,
): Promise<unknown[]> => {
  const first = await request(buildPath(0), token);
  const totalPages = pageCount(first);
  if (totalPages === 1) return pageItems(first);
  const remaining = await Promise.all(
    Array.from({ length: totalPages - 1 }, (_, index) => request(buildPath(index + 1), token)),
  );
  return [first, ...remaining].flatMap(pageItems);
};

const normalizeEmployee = (value: unknown): TeamEmployee | null => {
  const item = recordOf(value);
  if (!item) return null;
  const id = numberOf(item.id, item.employeeId);
  if (id == null) return null;
  const designation = nested(item, 'designation');
  const manager = nested(item, 'manager');
  const team = nested(item, 'team');
  const role = stringOf(item.role, item.employeeRole, item.roleName, designation?.name);
  const active = booleanOf(true, item.active, item.isActive);

  return {
    id,
    firstName: stringOf(item.firstName, item.givenName),
    lastName: stringOf(item.lastName, item.surname),
    employeeCode: stringOf(item.employeeCode, item.code),
    city: stringOf(item.city, item.addressCity),
    role,
    status: stringOf(item.status) || (active ? 'ACTIVE' : 'INACTIVE'),
    active,
    teamId: numberOf(item.teamId, team?.id),
    managerId: numberOf(item.managerId, manager?.id),
    updatePayload: {
      employeeCode: item.employeeCode ?? null,
      firstName: item.firstName ?? item.givenName ?? '',
      lastName: item.lastName ?? item.surname ?? '',
      mobile: item.mobile ?? '',
      secondaryMobile: item.secondaryMobile ?? null,
      email: item.email ?? null,
      role,
      managerId: numberOf(item.managerId, manager?.id),
      teamId: numberOf(item.teamId, team?.id),
      designationId: numberOf(item.designationId, designation?.id),
      regionIds: numberArrayOf(item.regionIds ?? item.regions),
      department: item.department ?? null,
      houseLatitude: numberOf(item.houseLatitude, item.homeLatitude),
      houseLongitude: numberOf(item.houseLongitude, item.homeLongitude),
      addressLine1: item.addressLine1 ?? null,
      addressLine2: item.addressLine2 ?? null,
      city: item.city ?? null,
      state: item.state ?? null,
      country: item.country ?? null,
      pincode: item.pincode ?? item.pinCode ?? null,
      officeManager: booleanOf(false, item.officeManager, item.isOfficeManager),
      travelAllowance: numberOf(item.travelAllowance) ?? 0,
      dearnessAllowance: numberOf(item.dearnessAllowance) ?? 0,
      fullMonthSalary: numberOf(item.fullMonthSalary, item.monthlySalary, item.baseSalary) ?? 0,
      dateOfJoining: item.dateOfJoining ?? null,
      status: item.status ?? (active ? 'ACTIVE' : 'INACTIVE'),
      active,
    },
  };
};

const normalizeTeam = (value: unknown): CrmTeam | null => {
  const item = recordOf(value);
  if (!item) return null;
  const id = numberOf(item.id, item.teamId);
  if (id == null) return null;
  const manager = nested(item, 'officeManager', 'manager');
  const officeManagerId = numberOf(item.officeManagerId, item.managerId, manager?.id);
  const embeddedEmployees = [item.employees, item.teamEmployees, item.members]
    .find(Array.isArray) as unknown[] | undefined;

  return {
    id,
    teamName: stringOf(item.teamName, item.name) || `Team ${id}`,
    teamCode: stringOf(item.teamCode, item.code),
    officeManagerId,
    officeManagerName: stringOf(
      item.officeManagerName,
      item.managerName,
      [stringOf(manager?.firstName), stringOf(manager?.lastName)].filter(Boolean).join(' '),
    ),
    employees: (embeddedEmployees ?? []).flatMap((employee) => {
      const normalized = normalizeEmployee(employee);
      return normalized ? [normalized] : [];
    }),
  };
};

export const teamsApi = {
  async getEmployees(token: string): Promise<TeamEmployee[]> {
    return (await fetchAllPages(
      (page) => `/api/common/employees?active=true&page=${page}&size=${PAGE_SIZE}`,
      token,
    )).flatMap((value) => {
      const employee = normalizeEmployee(value);
      return employee ? [employee] : [];
    });
  },

  async getTeams(token: string): Promise<CrmTeam[]> {
    const teams = (await fetchAllPages(
      (page) => `/api/common/teams?page=${page}&size=${PAGE_SIZE}`,
      token,
    )).flatMap((value) => {
      const team = normalizeTeam(value);
      return team ? [team] : [];
    });

    const members = await Promise.all(teams.map((team) => fetchAllPages(
      (page) => `/api/common/teams/${team.id}/employees?active=true&page=${page}&size=${PAGE_SIZE}`,
      token,
    )));

    return teams.map((team, index) => ({
      ...team,
      employees: members[index].flatMap((value) => {
        const employee = normalizeEmployee(value);
        return employee ? [employee] : [];
      }),
    }));
  },

  async createTeam(token: string, input: TeamInput): Promise<void> {
    await request('/api/common/teams', token, {
      method: 'POST',
      body: JSON.stringify(input),
    });
  },

  async updateTeam(token: string, teamId: number, input: TeamInput): Promise<void> {
    await request(`/api/common/teams/${teamId}`, token, {
      method: 'PUT',
      body: JSON.stringify(input),
    });
  },

  async updateEmployeeTeam(token: string, employee: TeamEmployee, teamId: number | null): Promise<void> {
    await request(`/api/common/employees/${employee.id}`, token, {
      method: 'PUT',
      body: JSON.stringify({ ...employee.updatePayload, teamId }),
    });
  },
};
