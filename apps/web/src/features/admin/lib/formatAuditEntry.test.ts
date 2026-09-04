import { describe, expect, it } from 'vitest';
import { formatAuditTimestamp, humanizeAuditAction } from './formatAuditEntry';

describe('humanizeAuditAction', () => {
  it('turns SNAKE_CASE into a single capitalized sentence fragment', () => {
    expect(humanizeAuditAction('LOGIN_SUCCESS')).toBe('Login success');
    expect(humanizeAuditAction('PROJECT_PUBLISH')).toBe('Project publish');
    expect(humanizeAuditAction('TOKEN_REUSE_DETECTED')).toBe('Token reuse detected');
  });

  it('handles a single-word action with no underscores', () => {
    expect(humanizeAuditAction('LOGOUT')).toBe('Logout');
  });
});

describe('formatAuditTimestamp', () => {
  it('includes both date and time', () => {
    const formatted = formatAuditTimestamp('2026-09-04T13:45:00.000Z');
    expect(formatted).toMatch(/2026/);
    // Time-of-day (hour:minute) must be present, not just a bare date — the
    // whole point over the public site's date-only `formatDate`.
    expect(formatted).toMatch(/\d{1,2}:\d{2}/);
  });
});
