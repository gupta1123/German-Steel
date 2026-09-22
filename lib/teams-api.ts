import { getApiErrorMessage } from './api-error.ts';
import { toTitleCase } from './utils.ts';

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
  regionIds: number[];
  teamId: number | null;
  managerId: number | null;
  mobile: string;
  secondaryMobile: string | null;
  email: string;
  department: string;
  state: string;
  country: string;
  addressLine1: string;
  addressLine2: string;
  pincode: string;
  dateOfJoining: string;
  userName: string;
  assignedCity: string[];
  updatePayload: EmployeeUpdatePayload;
}

export interface CrmTeam {
  id: number;
  teamName: string;
  teamCode: string;
  officeManagerId: number | null;
  officeManagerName: string;
  regionIds: number[];
  active: boolean;
  employees: TeamEmployee[];
}

export interface TeamInput {
  teamName: string;
  teamCode: string;
  officeManagerId: number;
  regionIds?: number[];
  active?: boolean;
}

export interface TeamRegion {
  id: number;
  code: string;
  name: string;
  active: boolean;
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
  const mobile = stringOf(item.mobile, item.primaryContact, item.phone);
  const assignedCity = Array.isArray(item.assignedCity)
    ? item.assignedCity.map(String).filter(Boolean)
    : Array.isArray(item.assignedCities)
      ? item.assignedCities.map(String).filter(Boolean)
      : [];
  const regionIds = numberArrayOf(item.regionIds ?? item.regions);

  return {
    id,
    firstName: toTitleCase(stringOf(item.firstName, item.givenName)),
    lastName: toTitleCase(stringOf(item.lastName, item.surname)),
    employeeCode: stringOf(item.employeeCode, item.code),
    city: toTitleCase(stringOf(item.city, item.addressCity)),
    role,
    status: stringOf(item.status) || (active ? 'ACTIVE' : 'INACTIVE'),
    active,
    regionIds,
    teamId: numberOf(item.teamId, team?.id),
    managerId: numberOf(item.managerId, manager?.id),
    mobile,
    secondaryMobile: stringOf(item.secondaryMobile, item.secondaryContact) || null,
    email: stringOf(item.email),
    department: toTitleCase(stringOf(item.department, item.departmentName)),
    state: toTitleCase(stringOf(item.state)),
    country: toTitleCase(stringOf(item.country)),
    addressLine1: stringOf(item.addressLine1),
    addressLine2: stringOf(item.addressLine2),
    pincode: stringOf(item.pincode, item.pinCode),
    dateOfJoining: stringOf(item.dateOfJoining),
    userName: stringOf(item.userName, item.username, recordOf(item.userDto)?.username),
    assignedCity,
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
      regionIds,
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
    teamName: toTitleCase(stringOf(item.teamName, item.name)) || `Team ${id}`,
    teamCode: stringOf(item.teamCode, item.code),
    officeManagerId,
    officeManagerName: toTitleCase(stringOf(
      item.officeManagerName,
      item.managerName,
      [stringOf(manager?.firstName), stringOf(manager?.lastName)].filter(Boolean).join(' '),
    )),
    regionIds: numberArrayOf(item.regionIds ?? item.regions),
    active: booleanOf(true, item.active, item.isActive),
    employees: (embeddedEmployees ?? []).flatMap((employee) => {
      const normalized = normalizeEmployee(employee);
      return normalized ? [normalized] : [];
    }),
  };
};

  // Paginated helpers — do not fetch every page for table render
  const getPageMeta = (value: unknown, fallbackSize: number) => {
    const src = sourceRecord(value);
    const totalElements = numberOf(src?.totalElements, src?.total) ?? 0;
    const totalPages = numberOf(src?.totalPages) ?? Math.max(1, Math.ceil(totalElements / Math.max(1, fallbackSize)));
    const number = numberOf(src?.number, src?.page) ?? 0;
    const size = numberOf(src?.size) ?? fallbackSize;
    return { totalElements, totalPages, number, size };
  };

