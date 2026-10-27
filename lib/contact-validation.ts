export const FUTURE_DATE_OF_BIRTH_ERROR = 'Date of birth cannot be in the future.';
export const INVALID_DATE_OF_BIRTH_ERROR = 'Enter a valid date of birth.';

/** A date-input value in the user's local calendar, rather than the UTC date. */
export function localDateInputValue(now = new Date()): string {
  return [now.getFullYear().toString().padStart(4, '0'), String(now.getMonth() + 1).padStart(2, '0'), String(now.getDate()).padStart(2, '0')].join('-');
}

export function getDateOfBirthError(value: string | null | undefined, now = new Date()): string | null {
  if (!value) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return INVALID_DATE_OF_BIRTH_ERROR;

  const [year, month, day] = value.split('-').map(Number);
  const leapYear = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  const daysInMonth = [31, leapYear ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  if (year < 1 || month < 1 || month > 12 || day < 1 || day > daysInMonth[month - 1]) return INVALID_DATE_OF_BIRTH_ERROR;

  return value > localDateInputValue(now) ? FUTURE_DATE_OF_BIRTH_ERROR : null;
}
