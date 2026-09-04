import express from 'express';
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import {
  ConflictError,
  ForbiddenError,
  NotFoundError,
  RateLimitedError,
  ValidationError,
} from '../errors/AppError.js';
import { createErrorHandler, errorHandler } from './errorHandler.js';
import { notFoundHandler } from './notFoundHandler.js';
import { requestId } from './requestId.js';

function buildApp(routeHandler: express.RequestHandler, handler = errorHandler) {
  const app = express();
  app.use(requestId);
  app.get('/thrown', routeHandler);
  app.use(notFoundHandler);
  app.use(handler);
  return app;
}

describe('errorHandler', () => {
  it('maps a NotFoundError to a 404 with the documented envelope', async () => {
    const app = buildApp((_req, _res, next) => {
      next(new NotFoundError());
    });

    const response = await request(app).get('/thrown');

    expect(response.status).toBe(404);
    expect(response.body).toEqual({
      success: false,
      error: { code: 'NOT_FOUND', message: 'Resource not found' },
    });
  });

  it('maps a ValidationError to 400 with field-level details', async () => {
    const app = buildApp((_req, _res, next) => {
      next(new ValidationError([{ field: 'email', message: 'Invalid email address' }]));
    });

    const response = await request(app).get('/thrown');

    expect(response.status).toBe(400);
    expect(response.body).toEqual({
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Request validation failed',
        details: [{ field: 'email', message: 'Invalid email address' }],
      },
    });
  });

  it('maps a ForbiddenError to 403 and carries no details field', async () => {
    const app = buildApp((_req, _res, next) => {
      next(new ForbiddenError());
    });

    const response = await request(app).get('/thrown');

    expect(response.status).toBe(403);
    expect(response.body.error).not.toHaveProperty('details');
  });

  it('maps a ConflictError to 409 with its message', async () => {
    const app = buildApp((_req, _res, next) => {
      next(new ConflictError('That slug is already in use'));
    });

    const response = await request(app).get('/thrown');

    expect(response.status).toBe(409);
    expect(response.body.error.message).toBe('That slug is already in use');
  });

  it('sets Retry-After for a RateLimitedError', async () => {
    const app = buildApp((_req, _res, next) => {
      next(new RateLimitedError(42));
    });

    const response = await request(app).get('/thrown');

    expect(response.status).toBe(429);
    expect(response.headers['retry-after']).toBe('42');
  });

  it('the 404 catch-all for an unmatched route uses the same envelope', async () => {
    const app = buildApp((_req, res) => {
      res.end();
    });

    const response = await request(app).get('/does-not-exist');

    expect(response.status).toBe(404);
    expect(response.body).toEqual({
      success: false,
      error: { code: 'NOT_FOUND', message: 'Resource not found' },
    });
  });

  it('every response includes the same X-Request-Id the client sent, even on error', async () => {
    const app = buildApp((_req, _res, next) => {
      next(new NotFoundError());
    });

    const response = await request(app).get('/thrown').set('X-Request-Id', 'trace-xyz');

    expect(response.headers['x-request-id']).toBe('trace-xyz');
  });
});

describe('errorHandler — production masking (docs/architecture/09 §11)', () => {
  const prodHandler = createErrorHandler({ isProduction: true });
  const devHandler = createErrorHandler({ isProduction: false });

  it('masks an unexpected error to the generic message and includes requestId, in production', async () => {
    const app = buildApp(() => {
      throw new Error('leaked database connection string: postgres://user:pass@host');
    }, prodHandler);

    const response = await request(app).get('/thrown');

    expect(response.status).toBe(500);
    expect(response.body.error.code).toBe('INTERNAL_ERROR');
    expect(response.body.error.message).toBe('An unexpected error occurred');
    expect(response.body.error).toHaveProperty('requestId');
    expect(JSON.stringify(response.body)).not.toContain('postgres://');
    expect(response.body.error).not.toHaveProperty('stack');
  });

  it('shows the real message and a stack outside production, still with requestId', async () => {
    const app = buildApp(() => {
      throw new Error('a specific bug message');
    }, devHandler);

    const response = await request(app).get('/thrown');

    expect(response.status).toBe(500);
    expect(response.body.error.message).toBe('a specific bug message');
    expect(response.body.error).toHaveProperty('stack');
    expect(response.body.error).toHaveProperty('requestId');
  });

  it('never masks a non-internal AppError, even in production', async () => {
    const app = buildApp((_req, _res, next) => {
      next(new ConflictError('That slug is already in use'));
    }, prodHandler);

    const response = await request(app).get('/thrown');

    expect(response.status).toBe(409);
    expect(response.body.error.message).toBe('That slug is already in use');
  });

  it('a non-internal AppError never carries a requestId field, in either mode', async () => {
    const app = buildApp((_req, _res, next) => {
      next(new NotFoundError());
    }, devHandler);

    const response = await request(app).get('/thrown');

    expect(response.body.error).not.toHaveProperty('requestId');
  });
});
