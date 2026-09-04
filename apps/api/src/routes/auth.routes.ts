import { changePasswordSchema, loginSchema } from '@portfolio/shared';
import { Router } from 'express';
import * as authController from '../controllers/authController.js';
import { authenticate } from '../middleware/authenticate.js';
import { csrfProtection } from '../middleware/csrf.js';
import {
  authLoginByEmailLimiter,
  authLoginByIpLimiter,
  authRefreshLimiter,
} from '../middleware/rateLimit.js';
import { validate } from '../middleware/validate.js';

/**
 * `/api/v1/auth` — docs/architecture/04. Every state-changing route here
 * carries `csrfProtection`; `GET /csrf` does not, since it is how a client
 * gets its first token before any of the others can be called (§5). The
 * login rate limiters are mounted either side of `validate` on purpose —
 * `authLoginByEmailLimiter` keys off `req.body.email`, which only exists
 * once `validate` has parsed and lower-cased it.
 */
export const authRouter: Router = Router();

authRouter.get('/csrf', authController.csrf);

authRouter.post(
  '/login',
  csrfProtection,
  authLoginByIpLimiter,
  validate({ body: loginSchema }),
  authLoginByEmailLimiter,
  authController.login,
);

authRouter.post('/refresh', csrfProtection, authRefreshLimiter, authController.refresh);

// No `authenticate`: identifies the session from the refresh cookie itself
// (authService.logout) so an already-expired access token cannot make
// logout fail. Reuses the refresh bucket — it performs the same shape of
// work (one token-hash lookup) and doc 09 §4's table has no bucket of its own.
authRouter.post('/logout', csrfProtection, authRefreshLimiter, authController.logout);

authRouter.post('/logout-all', csrfProtection, authenticate, authController.logoutAll);

authRouter.get('/me', authenticate, authController.me);

authRouter.post(
  '/change-password',
  csrfProtection,
  authenticate,
  validate({ body: changePasswordSchema }),
  authController.changePassword,
);
