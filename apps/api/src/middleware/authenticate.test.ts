import type { NextFunction, Request, Response } from 'express';
import { describe, expect, it, vi } from 'vitest';

vi.mock('../repositories/userRepository.js', () => ({
  findByIdSafe: vi.fn(),
}));

const { findByIdSafe } = await import('../repositories/userRepository.js');
const { authenticate } = await import('./authenticate.js');
const { signAccessToken } = await import('../lib/jwt.js');
const { setAccessTokenCookie } = await import('../lib/cookies.js');
const { UnauthenticatedError, TokenExpiredError } = await import('../errors/AppError.js');

function reqWithAccessToken(token: string | undefined): Request {
  const cookies: Record<string, string> = {};
  if (token !== undefined) {
    // Sets it the same way lib/cookies.ts's setAccessTokenCookie does, via a
    // fake res, rather than hardcoding the cookie name a second time here.
    setAccessTokenCookie(
      {
        cookie: (_name: string, value: string) => (cookies['__Secure-at'] = value),
      } as unknown as Response,
      token,
    );
  }
  return { cookies } as unknown as Request;
}

const SAFE_USER = {
  id: 7,
  email: 'admin@eslamramzy.dev',
  name: 'Admin',
  role: 'ADMIN',
  isActive: true,
  mustChangePassword: false,
  tokenVersion: 2,
  failedLoginCount: 0,
  lockedUntil: null,
  lastLoginAt: null,
  createdAt: new Date(),
  updatedAt: new Date(),
};

describe('authenticate', () => {
  it('attaches req.user and calls next() with no error for a valid token matching the current tokenVersion', async () => {
    vi.mocked(findByIdSafe).mockResolvedValueOnce(SAFE_USER);
    const token = signAccessToken({ sub: '7', role: 'ADMIN', tokenVersion: 2 });
    const req = reqWithAccessToken(token);
    const next = vi.fn() as NextFunction;

    await authenticate(req, {} as Response, next);

    expect(next).toHaveBeenCalledWith();
    expect(req.user).toEqual({ id: 7, role: 'ADMIN', tokenVersion: 2 });
  });

  it('calls next(UnauthenticatedError) with no cookie at all', async () => {
    const req = reqWithAccessToken(undefined);
    const next = vi.fn() as NextFunction;

    await authenticate(req, {} as Response, next);

    expect(next).toHaveBeenCalledWith(expect.any(UnauthenticatedError));
    expect(findByIdSafe).not.toHaveBeenCalled();
  });

  it('calls next(TokenExpiredError) for an expired token', async () => {
    const { default: jwt } = await import('jsonwebtoken');
    const { env } = await import('../config/env.js');
    const token = jwt.sign({ sub: '7', role: 'ADMIN', tokenVersion: 2 }, env.JWT_SECRET, {
      algorithm: 'HS256',
      expiresIn: '-1s',
      issuer: 'eslam-ramzy-portfolio-api',
      audience: 'eslam-ramzy-portfolio-admin',
    });
    const req = reqWithAccessToken(token);
    const next = vi.fn() as NextFunction;

    await authenticate(req, {} as Response, next);

    expect(next).toHaveBeenCalledWith(expect.any(TokenExpiredError));
  });

  it('calls next(UnauthenticatedError) for a structurally invalid token', async () => {
    const req = reqWithAccessToken('not-a-jwt');
    const next = vi.fn() as NextFunction;

    await authenticate(req, {} as Response, next);

    expect(next).toHaveBeenCalledWith(expect.any(UnauthenticatedError));
  });

  it('calls next(UnauthenticatedError) when the user no longer exists', async () => {
    vi.mocked(findByIdSafe).mockResolvedValueOnce(null);
    const token = signAccessToken({ sub: '7', role: 'ADMIN', tokenVersion: 2 });
    const req = reqWithAccessToken(token);
    const next = vi.fn() as NextFunction;

    await authenticate(req, {} as Response, next);

    expect(next).toHaveBeenCalledWith(expect.any(UnauthenticatedError));
  });

  it('calls next(UnauthenticatedError) when the user is deactivated', async () => {
    vi.mocked(findByIdSafe).mockResolvedValueOnce({ ...SAFE_USER, isActive: false });
    const token = signAccessToken({ sub: '7', role: 'ADMIN', tokenVersion: 2 });
    const req = reqWithAccessToken(token);
    const next = vi.fn() as NextFunction;

    await authenticate(req, {} as Response, next);

    expect(next).toHaveBeenCalledWith(expect.any(UnauthenticatedError));
  });

  it('calls next(UnauthenticatedError) when tokenVersion no longer matches (password changed / logout-all since issuance)', async () => {
    vi.mocked(findByIdSafe).mockResolvedValueOnce({ ...SAFE_USER, tokenVersion: 3 });
    const token = signAccessToken({ sub: '7', role: 'ADMIN', tokenVersion: 2 });
    const req = reqWithAccessToken(token);
    const next = vi.fn() as NextFunction;

    await authenticate(req, {} as Response, next);

    expect(next).toHaveBeenCalledWith(expect.any(UnauthenticatedError));
  });

  it('calls next(UnauthenticatedError) when the sub claim is not a valid integer', async () => {
    const { default: jwt } = await import('jsonwebtoken');
    const { env } = await import('../config/env.js');
    const token = jwt.sign(
      { sub: 'not-a-number', role: 'ADMIN', tokenVersion: 2 },
      env.JWT_SECRET,
      {
        algorithm: 'HS256',
        expiresIn: '15m',
        issuer: 'eslam-ramzy-portfolio-api',
        audience: 'eslam-ramzy-portfolio-admin',
      },
    );
    const req = reqWithAccessToken(token);
    const next = vi.fn() as NextFunction;

    await authenticate(req, {} as Response, next);

    expect(next).toHaveBeenCalledWith(expect.any(UnauthenticatedError));
    expect(findByIdSafe).not.toHaveBeenCalled();
  });
});
