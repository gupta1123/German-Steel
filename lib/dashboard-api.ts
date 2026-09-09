import { getApiErrorMessage } from '@/lib/api-error';

const DASHBOARD_API_BASE_URL = 'http://ec2-18-211-58-135.compute-1.amazonaws.com:8081';
const PAGE_SIZE = 500;

export interface DashboardEmployee {
  id: number;
  employeeCode: string;
  firstName: string;
  lastName: string;
  role: string;
  city: string;
  state: string;
  active: boolean;
  houseLatitude: number | null;
  houseLongitude: number | null;
}

export interface DashboardVisit {
  id: number;
  assignedEmployeeId: number | null;
  scheduledVisitDate: string;
  purpose: string;
  status: string;
  customerName: string;
  actualCheckinAt: string;
  actualCheckoutAt: string;
  state: string;
}

export interface DashboardAttendanceLog {
  id: number | string;
  employeeId: number;
  attendanceDate: string;
  status: string;
}

export interface DashboardSummary {
  totalVisits: number | null;
  activeEmployees: number | null;
}

export interface DashboardCurrentLocation {
  employeeId: number;
  employeeName: string;
  latitude: number;
  longitude: number;
  capturedAt: string;
}

export interface DashboardLocationHistoryPoint {
  id: number | string;
  employeeId: number;
  latitude: number;
  longitude: number;
  capturedAt: string;
  provider: string;
  accuracyMeters: number | null;
  batteryPercent: number | null;
}

export class DashboardApiError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = 'DashboardApiError';
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

const queryString = (values: Record<string, string | number | boolean | null | undefined>): string => {
  const params = new URLSearchParams();
  Object.entries(values).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') params.set(key, String(value));
  });
  return params.size ? `?${params.toString()}` : '';
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

