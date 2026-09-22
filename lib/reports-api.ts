import { getApiErrorMessage } from '@/lib/api-error';

const BASE = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://ec2-18-211-58-135.compute-1.amazonaws.com:8081';
export type RecordType = 'ALL' | 'RETAIL' | 'INSTITUTION' | 'PROJECT';
export type EmployeeActivity = { employeeId: number; employeeCode: string; employeeName: string; employeeRole: string; teamId: number | null; teamName: string | null; newRetailAccountCount: number; newInstitutionCount: number; totalVisitCount: number; completedVisitCount: number; retailVisitCount: number; institutionVisitCount: number; projectVisitCount: number };
export type EmployeeCounts = { activity: EmployeeActivity; attendanceDays: number; attendanceCountByStatus: Record<string, number> };
export type CustomerActivity = { customerType: string; customerId: number; customerName: string; employeeId: number; employeeName: string; createdDate: string; cityOrJurisdiction: string; state: string; regionId: number | null; regionName: string | null; totalVisitCount: number; completedVisitCount: number };
export type CustomerPerformance = { recordType: string; customerId: number; customerName: string; totalVisits: number; completedVisits: number; visitCountByOutcome: Record<string, number>; taskCountByStatus: Record<string, number>; postedSalesQuantityMt: number; postedSaleCount: number; currentInstitutionStage: string | null };
export type ReportPage<T> = { content: T[]; page: number; size: number; totalElements: number; totalPages: number; last: boolean };

const qs = (values: Record<string, unknown>) => { const p = new URLSearchParams(); Object.entries(values).forEach(([key, value]) => { if (value !== undefined && value !== null && value !== '') p.set(key, String(value)); }); return p.toString(); };
const request = async <T>(path: string, token: string): Promise<T> => { const response = await fetch(`${BASE}${path}`, { headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' } }); if (!response.ok) throw new Error(await getApiErrorMessage(response, `Request failed (${response.status})`)); return response.json() as Promise<T>; };

export const reportsApi = {
  employeeActivity: (token: string, filters: { from: string; to: string; recordType?: RecordType; employeeId?: number; teamId?: number; regionId?: number; active?: boolean; page?: number; size?: number }) => request<ReportPage<EmployeeActivity>>(`/api/reports/employees/activity?${qs({ recordType: 'ALL', active: true, page: 0, size: 100, ...filters })}`, token),
  employeeCounts: (token: string, filters: { from: string; to: string; recordType?: RecordType; employeeId?: number; teamId?: number; regionId?: number; active?: boolean; page?: number; size?: number }) => request<ReportPage<EmployeeCounts>>(`/api/reports/counts?${qs({ recordType: 'ALL', active: true, page: 0, size: 100, ...filters })}`, token),
  customerActivity: (token: string, filters: { from: string; to: string; recordType?: Exclude<RecordType, 'PROJECT'>; employeeId?: number; page?: number; size?: number }) => request<ReportPage<CustomerActivity>>(`/api/reports/customers/activity?${qs({ recordType: 'ALL', page: 0, size: 100, ...filters })}`, token),
  customerPerformance: (token: string, recordType: 'RETAIL' | 'INSTITUTION', customerId: number, from: string, to: string) => request<CustomerPerformance>(`/api/reports/customers/${recordType}/${customerId}/performance?${qs({ from, to })}`, token),
};
