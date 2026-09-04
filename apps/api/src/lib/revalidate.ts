import { env } from '../config/env.js';
import { logger } from './logger.js';

/**
 * On-demand revalidation: notifies the Next.js web app that certain cache
 * tags are stale, right after an admin mutation's own transaction commits
 * (docs/architecture/01 §4.2's sequence diagram — `S->>N: POST /api/revalidate
 * (shared secret) tags: [...]`; docs/architecture/06 line 53 for the receiving
 * Route Handler at `apps/web/src/app/api/revalidate/route.ts`).
 *
 * Deliberately best-effort: a mutation that already committed to the database
 * (and already has its audit-log entry) must never be reported as failed to
 * the admin just because the web app is briefly unreachable or slow — the
 * page in question still gets revalidated eventually via the time-based
 * `revalidate: 3600` fallback every cached fetch also carries
 * (docs/architecture/01 line 223: "Time-based revalidation is a fallback...
 * not the primary mechanism"). Every failure path here is caught and logged,
 * never thrown — this function's return value tells the caller whether it
 * worked, but nothing upstream is obligated to check it, let alone roll back
 * on a `false`.
 */

const REVALIDATE_PATH = '/api/revalidate';

/** Generous but bounded — this must never be the reason an admin request hangs. */
const REQUEST_TIMEOUT_MS = 5000;

export async function revalidateTags(tags: string[]): Promise<boolean> {
  if (tags.length === 0) return true;

  const url = new URL(REVALIDATE_PATH, env.PUBLIC_SITE_URL).toString();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Revalidate-Secret': env.REVALIDATE_SECRET,
      },
      body: JSON.stringify({ tags }),
      signal: controller.signal,
    });

    if (!response.ok) {
      logger.warn(
        { tags, status: response.status },
        'revalidate: web app rejected the revalidation request',
      );
      return false;
    }

    return true;
  } catch (error) {
    // Network error, timeout, DNS failure, web app down — all the same
    // outcome here: log it and move on. See the file-level comment for why
    // this never throws.
    logger.warn({ tags, error }, 'revalidate: request to the web app failed');
    return false;
  } finally {
    clearTimeout(timeout);
  }
}
