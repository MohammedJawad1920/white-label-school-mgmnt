/**
 * Tenant Timezone Utilities
 *
 * Pure functions for timezone-aware date validation.
 * Extracted for unit testability per Freeze v6.1 §13.4.
 */

import { formatInTimeZone, toZonedTime } from "date-fns-tz";
import { parseISO, isBefore, startOfDay } from "date-fns";

/**
 * Gets the current date string in a tenant's timezone.
 *
 * @param timezone - IANA timezone string (e.g., "Asia/Kolkata")
 * @param referenceDate - The UTC date to convert (defaults to now)
 * @returns Date string in YYYY-MM-DD format
 */
export function getTodayInTimezone(
  timezone: string = "UTC",
  referenceDate: Date = new Date(),
): string {
  return formatInTimeZone(referenceDate, timezone, "yyyy-MM-dd");
}

/**
 * Gets the current hour in a tenant's timezone.
 *
 * @param timezone - IANA timezone string
 * @param referenceDate - The UTC date to convert
 * @returns Hour string in HH format (00-23)
 */
export function getCurrentHourInTimezone(
  timezone: string = "UTC",
  referenceDate: Date = new Date(),
): string {
  return formatInTimeZone(referenceDate, timezone, "HH");
}

/**
 * Checks if a date is in the past for a given tenant timezone.
 *
 * Used by attendance backdating guard per Freeze §13.4.
 *
 * @param dateStr - Date string in YYYY-MM-DD format
 * @param timezone - Tenant timezone
 * @param referenceDate - The current UTC time (for testing)
 * @returns true if the date is before today in the tenant's timezone
 */
export function isDateInPast(
  dateStr: string,
  timezone: string = "UTC",
  referenceDate: Date = new Date(),
): boolean {
  const todayStr = getTodayInTimezone(timezone, referenceDate);
  return dateStr < todayStr;
}

/**
 * Checks if a date is today in the tenant's timezone.
 *
 * @param dateStr - Date string in YYYY-MM-DD format
 * @param timezone - Tenant timezone
 * @param referenceDate - The current UTC time
 * @returns true if the date equals today in the tenant's timezone
 */
export function isDateToday(
  dateStr: string,
  timezone: string = "UTC",
  referenceDate: Date = new Date(),
): boolean {
  const todayStr = getTodayInTimezone(timezone, referenceDate);
  return dateStr === todayStr;
}

/**
 * Checks if a date is in the future for a given tenant timezone.
 *
 * @param dateStr - Date string in YYYY-MM-DD format
 * @param timezone - Tenant timezone
 * @param referenceDate - The current UTC time
 * @returns true if the date is after today in the tenant's timezone
 */
export function isDateInFuture(
  dateStr: string,
  timezone: string = "UTC",
  referenceDate: Date = new Date(),
): boolean {
  const todayStr = getTodayInTimezone(timezone, referenceDate);
  return dateStr > todayStr;
}

/**
 * Validates whether an attendance date can be modified by a given role.
 *
 * Rules per Freeze §13.4:
 * - Admin can modify any date
 * - Teacher can only modify today (no backdating)
 *
 * @param dateStr - Date being modified
 * @param timezone - Tenant timezone
 * @param isAdmin - Whether the user has Admin role
 * @param referenceDate - Current UTC time
 * @returns Validation result with isValid and error
 */
export function validateAttendanceDate(
  dateStr: string,
  timezone: string,
  isAdmin: boolean,
  referenceDate: Date = new Date(),
): {
  isValid: boolean;
  errorCode?: string;
  errorMessage?: string;
} {
  // Admin bypasses all date restrictions
  if (isAdmin) {
    return { isValid: true };
  }

  // Teacher cannot backdate
  if (isDateInPast(dateStr, timezone, referenceDate)) {
    return {
      isValid: false,
      errorCode: "BACKDATING_NOT_ALLOWED",
      errorMessage: "Teachers cannot backdate attendance",
    };
  }

  // Teacher cannot future-date (only today)
  if (isDateInFuture(dateStr, timezone, referenceDate)) {
    return {
      isValid: false,
      errorCode: "FUTURE_DATE_NOT_ALLOWED",
      errorMessage: "Cannot record attendance for future dates",
    };
  }

  return { isValid: true };
}

/**
 * Checks if it's the specified hour in the tenant's timezone.
 *
 * Used by cron jobs to run at specific local times.
 *
 * @param targetHour - The hour to check (e.g., "09" for 9 AM)
 * @param timezone - Tenant timezone
 * @param referenceDate - Current UTC time
 * @returns true if current hour matches target
 */
export function isTargetHourInTimezone(
  targetHour: string,
  timezone: string = "UTC",
  referenceDate: Date = new Date(),
): boolean {
  const currentHour = getCurrentHourInTimezone(timezone, referenceDate);
  return currentHour === targetHour;
}

/**
 * Converts a date-time to a tenant's local timezone for display.
 *
 * @param utcDate - UTC Date object or ISO string
 * @param timezone - Target timezone
 * @param format - date-fns format string
 * @returns Formatted date string in local timezone
 */
export function formatInTenantTimezone(
  utcDate: Date | string,
  timezone: string = "UTC",
  format: string = "yyyy-MM-dd HH:mm:ss",
): string {
  const date = typeof utcDate === "string" ? new Date(utcDate) : utcDate;
  return formatInTimeZone(date, timezone, format);
}

/**
 * Gets the start of day in a tenant's timezone as a UTC Date.
 *
 * Useful for date range queries.
 *
 * @param dateStr - Date string in YYYY-MM-DD format
 * @param timezone - Tenant timezone
 * @returns UTC Date representing start of day in tenant timezone
 */
export function getStartOfDayInTimezone(
  dateStr: string,
  timezone: string = "UTC",
): Date {
  // Create a date at midnight in the tenant's timezone
  const localMidnight = `${dateStr}T00:00:00`;
  return toZonedTime(parseISO(localMidnight), timezone);
}
