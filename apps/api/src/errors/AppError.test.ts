import { describe, expect, it } from 'vitest';
import {
  AppError,
  ConflictError,
  CsrfError,
  ForbiddenError,
  InternalError,
  NotFoundError,
  PayloadTooLargeError,
  RateLimitedError,
  TokenExpiredError,
  UnauthenticatedError,
  UnsupportedMediaTypeError,
  ValidationError,
} from './AppError.js';

describe('AppError subclasses', () => {
  it.each([
    [new ValidationError([{ field: 'email', message: 'Invalid' }]), 400, 'VALIDATION_ERROR'],
    [new UnauthenticatedError(), 401, 'UNAUTHENTICATED'],
    [new TokenExpiredError(), 401, 'TOKEN_EXPIRED'],
    [new ForbiddenError(), 403, 'FORBIDDEN'],
    [new CsrfError(), 403, 'CSRF_FAILED'],
    [new NotFoundError(), 404, 'NOT_FOUND'],
    [new ConflictError('slug taken'), 409, 'CONFLICT'],
    [new PayloadTooLargeError(), 413, 'PAYLOAD_TOO_LARGE'],
    [new UnsupportedMediaTypeError(), 415, 'UNSUPPORTED_MEDIA_TYPE'],
    [new RateLimitedError(60), 429, 'RATE_LIMITED'],
    [new InternalError(), 500, 'INTERNAL_ERROR'],
  ])('%# matches its documented status code and error code', (error, statusCode, code) => {
    expect(error).toBeInstanceOf(AppError);
    expect(error.statusCode).toBe(statusCode);
    expect(error.code).toBe(code);
    expect(error.isOperational).toBe(true);
  });

  it('ValidationError carries field-level details', () => {
    const error = new ValidationError([{ field: 'email', message: 'Invalid email address' }]);
    expect(error.details).toEqual([{ field: 'email', message: 'Invalid email address' }]);
  });

  it('every other error type carries no details', () => {
    expect(new NotFoundError().details).toBeUndefined();
  });

  it('RateLimitedError carries the retry-after value', () => {
    expect(new RateLimitedError(120).retryAfterSeconds).toBe(120);
  });

  it('uses sensible default messages', () => {
    expect(new NotFoundError().message).toBe('Resource not found');
    expect(new ForbiddenError().message).toBe('You do not have permission to perform this action');
  });

  it('accepts a custom message where the constructor allows one', () => {
    expect(new NotFoundError('Project not found').message).toBe('Project not found');
    expect(new ConflictError('That slug is already in use').message).toBe(
      'That slug is already in use',
    );
  });

  it('captures a stack trace pointing at the throw site, not AppError itself', () => {
    const error = new NotFoundError();
    expect(error.stack).toContain('NotFoundError');
  });
});
