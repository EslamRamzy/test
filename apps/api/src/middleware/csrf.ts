import type { NextFunction, Request, Response } from 'express';
import { env } from '../config/env.js';
import { CsrfError } from '../errors/AppError.js';
import { getCsrfCookieFromRequest } from '../lib/cookies.js';
import { verifyCsrfPair } from '../lib/csrf.js';

const CSRF_HEADER = 'x-csrf-token';

/**
 * The second and third of docs/architecture/04 §5's three CSRF layers
 * (`SameSite=Strict` on the cookies themselves is the first, and needs no
 * code here). Mounted on every state-changing auth route, including
 * `/auth/login` — the login sequence in doc 04 §2 explicitly shows the
 * client presenting a CSRF token it already fetched from `GET /auth/csrf`
 * before it has any session at all, which is why CSRF protection cannot be
 * bundled into `authenticate`.
 *
 * **Origin check.** Checked first and independently of the token pair:
 * rejects outright if `Origin` is missing or not on the same allow-list CORS
 * uses. A real cross-site browser request to a state-changing endpoint
 * always carries an `Origin` header (fetch/XHR/form submission all set it
 * for non-GET requests); a request with none or a foreign one is not
 * something a legitimate admin-client call ever produces.
 *
 * **Signed double-submit pair.** The non-`HttpOnly` `__Secure-csrf` cookie
 * value must exactly match the `X-CSRF-Token` header AND independently
 * verify against `CSRF_SECRET` (lib/csrf.ts). Required specifically because
 * of decision D1 (`Domain=.eslamramzy.dev`): a plain (unsigned)
 * double-submit check can be defeated by any sibling subdomain that can set
 * cookies on the shared domain, which a signed pair cannot.
 */
export function csrfProtection(req: Request, _res: Response, next: NextFunction): void {
  const origin = req.header('origin');
  if (!origin || !env.CORS_ORIGIN.includes(origin)) {
    next(new CsrfError('Origin not allowed'));
    return;
  }

  const cookieToken = getCsrfCookieFromRequest(req);
  const headerToken = req.header(CSRF_HEADER);
  if (!verifyCsrfPair(cookieToken, headerToken)) {
    next(new CsrfError());
    return;
  }

  next();
}
