import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * `adminClient.ts`'s module-level `refreshPromise` state means a fresh
 * module instance is required per test — `vi.resetModules()` +
 * dynamic `import()` inside each `it()`, rather than one top-level import,
 * so a previous test's in-flight-refresh state (or lack of it) never leaks
 * into the next.
 *
 * That same reset is why assertions below check the rejected error's shape
 * (`code`, `status`) rather than `instanceof ApiError`: `vi.resetModules()`
 * gives the dynamically re-imported `adminClient` a fresh instance of
 * `ApiError.ts` too, whose class is not `===` the one a top-level `import`
 * here would capture — `instanceof` against that stale reference would fail
 * even for a correctly-thrown error.
 */

function jsonResponse(status: number, body: unknown, extra: Partial<Response> = {}): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(body),
    ...extra,
  } as Response;
}

/**
 * `Secure` is required here, not optional — the real bug this uncovered
 * (fixed in `apps/api/src/lib/cookies.ts`) was exactly this: the
 * `__Secure-` NAME PREFIX makes a real browser (jsdom's cookie jar included)
 * silently drop the cookie if the `Set-Cookie`/`document.cookie` value omits
 * the literal `Secure` attribute, regardless of origin. Omitting it here
 * would make every test in this file pass for the wrong reason — falling
 * through to the "no cookie yet, fetch one" branch instead of exercising
 * the "cookie already present" branch it means to test.
 */
function setCsrfCookie(token: string): void {
  document.cookie = `__Secure-csrf=${token}; path=/; Secure; SameSite=Strict`;
}

