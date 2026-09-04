/** Formats an ISO-8601 date string (docs/architecture/03 §2) as e.g. "Sep 4, 2026". English-only (decision D10). */
export function formatDate(isoDate: string): string {
  return new Date(isoDate).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC',
  });
}
