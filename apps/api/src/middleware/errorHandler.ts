import type { ApiFailure } from '@portfolio/shared';
import type { ErrorRequestHandler, NextFunction, Request, Response } from 'express';
import { isProduction } from '../config/env.js';
import { AppError, InternalError, RateLimitedError, ValidationError } from '../errors/AppError.js';
import { logger } from '../lib/logger.js';
import { getRequestId } from './requestId.js';

export interface ErrorHandlerOptions {
  isProduction: boolean;
}

/**
 * The single place a caught error becomes an HTTP response
 * (docs/architecture/01 §5, §6). Last in the middleware chain, always
 * (docs/architecture/03 §6) — Express identifies an error handler by its
 * four-parameter signature, so `next` stays in the list even though it is
 * unused.
 *
 * Every error is logged server-side against `req.id` before the client ever
 * sees a response, whether it is an expected `AppError` or a genuine bug —
 * only the RESPONSE differs (docs/architecture/09 §11): a masked
 * `INTERNAL_ERROR` in production is always exactly `{code, message,
 * requestId}`, with no stack, no SQL, no file paths, no dependency versions.
 * Outside production it additionally includes the real message and stack.
 *
 * Built as a factory taking `isProduction` explicitly, rather than reading
 * the module-level `isProduction` from config/env.ts directly, so
 * `errorHandler.test.ts` can construct one instance configured each way and
 * assert both behaviours side by side — no environment stubbing or module
 * cache reset required. `vi.resetModules()` plus a dynamic re-import of this
 * module was tried first and produced two real, confusing failures: the
 * freshly re-imported module read a stale `process.env.NODE_ENV`, and an
 * `AppError` constructed against the statically-imported class failed
 * `instanceof` against the dynamically re-imported one (a different class
 * despite identical code) — both symptoms of `vi.resetModules()` not fully
 * resetting Node's native ESM cache the way it does for a transformed graph.
 * Explicit configuration sidesteps the whole problem.
 */
export function createErrorHandler(options: ErrorHandlerOptions): ErrorRequestHandler {
  return function errorHandler(
    error: unknown,
    req: Request,
    res: Response,
    _next: NextFunction,
  ): void {
    // The real message is preserved on `appError` even for a wrapped bug —
    // masking happens once, below, when building the response body. Without
    // this, `appError.message` would always be InternalError's own generic
    // default regardless of environment, and "the real message shows outside
    // production" would silently never be true — exactly the bug this
    // comment exists because of.
    const appError =
      error instanceof AppError
        ? error
        : new InternalError(
            error instanceof Error ? error.message : 'An unexpected error occurred',
          );
    const reqId = getRequestId(req);

    if (appError.isOperational && error instanceof AppError) {
      // An expected condition (404, a validation failure, ...) — real traffic
      // signal, not a bug. Logged, but at a level that will not page anyone.
      logger.info(
        { reqId, code: appError.code, statusCode: appError.statusCode },
        appError.message,
      );
    } else {
      logger.error({ reqId, err: error }, 'Unhandled error');
    }

    if (appError instanceof RateLimitedError) {
      res.setHeader('Retry-After', appError.retryAfterSeconds);
    }

    const isMaskedInternal = appError.code === 'INTERNAL_ERROR';
    const message =
      isMaskedInternal && options.isProduction ? 'An unexpected error occurred' : appError.message;

    const body: ApiFailure = {
      success: false,
      error: {
        code: appError.code,
        message,
        ...(appError instanceof ValidationError ? { details: appError.details ?? [] } : {}),
        ...(isMaskedInternal ? { requestId: reqId } : {}),
      },
    };

    // Stack traces are a development-only convenience, never part of the
    // documented envelope contract — attached after typing `body` against the
    // real contract, not folded into it, so the shared type stays the source
    // of truth for what a client can rely on.
    const responseBody =
      isMaskedInternal && !options.isProduction && error instanceof Error
        ? { ...body, error: { ...body.error, stack: error.stack } }
        : body;

    res.status(appError.statusCode).json(responseBody);
  };
}

/** The real instance the app actually mounts, wired to the real environment. */
export const errorHandler: ErrorRequestHandler = createErrorHandler({ isProduction });
