/**
 * Audit `action` values are free text, not a fixed enum (docs/architecture
 * schema comment on `AuditLog.action`: "the action vocabulary grows with
 * every feature and an audit trail must never reject a write for an
 * unrecognised action name") — so this is a generic SNAKE_CASE → "Snake
 * case" humanizer, not a lookup table. A table would need a new entry
 * every time any future phase adds an action, which is exactly the
 * maintenance burden a free-text column was chosen to avoid upstream.
 */
export function humanizeAuditAction(action: string): string {
  const lower = action.toLowerCase().replaceAll('_', ' ');
  return lower.charAt(0).toUpperCase() + lower.slice(1);
}

/**
 * Local time, not UTC — unlike the public site's `formatDate` (pinned to
 * UTC because it renders the same content to every visitor regardless of
 * timezone), this is admin-only internal data where the one viewer's own
 * local clock is the more useful reading. Includes time-of-day, not just
 * the date: audit entries can be seconds apart and a date-only format
 * would make them indistinguishable.
 */
export function formatAuditTimestamp(isoDate: string): string {
  return new Date(isoDate).toLocaleString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}
