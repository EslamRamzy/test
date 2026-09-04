import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';
import { prisma } from '../src/config/prisma.js';

const app = createApp();

let ipCounter = 0;
function freshIp(): string {
  ipCounter += 1;
  return `10.2.${Math.floor(ipCounter / 256)}.${ipCounter % 256}`;
}

describe('POST /analytics/view', () => {
  it('returns 204 with no body and stores a hashed visitor, never a raw IP', async () => {
    const path = `/projects/analytics-test-${Date.now()}`;
    const ip = freshIp();

    const res = await request(app)
      .post('/api/v1/analytics/view')
      .set('X-Forwarded-For', ip)
      .send({ path });

    expect(res.status).toBe(204);
    expect(res.body).toEqual({});

    const stored = await prisma.pageView.findFirst({ where: { path }, orderBy: { id: 'desc' } });
    expect(stored).not.toBeNull();
    expect(stored?.visitorHash).toMatch(/^[0-9a-f]{64}$/);
    expect(stored?.visitorHash).not.toContain(ip);

    if (stored) await prisma.pageView.delete({ where: { id: stored.id } });
  });

  it('accepts entityType/entityId/referrerHost', async () => {
    const path = `/articles/analytics-test-${Date.now()}`;
    const res = await request(app)
      .post('/api/v1/analytics/view')
      .set('X-Forwarded-For', freshIp())
      .send({ path, entityType: 'ARTICLE', entityId: 1, referrerHost: 'google.com' });

    expect(res.status).toBe(204);

    const stored = await prisma.pageView.findFirst({ where: { path }, orderBy: { id: 'desc' } });
    expect(stored?.entityType).toBe('ARTICLE');
    expect(stored?.referrerHost).toBe('google.com');

    if (stored) await prisma.pageView.delete({ where: { id: stored.id } });
  });

  it('rejects a malformed payload', async () => {
    const res = await request(app)
      .post('/api/v1/analytics/view')
      .set('X-Forwarded-For', freshIp())
      .send({ path: '' });

    expect(res.status).toBe(400);
  });

  it('enforces the 60/minute/IP rate limit', async () => {
    const ip = freshIp();
    let last: request.Response | undefined;
    for (let i = 0; i < 61; i++) {
      last = await request(app)
        .post('/api/v1/analytics/view')
        .set('X-Forwarded-For', ip)
        .send({ path: `/rl-test-${i}` });
    }
    expect(last?.status).toBe(429);

    await prisma.pageView.deleteMany({ where: { path: { startsWith: '/rl-test-' } } });
  }, 15_000);
});
