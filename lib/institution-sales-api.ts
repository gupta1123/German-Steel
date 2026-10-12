import { INSTITUTIONS_API_BASE_URL } from './institutions-api';
import { getApiErrorMessage } from './api-error';

export interface InstitutionCycle { id: number; institutionId: number; cycleNumber: number; cycleType: string; active: boolean; closedAt: string | null }
export interface InstitutionSalePayload { applicationCycleId: number; saleDate: string; quantityMt: number; invoiceReference: string | null; sourceSystem: 'WEB' | 'MOBILE'; outcomeStatus: 'WIN' | 'LOST'; poNumber: string | null; poDate: string | null; lossReason: string | null }
export interface InstitutionSale extends InstitutionSalePayload { id: number; institutionId: number; saleStatus: string; correctionReason?: string | null; correctedAt?: string | null }
const request = async (path: string, token: string, method = 'GET', body?: unknown) => {
  const response = await fetch(`${INSTITUTIONS_API_BASE_URL}${path}`, { method, headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
  if (!response.ok) throw new Error(await getApiErrorMessage(response, `Request failed (${response.status})`));
  return response.status === 204 ? null : response.json();
};
const allPages = async <T,>(path: string, token: string): Promise<T[]> => {
  const rows: T[] = [];
  for (let page = 0; ; page++) {
    const result = await request(`${path}${path.includes('?') ? '&' : '?'}page=${page}&size=50`, token);
    const content = Array.isArray(result) ? result : result.content || [];
    rows.push(...content);
    if (Array.isArray(result) || result.last === true || !content.length || page + 1 >= (result.totalPages || 1)) return rows;
  }
};
export const InstitutionSalesAPI = {
  list: (id: number, token: string) => allPages<InstitutionSale>(`/api/empanelment/institutions/${id}/sales?from=0001-01-01&to=9999-12-31`, token),
  cycles: (id: number, token: string) => allPages<InstitutionCycle>(`/api/empanelment/institutions/${id}/application-cycles`, token),
  create: (id: number, payload: InstitutionSalePayload, token: string) => request(`/api/empanelment/institutions/${id}/sales`, token, 'POST', payload),
  update: (id: number, payload: InstitutionSalePayload, token: string) => request(`/api/empanelment/institution-sales/${id}`, token, 'PUT', payload),
  void: (id: number, correctionReason: string, token: string) => request(`/api/empanelment/institution-sales/${id}/void`, token, 'POST', { correctionReason }),
};
