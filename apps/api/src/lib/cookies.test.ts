import type { Request, Response } from 'express';
import { describe, expect, it, vi } from 'vitest';
import {
  ACCESS_TOKEN_COOKIE,
  CSRF_TOKEN_COOKIE,
  REFRESH_TOKEN_COOKIE,
  clearAuthCookies,
  getAccessTokenFromRequest,
  getCsrfCookieFromRequest,
  getRefreshTokenFromRequest,
  setAccessTokenCookie,
  setCsrfCookie,
  setRefreshTokenCookie,
} from './cookies.js';

function mockResponse() {
  return { cookie: vi.fn(), clearCookie: vi.fn() } as unknown as Response;
}

function mockRequest(cookies: Record<string, string>) {
  return { cookies } as unknown as Request;
}

describe('cookie setters', () => {
  it('sets the access token cookie HttpOnly, path "/"', () => {
    const res = mockResponse();
    setAccessTokenCookie(res, 'access-token-value');

    expect(res.cookie).toHaveBeenCalledWith(
      ACCESS_TOKEN_COOKIE,
      'access-token-value',
      expect.objectContaining({ httpOnly: true, path: '/', sameSite: 'strict' }),
    );
  });

  it('sets the refresh token cookie HttpOnly, scoped to the auth path', () => {
    const res = mockResponse();
    setRefreshTokenCookie(res, 'refresh-token-value');

    expect(res.cookie).toHaveBeenCalledWith(
      REFRESH_TOKEN_COOKIE,
      'refresh-token-value',
      expect.objectContaining({ httpOnly: true, path: '/api/v1/auth' }),
    );
  });

  it('sets the CSRF cookie NOT HttpOnly, path "/"', () => {
    const res = mockResponse();
    setCsrfCookie(res, 'csrf-token-value');

    expect(res.cookie).toHaveBeenCalledWith(
      CSRF_TOKEN_COOKIE,
      'csrf-token-value',
      expect.objectContaining({ httpOnly: false, path: '/' }),
    );
  });

  it('clears all three cookies with attributes matching how each was set', () => {
    const res = mockResponse();
    clearAuthCookies(res);

    expect(res.clearCookie).toHaveBeenCalledWith(
      ACCESS_TOKEN_COOKIE,
      expect.objectContaining({ httpOnly: true, path: '/' }),
    );
    expect(res.clearCookie).toHaveBeenCalledWith(
      REFRESH_TOKEN_COOKIE,
      expect.objectContaining({ httpOnly: true, path: '/api/v1/auth' }),
    );
    expect(res.clearCookie).toHaveBeenCalledWith(
      CSRF_TOKEN_COOKIE,
      expect.objectContaining({ httpOnly: false, path: '/' }),
    );
  });
});

describe('cookie readers', () => {
  it('reads each cookie by its own name', () => {
    const req = mockRequest({
      [ACCESS_TOKEN_COOKIE]: 'at-value',
      [REFRESH_TOKEN_COOKIE]: 'rt-value',
      [CSRF_TOKEN_COOKIE]: 'csrf-value',
    });

    expect(getAccessTokenFromRequest(req)).toBe('at-value');
    expect(getRefreshTokenFromRequest(req)).toBe('rt-value');
    expect(getCsrfCookieFromRequest(req)).toBe('csrf-value');
  });

  it('returns undefined when a cookie is absent', () => {
    const req = mockRequest({});
    expect(getAccessTokenFromRequest(req)).toBeUndefined();
    expect(getRefreshTokenFromRequest(req)).toBeUndefined();
    expect(getCsrfCookieFromRequest(req)).toBeUndefined();
  });

  it('returns undefined when req.cookies itself is absent (cookie-parser not mounted)', () => {
    const req = { cookies: undefined } as unknown as Request;
    expect(getAccessTokenFromRequest(req)).toBeUndefined();
  });
});
