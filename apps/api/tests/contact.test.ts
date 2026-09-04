import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { afterAll, describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';
import { prisma } from '../src/config/prisma.js';

/**
 * Doc 09 §8 / T7: rate limit, honeypot, timing check, no user input in
 * headers. `X-Forwarded-For` isolates each test from the shared 3/hour/IP
 * bucket, exactly as tests/auth.test.ts does for the login limiter.
 */

const app = createApp();

let ipCounter = 0;
function freshIp(): string {
  ipCounter += 1;
  return `10.1.${Math.floor(ipCounter / 256)}.${ipCounter % 256}`;
}

/**
 * Every submission here carries the same `subject` marker so `afterAll` can
 * find and delete every row this file actually stored — including the ones
 * created incidentally by the rate-limit test, which has no other reason to
 * tag its payloads and would otherwise leave real rows in the shared test
 * database counting toward the 10/day global cap on every future run.
 */
function validPayload(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    name: 'Jane Doe',
    email: `jane-${randomUUID()}@example.com`,
    subject: 'contact-test-marker',
    message: 'Hello, I would like to get in touch about a project.',
    renderedAt: Date.now() - 5000, // 5s ago — clears the 3s timing check
    ...overrides,
  };
}

afterAll(async () => {
  // Best-effort cleanup of anything this file actually stored.
  await prisma.contactMessage.deleteMany({ where: { subject: 'contact-test-marker' } });
});

describe('POST /contact', () => {
  it('stores a valid, human-paced submission and always reports generic success', async () => {
    const res = await request(app)
      .post('/api/v1/contact')
      .set('X-Forwarded-For', freshIp())
      .send(validPayload());

    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ success: true, data: { received: true } });

    const stored = await prisma.contactMessage.findFirst({
      where: { subject: 'contact-test-marker' },
    });
    expect(stored).not.toBeNull();
  });

  it('silently drops a honeypot-filled submission with the identical response', async () => {
    const email = `honeypot-${randomUUID()}@example.com`;
    const res = await request(app)
      .post('/api/v1/contact')
      .set('X-Forwarded-For', freshIp())
      .send(validPayload({ email, website: 'http://spam.example' }));

    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ success: true, data: { received: true } });

    const stored = await prisma.contactMessage.findFirst({ where: { email } });
    expect(stored).toBeNull();
  });

  it('silently drops a too-fast submission with the identical response', async () => {
    const email = `toofast-${randomUUID()}@example.com`;
    const res = await request(app)
      .post('/api/v1/contact')
      .set('X-Forwarded-For', freshIp())
      .send(validPayload({ email, renderedAt: Date.now() })); // 0s elapsed

    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ success: true, data: { received: true } });

    const stored = await prisma.contactMessage.findFirst({ where: { email } });
    expect(stored).toBeNull();
  });

  it('rejects an invalid payload with a 400, not a silent drop', async () => {
    const res = await request(app)
      .post('/api/v1/contact')
      .set('X-Forwarded-For', freshIp())
      .send(validPayload({ email: 'not-an-email' }));

    expect(res.status).toBe(400);
    expect(res.body).toMatchObject({ error: { code: 'VALIDATION_ERROR' } });
  });

  it('rejects an unknown field (mass-assignment defence)', async () => {
    const res = await request(app)
      .post('/api/v1/contact')
      .set('X-Forwarded-For', freshIp())
      .send(validPayload({ isAdmin: true }));

    expect(res.status).toBe(400);
  });

  it('enforces the 3/hour/IP rate limit', async () => {
    const ip = freshIp();
    let last: request.Response | undefined;
    for (let i = 0; i < 4; i++) {
      last = await request(app)
        .post('/api/v1/contact')
        .set('X-Forwarded-For', ip)
        .send(validPayload());
    }
    expect(last?.status).toBe(429);
    expect(last?.body).toMatchObject({ error: { code: 'RATE_LIMITED' } });
  });
});
