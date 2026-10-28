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
  if (options.reasonField && !reason) throw new Error('A correction reason is required.');
  // Never retry destructive requests automatically: an interrupted response can
  // still mean the server already applied the action.
  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    method: options.method ?? 'DELETE',
    headers: {
      Accept: 'application/json',
      Authorization: `Bearer ${token}`,
      ...(options.reasonField ? { 'Content-Type': 'application/json' } : {}),
    },
    ...(options.reasonField ? { body: JSON.stringify({ [options.reasonField]: reason }) } : {}),
  });
  if (!response.ok) throw new Error(await getApiErrorMessage(response, 'Unable to remove this record.'));
}
