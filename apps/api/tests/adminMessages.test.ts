import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { afterAll, describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';
import { env } from '../src/config/env.js';
import { prisma } from '../src/config/prisma.js';
import { loginAsAdmin } from './helpers/adminAuth.js';

/**
 * `/api/v1/admin/messages` (doc03 §5) — the inbox: list/filter/search,
 * PATCH .../:id/status (the one place UNREAD/READ/ARCHIVED transitions
 * happen), DELETE, and the audit trail for both mutations. There is no
 * admin-side create — every fixture here is inserted directly via Prisma,
 * exactly the way a real row only ever arrives (through the public
 * contact form, covered separately in contact.test.ts).
 */

const app = createApp();
const ORIGIN = env.CORS_ORIGIN[0];
if (!ORIGIN) throw new Error('test setup: env.CORS_ORIGIN is empty');

const createdMessageIds: number[] = [];

afterAll(async () => {
  if (createdMessageIds.length > 0) {
    await prisma.contactMessage.deleteMany({ where: { id: { in: createdMessageIds } } });
  }
});

async function createFixtureMessage(overrides: Partial<{ status: string; subject: string }> = {}) {
  const message = await prisma.contactMessage.create({
    data: {
      name: 'Test Sender',
      email: `sender-${randomUUID()}@example.com`,
      subject: overrides.subject ?? `admin-messages-test-${randomUUID()}`,
      message: 'A test message body long enough to pass validation elsewhere.',
      status: overrides.status ?? 'UNREAD',
    },
  });
  createdMessageIds.push(message.id);
  return message;
}

describe('/api/v1/admin/messages', () => {
  it('requires authentication', async () => {
    const res = await request(app).get('/api/v1/admin/messages').set('X-Forwarded-For', '10.9.5.1');
    expect(res.status).toBe(401);
  });

  it('lists messages, filters by status, and searches by subject', async () => {
    const { cookie, ip } = await loginAsAdmin(app, ORIGIN);
    const unread = await createFixtureMessage({ status: 'UNREAD' });
    const archived = await createFixtureMessage({ status: 'ARCHIVED' });

    const listRes = await request(app)
      .get('/api/v1/admin/messages')
      .set('X-Forwarded-For', ip)
      .set('Cookie', cookie);
    expect(listRes.status).toBe(200);
    const ids = (listRes.body as { data: Array<{ id: number }> }).data.map((row) => row.id);
    expect(ids).toContain(unread.id);
    expect(ids).toContain(archived.id);

    const filteredRes = await request(app)
      .get('/api/v1/admin/messages?status=ARCHIVED')
      .set('X-Forwarded-For', ip)
      .set('Cookie', cookie);
    const filteredIds = (filteredRes.body as { data: Array<{ id: number }> }).data.map(
      (row) => row.id,
    );
    expect(filteredIds).toContain(archived.id);
    expect(filteredIds).not.toContain(unread.id);

    const searchRes = await request(app)
      .get(`/api/v1/admin/messages?q=${unread.subject}`)
      .set('X-Forwarded-For', ip)
      .set('Cookie', cookie);
    const searchIds = (searchRes.body as { data: Array<{ id: number }> }).data.map((row) => row.id);
    expect(searchIds).toEqual([unread.id]);
  });

  it('transitions UNREAD -> READ, stamping readAt, then back to UNREAD, clearing it — with an audit entry each time', async () => {
    const { cookie, ip, csrfToken } = await loginAsAdmin(app, ORIGIN);
    const fixture = await createFixtureMessage({ status: 'UNREAD' });

    const readRes = await request(app)
      .patch(`/api/v1/admin/messages/${String(fixture.id)}/status`)
      .set('X-Forwarded-For', ip)
      .set('Origin', ORIGIN)
      .set('Cookie', cookie)
      .set('X-CSRF-Token', csrfToken)
      .send({ status: 'READ' });
    expect(readRes.status).toBe(200);
    const readBody = (readRes.body as { data: { status: string; readAt: string | null } }).data;
    expect(readBody.status).toBe('READ');
    expect(readBody.readAt).not.toBeNull();

    const unreadRes = await request(app)
      .patch(`/api/v1/admin/messages/${String(fixture.id)}/status`)
      .set('X-Forwarded-For', ip)
      .set('Origin', ORIGIN)
      .set('Cookie', cookie)
      .set('X-CSRF-Token', csrfToken)
      .send({ status: 'UNREAD' });
    expect(unreadRes.status).toBe(200);
    const unreadBody = (unreadRes.body as { data: { status: string; readAt: string | null } }).data;
    expect(unreadBody.status).toBe('UNREAD');
    expect(unreadBody.readAt).toBeNull();

    const auditRows = await prisma.auditLog.findMany({
      where: { entityType: 'MESSAGE', entityId: fixture.id },
      orderBy: { id: 'asc' },
    });
    expect(auditRows.map((row) => row.action)).toEqual([
      'MESSAGE_MARK_READ',
      'MESSAGE_MARK_UNREAD',
    ]);
  });

  it('archives a message', async () => {
    const { cookie, ip, csrfToken } = await loginAsAdmin(app, ORIGIN);
    const fixture = await createFixtureMessage({ status: 'UNREAD' });

    const res = await request(app)
      .patch(`/api/v1/admin/messages/${String(fixture.id)}/status`)
      .set('X-Forwarded-For', ip)
      .set('Origin', ORIGIN)
      .set('Cookie', cookie)
      .set('X-CSRF-Token', csrfToken)
      .send({ status: 'ARCHIVED' });
    expect(res.status).toBe(200);
    expect((res.body as { data: { status: string } }).data.status).toBe('ARCHIVED');
  });

  it('rejects a status value outside the enum', async () => {
    const { cookie, ip, csrfToken } = await loginAsAdmin(app, ORIGIN);
    const fixture = await createFixtureMessage();

    const res = await request(app)
      .patch(`/api/v1/admin/messages/${String(fixture.id)}/status`)
      .set('X-Forwarded-For', ip)
      .set('Origin', ORIGIN)
      .set('Cookie', cookie)
      .set('X-CSRF-Token', csrfToken)
      .send({ status: 'DELETED' });
    expect(res.status).toBe(400);
  });

  it('404s for a nonexistent message', async () => {
    const { cookie, ip, csrfToken } = await loginAsAdmin(app, ORIGIN);
    const res = await request(app)
      .patch('/api/v1/admin/messages/999999999/status')
      .set('X-Forwarded-For', ip)
      .set('Origin', ORIGIN)
      .set('Cookie', cookie)
      .set('X-CSRF-Token', csrfToken)
      .send({ status: 'READ' });
    expect(res.status).toBe(404);
  });

  it('deletes a message, with an audit entry', async () => {
    const { cookie, ip, csrfToken } = await loginAsAdmin(app, ORIGIN);
    const fixture = await createFixtureMessage();

    const res = await request(app)
      .delete(`/api/v1/admin/messages/${String(fixture.id)}`)
      .set('X-Forwarded-For', ip)
      .set('Origin', ORIGIN)
      .set('Cookie', cookie)
      .set('X-CSRF-Token', csrfToken);
    expect(res.status).toBe(200);
    createdMessageIds.splice(createdMessageIds.indexOf(fixture.id), 1);

    const stillThere = await prisma.contactMessage.findUnique({ where: { id: fixture.id } });
    expect(stillThere).toBeNull();

    const auditRow = await prisma.auditLog.findFirst({
      where: { entityType: 'MESSAGE', entityId: fixture.id, action: 'MESSAGE_DELETE' },
    });
    expect(auditRow).not.toBeNull();
  });
});
