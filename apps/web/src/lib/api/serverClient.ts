import type {
  ApiFailure,
  ApiPaginatedSuccess,
  ApiSuccess,
  PaginationMeta,
} from '@portfolio/shared';
import { getApiInternalUrl } from '../config';
import { ApiError } from './ApiError';

/**
 * Server-side API access (docs/architecture/06 §4, docs/architecture/04
 * §7). Only Server Components and Route Handlers may import this — it
 * calls `API_INTERNAL_URL` directly, over the container network, so this
 * traffic never leaves the host. The browser client (`publicApiClient.ts`,
 * used by the one client island that needs it — the contact form) is a
 * separate, deliberately smaller file that talks to the PUBLIC origin
 * instead.
 */

export interface FetchTags {
  /** Next's own cache-tag invalidation (`revalidateTag`) — Phase 8's admin publish actions will call this once they exist. */
  tags?: string[];
  /** Seconds, or `false` for "cache indefinitely until explicitly revalidated." Defaults to 1 hour (doc 06 §4's own example). */
  revalidate?: number | false;
}

async function request<T>(path: string, options: FetchTags = {}): Promise<T> {
  const { tags, revalidate = 3600 } = options;

  const res = await fetch(`${getApiInternalUrl()}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    next: { ...(tags ? { tags } : {}), revalidate },
  });

  const body = (await res.json()) as ApiSuccess<T> | ApiFailure;

  if (!res.ok || !body.success) {
    const message = body.success ? 'Unexpected API response shape' : body.error.message;
    const code = body.success ? undefined : body.error.code;
    throw new ApiError(res.status, message, code);
  }

  return body.data;
}

/** Same as `request`, but for a paginated list endpoint — returns items and pagination meta together. */
async function requestPaginated<T>(
  path: string,
  options: FetchTags = {},
): Promise<{ items: T[]; meta: PaginationMeta }> {
  const { tags, revalidate = 3600 } = options;

  const res = await fetch(`${getApiInternalUrl()}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    next: { ...(tags ? { tags } : {}), revalidate },
  });

  const body = (await res.json()) as ApiPaginatedSuccess<T> | ApiFailure;

  if (!res.ok || !body.success) {
    const message = body.success ? 'Unexpected API response shape' : body.error.message;
    const code = body.success ? undefined : body.error.code;
    throw new ApiError(res.status, message, code);
  }

  return { items: body.data, meta: body.meta };
}

/**
 * Fetches a detail resource that may legitimately not exist, translating a
 * `404` into `null` rather than an exception — the caller passes that to
 * Next's `notFound()`, exactly the pattern doc 06 §4 shows. Any OTHER
 * failure (validation, rate limit, a real server error) still throws.
 */
async function requestOrNull<T>(path: string, options: FetchTags = {}): Promise<T | null> {
  try {
    return await request<T>(path, options);
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) return null;
    throw error;
  }
}

export const serverApi = { request, requestPaginated, requestOrNull };
