import { z } from 'zod';
import { DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE } from '../constants/api.js';

/**
 * Slugs are the public identifier for every content entity. Numeric ids never
 * appear in public URLs, so they are not enumerable from the public surface.
 */
export const slugSchema = z
  .string()
  .trim()
  .min(1)
  .max(120)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Must be lowercase words separated by single hyphens');

/** Positive integer route parameter, e.g. /admin/projects/:id */
export const idSchema = z.coerce.number().int().positive();

export const idParamSchema = z.object({ id: idSchema });

/** Public detail-route param — every public read addresses content by slug, never id (docs/architecture/03 §2). */
export const slugParamSchema = z.object({ slug: slugSchema });

/**
 * Any URL that will end up in an `href` or `src`.
 *
 * Rejecting non-HTTP(S) protocols here closes a stored-XSS vector that markdown
 * sanitisation does not cover: `githubUrl`, `liveUrl` and social links are
 * rendered as attributes, not as markdown, so `javascript:` in one of those
 * fields would execute. Parsing with `URL` rather than a regex avoids the
 * usual bypasses (leading whitespace, `JaVaScRiPt:`, embedded newlines).
 *
 * `http:` is permitted only outside production; see `webUrlSchema` below.
 */
const ALLOWED_URL_PROTOCOLS = new Set(['https:', 'http:']);

export const httpsUrlSchema = z
  .string()
  .trim()
  .max(2048)
  .superRefine((value, ctx) => {
    let parsed: URL;
    try {
      parsed = new URL(value);
    } catch {
      ctx.addIssue({ code: 'custom', message: 'Must be a valid absolute URL' });
      return;
    }
    if (parsed.protocol !== 'https:') {
      ctx.addIssue({ code: 'custom', message: 'Must use https' });
    }
  });

/** Like `httpsUrlSchema` but tolerates `http:` — for local development values only. */
export const webUrlSchema = z
  .string()
  .trim()
  .max(2048)
  .superRefine((value, ctx) => {
    let parsed: URL;
    try {
      parsed = new URL(value);
    } catch {
      ctx.addIssue({ code: 'custom', message: 'Must be a valid absolute URL' });
      return;
    }
    if (!ALLOWED_URL_PROTOCOLS.has(parsed.protocol)) {
      ctx.addIssue({ code: 'custom', message: 'Must use http or https' });
    }
  });

/** Emails are normalised to lowercase before lookup and storage (SQLite has no case-insensitive mode). */
export const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .max(254)
  .pipe(z.email('Must be a valid email address'));

/**
 * Pagination. `pageSize` is clamped rather than rejected so an over-large value
 * degrades gracefully instead of 400-ing a legitimate client.
 */
export const paginationQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce
    .number()
    .int()
    .positive()
    .default(DEFAULT_PAGE_SIZE)
    .transform((n) => Math.min(n, MAX_PAGE_SIZE)),
});

export type PaginationQuery = z.infer<typeof paginationQuerySchema>;

/** Sort direction. Sort *keys* are validated per resource against an allow-list. */
export const sortOrderSchema = z.enum(['asc', 'desc']).default('desc');

/**
 * `z.iso.date()`/`z.iso.datetime()` alone validate the STRING shape but
 * leave the value a string — passed straight through to Prisma, a
 * date-only string (`"2022-06-01"`, no time component) hits SQLite's
 * driver adapter as "premature end of input. Expected ISO-8601 DateTime,"
 * confirmed empirically against the real database, not assumed from
 * reading Prisma's docs. `.transform((v) => new Date(v))` converts a
 * validated string into a real `Date` at the schema boundary — the only
 * place across the whole call chain — so nothing downstream, in any
 * repository's `create`/`update`, ever hands Prisma a raw date string
 * again. `new Date("2022-06-01")` itself parses correctly (UTC midnight)
 * once it's an actual `Date` being constructed rather than a string percolating
 * through to Prisma's own parser.
 */
export const isoDateAsDate = z.iso.date().transform((value) => new Date(value));
export const isoDatetimeAsDate = z.iso.datetime().transform((value) => new Date(value));
