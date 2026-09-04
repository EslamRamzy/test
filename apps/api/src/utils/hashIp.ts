import { createHash } from 'node:crypto';
import { env } from '../config/env.js';

/**
 * Privacy-preserving identifier hash for audit logs (docs/architecture/09
 * §10): `sha256(ip + userAgent + dailySalt)`, where the salt rotates every
 * 24h (UTC calendar day). This keeps the value useful for same-day abuse
 * investigation (e.g. "these 8 failed logins came from the same hashed
 * source") while making it non-reversible and non-linkable across days —
 * the same treatment doc 09 §10 specifies for `page_views.visitor_hash` and
 * `contact_messages.ip_hash`, reused here for `audit_logs.ip_hash` and
 * `refresh_tokens.ip_hash`.
 *
 * `IP_HASH_SALT` is its own dedicated secret, not reused from `JWT_SECRET`
 * or `CSRF_SECRET` — it has been in `.env.example` and `docker-compose.yml`
 * since Phase 1, anticipating exactly this use.
 */
function dailySalt(): string {
  const utcDay = new Date().toISOString().slice(0, 10); // YYYY-MM-DD, UTC
  return createHash('sha256').update(`${env.IP_HASH_SALT}:${utcDay}`).digest('hex');
}

export function hashIp(ip: string, userAgent: string | undefined): string {
  return createHash('sha256')
    .update(`${ip}:${userAgent ?? ''}:${dailySalt()}`)
    .digest('hex');
}
