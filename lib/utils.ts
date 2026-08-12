import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"
import { format, isToday, isYesterday, parseISO } from "date-fns"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Formats time string to 12-hour format (e.g., "05:30 PM")
 * @param timeString - Time in HH:mm format (e.g., "17:30")
 * @returns Formatted time string (e.g., "05:30 PM")
 */
export function formatTimeTo12Hour(timeString: string): string {
  if (!timeString) return '';
  
  try {
    // Parse the time string and format it to 12-hour format
    const [hours, minutes] = timeString.split(':');
    const date = new Date();
    date.setHours(parseInt(hours, 10), parseInt(minutes, 10), 0, 0);
    
    return format(date, 'h:mm a');
  } catch (error) {
    console.error('Error formatting time:', error);
    return timeString; // Return original string if formatting fails
  }
}

/**
 * Formats date string to user-friendly format (Today, Yesterday, or 09 Oct 2018)
 * @param dateString - Date in yyyy-MM-dd format
 * @returns Formatted date string
 */
export function formatDateToUserFriendly(dateString: string): string {
  if (!dateString) return '';
  
  try {
    const date = parseISO(dateString);
    
    if (isToday(date)) {
      return 'Today';
    } else if (isYesterday(date)) {
      return 'Yesterday';
    } else {
      return format(date, 'dd MMM yyyy');
    }
  } catch (error) {
    console.error('Error formatting date:', error);
    return dateString; // Return original string if formatting fails
  }
}

/**
 * Formats last updated field combining date and time formatting
 * @param lastUpdatedString - String in format "yyyy-MM-dd HH:mm" or similar
 * @returns Formatted string like "Today 05:30 PM" or "09 Oct 2018 05:30 PM"
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
