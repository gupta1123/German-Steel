import { getApiErrorMessage } from '@/lib/api-error';

const ALLOWANCE_API_BASE_URL = 'http://ec2-18-211-58-135.compute-1.amazonaws.com:8081';
const PAGE_SIZE = 500;

type EmployeeUpdatePayload = Record<string, unknown>;

export interface AllowanceEmployee {
  id: number;
  firstName: string;
  lastName: string;
  role: string;
  travelAllowance: number;
  dearnessAllowance: number;
  fullMonthSalary: number;
  updatePayload: EmployeeUpdatePayload;
}

export interface AllowanceTravelRate {
  id: number | null;
  employeeId: number;
  carRatePerKm: number;
  bikeRatePerKm: number;
  effectiveFrom: string;
  effectiveTo: string | null;
}

export class AllowanceApiError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = 'AllowanceApiError';
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
  const response = await fetch(`${ALLOWANCE_API_BASE_URL}${path}`, {
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
    throw new AllowanceApiError(
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

const numberArrayOf = (value: unknown): number[] => (
  Array.isArray(value)
    ? value.flatMap((item) => {
      const numericValue = numberOf(item, recordOf(item)?.id);
      return numericValue == null ? [] : [numericValue];
    })
    : []
);

const normalizeEmployee = (value: unknown): AllowanceEmployee | null => {
  const item = recordOf(value);
  if (!item) return null;
  const id = numberOf(item.id, item.employeeId);
  if (id == null) return null;
  const designation = nested(item, 'designation');
  const manager = nested(item, 'manager');
  const team = nested(item, 'team');
  const role = stringOf(item.role, item.employeeRole, item.roleName, designation?.name);

  return {
    id,
    firstName: stringOf(item.firstName, item.givenName),
    lastName: stringOf(item.lastName, item.surname),
    role,
    travelAllowance: numberOf(item.travelAllowance) ?? 0,
    dearnessAllowance: numberOf(item.dearnessAllowance) ?? 0,
    fullMonthSalary: numberOf(item.fullMonthSalary, item.monthlySalary, item.baseSalary) ?? 0,
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
      status: item.status ?? (booleanOf(true, item.active, item.isActive) ? 'ACTIVE' : 'INACTIVE'),
      active: booleanOf(true, item.active, item.isActive),
    },
  };
};

const normalizeTravelRate = (value: unknown, employeeId: number): AllowanceTravelRate | null => {
  const item = sourceRecord(value);
  if (!item) return null;
  const carRatePerKm = numberOf(item.carRatePerKm, item.carRate);
  const bikeRatePerKm = numberOf(item.bikeRatePerKm, item.bikeRate);
  if (carRatePerKm == null && bikeRatePerKm == null) return null;

  return {
    id: numberOf(item.id, item.travelRateId),
    employeeId: numberOf(item.employeeId) ?? employeeId,
    carRatePerKm: carRatePerKm ?? 0,
    bikeRatePerKm: bikeRatePerKm ?? 0,
    effectiveFrom: stringOf(item.effectiveFrom),
    effectiveTo: stringOf(item.effectiveTo) || null,
  };
};

const localDate = (): string => {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

export const allowanceApi = {
  async getEmployees(token: string): Promise<AllowanceEmployee[]> {
    return (await fetchAllPages(
      (page) => `/api/common/employees?active=true&page=${page}&size=${PAGE_SIZE}`,
      token,
    )).flatMap((value) => {
      const employee = normalizeEmployee(value);
      return employee ? [employee] : [];
    });
  },

  async getEffectiveTravelRates(
    token: string,
    employees: AllowanceEmployee[],
    onDate = localDate(),
  ): Promise<AllowanceTravelRate[]> {
    const rates = await Promise.all(employees.map(async (employee) => {
      try {
        const response = await request(
          `/api/hr/salary/travel-rates/effective?employeeId=${employee.id}&onDate=${onDate}`,
          token,
        );
        return normalizeTravelRate(response, employee.id);
      } catch (error) {
        if (
          error instanceof AllowanceApiError &&
          (error.status === 404 || /not found/i.test(error.message))
        ) return null;
        throw error;
      }
    }));
    return rates.flatMap((rate) => rate ? [rate] : []);
  },

  async updateEmployeeCompensation(
    token: string,
    employee: AllowanceEmployee,
    values: { travelAllowance: number; dearnessAllowance: number; fullMonthSalary: number },
  ): Promise<void> {
    await request(`/api/common/employees/${employee.id}`, token, {
      method: 'PUT',
      body: JSON.stringify({ ...employee.updatePayload, ...values }),
    });
  },

  async saveTravelRate(
    token: string,
    employeeId: number,
    values: { carRatePerKm: number; bikeRatePerKm: number },
    hasExistingRate: boolean,
    effectiveFrom = localDate(),
  ): Promise<AllowanceTravelRate> {
    const response = await request(
      hasExistingRate
        ? `/api/hr/salary/travel-rates/by-employee/${employeeId}/effective-change`
        : '/api/hr/salary/travel-rates',
      token,
      {
        method: 'POST',
        body: JSON.stringify({
          ...(hasExistingRate ? {} : { employeeId }),
          ...values,
          effectiveFrom,
          effectiveTo: null,
        }),
      },
    );

    return normalizeTravelRate(response, employeeId) ?? {
      id: null,
      employeeId,
      ...values,
      effectiveFrom,
      effectiveTo: null,
    };
  },
};
