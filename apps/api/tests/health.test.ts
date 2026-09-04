import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';

const app = createApp();

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
