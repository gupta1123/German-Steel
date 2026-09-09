import { getApiErrorMessage } from "@/lib/api-error";
import type {
  EmployeeUserDto,
  SalesTargetCreatePayload,
  SalesTargetDto,
  SalesTargetEditPayload,
  SalesTargetSearchParams,
  StoreDto,
} from "@/lib/api";

const TARGETS_API_BASE_URL = "http://ec2-18-211-58-135.compute-1.amazonaws.com:8081";
const PAGE_SIZE = 500;

export type {
  EmployeeUserDto,
  SalesTargetCreatePayload,
  SalesTargetDto,
  SalesTargetEditPayload,
  SalesTargetSearchParams,
  StoreDto,
};

export class TargetsApiError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "TargetsApiError";
    this.status = status;
  }
}

const recordOf = (value: unknown): Record<string, unknown> | null => (
  value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null
);

const stringOf = (...values: unknown[]): string => {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) return value.trim();
    if (typeof value === "number" && Number.isFinite(value)) return String(value);
  }
  return "";
};

const numberOf = (...values: unknown[]): number | null => {
  for (const value of values) {
    if (typeof value === "number" && Number.isFinite(value)) return value;
    if (typeof value === "string" && value.trim() && Number.isFinite(Number(value))) return Number(value);
  }
  return null;
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

const request = async (path: string, token: string, init: RequestInit = {}): Promise<unknown> => {
  const response = await fetch(`${TARGETS_API_BASE_URL}${path}`, {
    ...init,
    cache: "no-store",
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${token}`,
      ...(init.body ? { "Content-Type": "application/json" } : {}),
      ...init.headers,
    },
  });

  if (!response.ok) {
    throw new TargetsApiError(
      await getApiErrorMessage(response, `Request failed (${response.status})`),
      response.status,
    );
  }
  return readResponseBody(response);
};

const fetchAllPages = async (buildPath: (page: number) => string, token: string): Promise<unknown[]> => {
  const first = await request(buildPath(0), token);
  const totalPages = pageCount(first);
  if (totalPages === 1) return pageItems(first);
  const remaining = await Promise.all(
    Array.from({ length: totalPages - 1 }, (_, index) => request(buildPath(index + 1), token)),
  );
  return [first, ...remaining].flatMap(pageItems);
};

const normalizeEmployee = (value: unknown): EmployeeUserDto | null => {
  const item = recordOf(value);
  if (!item) return null;
  const id = numberOf(item.id, item.employeeId);
  if (id == null) return null;
  const user = recordOf(item.userDto) ?? recordOf(item.user);
  const employeeCode = stringOf(item.employeeCode, item.code, item.employeeId);
  const firstName = stringOf(item.firstName, item.givenName);
  const lastName = stringOf(item.lastName, item.surname);

  return {
    id,
    firstName,
    lastName,
    employeeId: employeeCode,
    email: stringOf(item.email),
    role: stringOf(item.role, item.employeeRole, item.roleName),
    departmentName: stringOf(item.departmentName, item.department),
    userName: stringOf(item.userName, item.username, user?.username),
    password: "",
    primaryContact: stringOf(item.mobile, item.primaryContact),
    secondaryContact: stringOf(item.secondaryMobile, item.secondaryContact) || undefined,
    dateOfJoining: stringOf(item.dateOfJoining),
    city: stringOf(item.city),
    state: stringOf(item.state),
    district: stringOf(item.district) || null,
    subDistrict: stringOf(item.subDistrict, item.taluka) || null,
    country: stringOf(item.country),
    addressLine1: stringOf(item.addressLine1),
    addressLine2: stringOf(item.addressLine2),
    pincode: stringOf(item.pincode, item.pinCode),
    assignedCity: Array.isArray(item.assignedCity)
      ? item.assignedCity.flatMap((city) => stringOf(city) ? [stringOf(city)] : [])
      : null,
    houseLatitude: numberOf(item.houseLatitude) ?? undefined,
    houseLongitude: numberOf(item.houseLongitude) ?? undefined,
    userDto: {
      username: stringOf(user?.username, item.userName, item.username),
      password: null,
      roles: stringOf(user?.roles, item.role) || null,
      employeeId: numberOf(user?.employeeId, id),
      firstName: stringOf(user?.firstName, firstName) || null,
      lastName: stringOf(user?.lastName, lastName) || null,
    },
  };
};

const normalizeStore = (value: unknown): StoreDto | null => {
  const item = recordOf(value);
  if (!item) return null;
  const storeId = numberOf(item.id, item.clientAccountId, item.accountId, item.storeId);
  if (storeId == null) return null;

  return {
    storeId,
    storeName: stringOf(item.accountName, item.storeName, item.clientName) || `Store ${storeId}`,
    clientFirstName: stringOf(item.clientFirstName, item.ownerFirstName),
    clientLastName: stringOf(item.clientLastName, item.ownerLastName),
    primaryContact: numberOf(item.primaryContact, item.mobile) ?? 0,
    monthlySale: numberOf(item.declaredMonthlySalesMt, item.monthlySale),
    intent: numberOf(item.intent),
    employeeName: stringOf(item.ownerEmployeeName, item.employeeName),
    employeeId: numberOf(item.ownerEmployeeId, item.employeeId) ?? undefined,
    clientType: stringOf(item.clientType) || null,
    totalVisitCount: numberOf(item.totalVisitCount) ?? 0,
    lastVisitDate: stringOf(item.lastVisitDate) || null,
    email: stringOf(item.email) || null,
    city: stringOf(item.addressCity, item.city),
    state: stringOf(item.addressState, item.state),
    country: stringOf(item.country) || null,
    district: stringOf(item.addressDistrict, item.district),
    subDistrict: stringOf(item.addressTaluka, item.subDistrict),
    latitude: numberOf(item.outletLatitude, item.latitude),
    longitude: numberOf(item.outletLongitude, item.longitude),
    gstNumber: stringOf(item.gstNumber) || null,
    addressLine1: stringOf(item.addressVillageArea, item.addressLine1) || null,
    pincode: numberOf(item.pinCode, item.pincode),
  };
};

const normalizeTarget = (value: unknown): SalesTargetDto | null => {
  const item = recordOf(value);
  if (!item) return null;
  const id = numberOf(item.id, item.targetId);
  const employeeId = numberOf(item.employeeId);
  const storeId = numberOf(item.storeId, item.clientAccountId);
  if (id == null || employeeId == null || storeId == null) return null;
  const targetTons = numberOf(item.targetTons) ?? 0;
  const fulfilledTons = numberOf(item.fulfilledTons);
  const salesTons = numberOf(item.salesTons);
  const effectiveFulfilledTons = numberOf(item.effectiveFulfilledTons, fulfilledTons, salesTons) ?? 0;

  return {
    id,
    employeeId,
    employeeName: stringOf(item.employeeName),
    storeId,
    storeName: stringOf(item.storeName, item.accountName),
    storeCity: stringOf(item.storeCity, item.addressCity) || null,
    storeState: stringOf(item.storeState, item.addressState) || null,
    targetType: stringOf(item.targetType).toUpperCase() === "DAILY" ? "DAILY" : "MONTHLY",
    month: numberOf(item.month),
    year: numberOf(item.year),
    targetDate: stringOf(item.targetDate) || null,
    targetTons,
    fulfilledTons,
    salesTons,
    effectiveFulfilledTons,
    pendingTons: numberOf(item.pendingTons) ?? Math.max(0, targetTons - effectiveFulfilledTons),
    achievementPercent: numberOf(item.achievementPercent) ?? (targetTons > 0 ? effectiveFulfilledTons / targetTons * 100 : 0),
    status: stringOf(item.status) || "PENDING",
    remarks: stringOf(item.remarks) || null,
  };
};

const targetQuery = (params: SalesTargetSearchParams) => {
  const query = new URLSearchParams();
  if (params.employeeId != null) query.set("employeeId", String(params.employeeId));
  if (params.storeId != null) query.set("storeId", String(params.storeId));
  if (params.targetType) query.set("targetType", params.targetType);
  if (params.month != null) query.set("month", String(params.month));
  if (params.year != null) query.set("year", String(params.year));
  if (params.startDate) query.set("startDate", params.startDate);
  if (params.endDate) query.set("endDate", params.endDate);
  return query.toString();
};

export const targetsApi = {
  async getEmployees(token: string): Promise<EmployeeUserDto[]> {
    return (await fetchAllPages(
      (page) => `/api/common/employees?active=true&page=${page}&size=${PAGE_SIZE}`,
      token,
    )).flatMap((value) => {
      const employee = normalizeEmployee(value);
      return employee ? [employee] : [];
    });
  },

  async getStoresByEmployee(token: string, employeeId: number): Promise<StoreDto[]> {
    return (await fetchAllPages(
      (page) => `/api/retail/accounts?ownerEmployeeId=${employeeId}&active=true&page=${page}&size=${PAGE_SIZE}`,
      token,
    )).flatMap((value) => {
      const store = normalizeStore(value);
      return store ? [store] : [];
    }).sort((a, b) => a.storeName.localeCompare(b.storeName));
  },

  async searchSalesTargets(token: string, params: SalesTargetSearchParams = {}): Promise<SalesTargetDto[]> {
    const query = targetQuery(params);
    return pageItems(await request(`/sales-target/search${query ? `?${query}` : ""}`, token)).flatMap((value) => {
      const target = normalizeTarget(value);
      return target ? [target] : [];
    });
  },

  async createSalesTarget(token: string, payload: SalesTargetCreatePayload): Promise<number | null> {
    const response = await request("/sales-target/create", token, {
      method: "POST",
      body: JSON.stringify(payload),
    });
    const source = sourceRecord(response);
    return numberOf(response, source?.id, source?.targetId, source?.data);
  },

  async editSalesTarget(token: string, id: number, payload: SalesTargetEditPayload): Promise<SalesTargetDto | null> {
    const response = await request(`/sales-target/edit?id=${id}`, token, {
      method: "PUT",
      body: JSON.stringify(payload),
    });
    return normalizeTarget(sourceRecord(response));
  },
};
