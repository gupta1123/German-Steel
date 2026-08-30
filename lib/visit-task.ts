import type { Task } from './api';

const textValue = (...values: unknown[]): string => {
  for (const value of values) {
    if (typeof value === 'string' && value.trim()) return value.trim();
  }
  return '';
};

// The visit endpoint returns taskTitle/taskDescription and assignedToName,
// while detail views consume the normalized Task model.
export function normalizeVisitTask(raw: Record<string, unknown>): Task {
  return {
    id: Number(raw.id) || 0,
    title: textValue(raw.taskTitle, raw.title),
    description: textValue(raw.taskDescription, raw.taskDesciption, raw.description),
    type: textValue(raw.taskType, raw.type).toLowerCase(),
    status: textValue(raw.status),
    priority: textValue(raw.priority).toLowerCase(),
    assignedTo: textValue(raw.assignedToName, raw.assignedTo),
    assignedToId: Number(raw.assignedToId) || undefined,
    assignedBy: textValue(raw.assignedByName, raw.assignedBy),
    dueDate: textValue(raw.dueDate),
    visitId: Number(raw.visitId) || 0,
    storeName: textValue(raw.storeName),
    storeCity: textValue(raw.storeCity),
    createdAt: textValue(raw.createdAt),
    updatedAt: textValue(raw.updatedAt),
    imageCount: Number(raw.imageCount) || 0,
  };
}
