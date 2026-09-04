import express from 'express';
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { createRateLimiter } from './rateLimit.js';

function buildApp(limit: number, trustProxy = false) {
  const app = express();
  if (trustProxy) {
    // Mirrors the real app's `trust proxy: 1` (docs/architecture/09 §4) — only
    // with this set does express-rate-limit's default `req.ip`-based keying
    // honour X-Forwarded-For at all.
    app.set('trust proxy', 1);
  }
  // A high per-test window so the limiter's own window expiry never
  // interferes with a single test run.
  app.use(createRateLimiter({ windowMs: 60_000, limit }));
  app.get('/', (_req, res) => {
    res.json({ success: true, data: { ok: true } });
  });
  return app;
}

describe('rate limiting (docs/architecture/09 §4)', () => {
  it('allows requests under the limit', async () => {
    const app = buildApp(3);

    for (let i = 0; i < 3; i++) {
      const response = await request(app).get('/');
      expect(response.status).toBe(200);
    }
  });

  it('rejects the request that exceeds the limit with the documented envelope', async () => {
    const app = buildApp(2);

    await request(app).get('/');
    await request(app).get('/');
    const blocked = await request(app).get('/');

    expect(blocked.status).toBe(429);
    expect(blocked.body).toEqual({
      success: false,
      error: { code: 'RATE_LIMITED', message: 'Too many requests' },
    });
  });

  it('sets a Retry-After header on the blocked response', async () => {
    const app = buildApp(1);

    await request(app).get('/');
    const blocked = await request(app).get('/');

    expect(blocked.headers['retry-after']).toBeDefined();
    expect(Number(blocked.headers['retry-after'])).toBeGreaterThan(0);
  });

  it('without a configured trust proxy, two different X-Forwarded-For values share one bucket', async () => {
    const app = buildApp(1, false);

    const first = await request(app).get('/').set('X-Forwarded-For', '1.1.1.1');
    const second = await request(app).get('/').set('X-Forwarded-For', '2.2.2.2');

    expect(first.status).toBe(200);
    // Both share the test client's real loopback address regardless of the
    // header, since it is not trusted — this is the correct, safe default,
    // and the reason docs/architecture/09 §4 insists on `trust proxy: 1`
    // rather than `true`: a client could otherwise forge a fresh IP on every
    // request and evade every bucket for free.
    expect(second.status).toBe(429);
  });

  it('with trust proxy configured, distinct forwarded IPs get independent buckets', async () => {
    const app = buildApp(1, true);

    const first = await request(app).get('/').set('X-Forwarded-For', '203.0.113.1');
    const second = await request(app).get('/').set('X-Forwarded-For', '203.0.113.2');

    expect(first.status).toBe(200);
    expect(second.status).toBe(200);
  });
});
