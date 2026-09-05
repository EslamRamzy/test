import type {
  AdminOverviewDto,
  ApiFailure,
  ApiPaginatedSuccess,
  ApiSuccess,
  AuthUser,
  ChangePasswordInput,
  LoginInput,
  PaginationMeta,
} from '@portfolio/shared';
import { getApiBaseUrl } from '../config';
import { ApiError } from './ApiError';

/**
 * Admin's authenticated browser client (docs/architecture/04 §5-6, docs/
 * architecture/07). Deliberately a separate file from `client.ts` (the
 * public browser client for the contact form + analytics beacon), even
 * though that file's own comment anticipated Phase 7 extending it directly.
 * The two are qualitatively different: every admin call carries a CSRF
 * header and can trigger the stateful single-flight refresh interceptor
 * below, machinery the public client's two unauthenticated, CSRF-exempt
 * calls have no use for — folding both into one file would mean every
 * public call site pays for a module-level in-flight-refresh promise it
 * never touches.
 */

const CSRF_COOKIE_NAME = '__Secure-csrf';
const CSRF_HEADER = 'X-CSRF-Token';

/**
 * `__Secure-csrf` is deliberately non-`HttpOnly` (docs/architecture/04 §5) —
 * it exists specifically so the client can read it and echo it back in a
 * header. `document.cookie` is the same mechanism a real browser session
 * uses; this file is never imported by a Server Component.
 */
function readCsrfCookie(): string | null {
  if (typeof document === 'undefined') return null;
  const match = document.cookie.match(new RegExp(`(?:^|; )${CSRF_COOKIE_NAME}=([^;]*)`));
  const value = match?.[1];
  return value !== undefined ? decodeURIComponent(value) : null;
}

/** `GET /auth/csrf` sets the cookie as a side effect; only fetched when no cookie is already on hand (e.g. the login page, before any session exists). */
async function ensureCsrfToken(): Promise<string> {
  const existing = readCsrfCookie();
  if (existing) return existing;

  const res = await fetch(`${getApiBaseUrl()}/api/v1/auth/csrf`, { credentials: 'include' });
  const body = (await res.json()) as ApiSuccess<{ csrfToken: string }>;
  return body.data.csrfToken;
}

/**
 * Single-flight refresh (doc 04 §6): "Concurrent 401s share one in-flight
 * refresh promise (otherwise five parallel refreshes rotate the token five
 * times and four of them look like reuse)." Module-level state is exactly
 * right here — there is one browser tab's worth of session, and every
 * caller in it must await the same in-flight attempt rather than start its
 * own.
 */
let refreshPromise: Promise<boolean> | null = null;

function refreshOnce(): Promise<boolean> {
  refreshPromise ??= performRefresh().finally(() => {
    refreshPromise = null;
  });
  return refreshPromise;
}

/**
 * Calls `/auth/refresh` directly with `fetch`, not through `request()` below
 * — going through `request()` would make a failed refresh's own 401 loop
 * back into `refreshOnce()` again instead of just reporting failure once.
 */
async function performRefresh(): Promise<boolean> {
  try {
    const csrfToken = await ensureCsrfToken();
    const res = await fetch(`${getApiBaseUrl()}/api/v1/auth/refresh`, {
      method: 'POST',
      credentials: 'include',
      headers: { [CSRF_HEADER]: csrfToken },
    });
    return res.ok;
  } catch {
    return false;
  }
}

/** doc 04 §6: "If refresh fails → clear client state, redirect to /admin/login?reason=expired." Client state itself is whatever cookies the failed refresh already cleared server-side; there is nothing else to clear here. */
function redirectToExpiredLogin(): void {
  if (typeof window === 'undefined') return;
  window.location.href = '/admin/login?reason=expired';
}

interface RequestOptions extends RequestInit {
  /**
   * `false` only for the one retry `request()` issues after a successful
   * refresh — never chain a second refresh attempt off that retry's own
   * 401, which would turn a single retry into an unbounded loop.
   */
  allowRefresh?: boolean;
}

/**
 * The shared fetch-plus-single-flight-refresh core, returning the FULL
 * parsed success envelope rather than just `data` — `request()` and
 * `requestPaginated()` below are both thin projections of this, so the
 * refresh/retry logic exists in exactly one place regardless of which
 * envelope shape a given endpoint returns.
 */
