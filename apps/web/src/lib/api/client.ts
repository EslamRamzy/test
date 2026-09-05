import type {
  AnalyticsViewInput,
  ApiFailure,
  ApiSuccess,
  ContactInput,
  SearchResultDto,
} from '@portfolio/shared';
import { getApiBaseUrl } from '../config';
import { ApiError } from './ApiError';

/**
 * Browser-side API access (docs/architecture/06 §4) — the two public writes
 * a Client Component ever makes: the contact form and the page-view beacon.
 * Talks to the PUBLIC API origin (`getApiBaseUrl()`), not the internal one
 * `serverClient.ts` uses.
 *
 * `credentials: 'include'` is set unconditionally, even though neither call
 * here needs a cookie today — both endpoints are explicitly unauthenticated
 * and CSRF-exempt (docs/architecture/04 §5: "no session to ride"). Setting
 * it here now, once, is what doc 06 §4 means by "so no call site can
 * forget": Phase 7 adds the admin's authenticated calls to this same file,
 * and a fetch missing `credentials: 'include'` silently drops cookies and
 * returns `401` — a confusing failure mode worth avoiding structurally
 * rather than by remembering it per call site later.
 */
async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(`${getApiBaseUrl()}${path}`, {
    ...init,
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', ...init.headers },
  });

  // The analytics beacon returns 204 — no body to parse.
  if (res.status === 204) return undefined as T;

  const body = (await res.json()) as ApiSuccess<T> | ApiFailure;

  if (!res.ok || !body.success) {
    const message = body.success ? 'Unexpected API response shape' : body.error.message;
    const code = body.success ? undefined : body.error.code;
    throw new ApiError(res.status, message, code);
  }

  return body.data;
}

export function submitContact(input: ContactInput) {
  return request<{ received: boolean }>('/api/v1/contact', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

/**
 * Fire-and-forget — callers should not await this in a way that blocks
 * anything the visitor is looking at; a failed beacon must never be visible
 * to them (doc 03 §3: "fire-and-forget").
 */
export function recordAnalyticsView(input: AnalyticsViewInput): Promise<void> {
  return request<void>('/api/v1/analytics/view', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

/**
 * The command palette's own live search (doc06 §39: "debounced 250ms against
 * GET /api/v1/search?q="). A browser-side fetch, not `endpoints.ts`'s
 * `search()` — that one goes through `serverApi.request` (`API_INTERNAL_URL`,
 * a Server Component/Route Handler concern), which a Client Component cannot
 * call directly. `/search`'s own rate limit (`searchLimiter`, doc09 §4:
 * 30/min) is the same limit `next dev`'s SSR-rendered `/search` page already
 * shares — a debounced 250ms client only makes that bucket easier to stay
 * under, never harder.
 */
export function searchContent(q: string, limit?: number): Promise<SearchResultDto[]> {
  const params = new URLSearchParams({ q });
  if (limit !== undefined) params.set('limit', String(limit));
  return request<SearchResultDto[]>(`/api/v1/search?${params.toString()}`);
}