beforeEach(() => {
  vi.resetModules();
  // `; Secure` on the clearing write too — see `setCsrfCookie`'s comment;
  // the same prefix rule that blocks a Secure-less write governs overwrites.
  document.cookie =
    '__Secure-csrf=; path=/; Secure; SameSite=Strict; expires=Thu, 01 Jan 1970 00:00:00 GMT';
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('adminClient — single-flight refresh (doc 04 §6)', () => {
  it('on a 401 TOKEN_EXPIRED, refreshes once and retries the original request', async () => {
    setCsrfCookie('csrf-token-1');
    const fetchMock = vi.fn<typeof fetch>();
    let overviewCalls = 0;

    fetchMock.mockImplementation((input) => {
      const url = String(input);
      if (url.endsWith('/api/v1/admin/overview')) {
        overviewCalls += 1;
        if (overviewCalls === 1) {
          return Promise.resolve(
            jsonResponse(401, {
              success: false,
              error: { code: 'TOKEN_EXPIRED', message: 'Access token expired' },
            }),
          );
        }
        return Promise.resolve(
          jsonResponse(200, {
            success: true,
            data: {
              projectsCount: 1,
              articlesCount: 2,
              unreadMessagesCount: 0,
              openFindingsCount: 0,
              recentActivity: [],
            },
          }),
        );
      }
      if (url.endsWith('/api/v1/auth/refresh')) {
        return Promise.resolve(jsonResponse(200, { success: true, data: { user: null } }));
      }
      throw new Error(`unexpected fetch: ${url}`);
    });
    vi.stubGlobal('fetch', fetchMock);

    const { getOverview } = await import('./adminClient');
    const result = await getOverview();

    expect(result.projectsCount).toBe(1);
    expect(overviewCalls).toBe(2);
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('/api/v1/auth/refresh'),
      expect.objectContaining({ method: 'POST' }),
    );
  });

  it('concurrent 401s share exactly one refresh call, not one per request', async () => {
    setCsrfCookie('csrf-token-2');
    const fetchMock = vi.fn<typeof fetch>();
    let refreshCalls = 0;
    const overviewAttempt: Record<string, number> = {};

    fetchMock.mockImplementation((input) => {
      const url = String(input);
      if (url.endsWith('/api/v1/auth/refresh')) {
        refreshCalls += 1;
        return Promise.resolve(jsonResponse(200, { success: true, data: { user: null } }));
      }
      if (url.endsWith('/api/v1/admin/overview')) {
        overviewAttempt['n'] = (overviewAttempt['n'] ?? 0) + 1;
        const isFirstRoundForEachCaller = overviewAttempt['n']! <= 3;
        if (isFirstRoundForEachCaller) {
          return Promise.resolve(
            jsonResponse(401, {
              success: false,
              error: { code: 'TOKEN_EXPIRED', message: 'Access token expired' },
            }),
          );
        }
        return Promise.resolve(
          jsonResponse(200, {
            success: true,
            data: {
              projectsCount: 0,
              articlesCount: 0,
              unreadMessagesCount: 0,
              openFindingsCount: 0,
              recentActivity: [],
            },
          }),
        );
      }
      throw new Error(`unexpected fetch: ${url}`);
    });
    vi.stubGlobal('fetch', fetchMock);

    const { getOverview } = await import('./adminClient');
    await Promise.all([getOverview(), getOverview(), getOverview()]);

    // Three concurrent 401s must still result in exactly one /auth/refresh
    // call — five parallel refreshes rotating the token five times is
    // exactly the bug doc 04 §6 calls out.
    expect(refreshCalls).toBe(1);
  });

  it('redirects to /admin/login?reason=expired when refresh itself fails', async () => {
    setCsrfCookie('csrf-token-3');
    const fetchMock = vi.fn<typeof fetch>();

    fetchMock.mockImplementation((input) => {
      const url = String(input);
      if (url.endsWith('/api/v1/admin/overview')) {
        return Promise.resolve(
          jsonResponse(401, {
            success: false,
            error: { code: 'TOKEN_EXPIRED', message: 'Access token expired' },
          }),
        );
      }
      if (url.endsWith('/api/v1/auth/refresh')) {
        return Promise.resolve(
          jsonResponse(401, {
            success: false,
            error: { code: 'UNAUTHENTICATED', message: 'Refresh failed' },
          }),
        );
      }
      throw new Error(`unexpected fetch: ${url}`);
    });
    vi.stubGlobal('fetch', fetchMock);

    // jsdom's real `window.location.href` setter throws "navigation not
    // implemented"; `Object.defineProperty` swaps in a plain stand-in
    // (`writable`/`configurable` so it can be restored afterwards) so this
    // test can observe the redirect instead of crashing on it.
    const originalLocation = window.location;
    Object.defineProperty(window, 'location', {
      value: { href: '' },
      writable: true,
      configurable: true,
    });

    const { getOverview } = await import('./adminClient');
    await expect(getOverview()).rejects.toMatchObject({
      name: 'ApiError',
      status: 401,
      code: 'TOKEN_EXPIRED',
    });

    expect(window.location.href).toBe('/admin/login?reason=expired');
    Object.defineProperty(window, 'location', {
      value: originalLocation,
      writable: true,
      configurable: true,
    });
  });

  it('does not attempt a refresh, and throws directly, on a plain UNAUTHENTICATED 401', async () => {
    setCsrfCookie('csrf-token-4');
    const fetchMock = vi.fn<typeof fetch>();

    fetchMock.mockImplementation((input) => {
      const url = String(input);
      if (url.endsWith('/api/v1/admin/overview')) {
        return Promise.resolve(
          jsonResponse(401, {
            success: false,
            error: { code: 'UNAUTHENTICATED', message: 'Not logged in' },
          }),
        );
      }
      throw new Error(`unexpected fetch: ${url}`);
    });
    vi.stubGlobal('fetch', fetchMock);

    const { getOverview } = await import('./adminClient');
    await expect(getOverview()).rejects.toMatchObject({
      name: 'ApiError',
      status: 401,
      code: 'UNAUTHENTICATED',
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});

describe('adminClient — CSRF header on mutations (doc 04 §5)', () => {
  it('echoes the __Secure-csrf cookie value in the X-CSRF-Token header on login', async () => {
    setCsrfCookie('csrf-token-5');
    const fetchMock = vi.fn<typeof fetch>();

    fetchMock.mockImplementation((_input, init) => {
      const headers = new Headers(init?.headers);
      expect(headers.get('X-CSRF-Token')).toBe('csrf-token-5');
      return Promise.resolve(
        jsonResponse(200, {
          success: true,
          data: {
            user: { id: 1, email: 'a@b.test', name: 'A', role: 'ADMIN', mustChangePassword: false },
          },
        }),
      );
    });
    vi.stubGlobal('fetch', fetchMock);

    const { login } = await import('./adminClient');
    const { user } = await login({ email: 'a@b.test', password: 'whatever-12345' });
    expect(user.email).toBe('a@b.test');
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('fetches a CSRF token first when no cookie is present yet', async () => {
    const fetchMock = vi.fn<typeof fetch>();
    const calls: string[] = [];

    fetchMock.mockImplementation((input, init) => {
      const url = String(input);
      calls.push(url);
      if (url.endsWith('/api/v1/auth/csrf')) {
        // Real GET /auth/csrf sets the cookie as a side effect; this stub
        // does the same so the next line's own cookie read (inside the
        // request this call precedes) reflects it.
        setCsrfCookie('csrf-token-fetched');
        return Promise.resolve(
          jsonResponse(200, { success: true, data: { csrfToken: 'csrf-token-fetched' } }),
        );
      }
      if (url.endsWith('/api/v1/auth/login')) {
        const headers = new Headers(init?.headers);
        expect(headers.get('X-CSRF-Token')).toBe('csrf-token-fetched');
        return Promise.resolve(
          jsonResponse(200, {
            success: true,
            data: {
              user: {
                id: 1,
                email: 'a@b.test',
                name: 'A',
                role: 'ADMIN',
                mustChangePassword: false,
              },
            },
          }),
        );
      }
      throw new Error(`unexpected fetch: ${url}`);
    });
    vi.stubGlobal('fetch', fetchMock);

    const { login } = await import('./adminClient');
    await login({ email: 'a@b.test', password: 'whatever-12345' });

    expect(calls[0]).toContain('/api/v1/auth/csrf');
  });
});