// `R` is the whole success-envelope shape (`ApiSuccess<T>` or
// `ApiPaginatedSuccess<T>`), not the item type — that is what lets one
// function serve both `request` (data: T) and `requestPaginated`
// (data: T[], plus meta) without a `T | T[]` union `.data` access neither
// caller could narrow back down on its own.
async function requestRaw<R extends ApiSuccess<unknown>>(
  path: string,
  init: RequestOptions,
): Promise<R> {
  const { allowRefresh = true, ...rest } = init;

  // A `FormData` body (the media upload endpoint's multipart request) must
  // NEVER get an explicit `Content-Type` — the browser sets its own
  // `multipart/form-data; boundary=...` value, which only it can compute,
  // when `fetch` sees a `FormData` body and no such header already set.
  // Every other call site sends a plain object through `mutate()`, already
  // JSON-stringified into a string body by the time it reaches here.
  const isFormDataBody = rest.body instanceof FormData;

  const res = await fetch(`${getApiBaseUrl()}${path}`, {
    ...rest,
    credentials: 'include',
    headers: isFormDataBody
      ? { ...rest.headers }
      : { 'Content-Type': 'application/json', ...rest.headers },
  });
  const body = (await res.json()) as R | ApiFailure;

  if (res.ok && body.success) return body;

  const code = body.success ? undefined : body.error.code;

  if (allowRefresh && res.status === 401 && code === 'TOKEN_EXPIRED') {
    const refreshed = await refreshOnce();
    if (refreshed) {
      return requestRaw<R>(path, { ...init, allowRefresh: false });
    }
    redirectToExpiredLogin();
  }

  const message = body.success ? 'Unexpected API response shape' : body.error.message;
  const details = body.success ? undefined : body.error.details;
  throw new ApiError(res.status, message, code, details);
}

/**
 * Exported (Phase 8) — `lib/api/adminResource.ts`'s generic CRUD client
 * builds every one of the ~13 modules' own typed call functions on top of
 * these primitives, rather than each module hand-rolling its own
 * fetch-plus-CSRF plumbing. Auth's own named functions below (`login`,
 * `logout`, ...) still call them directly too — nothing about exporting
 * them changes how those work.
 */
export async function request<T>(path: string, init: RequestOptions = {}): Promise<T> {
  const body = await requestRaw<ApiSuccess<T>>(path, init);
  return body.data;
}

/** Same as `request`, but for a paginated list endpoint — returns items and pagination meta together (mirrors `serverClient.ts`'s own `requestPaginated`). */
export async function requestPaginated<T>(
  path: string,
  init: RequestOptions = {},
): Promise<{ items: T[]; meta: PaginationMeta }> {
  const body = await requestRaw<ApiPaginatedSuccess<T>>(path, init);
  return { items: body.data, meta: body.meta };
}

/**
 * Every state-changing admin call needs the CSRF header (doc 04 §5) —
 * `request()` alone never adds it, so mutations go through this wrapper
 * instead. Its own `body` is a plain value to `JSON.stringify`, not
 * `RequestInit`'s `BodyInit | null` — keeping this signature separate from
 * `RequestOptions` is what lets a call site pass a typed input object
 * directly rather than pre-stringifying it itself.
 */
export async function mutate<T>(
  path: string,
  init: { method: string; body?: unknown; headers?: HeadersInit },
): Promise<T> {
  const csrfToken = await ensureCsrfToken();
  const { body, method, headers } = init;
  return request<T>(path, {
    method,
    headers: { [CSRF_HEADER]: csrfToken, ...headers },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
}

/**
 * The one admin endpoint whose body is a real file, not JSON — the media
 * upload (Phase 9). Sibling of `mutate()` above rather than a case that
 * function handles: `mutate` always `JSON.stringify`s its body, which would
 * turn a `FormData` into the useless string `"[object FormData]"`. The CSRF
 * header is still required, same as every other state-changing call.
 */
export async function mutateFormData<T>(path: string, formData: FormData): Promise<T> {
  const csrfToken = await ensureCsrfToken();
  return request<T>(path, {
    method: 'POST',
    headers: { [CSRF_HEADER]: csrfToken },
    body: formData,
  });
}

export async function login(input: LoginInput): Promise<{ user: AuthUser }> {
  return mutate<{ user: AuthUser }>('/api/v1/auth/login', { method: 'POST', body: input });
}

export async function logout(): Promise<void> {
  await mutate<{ loggedOut: boolean }>('/api/v1/auth/logout', { method: 'POST' });
}

export async function logoutAll(): Promise<void> {
  await mutate<{ loggedOut: boolean }>('/api/v1/auth/logout-all', { method: 'POST' });
}

export async function getCurrentUser(): Promise<AuthUser> {
  const { user } = await request<{ user: AuthUser }>('/api/v1/auth/me');
  return user;
}

export async function changePassword(input: ChangePasswordInput): Promise<void> {
  await mutate<{ passwordChanged: boolean }>('/api/v1/auth/change-password', {
    method: 'POST',
    body: input,
  });
}

export async function getOverview(): Promise<AdminOverviewDto> {
  return request<AdminOverviewDto>('/api/v1/admin/overview');
}
