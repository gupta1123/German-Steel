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
  };
};

export const tasksApi = {
  async getPage(token: string, page = 0, size = 50): Promise<SharedTaskPage> {
    const query = new URLSearchParams({ page: String(page), size: String(size) });
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

  async create(payload: SharedTaskCreatePayload, token: string): Promise<void> {
    await request('/api/tasks', token, { method: 'POST', body: JSON.stringify(payload) });
  },

  async update(taskId: number, payload: SharedTaskUpdatePayload, token: string): Promise<void> {
    await request(`/api/tasks/${taskId}`, token, { method: 'PUT', body: JSON.stringify(payload) });
  },

  async delete(taskId: number, token: string): Promise<void> {
    await request(`/api/tasks/${taskId}`, token, { method: 'DELETE' });
  },
};
