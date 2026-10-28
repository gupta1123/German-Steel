interface TaskRelatedRecordIds {
  projectId?: number | null;
  institutionId?: number | null;
  clientAccountId?: number | null;
}

export interface TaskRelatedRecord {
  href: string;
  label: 'View Project' | 'View Institution' | 'View Store';
}

const isValidId = (value: unknown): value is number => typeof value === 'number' && Number.isSafeInteger(value) && value > 0;

/** A project can also carry its parent institution ID; open the more specific record. */
export function getTaskRelatedRecord(task: TaskRelatedRecordIds): TaskRelatedRecord | null {
  if (isValidId(task.projectId)) return { href: `/dashboard/projects/${task.projectId}`, label: 'View Project' };
  if (isValidId(task.institutionId)) return { href: `/dashboard/institutions/${task.institutionId}`, label: 'View Institution' };
  if (isValidId(task.clientAccountId)) return { href: `/dashboard/customers/${task.clientAccountId}`, label: 'View Store' };
  return null;
}