export const teamsApi = {
  async getRegions(token: string): Promise<TeamRegion[]> {
    const values = await fetchAllPages(
      (page) => `/api/common/regions?page=${page}&size=${PAGE_SIZE}`,
      token,
    );
    return values.flatMap((value) => {
      const item = recordOf(value);
      const id = numberOf(item?.id, item?.regionId);
      if (id == null) return [];
      return [{
        id,
        code: stringOf(item?.code, item?.regionCode),
        name: stringOf(item?.name, item?.regionName) || `Region ${id}`,
        active: booleanOf(true, item?.active, item?.isActive),
      }];
    });
  },
  async getEmployeeById(token: string, employeeId: number): Promise<TeamEmployee> {
    const data = await request(`/api/common/employees/${employeeId}`, token);
    const record = sourceRecord(data) ?? recordOf(data);
    // Response may be a single employee object directly or wrapped in data/content
    const candidate = record && (record.id != null || record.employeeId != null) ? record : recordOf(pageItems(data)[0]);
    const normalized = candidate ? normalizeEmployee(candidate) : null;
    if (!normalized) throw new TeamsApiError(`Employee ${employeeId} not found`, 404);
    return normalized;
  },

  // Legacy bulk fetch — kept for non-paginated consumers; new pages should use paginated variants below
  async getEmployees(token: string): Promise<TeamEmployee[]> {
    return (await fetchAllPages(
      (page) => `/api/common/employees?active=true&page=${page}&size=${PAGE_SIZE}`,
      token,
    )).flatMap((value) => {
      const employee = normalizeEmployee(value);
      return employee ? [employee] : [];
    });
  },

  async getEmployeesPage(token: string, opts: { active?: boolean; page?: number; size?: number; q?: string; role?: string; status?: string; regionId?: number; teamId?: number; managerId?: number } = {}): Promise<{ content: TeamEmployee[]; totalElements: number; totalPages: number; number: number; size: number }> {
    const page = opts.page ?? 0; const size = opts.size ?? 50;
    const params = new URLSearchParams({ page: String(page), size: String(size) });
    if (opts.active !== undefined) params.set('active', String(opts.active));
    if (opts.q) params.set('q', opts.q);
    if (opts.role) params.set('role', opts.role);
    if (opts.status) params.set('status', opts.status);
    if (opts.regionId) params.set('regionId', String(opts.regionId));
    if (opts.teamId) params.set('teamId', String(opts.teamId));
    if (opts.managerId) params.set('managerId', String(opts.managerId));
    const data = await request(`/api/common/employees?${params.toString()}`, token);
    const content = pageItems(data).flatMap((v) => { const e = normalizeEmployee(v); return e ? [e] : []; });
    const meta = getPageMeta(data, size);
    return { content, ...meta };
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

  async getTeamsPage(token: string, opts: { q?: string; officeManagerId?: number; active?: boolean; page?: number; size?: number } = {}): Promise<{ content: CrmTeam[]; totalElements: number; totalPages: number; number: number; size: number }> {
    const page = opts.page ?? 0; const size = opts.size ?? 50;
    const params = new URLSearchParams({ page: String(page), size: String(size) });
    if (opts.q) params.set('q', opts.q);
    if (opts.officeManagerId) params.set('officeManagerId', String(opts.officeManagerId));
    if (opts.active !== undefined) params.set('active', String(opts.active));
    const data = await request(`/api/common/teams?${params.toString()}`, token);
    const content = pageItems(data).flatMap((v) => { const t = normalizeTeam(v); return t ? [t] : []; });
    const meta = getPageMeta(data, size);
    // Preserve server pagination meta; do not hydrate employees here — callers fetch members per team via getTeamEmployeesPage
    return { content, ...meta };
  },

  async getTeamEmployeesPage(token: string, teamId: number, opts: { page?: number; size?: number } = {}): Promise<{ content: TeamEmployee[]; totalElements: number; totalPages: number; number: number; size: number }> {
    const page = opts.page ?? 0; const size = opts.size ?? 50;
    const data = await request(`/api/common/teams/${teamId}/employees?active=true&page=${page}&size=${size}`, token);
    const content = pageItems(data).flatMap((v) => { const e = normalizeEmployee(v); return e ? [e] : []; });
    const meta = getPageMeta(data, size);
    return { content, ...meta };
  },

  async createTeam(token: string, input: TeamInput): Promise<CrmTeam> {
    const response = await request('/api/common/teams', token, {
      method: 'POST',
      body: JSON.stringify(input),
    });
    const team = normalizeTeam(sourceRecord(response) ?? response);
    if (!team) throw new TeamsApiError('The server created the team but returned an invalid response.', 500);
    return team;
  },

  async updateTeam(token: string, teamId: number, input: TeamInput): Promise<void> {
    await request(`/api/common/teams/${teamId}`, token, {
      method: 'PUT',
      body: JSON.stringify(input),
    });
  },

  async updateTeamSupervisor(token: string, teamId: number, officeManagerId: number): Promise<void> {
    await request(`/api/common/teams/${teamId}/supervisor`, token, {
      method: 'PUT',
      body: JSON.stringify({ officeManagerId }),
    });
  },

  async clearTeamSupervisor(token: string, teamId: number): Promise<void> {
    await request(`/api/common/teams/${teamId}/supervisor`, token, { method: 'DELETE' });
  },

  async getTeamRegions(token: string, teamId: number): Promise<TeamRegion[]> {
    const data = await request(`/api/common/teams/${teamId}/regions`, token);
    return pageItems(data).length > 0 ? pageItems(data).flatMap((value) => {
      const item = recordOf(value); const id = numberOf(item?.id, item?.regionId);
      return id == null ? [] : [{ id, code: stringOf(item?.code), name: stringOf(item?.name) || `Region ${id}`, active: booleanOf(true, item?.active) }];
    }) : (Array.isArray(data) ? data : []).flatMap((value) => {
      const item = recordOf(value); const id = numberOf(item?.id, item?.regionId);
      return id == null ? [] : [{ id, code: stringOf(item?.code), name: stringOf(item?.name) || `Region ${id}`, active: booleanOf(true, item?.active) }];
    });
  },

  async updateTeamRegions(token: string, teamId: number, regionIds: number[]): Promise<void> {
    await request(`/api/common/teams/${teamId}/regions`, token, {
      method: 'PUT',
      body: JSON.stringify({ regionIds }),
    });
  },

  async addTeamEmployee(token: string, teamId: number, employeeId: number): Promise<void> {
    await request(`/api/common/teams/${teamId}/employees/${employeeId}`, token, { method: 'PUT' });
  },

  async removeTeamEmployee(token: string, teamId: number, employeeId: number): Promise<void> {
    await request(`/api/common/teams/${teamId}/employees/${employeeId}`, token, { method: 'DELETE' });
  },

  async updateEmployeeRegions(token: string, employeeId: number, regionIds: number[]): Promise<void> {
    await request(`/api/common/employees/${employeeId}/regions`, token, {
      method: 'PUT',
      body: JSON.stringify({ regionIds }),
    });
  },

  async deleteTeam(token: string, teamId: number): Promise<void> {
    await request(`/api/common/teams/${teamId}`, token, { method: 'DELETE' });
  },

  async updateEmployeeTeam(token: string, employee: TeamEmployee, teamId: number | null, managerId?: number | null): Promise<void> {
    // Guide 5.8: PUT is patch-style - send only teamId after backend confirms partial validation.
    // Keep fallback to full payload if server requires it (backward compat).
    try {
      await request(`/api/common/employees/${employee.id}`, token, {
        method: 'PUT',
        body: JSON.stringify({ teamId, ...(managerId !== undefined ? { managerId } : {}) }),
      });
    } catch (error) {
      if (error instanceof TeamsApiError && error.status === 400) {
        await request(`/api/common/employees/${employee.id}`, token, {
          method: 'PUT',
          body: JSON.stringify({ ...employee.updatePayload, teamId, ...(managerId !== undefined ? { managerId } : {}) }),
        });
        return;
      }
      throw error;
    }
  },
};
