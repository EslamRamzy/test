import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { afterAll, describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';
import { env } from '../src/config/env.js';
import { prisma } from '../src/config/prisma.js';
import { hashPassword } from '../src/lib/password.js';

/**
 * `/api/v1/admin/technologies` — real HTTP integration test against the
 * generic admin CRUD factory (`services/adminCrudFactory.ts`,
 * `controllers/admin/crudFactory.ts`). This is the FIRST of the ~10 simple
 * modules built on that factory, so it is also the test that actually
 * proves the factory itself: list/create/read/update/delete/reorder, auth,
 * and audit-log coupling all exercised against a real request, not a mock.
 * The remaining simple modules replicate this same shape with their own
 * fields — see this file's own header on each new resource's test.
 *
 * Helpers duplicated from `tests/auth.test.ts`/`tests/adminOverview.test.ts`
 * rather than extracted, matching those files' own established convention.
 */

const app = createApp();
const ORIGIN = env.CORS_ORIGIN[0];
if (!ORIGIN) throw new Error('test setup: env.CORS_ORIGIN is empty');

const PASSWORD = 'a-perfectly-fine-test-password-000';
const createdUserIds: number[] = [];
const createdTechnologyIds: number[] = [];

async function createUser() {
  const email = `http-${randomUUID()}@eslamramzy.test`;
  const user = await prisma.user.create({
    data: {
      email,
      passwordHash: await hashPassword(PASSWORD),
      name: 'HTTP Test User',
      role: 'ADMIN',
    },
  });
  createdUserIds.push(user.id);
  return { email, user };
}

afterAll(async () => {
  if (createdTechnologyIds.length > 0) {
    await prisma.technology.deleteMany({ where: { id: { in: createdTechnologyIds } } });
  }
  if (createdUserIds.length > 0) {
    await prisma.user.deleteMany({ where: { id: { in: createdUserIds } } });
  }
});

function cookieHeader(res: request.Response): string {
  const raw = res.headers['set-cookie'] as unknown;
  const list: string[] = Array.isArray(raw)
    ? (raw as string[])
    : typeof raw === 'string'
      ? [raw]
      : [];
  return list.map((entry) => entry.split(';')[0]).join('; ');
}

async function fetchCsrf(forwardedFor: string) {
  const res = await request(app).get('/api/v1/auth/csrf').set('X-Forwarded-For', forwardedFor);
  const body = res.body as { data: { csrfToken: string } };
  return { csrfToken: body.data.csrfToken, cookie: cookieHeader(res) };
}

let ipCounter = 0;
function freshIp(): string {
  ipCounter += 1;
  return `10.2.${Math.floor(ipCounter / 256)}.${ipCounter % 256}`;
}

async function login() {
  const { email } = await createUser();
  const ip = freshIp();
  const { csrfToken, cookie } = await fetchCsrf(ip);

  const res = await request(app)
    .post('/api/v1/auth/login')
    .set('X-Forwarded-For', ip)
    .set('Origin', ORIGIN)
    .set('Cookie', cookie)
    .set('X-CSRF-Token', csrfToken)
    .send({ email, password: PASSWORD });

  if (res.status !== 200) {
    throw new Error(`test setup: login failed with ${res.status}: ${JSON.stringify(res.body)}`);
  }

  return { cookie: cookieHeader(res), ip, csrfToken };
}

describe('/api/v1/admin/technologies', () => {
  it('requires authentication', async () => {
    const res = await request(app)
      .get('/api/v1/admin/technologies')
      .set('X-Forwarded-For', freshIp());
    expect(res.status).toBe(401);
  });

  it('creates, lists, reads, updates, reorders, and deletes a technology — with audit entries for each', async () => {
    const { cookie, ip, csrfToken } = await login();
    const slug = `test-tech-${randomUUID()}`;

    // CREATE
    const createRes = await request(app)
      .post('/api/v1/admin/technologies')
      .set('X-Forwarded-For', ip)
      .set('Origin', ORIGIN)
      .set('Cookie', cookie)
      .set('X-CSRF-Token', csrfToken)
      .send({ name: 'Test Technology', slug });

    expect(createRes.status).toBe(201);
    const created = (createRes.body as { data: { id: number; name: string; slug: string } }).data;
    expect(created.name).toBe('Test Technology');
    createdTechnologyIds.push(created.id);

    // LIST — the new row is findable by its own slug via `q`
    const listRes = await request(app)
      .get(`/api/v1/admin/technologies?q=${slug}`)
      .set('X-Forwarded-For', ip)
      .set('Cookie', cookie);
    expect(listRes.status).toBe(200);
    const listBody = listRes.body as { data: Array<{ id: number }>; meta: { total: number } };
    expect(listBody.data.some((row) => row.id === created.id)).toBe(true);

    // READ
    const readRes = await request(app)
      .get(`/api/v1/admin/technologies/${created.id}`)
      .set('X-Forwarded-For', ip)
      .set('Cookie', cookie);
    expect(readRes.status).toBe(200);

    // UPDATE
    const updateRes = await request(app)
      .patch(`/api/v1/admin/technologies/${created.id}`)
      .set('X-Forwarded-For', ip)
      .set('Origin', ORIGIN)
      .set('Cookie', cookie)
      .set('X-CSRF-Token', csrfToken)
      .send({ category: 'language' });
    expect(updateRes.status).toBe(200);
    expect((updateRes.body as { data: { category: string } }).data.category).toBe('language');

    // REORDER
    const reorderRes = await request(app)
      .patch('/api/v1/admin/technologies/reorder')
      .set('X-Forwarded-For', ip)
      .set('Origin', ORIGIN)
      .set('Cookie', cookie)
      .set('X-CSRF-Token', csrfToken)
      .send([{ id: created.id, displayOrder: 5 }]);
    expect(reorderRes.status).toBe(200);

    const afterReorder = await prisma.technology.findUnique({ where: { id: created.id } });
    expect(afterReorder?.displayOrder).toBe(5);

    // Audit entries recorded for every mutation (doc 05 §7). CREATE/UPDATE
    // carry this row's own entityId; REORDER's audit entry deliberately
    // does not (it can touch many rows in one call, so no single entityId
    // applies) — queried separately rather than by entityId, for that reason.
    const rowAuditActions = (
      await prisma.auditLog.findMany({
        where: { entityType: 'TECHNOLOGY', entityId: created.id },
        orderBy: { id: 'asc' },
      })
    ).map((entry) => entry.action);
    expect(rowAuditActions).toEqual(['TECHNOLOGY_CREATE', 'TECHNOLOGY_UPDATE']);

    const reorderAudit = await prisma.auditLog.findFirst({
      where: { entityType: 'TECHNOLOGY', action: 'TECHNOLOGY_REORDER' },
      orderBy: { id: 'desc' },
    });
    expect(reorderAudit).not.toBeNull();
    expect(reorderAudit?.entityId).toBeNull();

    // DELETE
    const deleteRes = await request(app)
      .delete(`/api/v1/admin/technologies/${created.id}`)
      .set('X-Forwarded-For', ip)
      .set('Origin', ORIGIN)
      .set('Cookie', cookie)
      .set('X-CSRF-Token', csrfToken);
    expect(deleteRes.status).toBe(200);

    const afterDelete = await prisma.technology.findUnique({ where: { id: created.id } });
    expect(afterDelete).toBeNull();
    createdTechnologyIds.pop(); // already gone — nothing left for afterAll to clean up
  });

  it('rejects a duplicate slug with 409, not a raw 500', async () => {
    const { cookie, ip, csrfToken } = await login();
    const slug = `dup-tech-${randomUUID()}`;

    const first = await request(app)
      .post('/api/v1/admin/technologies')
      .set('X-Forwarded-For', ip)
      .set('Origin', ORIGIN)
      .set('Cookie', cookie)
      .set('X-CSRF-Token', csrfToken)
      .send({ name: 'Dup', slug });
    expect(first.status).toBe(201);
    createdTechnologyIds.push((first.body as { data: { id: number } }).data.id);

    const second = await request(app)
      .post('/api/v1/admin/technologies')
      .set('X-Forwarded-For', ip)
      .set('Origin', ORIGIN)
      .set('Cookie', cookie)
      .set('X-CSRF-Token', csrfToken)
      .send({ name: 'Dup Again', slug });

    expect(second.status).toBe(409);
    expect(second.body).toMatchObject({ success: false, error: { code: 'CONFLICT' } });
  });

  it('returns 404 for a nonexistent id, and 400 (not 500) for a malformed body', async () => {
    const { cookie, ip, csrfToken } = await login();

    const notFound = await request(app)
      .get('/api/v1/admin/technologies/999999999')
      .set('X-Forwarded-For', ip)
      .set('Cookie', cookie);
    expect(notFound.status).toBe(404);

    const badBody = await request(app)
      .post('/api/v1/admin/technologies')
      .set('X-Forwarded-For', ip)
      .set('Origin', ORIGIN)
      .set('Cookie', cookie)
      .set('X-CSRF-Token', csrfToken)
      .send({ name: '' }); // missing required slug, empty name
    expect(badBody.status).toBe(400);
    expect(badBody.body).toMatchObject({ error: { code: 'VALIDATION_ERROR' } });
  });
});
