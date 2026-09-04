import type { UserRole } from '@portfolio/shared';
import type { NextFunction, Request, Response } from 'express';
import { TokenExpiredError, UnauthenticatedError } from '../errors/AppError.js';
import { getAccessTokenFromRequest } from '../lib/cookies.js';
import { verifyAccessToken } from '../lib/jwt.js';
import { findByIdSafe } from '../repositories/userRepository.js';

/**
 * Enforcement point #1 of 3 (docs/architecture/05 §3): a valid, unexpired
 * access token; the user still active; `tokenVersion` still current. All
 * three are re-checked against the database on every request, not just the
 * JWT signature — a JWT that verifies cryptographically can still describe a
 * session that should no longer exist (the user was deactivated, or changed
 * their password since this token was issued), and only a DB read can know
 * that.
 *
 * `TokenExpiredError` (401, `code: TOKEN_EXPIRED`) is distinguished from the
 * generic `UnauthenticatedError` (401, `code: UNAUTHENTICATED`) so the admin
 * client can tell "call /auth/refresh" apart from "redirect to login" —
 * every other failure here (bad signature, revoked user, stale
 * `tokenVersion`) collapses to the generic case, matching lib/jwt.ts's own
 * `verifyAccessToken` contract.
 */
export async function authenticate(
  req: Request,
  _res: Response,
  next: NextFunction,
): Promise<void> {
  const token = getAccessTokenFromRequest(req);
  if (!token) {
    next(new UnauthenticatedError());
    return;
  }

  const result = verifyAccessToken(token);
  if (result.outcome === 'expired') {
    next(new TokenExpiredError());
    return;
  }
  if (result.outcome === 'invalid') {
    next(new UnauthenticatedError());
    return;
  }

  const userId = Number(result.claims.sub);
  if (!Number.isInteger(userId)) {
    next(new UnauthenticatedError());
    return;
  }

  const user = await findByIdSafe(userId);
  if (!user || !user.isActive || user.tokenVersion !== result.claims.tokenVersion) {
    next(new UnauthenticatedError());
    return;
  }

  req.user = { id: user.id, role: user.role as UserRole, tokenVersion: user.tokenVersion };
  next();
}
