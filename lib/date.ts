/**
 * All timestamps from the API are stored as UTC (TIMESTAMPTZ).
 * TypeORM may serialize them without the "Z" suffix on some drivers.
 * These helpers ensure correct UTC parsing + browser-local display.
 */

/**
 * Parse a UTC timestamp string from the API into a JavaScript Date.
 * Appends "Z" when no timezone offset is present so the browser always
 * treats the value as UTC rather than local time.
 */
export function parseUTC(s: string | Date): Date {
  if (s instanceof Date) return s;
  if (s.endsWith('Z') || s.includes('+') || /[0-9]{2}-[0-9]{2}:[0-9]{2}$/.test(s)) {
    return new Date(s);
  }
  return new Date(s + 'Z');
}

/**
 * Format a UTC timestamp in the browser's local timezone and locale.
 * Automatically shows "IST", "EDT", "UTC", etc. based on the user's system.
 *
 * @example
 *   fmtDateTime(parseUTC(log.createdAt))
 *   // → "28 Apr 2026, 10:01 IST"  (for India)
 *   // → "28 Apr 2026, 05:31 EDT"  (for US Eastern)
 */
export function fmtDateTime(d: Date): string {
  return d.toLocaleString(undefined, {
    day:          '2-digit',
    month:        'short',
    year:         'numeric',
    hour:         '2-digit',
    minute:       '2-digit',
    hour12:       false,
    timeZoneName: 'short',
  });
}

/**
 * Format a UTC timestamp as a date-only string in the browser's local timezone.
 *
 * @example
 *   fmtDate(parseUTC(project.createdAt))
 *   // → "28 Apr 2026"
 */
export function fmtDate(d: Date): string {
  return d.toLocaleDateString(undefined, {
    day:   '2-digit',
    month: 'short',
    year:  'numeric',
  });
}

/**
 * "2 minutes ago", "about 3 hours ago", etc.
 * Recompute each minute by re-rendering; accuracy degrades if page is stale.
 */
export function timeAgo(d: Date): string {
  const secs = Math.floor((Date.now() - d.getTime()) / 1000);
  if (secs < 60)   return 'just now';
  if (secs < 3600) return `${Math.floor(secs / 60)} min ago`;
  if (secs < 86400) {
    const h = Math.floor(secs / 3600);
    return `about ${h} hour${h > 1 ? 's' : ''} ago`;
  }
  const days = Math.floor(secs / 86400);
  return `${days} day${days > 1 ? 's' : ''} ago`;
}
