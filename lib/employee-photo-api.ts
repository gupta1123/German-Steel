import { getApiErrorMessage } from './api-error.ts';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://ec2-18-211-58-135.compute-1.amazonaws.com:8081';
export const MAX_EMPLOYEE_PHOTO_BYTES = 5 * 1024 * 1024;

export async function validateEmployeePhoto(file: File): Promise<void> {
  if (!['image/jpeg', 'image/png'].includes(file.type)) throw new Error('Choose a JPEG or PNG image.');
  if (file.size === 0) throw new Error('This image is empty. Choose another file.');
  if (file.size > MAX_EMPLOYEE_PHOTO_BYTES) throw new Error('The image must be 5 MiB or smaller.');
  const bytes = new Uint8Array(await file.slice(0, 8).arrayBuffer());
  const jpeg = bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  const png = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a].every((value, index) => bytes[index] === value);
  if ((file.type === 'image/jpeg' && !jpeg) || (file.type === 'image/png' && !png)) throw new Error('This file is not a valid JPEG or PNG image.');
}

const endpoint = (employeeId: number, token: string): string => {
  if (!token) throw new Error('Please sign in again.');
  if (!Number.isSafeInteger(employeeId) || employeeId < 1) throw new Error('A valid employee ID is required.');
  return `${API_BASE}/api/common/employees/${employeeId}/profile-photo`;
};

export const employeePhotoApi = {
  async get(employeeId: number, token: string): Promise<Blob | null> {
    const response = await fetch(endpoint(employeeId, token), { cache: 'no-store', headers: { Authorization: `Bearer ${token}` } });
    if (response.status === 404 || response.status === 204) return null;
    if (!response.ok) throw new Error(await getApiErrorMessage(response, `Unable to load the profile picture (HTTP ${response.status}).`));
    const blob = await response.blob();
    return blob.size ? blob : null;
  },
  async save(employeeId: number, token: string, file: File, mode: 'add' | 'replace'): Promise<void> {
    const url = endpoint(employeeId, token);
    await validateEmployeePhoto(file);
    const form = new FormData();
    form.append('file', file);
    const response = await fetch(url, { method: mode === 'add' ? 'POST' : 'PUT', headers: { Authorization: `Bearer ${token}` }, body: form });
    if (!response.ok) throw new Error(await getApiErrorMessage(response, 'Unable to save the profile picture.'));
  },
  async remove(employeeId: number, token: string): Promise<void> {
    const response = await fetch(endpoint(employeeId, token), { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } });
    if (!response.ok) throw new Error(await getApiErrorMessage(response, 'Unable to remove the profile picture.'));
  },
};

/** Creation returns an employee and an auth user; never mistake the user ID for the employee ID. */
export function createdEmployeeId(value: unknown): number | null {
  const record = (item: unknown): Record<string, unknown> => item && typeof item === 'object' ? item as Record<string, unknown> : {};
  const outer = record(value);
  const source = outer.data != null ? record(outer.data) : outer;
  const employee = record(source.employee);
  const user = record(source.user);
  for (const candidate of [employee.id, employee.employeeId, user.employeeId, source.employeeId, source.id, typeof value === 'number' || typeof value === 'string' ? value : null]) {
    if (typeof candidate !== 'number' && typeof candidate !== 'string') continue;
    const id = Number(candidate);
    if (Number.isSafeInteger(id) && id > 0) return id;
  }
  return null;
}
