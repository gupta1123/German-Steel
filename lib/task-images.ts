import { getApiErrorMessage } from './api-error.ts';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://ec2-18-211-58-135.compute-1.amazonaws.com:8081';

export interface TaskImage {
  id: number;
  name: string;
  mimeType: string;
  downloadUrl: string;
}

const recordOf = (value: unknown): Record<string, unknown> | null => (
  value !== null && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : null
);

const sourceOf = (value: unknown): Record<string, unknown> => {
  const record = recordOf(value) ?? {};
  return recordOf(record.data) ?? record;
};

const textOf = (...values: unknown[]): string => (
  values.find((value): value is string => typeof value === 'string' && Boolean(value.trim()))?.trim() ?? ''
);

export function normalizeTaskImages(value: unknown): TaskImage[] {
  const source = sourceOf(value);
  const items: unknown[] = Array.isArray(value) ? value : Array.isArray(source.attachments) ? source.attachments : Array.isArray(source.content) ? source.content : [];
  const images = new Map<number, TaskImage>();

  for (const item of items) {
    const file = recordOf(item);
    if (!file || file.active === false) continue;
    const id = Number(file.id);
    if (!Number.isSafeInteger(id) || id <= 0) continue;
    const name = textOf(file.fileName, file.originalFileName) || `Image ${id}`;
    const mimeType = textOf(file.mimeType, file.storedMimeType).toLowerCase();
    const imageType = mimeType.startsWith('image/');
    const imageName = /\.(jpe?g|png|gif|webp|bmp|avif|heic|heif|tiff?|svg)$/i.test(name);
    if (!imageType && !((!mimeType || mimeType === 'application/octet-stream') && imageName)) continue;

    // Never send the user's token to a host supplied by attachment metadata.
    const fallbackUrl = `${API_BASE}/api/hr/files/${id}/download`;
    let downloadUrl = fallbackUrl;
    const providedUrl = textOf(file.downloadUrl);
    if (providedUrl) {
      try {
        const url = new URL(providedUrl, `${API_BASE}/`);
        if (url.origin === new URL(API_BASE).origin && ['http:', 'https:'].includes(url.protocol) && !url.username && !url.password) downloadUrl = url.href;
      } catch { /* Use the authenticated file-asset endpoint for malformed URLs. */ }
    }
    images.set(id, { id, name, mimeType, downloadUrl });
  }
  return [...images.values()];
}

const readJson = async (response: Response): Promise<unknown> => {
  if (!response.ok) throw new Error(await getApiErrorMessage(response, `Could not load task images (${response.status}).`));
  return response.json();
};

/** Matches the mobile task-details contract, with its TASK file-list fallback. */
export async function listTaskImages(taskId: number, token: string, signal?: AbortSignal): Promise<TaskImage[]> {
  if (!Number.isSafeInteger(taskId) || taskId <= 0) throw new Error('A valid task ID is required.');
  const headers = { Authorization: `Bearer ${token}`, Accept: 'application/json' };
  const detailResponse = await fetch(`${API_BASE}/api/Task/getById?id=${taskId}`, { headers, signal });
  if (detailResponse.ok) {
    const detail = sourceOf(await detailResponse.json());
    if (Array.isArray(detail.attachments)) return normalizeTaskImages(detail.attachments);
  } else if (![404, 405].includes(detailResponse.status)) {
    await readJson(detailResponse);
  }

  const images = new Map<number, TaskImage>();
  let page = 0;
  let totalPages = 1;
  do {
    const query = new URLSearchParams({ parentType: 'TASK', parentId: String(taskId), page: String(page), size: '50' });
    const body = await readJson(await fetch(`${API_BASE}/api/hr/files?${query}`, { headers, signal }));
    for (const image of normalizeTaskImages(body)) images.set(image.id, image);
    const count = Number(sourceOf(body).totalPages);
    totalPages = Number.isSafeInteger(count) && count > 0 ? count : 1;
    page += 1;
  } while (page < totalPages);
  return [...images.values()];
}

export async function downloadTaskImage(image: TaskImage, token: string, signal?: AbortSignal): Promise<Blob> {
  const url = new URL(image.downloadUrl, `${API_BASE}/`);
  if (url.origin !== new URL(API_BASE).origin || !['http:', 'https:'].includes(url.protocol) || url.username || url.password) throw new Error('Invalid task image URL.');
  const response = await fetch(url.href, { headers: { Authorization: `Bearer ${token}` }, signal });
  if (!response.ok) throw new Error(await getApiErrorMessage(response, `Could not load ${image.name} (${response.status}).`));
  return response.blob();
}
