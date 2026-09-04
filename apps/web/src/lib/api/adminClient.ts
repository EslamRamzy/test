import type {
  AdminOverviewDto,
  ApiFailure,
  ApiSuccess,
  AuthUser,
  ChangePasswordInput,
  LoginInput,
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

async function request<T>(path: string, init: RequestOptions = {}): Promise<T> {
  const { allowRefresh = true, ...rest } = init;

  const res = await fetch(`${getApiBaseUrl()}${path}`, {
    ...rest,
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', ...rest.headers },
  });
  const body = (await res.json()) as ApiSuccess<T> | ApiFailure;

  if (res.ok && body.success) return body.data;

  const code = body.success ? undefined : body.error.code;

  if (allowRefresh && res.status === 401 && code === 'TOKEN_EXPIRED') {
    const refreshed = await refreshOnce();
    if (refreshed) {
      return request<T>(path, { ...init, allowRefresh: false });
    }
    redirectToExpiredLogin();
  }

  const message = body.success ? 'Unexpected API response shape' : body.error.message;
  throw new ApiError(res.status, message, code);
}

/**
 * Every state-changing admin call needs the CSRF header (doc 04 §5) —
 * `request()` alone never adds it, so mutations go through this wrapper
 * instead. Its own `body` is a plain value to `JSON.stringify`, not
 * `RequestInit`'s `BodyInit | null` — keeping this signature separate from
 * `RequestOptions` is what lets a call site pass a typed input object
 * directly rather than pre-stringifying it itself.
 */
async function mutate<T>(
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
