import type { NextFunction, Request, Response } from 'express';
import { NotFoundError } from '../errors/AppError.js';

/**
 * Mounted after every route (docs/architecture/03 §6). Routes to the same
 * `errorHandler` as everything else by throwing a typed error rather than
 * writing a response directly, so the 404 envelope is built by the one
 * function responsible for envelope shape, not duplicated here.
 */
export function notFoundHandler(_req: Request, _res: Response, next: NextFunction): void {
  next(new NotFoundError());
}
