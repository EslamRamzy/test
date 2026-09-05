import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { getApiBaseUrl } from '@/lib/config';

/**
 * `/admin` redirect + site-wide nonce-based CSP (docs/architecture/04 §7,
 * docs/architecture/09 §2). Two independent jobs share this one file because
 * Next.js allows exactly one `proxy`/`middleware` per app.
 *
 * `/admin` redirect: "Proxy is a redirect, not a guard... redirects
 * unauthenticated `/admin/*` requests to the login page based on cookie
 * presence only. It does not verify the JWT and is not a security control —
 * every admin API call is independently authenticated by Express (§26: never
 * rely on hiding the UI)."
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
 *
 * CSP: doc09 §2's policy is nonce-based, not hash-based, because Next.js
 * injects inline bootstrap/RSC-payload scripts on every page whose content
 * differs per render — a build-time hash cannot cover that, only a
 * per-request nonce can (verified against Next's own CSP guide,
 * `node_modules/next/dist/docs/01-app/02-guides/content-security-policy.md`).
 * A fresh nonce is generated here on every matched request, threaded to the
 * page via the `x-nonce` request header (read back in `layout.tsx` via
 * `headers()`), and set on both the request (so Next's own renderer can
 * extract it — Next parses ITS OWN response header, not the request one,
 * to apply nonces to framework-injected scripts) and the response.
 *
 * Nonces only work on dynamically-rendered pages (Next's own guide: "Static
 * pages are generated at build time, when no request or response headers
 * exist — so no nonce can be injected"), which is why `layout.tsx` now
 * `await connection()`s — that opts every route in the app into dynamic
 * rendering, trading away the static/ISR optimisation doc06 §9's bundle
 * budget was measured under (see docs/phases/phase-12-report.md "CSP vs.
 * static rendering" for the accepted trade-off).
 */
const ACCESS_TOKEN_COOKIE = '__Secure-at';
const LOGIN_PATH = '/admin/login';

function withNoStore(response: NextResponse): NextResponse {
  response.headers.set('Cache-Control', 'no-store, private');
  return response;
}

/**
 * doc09 §2's exact directive list. `img-src`/`connect-src` include the API's
 * own public origin — the browser fetches search results, the contact form,
 * and every `/uploads/*` image directly from it (decision D1, a separate
 * origin from the web app). `'strict-dynamic'` is Next's own recommended
 * addition (not in doc09's literal text, but harmless and additionally lets
 * a nonced script load further scripts without each needing its own nonce —
 * this app has none, so it is a no-op safety margin, not a live need).
 */
function buildCspHeaderValue(nonce: string): string {
  const apiOrigin = getApiBaseUrl();
  const isDev = process.env.NODE_ENV === 'development';

  return [
    `default-src 'self'`,
    // React's dev-mode error reconstruction needs eval (Next's own CSP
    // guide) — production ships neither React nor Next using eval.
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${isDev ? " 'unsafe-eval'" : ''}`,
    // doc09 §2 literally reads `style-src 'self' 'nonce-{random}'` — tried
    // exactly that first, verified against a real headless-browser pass
    // (docs/phases/phase-12-report.md "CSP vs. inline styles"). A CSP nonce
    // only ever covers `<style>` ELEMENTS, never inline `style="..."`
    // ATTRIBUTES (confirmed by Chromium's own violation message: "hashes do
    // not apply to event handlers, style attributes... unless the
    // 'unsafe-hashes' keyword is present" — nonces are subject to the same
    // element-only restriction). This app has no `<style>` elements, only
    // attributes: React's `style={{...}}` (77 call sites, mostly per-item
    // computed values — stagger delays, positions — that a build-time hash
    // allow-list cannot cover) and shiki's syntax-highlighted code spans
    // (`lib/markdown/render.ts`, per-token colors). Blocking both is a
    // real, measured regression (248 violations across every route in the
    // browser pass), not a theoretical one, so `style-src` drops the nonce
    // for `'unsafe-inline'` instead — `script-src` above stays strict with
    // no `unsafe-inline`/`unsafe-eval` in production, which is what doc09's
    // own threat model (T5: script injection via markdown) is actually
    // guarding against; rehype-sanitize already strips `style` from every
    // markdown-sourced node except shiki's own trusted output (same file),
    // so this relaxation adds no attacker-reachable surface.
    `style-src 'self' 'unsafe-inline'`,
    `img-src 'self' data: blob: ${apiOrigin}`,
    `font-src 'self'`,
    `connect-src 'self' ${apiOrigin}`,
    `frame-ancestors 'none'`,
    `form-action 'self'`,
    `base-uri 'self'`,
    `object-src 'none'`,
    `upgrade-insecure-requests`,
  ].join('; ');
}

export function proxy(request: NextRequest): NextResponse {
  const { pathname } = request.nextUrl;
  const hasAccessToken = request.cookies.has(ACCESS_TOKEN_COOKIE);

  const nonce = Buffer.from(crypto.randomUUID()).toString('base64');
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set('x-nonce', nonce);
  const cspHeaderValue = buildCspHeaderValue(nonce);
  requestHeaders.set('Content-Security-Policy', cspHeaderValue);

  function next(): NextResponse {
    return NextResponse.next({ request: { headers: requestHeaders } });
  }

  let response: NextResponse;

  if (pathname === LOGIN_PATH) {
    // Already-authenticated visitor landing on /admin/login (e.g. a
    // bookmark, or a back-navigation after logging in elsewhere) — send
    // them to the dashboard instead of showing the login form again.
    response = hasAccessToken
      ? withNoStore(NextResponse.redirect(new URL('/admin', request.url)))
      : withNoStore(next());
  } else if (pathname.startsWith('/admin')) {
    if (!hasAccessToken) {
      const loginUrl = new URL(LOGIN_PATH, request.url);
      loginUrl.searchParams.set('from', pathname);
      response = withNoStore(NextResponse.redirect(loginUrl));
    } else {
      response = withNoStore(next());
    }
  } else {
    response = next();
  }

  // doc09 §2's documented rollout — "deployed in
  // Content-Security-Policy-Report-Only first... then enforced once the
  // report endpoint is quiet" — was carried out during Phase 12
  // verification: real, headless-browser passes across every public route
  // plus the command palette showed zero console violations under
  // report-only first (docs/phases/phase-12-report.md "CSP rollout"), then
  // the same zero-violation result held after flipping to the enforcing
  // header below, which is what ships.
  response.headers.set('Content-Security-Policy', cspHeaderValue);
  return response;
}

export const config = {
  matcher: [
    {
      // Every page request — everything a browser navigates to needs the
      // CSP header. Static assets, image optimisation, and the favicon are
      // excluded (never HTML, never render inline scripts); prefetches are
      // excluded too (Next's own recommendation — a `next/link` prefetch
      // doesn't render, so generating and shipping a nonce for it is pure
      // waste).
      source: '/((?!_next/static|_next/image|favicon.ico).*)',
      missing: [
        { type: 'header', key: 'next-router-prefetch' },
        { type: 'header', key: 'purpose', value: 'prefetch' },
      ],
    },
  ],
};
