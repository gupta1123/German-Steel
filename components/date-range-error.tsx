import { AlertCircle } from "lucide-react";

import { cn } from "@/lib/utils";

export const DATE_RANGE_ERROR_MESSAGE = "Please select a From Date that is on or before the To Date.";
export const DATE_RANGE_START_REQUIRED_MESSAGE = "Please select the From Date first.";

type DateRangeValue = Date | string | null | undefined;

const toComparableTime = (value: DateRangeValue): number | null => {
  if (!value) return null;
  const date = value instanceof Date
    ? value
    : /^\d{4}-\d{2}-\d{2}$/.test(value)
      ? new Date(`${value}T00:00:00`)
      : new Date(value);
  const time = date.getTime();
  return Number.isNaN(time) ? null : time;
};

export const getDateRangeError = (fromDate: DateRangeValue, toDate: DateRangeValue): string | null => {
  if (!fromDate && toDate) return DATE_RANGE_START_REQUIRED_MESSAGE;

  const fromTime = toComparableTime(fromDate);
  const toTime = toComparableTime(toDate);
  if (fromTime !== null && toTime !== null && fromTime > toTime) {
    return DATE_RANGE_ERROR_MESSAGE;
  }

  return null;
};

export const isDateRangeInvalid = (fromDate: DateRangeValue, toDate: DateRangeValue) =>
  Boolean(getDateRangeError(fromDate, toDate));

interface DateRangeErrorProps {
  fromDate: DateRangeValue;
  toDate: DateRangeValue;
  className?: string;
}

export function DateRangeError({ fromDate, toDate, className }: DateRangeErrorProps) {
  const message = getDateRangeError(fromDate, toDate);
  if (!message) return null;

  return (
    <div
      role="alert"
      aria-live="polite"
      className={cn(
        "flex items-center gap-2 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive",
        className,
      )}
    >
      <AlertCircle className="h-4 w-4 shrink-0" aria-hidden="true" />
      <span>{message}</span>
    </div>
  );
}
