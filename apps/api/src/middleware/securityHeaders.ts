import type { NextFunction, Request, Response } from 'express';

/**
 * `Permissions-Policy` (docs/architecture/09 §2). Helmet does not set this
 * header at all — verified against the installed version's exports, which
 * list every other header in the doc's baseline set but not this one — so it
 * is set directly here rather than assumed to be covered by `helmet()`.
 *
 * Disables features this API has no legitimate use for. `interest-cohort=()`
 * additionally opts out of FLoC/Topics-style tracking, which is meaningful
 * even for an API response since some browsers honour it regardless of
 * content type.
 */
const PERMISSIONS_POLICY = 'camera=(), microphone=(), geolocation=(), interest-cohort=()';

export function permissionsPolicy(_req: Request, res: Response, next: NextFunction): void {
  res.setHeader('Permissions-Policy', PERMISSIONS_POLICY);
  next();
}
