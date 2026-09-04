import type { ApiFieldError } from '@portfolio/shared';
import type { NextFunction, Request, Response } from 'express';
import type { ZodError, ZodType } from 'zod';
import { ValidationError } from '../errors/AppError.js';

export interface ValidateSchemas {
  params?: ZodType;
  query?: ZodType;
  body?: ZodType;
}

function toFieldErrors(error: ZodError): ApiFieldError[] {
  return error.issues.map((issue) => ({
    field: issue.path.length > 0 ? issue.path.join('.') : '(root)',
    message: issue.message,
  }));
}

/**
 * Validates `params`/`query`/`body` against Zod schemas and **replaces**
 * `req.*` with the parsed output (docs/architecture/03 §6, §7) — coercion
 * (`?page=2` → `2: number`) and defaults happen here, once, so nothing
 * downstream re-parses a raw query string.
 *
 * All three schemas are checked even if an earlier one fails, so a single
 * bad request reports every problem at once instead of one field per retry
 * (the same reason `.strict()` write schemas are validated, not stripped,
 * in packages/shared — docs/architecture/03 §7: mass assignment must be
 * visible, and validation UX benefits from the same "tell me everything"
 * behaviour by coincidence, not because they are the same control).
 */
export function validate(schemas: ValidateSchemas) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const issues: ApiFieldError[] = [];

    if (schemas.params) {
      const result = schemas.params.safeParse(req.params);
      if (result.success) {
        req.params = result.data as typeof req.params;
      } else {
        issues.push(...toFieldErrors(result.error));
      }
    }

    if (schemas.query) {
      const result = schemas.query.safeParse(req.query);
      if (result.success) {
        // Express 5 made `req.query` a getter-only accessor (recomputed from
        // the raw URL on every read) rather than the plain mutable property
        // it was in Express 4 — verified empirically after a plain
        // `req.query = result.data` silently failed to persist in
        // validate.test.ts, with no error and no visible symptom besides the
        // coerced value never actually reaching the route handler.
        // `Object.defineProperty` replaces the accessor with a real,
        // writable, own property, which does persist.
        Object.defineProperty(req, 'query', {
          value: result.data,
          writable: true,
          configurable: true,
          enumerable: true,
        });
      } else {
        issues.push(...toFieldErrors(result.error));
      }
    }

    if (schemas.body) {
      const result = schemas.body.safeParse(req.body);
      if (result.success) {
        req.body = result.data;
      } else {
        issues.push(...toFieldErrors(result.error));
      }
    }

    if (issues.length > 0) {
      next(new ValidationError(issues));
      return;
    }

    next();
  };
}
