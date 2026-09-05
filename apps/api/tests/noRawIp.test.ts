import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { afterAll, describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';
import { env } from '../src/config/env.js';
import { prisma } from '../src/config/prisma.js';
import { hashPassword } from '../src/lib/password.js';

/**
 * doc11 Phase 13's own exit criterion, verified in one place rather than
 * scattered per-endpoint: "no raw IP anywhere in the database (asserted by
 * test)". Doc09 §10 names four tables that ever derive from a request's own
 * IP — `page_views.visitor_hash`, `contact_messages.ip_hash`,
 * `audit_logs.ip_hash`, `refresh_tokens.ip_hash` — this file drives a real
 * request through each of the endpoints that write one, with a known,
 * distinctive fake IP, then reads the persisted row directly and asserts
 * the stored value is a 64-char sha256 hex digest that never contains that
 * IP as a substring. (`tests/analytics.test.ts` already covers
 * `page_views` on its own; it is re-asserted here too so this one file is a
 * complete, literal answer to the exit criterion by itself.)
 */

const app = createApp();
const ORIGIN = env.CORS_ORIGIN[0];
if (!ORIGIN) throw new Error('test setup: env.CORS_ORIGIN is empty');

const RAW_IP = '203.0.113.77'; // TEST-NET-3 (RFC 5737) — guaranteed never a real visitor
const SHA256_HEX = /^[0-9a-f]{64}$/;

function cookieHeader(res: request.Response): string {
  const raw = res.headers['set-cookie'] as unknown;
  const list: string[] = Array.isArray(raw)
    ? (raw as string[])
    : typeof raw === 'string'
      ? [raw]
      : [];
  return list.map((entry) => entry.split(';')[0]).join('; ');
}

async function fetchCsrf() {
  const res = await request(app).get('/api/v1/auth/csrf').set('X-Forwarded-For', RAW_IP);
  const body = res.body as { data: { csrfToken: string } };
  return { csrfToken: body.data.csrfToken, cookie: cookieHeader(res) };
}

const PASSWORD = 'a-perfectly-fine-test-password-000';
const createdUserIds: number[] = [];

async function createUser() {
  const email = `no-raw-ip-${randomUUID()}@eslamramzy.test`;
  const user = await prisma.user.create({
    data: {
      email,
      passwordHash: await hashPassword(PASSWORD),
      name: 'No Raw IP Test User',
      role: 'ADMIN',
    },
  });
  createdUserIds.push(user.id);
  return { email, user };
}

afterAll(async () => {
  await prisma.pageView.deleteMany({ where: { path: '/no-raw-ip-test' } });
  await prisma.contactMessage.deleteMany({ where: { subject: 'no-raw-ip-test-marker' } });
  if (createdUserIds.length > 0) {
    await prisma.refreshToken.deleteMany({ where: { userId: { in: createdUserIds } } });
    await prisma.auditLog.deleteMany({ where: { userId: { in: createdUserIds } } });
    await prisma.user.deleteMany({ where: { id: { in: createdUserIds } } });
  }
});

describe('no raw IP anywhere in the database (doc11 Phase 13 exit criterion)', () => {
  it('page_views.visitor_hash is a hash, never the raw IP', async () => {
    const res = await request(app)
      .post('/api/v1/analytics/view')
      .set('X-Forwarded-For', RAW_IP)
      .send({ path: '/no-raw-ip-test' });
    expect(res.status).toBe(204);

    const row = await prisma.pageView.findFirst({
      where: { path: '/no-raw-ip-test' },
      orderBy: { id: 'desc' },
    });
    expect(row?.visitorHash).toMatch(SHA256_HEX);
    expect(row?.visitorHash).not.toContain(RAW_IP);
  });

  it('contact_messages.ip_hash is a hash, never the raw IP', async () => {
    const res = await request(app)
      .post('/api/v1/contact')
      .set('X-Forwarded-For', RAW_IP)
      .send({
        name: 'Jane Doe',
        email: `jane-${randomUUID()}@example.com`,
        subject: 'no-raw-ip-test-marker',
        message: 'Hello, I would like to get in touch about a project.',
        renderedAt: Date.now() - 5000,
      });
    expect(res.status).toBe(201);

    const row = await prisma.contactMessage.findFirst({
      where: { subject: 'no-raw-ip-test-marker' },
      orderBy: { id: 'desc' },
    });
    expect(row?.ipHash).toMatch(SHA256_HEX);
    expect(row?.ipHash).not.toContain(RAW_IP);
  });

  it('audit_logs.ip_hash and refresh_tokens.ip_hash are hashes, never the raw IP, after a real login', async () => {
    const { email, user } = await createUser();
    const { csrfToken, cookie } = await fetchCsrf();

    const res = await request(app)
      .post('/api/v1/auth/login')
      .set('X-Forwarded-For', RAW_IP)
      .set('Origin', ORIGIN)
      .set('Cookie', cookie)
      .set('X-CSRF-Token', csrfToken)
      .send({ email, password: PASSWORD });
    expect(res.status).toBe(200);

    const refreshToken = await prisma.refreshToken.findFirst({
      where: { userId: user.id },
      orderBy: { id: 'desc' },
    });
    expect(refreshToken?.ipHash).toMatch(SHA256_HEX);
    expect(refreshToken?.ipHash).not.toContain(RAW_IP);

    const auditEntry = await prisma.auditLog.findFirst({
      where: { userId: user.id, action: 'LOGIN_SUCCESS' },
      orderBy: { id: 'desc' },
    });
    expect(auditEntry?.ipHash).toMatch(SHA256_HEX);
    expect(auditEntry?.ipHash).not.toContain(RAW_IP);
  });
});
