import { format } from "date-fns";

const DATE_FMT = "PP";
const DATETIME_FMT = "PPpp";

/**
 * Formats a Date as a locale-friendly date (e.g., "May 12, 2026").
 * Server-side falls back to en-US; clients should pass a locale-aware
 * formatter when running in the browser.
 */
export function formatDate(d: Date): string {
  return format(d, DATE_FMT);
}

/**
 * Formats a Date with date and time (e.g., "May 12, 2026, 3:14 PM").
 */
export function formatDateTime(d: Date): string {
  return format(d, DATETIME_FMT);
}
