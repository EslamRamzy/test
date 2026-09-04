import type { ApiFieldError, ErrorCode } from '@portfolio/shared';

/**
 * Typed application errors (docs/architecture/01 §5, §6).
 *
 * Services throw these; nothing else in the codebase constructs an HTTP
 * status code or an error envelope by hand. `errorHandler.ts` is the single
 * place that turns a caught error into a response, so the envelope shape in
 * docs/architecture/03 §1 is enforced in exactly one function.
 *
 * `isOperational: true` marks an error as an expected, handled condition
 * (a missing resource, a validation failure) as opposed to a programming bug
 * that happened to surface as a thrown error. The error handler logs both,
 * but only masks the message of the latter in production (docs/architecture/09 §11).
 */
export abstract class AppError extends Error {
  abstract readonly statusCode: number;
  abstract readonly code: ErrorCode;
  readonly isOperational = true;
  // Not `details?:` — under `exactOptionalPropertyTypes`, an optional
  // property forbids assigning `undefined` to it explicitly, and the
  // constructor below does exactly that for every subclass that has no
  // details. An explicit union says what actually happens at runtime.
  readonly details: ApiFieldError[] | undefined;

  constructor(message: string, details?: ApiFieldError[]) {
    super(message);
    this.name = this.constructor.name;
    this.details = details;
    Error.captureStackTrace(this, this.constructor);
  }
}

/** 400 — Zod rejected body/query/params/file. The only error carrying `details`. */
export class ValidationError extends AppError {
  readonly statusCode = 400;
  readonly code: ErrorCode = 'VALIDATION_ERROR';

  constructor(details: ApiFieldError[], message = 'Request validation failed') {
    super(message, details);
  }
}

/** 401 — missing, invalid, or malformed access token. */
export class UnauthenticatedError extends AppError {
  readonly statusCode = 401;
  readonly code: ErrorCode = 'UNAUTHENTICATED';

  constructor(message = 'Authentication required') {
    super(message);
  }
}

/** 401 — a structurally valid access token that has expired. The client should call /auth/refresh. */
export class TokenExpiredError extends AppError {
  readonly statusCode = 401;
  readonly code: ErrorCode = 'TOKEN_EXPIRED';

  constructor(message = 'Access token has expired') {
    super(message);
  }
}

/** 403 — authenticated, but not permitted to perform this action. */
export class ForbiddenError extends AppError {
  readonly statusCode = 403;
  readonly code: ErrorCode = 'FORBIDDEN';

  constructor(message = 'You do not have permission to perform this action') {
    super(message);
  }
}

/** 403 — missing or mismatched CSRF token on a state-changing request. */
export class CsrfError extends AppError {
  readonly statusCode = 403;
  readonly code: ErrorCode = 'CSRF_FAILED';

  constructor(message = 'CSRF token missing or invalid') {
    super(message);
  }
}

/**
 * 404 — absent OR not visible to the caller. Draft content and a
 * genuinely-missing row return the exact same response on purpose
 * (docs/architecture/03 §1, "Draft leakage rule") — a 403 here would
 * confirm the resource exists and leak the slug of unreleased work.
 */
export class NotFoundError extends AppError {
  readonly statusCode = 404;
  readonly code: ErrorCode = 'NOT_FOUND';

  constructor(message = 'Resource not found') {
    super(message);
  }
}

/** 409 — a unique constraint conflict the caller can act on (slug taken, still referenced, stale write). */
export class ConflictError extends AppError {
  readonly statusCode = 409;
  readonly code: ErrorCode = 'CONFLICT';

  constructor(message: string) {
    super(message);
  }
}

/** 413 — upload exceeds the configured size limit. */
export class PayloadTooLargeError extends AppError {
  readonly statusCode = 413;
  readonly code: ErrorCode = 'PAYLOAD_TOO_LARGE';

  constructor(message = 'Payload exceeds the maximum allowed size') {
    super(message);
  }
}

/** 415 — a MIME type outside the allow-list. */
export class UnsupportedMediaTypeError extends AppError {
  readonly statusCode = 415;
  readonly code: ErrorCode = 'UNSUPPORTED_MEDIA_TYPE';

  constructor(message = 'Unsupported media type') {
    super(message);
  }
}

/** 429 — a rate-limit bucket was exceeded. `retryAfterSeconds` becomes the `Retry-After` header. */
export class RateLimitedError extends AppError {
  readonly statusCode = 429;
  readonly code: ErrorCode = 'RATE_LIMITED';
  readonly retryAfterSeconds: number;

  constructor(retryAfterSeconds: number, message = 'Too many requests') {
    super(message);
    this.retryAfterSeconds = retryAfterSeconds;
  }
}

/**
 * 500 — never thrown deliberately by application code. `errorHandler.ts`
 * constructs one internally to represent "an error that was not an
 * `AppError`," i.e. an unexpected bug rather than a handled condition.
 */
export class InternalError extends AppError {
  readonly statusCode = 500;
  readonly code: ErrorCode = 'INTERNAL_ERROR';

  constructor(message = 'An unexpected error occurred') {
    super(message);
  }
}
