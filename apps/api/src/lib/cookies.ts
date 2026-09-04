import type { CookieOptions, Request, Response } from 'express';
import { env } from '../config/env.js';

/**
 * The three auth cookies and their exact attributes (docs/architecture/04
 * §1, §5). Centralised here so "how a cookie is set" has exactly one
 * implementation — every login, refresh, and logout path calls these
 * functions rather than `res.cookie(...)` directly.
 *
 * `__Secure-` rather than `__Host-`: the cookies need `Domain=` to cross
 * `eslamramzy.dev` → `api.eslamramzy.dev` (decision D1), and `__Host-`
 * forbids a `Domain` attribute entirely. See docs/architecture/01 §3 and
 * docs/architecture/04 §1 for the full trade and its mitigations.
 *
 * `secure: true`, unconditionally — NOT `secure: isProduction`, which this
 * file used to read. That looked like the right dev accommodation (avoid
 * ever requiring TLS locally) but is actually a bug: the `__Secure-` NAME
 * PREFIX imposes its own hard requirement, independent of whether the
 * connection is HTTPS — a real browser rejects any `__Secure-`-prefixed
 * cookie whose `Set-Cookie` header lacks the literal `Secure` attribute,
 * full stop (confirmed against a real Chromium instance: with `secure:
 * isProduction` false in dev, `context.cookies()` came back empty after a
 * real `GET /auth/csrf`; identical request with `secure: true` set the
 * cookie). Both supported local topologies still work with `secure: true`:
 * the README's `local.eslamramzy.dev`/`api.local.eslamramzy.dev` setup runs
 * behind a local Caddy actually terminating TLS, and a bare
 * `http://localhost` dev server is covered by Chrome's (and Firefox's)
 * separate "localhost is a potentially trustworthy origin" carve-out, which
 * allows a `Secure` cookie to be set over plain HTTP specifically for
 * `localhost`/`127.0.0.1`. Production is always behind TLS regardless
 * (decision D3). There is no real topology this project supports where
 * `secure: true` is the wrong choice.
 */

export const ACCESS_TOKEN_COOKIE = '__Secure-at';
export const REFRESH_TOKEN_COOKIE = '__Secure-rt';
export const CSRF_TOKEN_COOKIE = '__Secure-csrf';

const REFRESH_COOKIE_PATH = '/api/v1/auth';

const BASE_COOKIE_OPTIONS: CookieOptions = {
  secure: true,
  sameSite: 'strict',
  domain: env.COOKIE_DOMAIN,
};

export function setAccessTokenCookie(res: Response, token: string): void {
  res.cookie(ACCESS_TOKEN_COOKIE, token, {
    ...BASE_COOKIE_OPTIONS,
    httpOnly: true,
    path: '/',
  });
}

export function setRefreshTokenCookie(res: Response, token: string): void {
  res.cookie(REFRESH_TOKEN_COOKIE, token, {
    ...BASE_COOKIE_OPTIONS,
    httpOnly: true,
    // Not transmitted on ordinary API calls — only the three endpoints that
    // need it (docs/architecture/04 §1), shrinking its attack surface.
    path: REFRESH_COOKIE_PATH,
  });
}

/**
 * Not `HttpOnly`: the admin client's JavaScript must be able to read this
 * value to echo it in the `X-CSRF-Token` header — that is the entire
 * "double-submit" mechanism (docs/architecture/04 §5).
 */
export function setCsrfCookie(res: Response, token: string): void {
  res.cookie(CSRF_TOKEN_COOKIE, token, {
    ...BASE_COOKIE_OPTIONS,
    httpOnly: false,
    path: '/',
  });
}

/** Clears all three auth cookies — used on logout and on a failed refresh (docs/architecture/04 §6). */
export function clearAuthCookies(res: Response): void {
  res.clearCookie(ACCESS_TOKEN_COOKIE, { ...BASE_COOKIE_OPTIONS, httpOnly: true, path: '/' });
  res.clearCookie(REFRESH_TOKEN_COOKIE, {
    ...BASE_COOKIE_OPTIONS,
    httpOnly: true,
    path: REFRESH_COOKIE_PATH,
  });
  res.clearCookie(CSRF_TOKEN_COOKIE, { ...BASE_COOKIE_OPTIONS, httpOnly: false, path: '/' });
}

export function getAccessTokenFromRequest(req: Request): string | undefined {
  const cookies = req.cookies as Record<string, string | undefined> | undefined;
  return cookies?.[ACCESS_TOKEN_COOKIE];
}

export function getRefreshTokenFromRequest(req: Request): string | undefined {
  const cookies = req.cookies as Record<string, string | undefined> | undefined;
  return cookies?.[REFRESH_TOKEN_COOKIE];
}

export function getCsrfCookieFromRequest(req: Request): string | undefined {
  const cookies = req.cookies as Record<string, string | undefined> | undefined;
  return cookies?.[CSRF_TOKEN_COOKIE];
}
