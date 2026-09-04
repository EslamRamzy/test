import type { ChangePasswordInput, LoginInput } from '@portfolio/shared';
import type { NextFunction, Request, Response } from 'express';
import { UnauthenticatedError } from '../errors/AppError.js';
import {
  clearAuthCookies,
  getRefreshTokenFromRequest,
  setAccessTokenCookie,
  setCsrfCookie,
  setRefreshTokenCookie,
} from '../lib/cookies.js';
import { generateCsrfToken } from '../lib/csrf.js';
import { sendSuccess } from '../lib/httpResponse.js';
import * as authService from '../services/authService.js';
import { hashIp } from '../utils/hashIp.js';

/**
 * HTTP ↔ service mapping only (docs/architecture/01 §5) — every actual
 * decision (constant-time verification, lockout, rotation, audit writes)
 * lives in `services/authService.ts`. This file's job is: read the request,
 * call the service, set/clear cookies, shape the response.
 */

function requestContext(req: Request): authService.RequestContext {
  const userAgent = req.get('user-agent') ?? undefined;
  return {
    ipHash: hashIp(req.ip ?? 'unknown', userAgent),
    userAgent,
  };
}

/** GET /auth/csrf — no auth required; this is how a client gets its first CSRF token, before login. */
export function csrf(_req: Request, res: Response): void {
  const token = generateCsrfToken();
  setCsrfCookie(res, token);
  sendSuccess(res, { csrfToken: token });
}

export async function login(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { email, password } = req.body as LoginInput;
    const result = await authService.login(email, password, requestContext(req));
    setAccessTokenCookie(res, result.accessToken);
    setRefreshTokenCookie(res, result.refreshToken);
    setCsrfCookie(res, generateCsrfToken());
    sendSuccess(res, { user: result.user });
  } catch (error) {
    next(error);
  }
}

export async function refresh(req: Request, res: Response, next: NextFunction): Promise<void> {
  const presented = getRefreshTokenFromRequest(req);
  try {
    if (!presented) {
      throw new UnauthenticatedError('No refresh session');
    }
    const result = await authService.refresh(presented, requestContext(req));
    setAccessTokenCookie(res, result.accessToken);
    setRefreshTokenCookie(res, result.refreshToken);
    sendSuccess(res, { user: result.user });
  } catch (error) {
    // Any refresh failure — missing cookie, unknown token, expired, or a
    // detected reuse — ends the client-visible session the same way (doc 04
    // §3: "401 + clear cookies"). Reuse detection has already revoked the
    // whole family server-side by the time this runs; clearing cookies here
    // is what makes that visible to the one client that still holds them.
    clearAuthCookies(res);
    next(error);
  }
}

/**
 * No `authenticate` in front of this route on purpose — see the reasoning
 * in `authService.logout`. Always succeeds from the client's point of view:
 * an absent or already-invalid refresh token has nothing left to revoke,
 * and cookies are cleared either way.
 */
export async function logout(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const presented = getRefreshTokenFromRequest(req);
    await authService.logout(presented, requestContext(req));
    clearAuthCookies(res);
    sendSuccess(res, { loggedOut: true });
  } catch (error) {
    next(error);
  }
}

export async function logoutAll(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    if (!req.user) {
      throw new UnauthenticatedError();
    }
    await authService.logoutAll(req.user.id, requestContext(req));
    clearAuthCookies(res);
    sendSuccess(res, { loggedOut: true });
  } catch (error) {
    next(error);
  }
}

export async function me(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    if (!req.user) {
      throw new UnauthenticatedError();
    }
    const user = await authService.getCurrentUser(req.user.id);
    if (!user) {
      throw new UnauthenticatedError();
    }
    sendSuccess(res, { user });
  } catch (error) {
    next(error);
  }
}

export async function changePassword(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    if (!req.user) {
      throw new UnauthenticatedError();
    }
    const { currentPassword, newPassword } = req.body as ChangePasswordInput;
    await authService.changePassword(
      req.user.id,
      currentPassword,
      newPassword,
      requestContext(req),
    );
    // Every session, this request's own included, is revoked by a password
    // change (doc 04 §4) — clear the cookies this response would otherwise
    // leave sitting on the client pointing at a now-dead session.
    clearAuthCookies(res);
    sendSuccess(res, { passwordChanged: true });
  } catch (error) {
    next(error);
  }
}
