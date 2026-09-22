import { getApiErrorMessage } from '@/lib/api-error';

const TASKS_API_BASE_URL = 'http://ec2-18-211-58-135.compute-1.amazonaws.com:8081';

export type SharedTaskStatus = 'OPEN' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';
export type SharedTaskPriority = 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';

export interface SharedTask {
  id: number;
  taskTitle: string;
  taskDescription: string;
  taskType: string;
  status: SharedTaskStatus;
  priority: SharedTaskPriority;
  dueDate: string;
  assignedToEmployeeId: number | null;
  assignedToEmployeeName: string;
  assignedByEmployeeId: number | null;
  clientAccountId: number | null;
  clientAccountName: string;
  clientAccountCity: string;
}

export interface SharedTaskCreatePayload {
  taskTitle: string;
  taskDescription: string | null;
  taskType: string;
  status: SharedTaskStatus;
  priority: SharedTaskPriority;
  assignedToEmployeeId: number;
  assignedByEmployeeId: number;
  dueDate: string;
  clientAccountId: number;
  visitActivityId: number | null;
}

export type SharedTaskUpdatePayload = Partial<SharedTaskCreatePayload>;

interface SharedTaskPage {
  content: SharedTask[];
  number: number;
  size: number;
  totalPages: number;
  totalElements: number;
}

class SharedTasksApiError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = 'SharedTasksApiError';
    this.status = status;
  }
}

const recordOf = (value: unknown): Record<string, unknown> | null => (
  value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null
);

