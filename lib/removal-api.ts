import { getApiErrorMessage } from './api-error.ts';

const API_BASE_URL = 'http://ec2-18-211-58-135.compute-1.amazonaws.com:8081';

export async function removeRecord(token: string, endpoint: string, options: {
  method?: 'DELETE' | 'POST';
  reasonField?: string;
  reason?: string;
} = {}): Promise<void> {
  if (!token) throw new Error('Please sign in again before removing a record.');
  if (!endpoint.startsWith('/api/') || endpoint.includes('..')) throw new Error('Invalid removal endpoint.');
  const reason = options.reason?.trim();
  const isAdminEndpoint = endpoint.startsWith('/api/admin/');
  const reasonField = isAdminEndpoint ? 'reason' : options.reasonField;
  if (reasonField && !reason) throw new Error('A reason is required.');
  if (reasonField && reason && reason.length > 500) throw new Error('The reason must be 500 characters or fewer.');
  // Never retry destructive requests automatically: an interrupted response can
  // still mean the server already applied the action.
  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    method: isAdminEndpoint ? 'POST' : options.method ?? 'DELETE',
    headers: {
      Accept: 'application/json',
      Authorization: `Bearer ${token}`,
      ...(reasonField ? { 'Content-Type': 'application/json' } : {}),
    },
    ...(reasonField ? { body: JSON.stringify({ [reasonField]: reason }) } : {}),
  });
  if (!response.ok) throw new Error(await getApiErrorMessage(response, isAdminEndpoint && response.status === 404 ? 'This removal API is not available yet. Please ask the backend team to deploy the new endpoints.' : 'Unable to remove this record.'));
}
