import type { NextFunction, Request, Response } from 'express';
import { describe, expect, it, vi } from 'vitest';
import { env } from '../config/env.js';
import { CsrfError } from '../errors/AppError.js';
import { generateCsrfToken } from '../lib/csrf.js';
import { csrfProtection } from './csrf.js';

const ALLOWED_ORIGIN = env.CORS_ORIGIN[0];
if (!ALLOWED_ORIGIN) throw new Error('test setup: env.CORS_ORIGIN is empty');

function mockReq(
  headers: Record<string, string | undefined>,
  cookies: Record<string, string> = {},
) {
  return {
    header: (name: string) => headers[name.toLowerCase()],
    cookies,
  } as unknown as Request;
}

describe('csrfProtection', () => {
  it('calls next() for a request with an allowed origin and a valid, matching token pair', () => {
    const token = generateCsrfToken();
    const req = mockReq(
      { origin: ALLOWED_ORIGIN, 'x-csrf-token': token },
      { '__Secure-csrf': token },
    );
    const next = vi.fn() as NextFunction;

    csrfProtection(req, {} as Response, next);

    expect(next).toHaveBeenCalledWith();
  });

  it('rejects a missing Origin header', () => {
    const token = generateCsrfToken();
    const req = mockReq({ 'x-csrf-token': token }, { '__Secure-csrf': token });
    const next = vi.fn() as NextFunction;

    csrfProtection(req, {} as Response, next);

    expect(next).toHaveBeenCalledWith(expect.any(CsrfError));
  });

  it('rejects an origin outside the allow-list', () => {
    const token = generateCsrfToken();
    const req = mockReq(
      { origin: 'https://evil-eslamramzy.dev', 'x-csrf-token': token },
      { '__Secure-csrf': token },
    );
    const next = vi.fn() as NextFunction;

    csrfProtection(req, {} as Response, next);

    expect(next).toHaveBeenCalledWith(expect.any(CsrfError));
  });

  it('rejects a missing CSRF cookie', () => {
    const token = generateCsrfToken();
    const req = mockReq({ origin: ALLOWED_ORIGIN, 'x-csrf-token': token }, {});
    const next = vi.fn() as NextFunction;

    csrfProtection(req, {} as Response, next);

    expect(next).toHaveBeenCalledWith(expect.any(CsrfError));
  });

  it('rejects a missing X-CSRF-Token header', () => {
    const token = generateCsrfToken();
    const req = mockReq({ origin: ALLOWED_ORIGIN }, { '__Secure-csrf': token });
    const next = vi.fn() as NextFunction;

    csrfProtection(req, {} as Response, next);

    expect(next).toHaveBeenCalledWith(expect.any(CsrfError));
  });

  it('rejects a cookie/header pair that mismatches (cookie tossing simulation)', () => {
    const legitimate = generateCsrfToken();
    const attackerSet = generateCsrfToken();
    const req = mockReq(
      { origin: ALLOWED_ORIGIN, 'x-csrf-token': legitimate },
      { '__Secure-csrf': attackerSet },
    );
    const next = vi.fn() as NextFunction;

    csrfProtection(req, {} as Response, next);

    expect(next).toHaveBeenCalledWith(expect.any(CsrfError));
  });
});
