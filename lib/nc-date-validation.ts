export const NC_RAISED_DATE_REQUIRED_ERROR = 'Raised date is required.';
export const NC_RAISED_DATE_INVALID_ERROR = 'Enter a valid raised date.';
export const NC_TARGET_DATE_INVALID_ERROR = 'Enter a valid target closure date.';
export const NC_TARGET_DATE_ORDER_ERROR = 'Target closure date cannot be earlier than raised date.';

const isCalendarDate = (value: string): boolean => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || value.startsWith('0000-')) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
};

/** Target closure is optional; when supplied, the raised date itself is allowed. */
export function getNcDateError(raisedDate: string | null | undefined, targetClosureDate: string | null | undefined): string | null {
  if (!raisedDate) return NC_RAISED_DATE_REQUIRED_ERROR;
  if (!isCalendarDate(raisedDate)) return NC_RAISED_DATE_INVALID_ERROR;
  if (!targetClosureDate) return null;
  if (!isCalendarDate(targetClosureDate)) return NC_TARGET_DATE_INVALID_ERROR;
  // Compare calendar dates directly, without converting them to the user's time zone.
  return targetClosureDate < raisedDate ? NC_TARGET_DATE_ORDER_ERROR : null;
}
