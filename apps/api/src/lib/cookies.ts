import type { CookieOptions, Request, Response } from 'express';
import { env, isProduction } from '../config/env.js';

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
 * `secure: isProduction` rather than always `true`: local development over
 * plain HTTP (per the README's `local.eslamramzy.dev` setup note) would
 * otherwise never receive the cookie at all. Production always runs behind
 * TLS (Caddy, decision D3), so this is not a downgrade there.
 */

export const ACCESS_TOKEN_COOKIE = '__Secure-at';
export const REFRESH_TOKEN_COOKIE = '__Secure-rt';
export const CSRF_TOKEN_COOKIE = '__Secure-csrf';

const REFRESH_COOKIE_PATH = '/api/v1/auth';

const BASE_COOKIE_OPTIONS: CookieOptions = {
  secure: isProduction,
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
