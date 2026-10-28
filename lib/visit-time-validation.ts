export const VISIT_TIME_REQUIRED_ERROR = 'Start time and end time are required.';
export const VISIT_TIME_INVALID_ERROR = 'Enter valid start and end times.';
export const VISIT_TIME_ORDER_ERROR = 'End time must be later than start time.';

const secondsOfDay = (value: string): number | null => {
  const match = /^([01]\d|2[0-3]):([0-5]\d)(?::([0-5]\d))?$/.exec(value);
  return match ? Number(match[1]) * 3600 + Number(match[2]) * 60 + Number(match[3] ?? 0) : null;
};

/** A visit has one scheduled date, so both times must form a positive same-day range. */
export function getVisitTimeRangeError(startTime: string | null | undefined, endTime: string | null | undefined): string | null {
  if (!startTime || !endTime) return VISIT_TIME_REQUIRED_ERROR;
  const start = secondsOfDay(startTime);
  const end = secondsOfDay(endTime);
  if (start === null || end === null) return VISIT_TIME_INVALID_ERROR;
  return end <= start ? VISIT_TIME_ORDER_ERROR : null;
}
