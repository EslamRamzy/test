import { z } from 'zod';
import { isoDateAsDate } from './primitives.js';

/**
 * The page-view beacon (docs/architecture/03 §3, docs/architecture/09 §10).
 * Fire-and-forget from the public client — no cookie, no session, and no raw
 * IP ever leaves this schema's shape: `visitor_hash` is computed server-side
 * from the request's own IP + user agent, never accepted from the client.
 */
export const analyticsViewSchema = z
  .object({
    path: z.string().trim().min(1).max(500),
    entityType: z.enum(['PROJECT', 'ARTICLE', 'RESEARCH', 'PAGE']).optional(),
    entityId: z.number().int().positive().optional(),
    /** Host only, never the full referrer URL — a full URL can leak a search query or a private path (doc 09 §10). */
    referrerHost: z.string().trim().max(255).optional(),
  })
  .strict();
export type AnalyticsViewInput = z.infer<typeof analyticsViewSchema>;

/** `GET /admin/analytics` — "?from,to,groupBy" (doc03 §5). `from`/`to` default in the service, not here (the "last 30 days" default depends on the current date, which a static schema default can't express). */
export const analyticsAdminQuerySchema = z
  .object({
    from: isoDateAsDate.optional(),
    to: isoDateAsDate.optional(),
    groupBy: z.enum(['day', 'week', 'month']).default('day'),
  })
  .strict();
export type AnalyticsAdminQuery = z.infer<typeof analyticsAdminQuerySchema>;
