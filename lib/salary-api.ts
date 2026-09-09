import { getApiErrorMessage } from '@/lib/api-error';

const SALARY_API_BASE_URL = 'http://ec2-18-211-58-135.compute-1.amazonaws.com:8081';
const PAGE_SIZE = 500;

export interface SalaryEmployee {
  id: number;
  employeeCode: string;
  firstName: string;
  lastName: string;
  role: string;
  active: boolean;
  fullMonthSalary: number;
  travelAllowance: number;
  dearnessAllowance: number;
}

export interface SalarySummary {
  employeeId: number;
  employeeName: string;
  employeeCode: string;
  startDate: string;
  endDate: string;
  presentDays: number;
  fullDays: number;
  halfDays: number;
  absentDays: number;
  baseSalary: number;
  travelAllowance: number;
  dearnessAllowance: number;
  approvedExpenses: number;
  totalSalary: number;
}

export interface SalaryCalculationFailure {
  employeeId: number;
  employeeName: string;
  message: string;
}

export interface SalaryCalculationBatch {
  summaries: SalarySummary[];
  failures: SalaryCalculationFailure[];
}

export class SalaryApiError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = 'SalaryApiError';
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
  const response = await fetch(`${SALARY_API_BASE_URL}${path}`, {
    ...init,
    headers: {
      Accept: 'application/json',
      Authorization: `Bearer ${token}`,
      ...(init.body ? { 'Content-Type': 'application/json' } : {}),
      ...init.headers,
    },
  });

  if (!response.ok) {
    throw new SalaryApiError(
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

const normalizeEmployee = (value: unknown): SalaryEmployee | null => {
  const item = recordOf(value);
  if (!item) return null;
  const id = numberOf(item.id, item.employeeId);
  if (id == null) return null;
  const designation = nested(item, 'designation');

  return {
    id,
    employeeCode: stringOf(item.employeeCode, item.code),
    firstName: stringOf(item.firstName, item.givenName),
    lastName: stringOf(item.lastName, item.surname),
    role: stringOf(item.role, item.employeeRole, item.roleName, designation?.name),
    active: booleanOf(true, item.active, item.isActive),
    fullMonthSalary: numberOf(item.fullMonthSalary, item.monthlySalary, item.baseSalary) ?? 0,
    travelAllowance: numberOf(item.travelAllowance) ?? 0,
    dearnessAllowance: numberOf(item.dearnessAllowance) ?? 0,
  };
};

const calculationRecord = (value: unknown): Record<string, unknown> | null => {
  if (Array.isArray(value)) return recordOf(value[0]);
  const outer = recordOf(value);
  if (!outer) return null;

  for (const key of ['data', 'result', 'calculation', 'salaryCalculation', 'summary']) {
    const candidate = outer[key];
    if (Array.isArray(candidate)) return recordOf(candidate[0]);
    const candidateRecord = recordOf(candidate);
    if (candidateRecord) return candidateRecord;
  }

  return outer;
};

const normalizeCalculation = (
  value: unknown,
  employee: SalaryEmployee,
  startDate: string,
  endDate: string,
): SalarySummary => {
  const item = calculationRecord(value);
  if (!item) {
    throw new Error('Salary calculation returned no result.');
  }

  const attendance = nested(item, 'attendance', 'attendanceSummary', 'attendanceStats', 'statsDto');
  const breakdown = nested(item, 'salaryBreakdown', 'breakdown', 'salaryDetails');
  const expenses = nested(item, 'expenses', 'expenseSummary');
  const responseEmployee = nested(item, 'employee', 'employeeDto');
  const hasCalculationValues = [
    'baseSalary',
    'calculatedBaseSalary',
    'totalSalary',
    'netSalary',
    'grossSalary',
    'payableSalary',
    'fullDays',
    'halfDays',
    'absentDays',
    'travelAllowance',
    'dearnessAllowance',
  ].some((key) => key in item) || Boolean(attendance || breakdown);

  if (!hasCalculationValues) {
    throw new Error('Salary calculation completed without returning summary details.');
  }

  const baseSalary = numberOf(
    item.baseSalary,
    item.calculatedBaseSalary,
    item.earnedBaseSalary,
    breakdown?.baseSalary,
    breakdown?.calculatedBaseSalary,
    employee.fullMonthSalary,
  ) ?? 0;
  const travelAllowance = numberOf(
    item.travelAllowance,
    item.travelAmount,
    breakdown?.travelAllowance,
    employee.travelAllowance,
  ) ?? 0;
  const dearnessAllowance = numberOf(
    item.dearnessAllowance,
    item.daAmount,
    breakdown?.dearnessAllowance,
    breakdown?.daAmount,
    employee.dearnessAllowance,
  ) ?? 0;
  const approvedExpenses = numberOf(
    item.approvedExpenses,
    item.approvedExpense,
    item.expenseReimbursement,
    expenses?.approvedExpenses,
    expenses?.approvedAmount,
    breakdown?.approvedExpenses,
  ) ?? 0;

  return {
    employeeId: numberOf(item.employeeId, responseEmployee?.id) ?? employee.id,
    employeeName: stringOf(
      item.employeeName,
      responseEmployee?.employeeName,
      [
        stringOf(responseEmployee?.firstName, employee.firstName),
        stringOf(responseEmployee?.lastName, employee.lastName),
      ].filter(Boolean).join(' '),
    ),
    employeeCode: stringOf(item.employeeCode, responseEmployee?.employeeCode, employee.employeeCode),
    startDate: stringOf(item.startDate, item.periodStart, startDate) || startDate,
    endDate: stringOf(item.endDate, item.periodEnd, endDate) || endDate,
    presentDays: numberOf(item.presentDays, item.presentDayCount, attendance?.presentDays, attendance?.presentDayCount) ?? 0,
    fullDays: numberOf(item.fullDays, item.fullDayCount, attendance?.fullDays, attendance?.fullDayCount) ?? 0,
    halfDays: numberOf(item.halfDays, item.halfDayCount, attendance?.halfDays, attendance?.halfDayCount) ?? 0,
    absentDays: numberOf(item.absentDays, item.absenceDays, item.absentDayCount, attendance?.absentDays, attendance?.absences) ?? 0,
    baseSalary,
    travelAllowance,
    dearnessAllowance,
    approvedExpenses,
    totalSalary: numberOf(
      item.totalSalary,
      item.netSalary,
      item.grossSalary,
      item.payableSalary,
      item.finalSalary,
      breakdown?.totalSalary,
      breakdown?.netSalary,
      breakdown?.payableSalary,
    ) ?? (baseSalary + travelAllowance + dearnessAllowance + approvedExpenses),
  };
};

export const salaryApi = {
  async getEmployees(token: string): Promise<SalaryEmployee[]> {
    return (await fetchAllPages(
      (page) => `/api/common/employees?active=true&page=${page}&size=${PAGE_SIZE}`,
      token,
    )).flatMap((value) => {
      const employee = normalizeEmployee(value);
      return employee ? [employee] : [];
    });
  },

  async runCalculations(
    token: string,
    employees: SalaryEmployee[],
    year: number,
    month: number,
    startDate: string,
    endDate: string,
  ): Promise<SalaryCalculationBatch> {
    const results = await Promise.allSettled(
      employees.map(async (employee) => {
        const response = await request('/api/hr/salary/calculations/run', token, {
          method: 'POST',
          body: JSON.stringify({
            employeeId: employee.id,
            year,
            month,
            refreshTravelData: false,
          }),
        });
        return normalizeCalculation(response, employee, startDate, endDate);
      }),
    );

    const summaries: SalarySummary[] = [];
    const failures: SalaryCalculationFailure[] = [];
    results.forEach((result, index) => {
      const employee = employees[index];
      if (result.status === 'fulfilled') {
        summaries.push(result.value);
      } else {
        failures.push({
          employeeId: employee.id,
          employeeName: `${employee.firstName} ${employee.lastName}`.trim() || `Employee ${employee.id}`,
          message: result.reason instanceof Error ? result.reason.message : 'Salary calculation failed.',
        });
      }
    });

    return { summaries, failures };
  },
};
