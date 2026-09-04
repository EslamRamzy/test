import { mkdirSync, rmSync } from 'node:fs';
import { dirname } from 'node:path';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';
import { applyMigrations } from './helpers/testDb.js';

// Must match vitest.config.ts's `test.env.DATABASE_URL` (without the `file:`
// prefix) — see that file for why config/prisma.ts's singleton cannot be
// pointed at a per-test file the usual way.
const DB_PATH = './.tmp/vitest-app.db';

const app = createApp();

beforeAll(() => {
  mkdirSync(dirname(DB_PATH), { recursive: true });
  applyMigrations(DB_PATH);
});

afterAll(() => {
  rmSync(dirname(DB_PATH), { recursive: true, force: true });
});

describe('health endpoints', () => {
  it('reports liveness', async () => {
    const response = await request(app).get('/api/v1/health');

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ success: true, data: { status: 'ok' } });
  });

  it('reports readiness', async () => {
    const response = await request(app).get('/api/v1/health/ready');

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ success: true, data: { status: 'ready' } });
  });
});

describe('application defaults', () => {
  it('returns the standard error envelope for an unknown route', async () => {
    const response = await request(app).get('/api/v1/does-not-exist');

    expect(response.status).toBe(404);
    expect(response.body).toEqual({
      success: false,
      error: { code: 'NOT_FOUND', message: 'Resource not found' },
    });
  });

  it('does not advertise the framework', async () => {
    const response = await request(app).get('/api/v1/health');

    expect(response.headers['x-powered-by']).toBeUndefined();
  });

  it('sets baseline security headers', async () => {
    const response = await request(app).get('/api/v1/health');

    expect(response.headers['x-content-type-options']).toBe('nosniff');
    expect(response.headers['x-frame-options']).toBe('DENY');
  });

  it('does not grant CORS access to an origin outside the allow-list', async () => {
    const response = await request(app)
      .get('/api/v1/health')
      .set('Origin', 'https://evil-eslamramzy.dev');

    expect(response.headers['access-control-allow-origin']).toBeUndefined();
  });
});