const numberOf = (...values: unknown[]): number | null => {
  for (const value of values) {
    if (typeof value === 'number' && Number.isFinite(value)) return value;
    if (typeof value === 'string' && value.trim() && Number.isFinite(Number(value))) return Number(value);
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

const request = async (path: string, token: string, options: RequestInit = {}): Promise<unknown> => {
  const response = await fetch(`${TASKS_API_BASE_URL}${path}`, {
    ...options,
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      ...options.headers,
    },
  });

  if (!response.ok) {
    throw new SharedTasksApiError(
      await getApiErrorMessage(response, `Task request failed (${response.status})`),
      response.status,
    );
  }

  return readResponseBody(response);
};

const sourceOf = (value: unknown): Record<string, unknown> => {
  const outer = recordOf(value) ?? {};
  const data = recordOf(outer.data);
  return data && (Array.isArray(data.content) || 'totalPages' in data) ? data : outer;
};

const normalizeStatus = (value: unknown): SharedTaskStatus => {
  const status = stringOf(value).toUpperCase().replaceAll(' ', '_');
  if (status === 'IN_PROGRESS' || status === 'COMPLETED' || status === 'CANCELLED') return status;
  return 'OPEN';
};

const normalizePriority = (value: unknown): SharedTaskPriority => {
  const priority = stringOf(value).toUpperCase();
  if (priority === 'LOW' || priority === 'HIGH' || priority === 'URGENT') return priority;
  return 'MEDIUM';
};

const normalizeTask = (value: unknown): SharedTask | null => {
  const item = recordOf(value);
  if (!item) return null;
  const id = numberOf(item.id, item.taskId);
  if (id == null) return null;

  const assignee = recordOf(item.assignedToEmployee) ?? recordOf(item.assignedEmployee);
  const assigner = recordOf(item.assignedByEmployee);
  const client = recordOf(item.clientAccount) ?? recordOf(item.retailClient);

  return {
    id,
    taskTitle: stringOf(item.taskTitle, item.title),
    taskDescription: stringOf(item.taskDescription, item.taskDesciption, item.description),
    taskType: stringOf(item.taskType, item.type).toUpperCase(),
    status: normalizeStatus(item.status),
    priority: normalizePriority(item.priority),
    dueDate: stringOf(item.dueDate),
    assignedToEmployeeId: numberOf(
      item.assignedToEmployeeId,
      item.assignedEmployeeId,
      item.employeeId,
      item.assignedToId,
      assignee?.id,
    ),
    assignedToEmployeeName: stringOf(
      item.assignedToEmployeeName,
      item.assignedEmployeeName,
      item.assignedToName,
      assignee?.fullName,
      [stringOf(assignee?.firstName), stringOf(assignee?.lastName)].filter(Boolean).join(' '),
    ),
    assignedByEmployeeId: numberOf(item.assignedByEmployeeId, item.assignedById, assigner?.id),
    clientAccountId: numberOf(item.clientAccountId, item.storeId, client?.id),
    clientAccountName: stringOf(item.clientAccountName, item.accountName, item.storeName, client?.accountName, client?.name),
    clientAccountCity: stringOf(item.clientAccountCity, item.accountCity, item.storeCity, client?.addressCity, client?.city),
  };
};

const normalizePage = (value: unknown, fallbackPage: number, fallbackSize: number): SharedTaskPage => {
  const source = sourceOf(value);
  const rows = Array.isArray(source.content)
    ? source.content
    : Array.isArray(value)
      ? value
      : [];
  const content = rows.flatMap((row) => {
    const task = normalizeTask(row);
    return task ? [task] : [];
  });

  return {
    content,
    number: numberOf(source.number, source.page, fallbackPage) ?? fallbackPage,
    size: numberOf(source.size, fallbackSize) ?? fallbackSize,
    totalPages: Math.max(1, numberOf(source.totalPages) ?? 1),
    totalElements: numberOf(source.totalElements, source.total) ?? content.length,
  };
};

export const tasksApi = {
  async getPage(token: string, page = 0, size = 50, params: Record<string, string | number | undefined> = {}): Promise<SharedTaskPage> {
    const query = new URLSearchParams({ page: String(page), size: String(size) });
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined && value !== null && value !== '') query.set(key, String(value));
    }
    return normalizePage(await request(`/api/tasks?${query}`, token), page, size);
  },

  async getAll(token: string): Promise<SharedTask[]> {
    const first = await this.getPage(token, 0, 50);
    if (first.totalPages <= 1) return first.content;

    const remaining = await Promise.all(
      Array.from({ length: first.totalPages - 1 }, (_, index) => this.getPage(token, index + 1, first.size)),
    );
    return [first, ...remaining].flatMap((page) => page.content);
  },

  async getVisiblePage(token: string, page = 0, size = 50, params: Record<string, string | number | undefined> = {}): Promise<SharedTaskPage> {
    const query = new URLSearchParams({ page: String(page), size: String(size) });
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined && value !== null && value !== '') query.set(key, String(value));
    }
    return normalizePage(await request(`/api/tasks/visible?${query}`, token), page, size);
  },

  async getComplaintsPage(
    token: string,
    opts: { assignedToEmployeeId?: number | string; status?: string; priority?: string; q?: string; dueFrom?: string; dueTo?: string; page?: number; size?: number } = {}
  ): Promise<SharedTaskPage> {
    const page = opts.page ?? 0;
    const size = opts.size ?? 50;
    const params: Record<string, string | number | undefined> = {};
    if (opts.assignedToEmployeeId !== undefined && opts.assignedToEmployeeId !== '' && opts.assignedToEmployeeId !== 'all') {
      params.assignedToEmployeeId = opts.assignedToEmployeeId;
    }
    if (opts.status && opts.status !== '' && opts.status !== 'all') {
      // Map UI status to API status: Assigned->OPEN, Work In Progress->IN_PROGRESS, etc.
      const s = String(opts.status).toLowerCase();
      if (s === 'assigned') params.status = 'OPEN';
      else if (s === 'work in progress') params.status = 'IN_PROGRESS';
      else if (s === 'complete') params.status = 'COMPLETED';
      else if (s === 'cancelled') params.status = 'CANCELLED';
      else params.status = String(opts.status).toUpperCase();
    }
    if (opts.priority && opts.priority !== '' && opts.priority !== 'all') {
      params.priority = String(opts.priority).toUpperCase();
    }
    if (opts.q && opts.q.trim() !== '') {
      params.q = opts.q.trim();
    }
    if (opts.dueFrom && opts.dueFrom !== '') {
      params.dueFrom = opts.dueFrom;
    }
    if (opts.dueTo && opts.dueTo !== '') {
      params.dueTo = opts.dueTo;
    }
    // Backend has no taskType filter — fetch visible tasks and keep only COMPLAINT client-side.
    // Date filters are server-side dueFrom/dueTo (verified 25 for 2026-09-01..30).
    const visible = await this.getVisiblePage(token, page, size, params);
    const complaints = visible.content.filter((task) => task.taskType === 'COMPLAINT');
    return { ...visible, content: complaints };
  },

  async getRequirementsPage(
    token: string,
    opts: { assignedToEmployeeId?: number | string; status?: string; priority?: string; q?: string; dueFrom?: string; dueTo?: string; page?: number; size?: number } = {}
  ): Promise<SharedTaskPage> {
    const page = opts.page ?? 0;
    const size = opts.size ?? 50;
    const params: Record<string, string | number | undefined> = {};
    if (opts.assignedToEmployeeId !== undefined && opts.assignedToEmployeeId !== '' && opts.assignedToEmployeeId !== 'all') {
      params.assignedToEmployeeId = opts.assignedToEmployeeId;
    }
    if (opts.status && opts.status !== '' && opts.status !== 'all') {
      const s = String(opts.status).toLowerCase();
      if (s === 'assigned') params.status = 'OPEN';
      else if (s === 'work in progress') params.status = 'IN_PROGRESS';
      else if (s === 'complete') params.status = 'COMPLETED';
      else if (s === 'cancelled') params.status = 'CANCELLED';
      else params.status = String(opts.status).toUpperCase();
    }
    if (opts.priority && opts.priority !== '' && opts.priority !== 'all') {
      params.priority = String(opts.priority).toUpperCase();
    }
    if (opts.q && opts.q.trim() !== '') {
      params.q = opts.q.trim();
    }
    if (opts.dueFrom && opts.dueFrom !== '') {
      params.dueFrom = opts.dueFrom;
    }
    if (opts.dueTo && opts.dueTo !== '') {
      params.dueTo = opts.dueTo;
    }
    // Backend has no taskType filter — fetch visible tasks and keep only REQUIREMENT client-side.
    const visible = await this.getVisiblePage(token, page, size, params);
    const requirements = visible.content.filter((task) => task.taskType === 'REQUIREMENT');
    return { ...visible, content: requirements };
  },

  async create(payload: SharedTaskCreatePayload, token: string): Promise<void> {
    await request('/api/tasks', token, { method: 'POST', body: JSON.stringify(payload) });
  },

  async update(taskId: number, payload: SharedTaskUpdatePayload, token: string): Promise<void> {
    await request(`/api/tasks/${taskId}`, token, { method: 'PUT', body: JSON.stringify(payload) });
  },

  async delete(taskId: number, token: string): Promise<void> {
    await request(`/api/tasks/${taskId}`, token, { method: 'DELETE' });
  },

  async getDue(token: string, employeeId: number, dueDate: string): Promise<SharedTaskPage> {
    const query = new URLSearchParams({ employeeId: String(employeeId), dueDate });
    return normalizePage(await request(`/api/tasks/due?${query}`, token), 0, 50);
  },
};