const request = async (path: string, token: string): Promise<unknown> => {
  const response = await fetch(`${DASHBOARD_API_BASE_URL}${path}`, {
    headers: {
      Accept: 'application/json',
      Authorization: `Bearer ${token}`,
    },
  });
  if (!response.ok) {
    throw new DashboardApiError(
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

const normalizeEmployee = (value: unknown): DashboardEmployee | null => {
  const item = recordOf(value);
  if (!item) return null;
  const id = numberOf(item.id, item.employeeId);
  if (id == null) return null;

  const address = nested(item, 'address', 'employeeAddress');
  const designation = nested(item, 'designation');
  const user = nested(item, 'userDto', 'user');

  return {
    id,
    employeeCode: stringOf(item.employeeCode, item.code),
    firstName: stringOf(item.firstName, item.givenName),
    lastName: stringOf(item.lastName, item.surname),
    role: stringOf(
      item.role,
      item.employeeRole,
      item.roleName,
      item.designationName,
      designation?.name,
      user?.roles,
      user?.role,
    ),
    city: stringOf(item.city, item.addressCity, address?.city),
    state: stringOf(item.state, item.addressState, address?.state),
    active: booleanOf(true, item.active, item.isActive),
    houseLatitude: numberOf(
      item.houseLatitude,
      item.homeLatitude,
      item.latitude,
      address?.latitude,
    ),
    houseLongitude: numberOf(
      item.houseLongitude,
      item.homeLongitude,
      item.longitude,
      address?.longitude,
    ),
  };
};

const normalizeVisit = (value: unknown): DashboardVisit | null => {
  const item = recordOf(value);
  if (!item) return null;
  const id = numberOf(item.id, item.visitId, item.visitActivityId);
  if (id == null) return null;
  const employee = nested(item, 'assignedEmployee', 'employee');
  const client = nested(item, 'clientAccount', 'retailClient', 'account');
  const institution = nested(item, 'institution');
  const project = nested(item, 'project');
  return {
    id,
    assignedEmployeeId: numberOf(
      item.assignedEmployeeId,
      item.employeeId,
      item.assignedToEmployeeId,
      employee?.id,
    ),
    scheduledVisitDate: stringOf(item.scheduledVisitDate, item.visitDate, item.date),
    purpose: stringOf(item.purpose, item.visitPurpose),
    status: stringOf(item.status, item.visitStatus).toUpperCase(),
    customerName: stringOf(
      item.clientAccountName,
      item.accountName,
      item.institutionName,
      item.projectName,
      item.storeName,
      client?.accountName,
      client?.name,
      institution?.institutionName,
      institution?.name,
      project?.projectName,
      project?.name,
    ),
    actualCheckinAt: stringOf(item.actualCheckinAt, item.checkinAt, item.checkInAt),
    actualCheckoutAt: stringOf(item.actualCheckoutAt, item.checkoutAt, item.checkOutAt),
    state: stringOf(
      item.addressState,
      item.state,
      client?.addressState,
      client?.state,
      institution?.addressState,
      institution?.state,
      project?.addressState,
      project?.state,
    ),
  };
};

const normalizeAttendanceLog = (
  value: unknown,
  employeeId: number,
  index: number,
): DashboardAttendanceLog | null => {
  const item = recordOf(value);
  if (!item) return null;
  return {
    id: numberOf(item.id, item.attendanceId, item.attendanceLogId) ?? `${employeeId}-${index}`,
    employeeId: numberOf(item.employeeId, nested(item, 'employee')?.id) ?? employeeId,
    attendanceDate: stringOf(item.attendanceDate, item.date, item.workDate),
    status: stringOf(item.status, item.attendanceStatus, item.dayStatus).toUpperCase(),
  };
};

const normalizeSummary = (value: unknown): DashboardSummary => {
  const source = sourceRecord(value) ?? {};
  const employees = Array.isArray(source.activeEmployees) ? source.activeEmployees : null;
  return {
    totalVisits: numberOf(source.totalVisits, source.visitCount, source.visits),
    activeEmployees: numberOf(
      source.activeEmployeeCount,
      source.employeesWithActivity,
      source.activeEmployees,
      employees?.length,
    ),
  };
};

const normalizeCurrentLocation = (
  value: unknown,
  fallbackEmployee: DashboardEmployee,
): DashboardCurrentLocation | null => {
  const source = sourceRecord(value);
  if (!source) return null;
  const location = nested(source, 'location', 'currentLocation') ?? source;
  const latitude = numberOf(location.latitude, location.lat);
  const longitude = numberOf(location.longitude, location.lng, location.lon);
  if (latitude == null || longitude == null) return null;
  const employee = nested(source, 'employee');
  const fallbackName = [fallbackEmployee.firstName, fallbackEmployee.lastName].filter(Boolean).join(' ');
  return {
    employeeId: numberOf(source.employeeId, employee?.id) ?? fallbackEmployee.id,
    employeeName: stringOf(
      source.employeeName,
      employee?.fullName,
      [stringOf(employee?.firstName), stringOf(employee?.lastName)].filter(Boolean).join(' '),
    ) || fallbackName || `Employee #${fallbackEmployee.id}`,
    latitude,
    longitude,
    capturedAt: stringOf(
      location.capturedAt,
      location.recordedAt,
      location.updatedAt,
      source.capturedAt,
      source.updatedAt,
    ),
  };
};

const normalizeHistoryPoint = (
  value: unknown,
  employeeId: number,
  index: number,
): DashboardLocationHistoryPoint | null => {
  const item = recordOf(value);
  if (!item) return null;
  const location = nested(item, 'location', 'trackingLocation') ?? item;
  const latitude = numberOf(location.latitude, location.lat);
  const longitude = numberOf(location.longitude, location.lng, location.lon);
  if (latitude == null || longitude == null) return null;
  return {
    id: numberOf(item.id, item.locationId, item.trackingId) ?? `${employeeId}-${index}`,
    employeeId: numberOf(item.employeeId, location.employeeId) ?? employeeId,
    latitude,
    longitude,
    capturedAt: stringOf(
      location.capturedAt,
      location.recordedAt,
      location.updatedAt,
      item.capturedAt,
      item.updatedAt,
    ),
    provider: stringOf(location.provider, item.provider, location.source, item.source) || 'GPS',
    accuracyMeters: numberOf(location.accuracyMeters, item.accuracyMeters, location.accuracy),
    batteryPercent: numberOf(location.batteryPercent, item.batteryPercent),
  };
};

export const dashboardApi = {
  async getSummary(token: string): Promise<DashboardSummary> {
    return normalizeSummary(await request('/api/dashboard/summary', token));
  },

  async getEmployees(
    token: string,
    filters: { managerId?: number | null; teamId?: number | null } = {},
  ): Promise<DashboardEmployee[]> {
    const buildPath = (page: number) => {
      const query = queryString({
        active: true,
        managerId: filters.managerId,
        page,
        size: PAGE_SIZE,
      });
      return filters.teamId
        ? `/api/common/teams/${filters.teamId}/employees${query}`
        : `/api/common/employees${query}`;
    };
    return (await fetchAllPages(buildPath, token))
      .flatMap((value) => {
        const employee = normalizeEmployee(value);
        return employee ? [employee] : [];
      });
  },

  async getVisits(
    token: string,
    from: string,
    to: string,
    assignedEmployeeId?: number,
  ): Promise<DashboardVisit[]> {
    const rows = await fetchAllPages(
      (page) => `/api/common/visits${queryString({
        from,
        to,
        assignedEmployeeId,
        page,
        size: PAGE_SIZE,
      })}`,
      token,
    );
    return rows.flatMap((value) => {
      const visit = normalizeVisit(value);
      return visit ? [visit] : [];
    });
  },

  async getAttendanceLogs(
    token: string,
    employeeId: number,
    from: string,
    to: string,
  ): Promise<DashboardAttendanceLog[]> {
    const rows = await fetchAllPages(
      (page) => `/api/hr/attendance/logs/by-employee/${employeeId}${queryString({
        from,
        to,
        page,
        size: PAGE_SIZE,
      })}`,
      token,
    );
    return rows.flatMap((value, index) => {
      const log = normalizeAttendanceLog(value, employeeId, index);
      return log ? [log] : [];
    });
  },

  async getCurrentLocations(
    token: string,
    employees: DashboardEmployee[],
  ): Promise<DashboardCurrentLocation[]> {
    const results = await Promise.allSettled(
      employees.map(async (employee) => normalizeCurrentLocation(
        await request(`/api/hr/tracking/current-location/${employee.id}`, token),
        employee,
      )),
    );
    const hardFailure = results.find((result) => (
      result.status === 'rejected' &&
      (!(result.reason instanceof DashboardApiError) || result.reason.status !== 404)
    ));
    if (hardFailure?.status === 'rejected' && results.every((result) => result.status === 'rejected')) {
      throw hardFailure.reason;
    }
    return results.flatMap((result) => (
      result.status === 'fulfilled' && result.value ? [result.value] : []
    ));
  },

  async getLocationHistory(
    token: string,
    employeeId: number,
    from: string,
    to: string,
  ): Promise<DashboardLocationHistoryPoint[]> {
    const rows = await fetchAllPages(
      (page) => `/api/hr/tracking/location-history/${employeeId}${queryString({
        from: `${from}T00:00:00`,
        to: `${to}T23:59:59`,
        page,
        size: PAGE_SIZE,
      })}`,
      token,
    );
    return rows.flatMap((value, index) => {
      const point = normalizeHistoryPoint(value, employeeId, index);
      return point ? [point] : [];
    });
  },
};
