import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

/**
 * `/admin` redirect only — docs/architecture/04 §7: "Proxy is a redirect,
 * not a guard. `apps/web/proxy.ts` ... redirects unauthenticated `/admin/*`
 * requests to the login page based on cookie presence only. It does not
 * verify the JWT and is not a security control — every admin API call is
 * independently authenticated by Express (§26: never rely on hiding the
 * UI)." This file is the entire implementation of that sentence.
 *
 * `proxy.ts`/`export function proxy` — not `middleware.ts`/`middleware` —
 * because Next.js renamed that file convention (same mechanism, same
 * one-per-app file); see the deprecation notice this repo's Next version
 * (16.3.4) prints for the old name.
 *
 * Checks the ACCESS token cookie specifically, not the refresh cookie — the
 * refresh cookie's `Path=/api/v1/auth` (`apps/api/src/lib/cookies.ts`) means
 * it is never sent to the web app's own origin/paths in the first place, so
 * it is not a signal this file could read even if it wanted to.
 * `setAccessTokenCookie` sets no `maxAge`/`expires` (a browser session
 * cookie), so this cookie stays present in the browser well past the JWT's
 * own 15-minute `exp` — an actually-expired-but-still-present token still
 * passes this check and reaches the page, where `adminClient.ts`'s
 * single-flight refresh interceptor (doc 04 §6) transparently renews it on
 * the first API call that 401s. This check is only ever wrong in the
 * direction of "lets an expired session through to be refreshed," never in
 * the direction of blocking a live one.
 *
 * Also sets `Cache-Control: no-store, private` (doc 07 §7: "All admin
 * responses are Cache-Control: no-store, private") on every response this
 * matcher touches — a layout has no access to set response headers itself,
 * so this file, which already runs on this exact path, is where the
 * frontend half of that rule lives (the backend half is `apps/api/src/
 * middleware/noStore.ts`, on every `/api/v1/admin` response).
 */
const ACCESS_TOKEN_COOKIE = '__Secure-at';
const LOGIN_PATH = '/admin/login';

function withNoStore(response: NextResponse): NextResponse {
  response.headers.set('Cache-Control', 'no-store, private');
  return response;
}

export function proxy(request: NextRequest): NextResponse {
  const { pathname } = request.nextUrl;
  const hasAccessToken = request.cookies.has(ACCESS_TOKEN_COOKIE);

  if (pathname === LOGIN_PATH) {
    // Already-authenticated visitor landing on /admin/login (e.g. a
    // bookmark, or a back-navigation after logging in elsewhere) — send
    // them to the dashboard instead of showing the login form again.
    if (hasAccessToken) {
      return withNoStore(NextResponse.redirect(new URL('/admin', request.url)));
    }
    return withNoStore(NextResponse.next());
  }

  if (!hasAccessToken) {
    const loginUrl = new URL(LOGIN_PATH, request.url);
    loginUrl.searchParams.set('from', pathname);
    return withNoStore(NextResponse.redirect(loginUrl));
  }

  return withNoStore(NextResponse.next());
}

export const config = {
  matcher: ['/admin/:path*'],
};
