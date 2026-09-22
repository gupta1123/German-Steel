import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"
import { format, parseISO } from "date-fns"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

const DISPLAY_ACRONYMS = new Map(
  [
    "aec", "aecom", "api", "crm", "crn", "csv", "da", "dob", "fda", "fe",
    "gps", "gst", "gstin", "hcc", "ho", "http", "https", "id", "it", "jnpt",
    "jv", "km", "knr", "mt", "nbcc", "nc", "ncr", "nhai", "orr", "pdf",
    "pin", "pmc", "pwd", "smec", "stup", "ta", "tmt", "url",
  ].map((value) => [value, value.toUpperCase()]),
);

/**
 * Normalizes human-facing names and labels without touching case-sensitive
 * values such as email addresses, URLs, file paths, or opaque identifiers.
 */
export function toTitleCase(value: string | null | undefined): string {
  const normalized = String(value ?? "").trim().replace(/\s+/g, " ");
  if (!normalized) return "";
  if (
    normalized.includes("@") ||
    /^(?:https?:\/\/|www\.|[./\\])\S+$/i.test(normalized)
  ) {
    return normalized;
  }

  return normalized
    .toLocaleLowerCase("en-IN")
    .replace(/(^|[\s\-–—/('])([\p{L}\p{N}])/gu, (_, boundary: string, letter: string) => (
      `${boundary}${letter.toLocaleUpperCase("en-IN")}`
    ))
    .replace(/\b[\p{L}]+\b/gu, (word) => DISPLAY_ACRONYMS.get(word.toLowerCase()) ?? word)
    .replace(/\bL&t\b/gi, "L&T");
}

export function formatPersonName(...parts: Array<string | null | undefined>): string {
  return toTitleCase(parts.filter(Boolean).join(" "));
}

/**
 * Formats time string to 12-hour format (e.g., "05:30 PM")
 * Accepts "HH:mm", "HH:mm:ss", or ISO datetime ("2026-09-08T16:55:12.80206").
 */
export function formatTimeTo12Hour(timeString: string): string {
  if (!timeString) return '';

  try {
    const trimmed = timeString.trim();
    // ISO datetime → parse and format time portion
    if (trimmed.includes('T')) {
      const date = parseISO(trimmed);
      return format(date, 'h:mm a');
    }
    // "HH:mm" or "HH:mm:ss" (time-only)
    const [hours, minutes] = trimmed.split(':');
    const date = new Date();
    date.setHours(parseInt(hours, 10), parseInt(minutes, 10), 0, 0);

    return format(date, 'h:mm a');
  } catch (error) {
    console.error('Error formatting time:', error);
    return timeString; // Return original string if formatting fails
  }
}

/**
 * Formats date strings consistently for display (for example, Oct 09, 2018)
 * @param dateString - Date in yyyy-MM-dd format
 * @returns Formatted date string
 */
export function formatDateToUserFriendly(dateString: string): string {
  if (!dateString) return '';
  
  try {
    const date = parseISO(dateString);
    
    return format(date, 'MMM dd, yyyy');
  } catch (error) {
    console.error('Error formatting date:', error);
    return dateString; // Return original string if formatting fails
  }
}

/**
 * Formats last updated field combining date and time formatting
 * @param lastUpdatedString - String in format "yyyy-MM-dd HH:mm" or similar
 * @returns Formatted string like "Oct 09, 2018 05:30 PM"
 */
export function formatLastUpdated(lastUpdatedString: string): string {
  if (!lastUpdatedString) return '';
  
  try {
    // Handle different possible formats
    let date: Date;
    
    // Try to parse as ISO string first
    if (lastUpdatedString.includes('T')) {
      date = parseISO(lastUpdatedString);
    } else {
      // Handle space-separated date and time
      const parts = lastUpdatedString.split(' ');
      if (parts.length >= 2) {
        const datePart = parts[0];
        const timePart = parts[1];
        
        // Create date from date part and time part
        const [year, month, day] = datePart.split('-').map(Number);
        const [hours, minutes] = timePart.split(':').map(Number);
        
        date = new Date(year, month - 1, day, hours, minutes);
      } else {
        // Fallback to parsing the whole string
        date = parseISO(lastUpdatedString);
      }
    }
    
    const formattedDate = formatDateToUserFriendly(format(date, 'yyyy-MM-dd'));
    const formattedTime = formatTimeTo12Hour(format(date, 'HH:mm'));
    
    return `${formattedDate} ${formattedTime}`;
  } catch (error) {
    console.error('Error formatting last updated:', error);
    return lastUpdatedString; // Return original string if formatting fails
  }
}
