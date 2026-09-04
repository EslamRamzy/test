import type { Permission } from '@portfolio/shared';
import { roleHasPermission } from '@portfolio/shared';
import type { NextFunction, Request, Response } from 'express';
import { ForbiddenError, UnauthenticatedError } from '../errors/AppError.js';

/**
 * Enforcement point #2 of 3 (docs/architecture/05 §3): does this role's
 * static permission set contain the permission this route needs. Always
 * mounted after `authenticate` — `req.user` missing here is a routing bug
 * (this middleware mounted without `authenticate` in front of it), not a
 * client error, but it still fails closed as 401 rather than throwing a
 * type error or, worse, treating a missing actor as permitted.
 */
export function authorize(permission: Permission) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user) {
      next(new UnauthenticatedError());
      return;
    }
    if (!roleHasPermission(req.user.role, permission)) {
      next(new ForbiddenError());
      return;
    }
    next();
  };
}
