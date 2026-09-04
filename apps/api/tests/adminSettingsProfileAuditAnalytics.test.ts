import { randomBytes, randomUUID } from 'node:crypto';
import request from 'supertest';
import { afterAll, describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';
import { env } from '../src/config/env.js';
import { prisma } from '../src/config/prisma.js';
import { loginAsAdmin } from './helpers/adminAuth.js';

/**
 * `/api/v1/admin/settings`, `/api/v1/admin/profile`,
 * `/api/v1/admin/audit-logs`, `/api/v1/admin/analytics` — the four
 * remaining Phase 8 modules with no publish workflow and no shared "list
 * of entities" shape, so one combined file rather than four near-empty
 * ones (same reasoning `adminSimpleResources.test.ts` gives for grouping).
 */

const app = createApp();
const ORIGIN = env.CORS_ORIGIN[0];
if (!ORIGIN) throw new Error('test setup: env.CORS_ORIGIN is empty');

const createdSettingKeys: string[] = [];

afterAll(async () => {
  if (createdSettingKeys.length > 0) {
    await prisma.siteSetting.deleteMany({ where: { key: { in: createdSettingKeys } } });
  }
});

describe('/api/v1/admin/settings', () => {
  it('requires authentication', async () => {
    const res = await request(app).get('/api/v1/admin/settings').set('X-Forwarded-For', '10.9.4.1');
    expect(res.status).toBe(401);
  });

  it('upserts a brand-new key (no seed data exists) as STRING/private by default, then updates it', async () => {
    const { cookie, ip, csrfToken } = await loginAsAdmin(app, ORIGIN);
    const key = `test.key.${randomUUID()}`;
    createdSettingKeys.push(key);

    const createRes = await request(app)
      .patch('/api/v1/admin/settings')
      .set('X-Forwarded-For', ip)
      .set('Origin', ORIGIN)
      .set('Cookie', cookie)
      .set('X-CSRF-Token', csrfToken)
      .send([{ key, value: 'hello' }]);
    expect(createRes.status).toBe(200);

    const created = await prisma.siteSetting.findUnique({ where: { key } });
    expect(created).toMatchObject({ value: 'hello', valueType: 'STRING', isPublic: false });

    const updateRes = await request(app)
      .patch('/api/v1/admin/settings')
      .set('X-Forwarded-For', ip)
      .set('Origin', ORIGIN)
      .set('Cookie', cookie)
      .set('X-CSRF-Token', csrfToken)
      .send([{ key, value: 'updated' }]);
    expect(updateRes.status).toBe(200);
    const updated = await prisma.siteSetting.findUnique({ where: { key } });
    expect(updated?.value).toBe('updated');

    const listRes = await request(app)
      .get('/api/v1/admin/settings')
      .set('X-Forwarded-For', ip)
      .set('Cookie', cookie);
    expect(listRes.status).toBe(200);
    const groups = listRes.body as {
      data: Array<{ groupName: string; settings: Array<{ key: string }> }>;
    };
    const allKeys = groups.data.flatMap((g) => g.settings.map((s) => s.key));
    expect(allKeys).toContain(key);

    const auditEntry = await prisma.auditLog.findFirst({
      where: { action: 'SETTINGS_UPDATE' },
      orderBy: { id: 'desc' },
    });
    expect(auditEntry).not.toBeNull();
  });

  it("validates the value against the EXISTING row's valueType, not just any string", async () => {
    const { cookie, ip, csrfToken } = await loginAsAdmin(app, ORIGIN);
    const key = `test.number.${randomUUID()}`;
    createdSettingKeys.push(key);

    // Directly create a NUMBER-typed row (bypassing the "new key defaults
    // to STRING" path) — mimics a pre-seeded numeric setting.
    await prisma.siteSetting.create({ data: { key, value: '42', valueType: 'NUMBER' } });

    const badRes = await request(app)
      .patch('/api/v1/admin/settings')
      .set('X-Forwarded-For', ip)
      .set('Origin', ORIGIN)
      .set('Cookie', cookie)
      .set('X-CSRF-Token', csrfToken)
      .send([{ key, value: 'not-a-number' }]);
    expect(badRes.status).toBe(400);
    expect(badRes.body).toMatchObject({ error: { code: 'VALIDATION_ERROR' } });

    const unchanged = await prisma.siteSetting.findUnique({ where: { key } });
    expect(unchanged?.value).toBe('42'); // rejected write never touched the row

    const goodRes = await request(app)
      .patch('/api/v1/admin/settings')
      .set('X-Forwarded-For', ip)
      .set('Origin', ORIGIN)
      .set('Cookie', cookie)
      .set('X-CSRF-Token', csrfToken)
      .send([{ key, value: '100' }]);
    expect(goodRes.status).toBe(200);

    // null always clears a setting, regardless of valueType.
    const clearRes = await request(app)
      .patch('/api/v1/admin/settings')
      .set('X-Forwarded-For', ip)
      .set('Origin', ORIGIN)
      .set('Cookie', cookie)
      .set('X-CSRF-Token', csrfToken)
      .send([{ key, value: null }]);
    expect(clearRes.status).toBe(200);
    const cleared = await prisma.siteSetting.findUnique({ where: { key } });
    expect(cleared?.value).toBeNull();
  });
});

describe('/api/v1/admin/profile', () => {
  it('requires authentication', async () => {
    const res = await request(app).get('/api/v1/admin/profile').set('X-Forwarded-For', '10.9.4.2');
    expect(res.status).toBe(401);
  });

  it('reads and updates the singleton profile — with an audit entry', async () => {
    // Mirrors what `prisma/bootstrap.ts` does in a real deployment — the
    // test DB has no such row until this fixture creates it.
    await prisma.profile.upsert({
      where: { id: 1 },
      create: { id: 1, fullName: 'Test Admin' },
      update: {},
    });

    const { cookie, ip, csrfToken } = await loginAsAdmin(app, ORIGIN);

    const readRes = await request(app)
      .get('/api/v1/admin/profile')
      .set('X-Forwarded-For', ip)
      .set('Cookie', cookie);
    expect(readRes.status).toBe(200);
    expect((readRes.body as { data: { fullName: string } }).data.fullName).toBe('Test Admin');

    const updateRes = await request(app)
      .patch('/api/v1/admin/profile')
      .set('X-Forwarded-For', ip)
      .set('Origin', ORIGIN)
      .set('Cookie', cookie)
      .set('X-CSRF-Token', csrfToken)
      .send({ headline: 'Security Engineer', availableForWork: true });
    expect(updateRes.status).toBe(200);
    expect(
      (updateRes.body as { data: { headline: string; availableForWork: boolean } }).data,
    ).toMatchObject({ headline: 'Security Engineer', availableForWork: true });

    const auditEntry = await prisma.auditLog.findFirst({
      where: { entityType: 'PROFILE', action: 'PROFILE_UPDATE' },
      orderBy: { id: 'desc' },
    });
    expect(auditEntry).not.toBeNull();
  });

  it('rejects mass assignment of id', async () => {
    const { cookie, ip, csrfToken } = await loginAsAdmin(app, ORIGIN);
    const res = await request(app)
      .patch('/api/v1/admin/profile')
      .set('X-Forwarded-For', ip)
      .set('Origin', ORIGIN)
      .set('Cookie', cookie)
      .set('X-CSRF-Token', csrfToken)
      .send({ id: 2, fullName: 'Hacked' });
    expect(res.status).toBe(400);
  });
});

describe('/api/v1/admin/audit-logs', () => {
  it('requires authentication', async () => {
    const res = await request(app)
      .get('/api/v1/admin/audit-logs')
      .set('X-Forwarded-For', '10.9.4.3');
    expect(res.status).toBe(401);
  });

  it('lists entries and filters by action/entityType', async () => {
    const { cookie, ip, csrfToken } = await loginAsAdmin(app, ORIGIN);
    const marker = randomUUID();

    // Generate one real, distinctive audit entry: create a technology.
    await request(app)
      .post('/api/v1/admin/technologies')
      .set('X-Forwarded-For', ip)
      .set('Origin', ORIGIN)
      .set('Cookie', cookie)
      .set('X-CSRF-Token', csrfToken)
      .send({ name: `AuditMarker ${marker}`, slug: `audit-marker-${marker}` });

    const listRes = await request(app)
      .get('/api/v1/admin/audit-logs?action=TECHNOLOGY_CREATE&entityType=TECHNOLOGY&pageSize=50')
      .set('X-Forwarded-For', ip)
      .set('Cookie', cookie);
    expect(listRes.status).toBe(200);
    const body = listRes.body as {
      data: Array<{ action: string; entityType: string | null }>;
      meta: { total: number };
    };
    expect(body.data.length).toBeGreaterThan(0);
    for (const entry of body.data) {
      expect(entry.action).toBe('TECHNOLOGY_CREATE');
      expect(entry.entityType).toBe('TECHNOLOGY');
    }
  });

  it("clamps an out-of-range page size rather than rejecting it (paginationQuerySchema's own contract)", async () => {
    const { cookie, ip } = await loginAsAdmin(app, ORIGIN);
    const res = await request(app)
      .get('/api/v1/admin/audit-logs?pageSize=99999')
      .set('X-Forwarded-For', ip)
      .set('Cookie', cookie);
    expect(res.status).toBe(200);
    const body = res.body as { meta: { pageSize: number } };
    expect(body.meta.pageSize).toBeLessThan(99999);
  });
});

describe('/api/v1/admin/analytics', () => {
  it('requires authentication', async () => {
    const res = await request(app)
      .get('/api/v1/admin/analytics')
      .set('X-Forwarded-For', '10.9.4.4');
    expect(res.status).toBe(401);
  });

  it('returns totals, a series, and top content for a real page view', async () => {
    const { cookie, ip } = await loginAsAdmin(app, ORIGIN);

    // A real page view via the public beacon, tagged to a fake project id —
    // "top content" resolves nothing for it (no such project), so this
    // mainly exercises the totals/series path with real data.
    await prisma.pageView.create({
      data: {
        path: '/projects/some-project',
        entityType: 'PROJECT',
        entityId: 999999,
        visitorHash: randomBytes(16).toString('hex'),
      },
    });

    const res = await request(app)
      .get('/api/v1/admin/analytics?groupBy=day')
      .set('X-Forwarded-For', ip)
      .set('Cookie', cookie);
    expect(res.status).toBe(200);
    const body = res.body as {
      data: {
        totalViews: number;
        uniqueVisitors: number;
        series: Array<{ bucket: string; views: number }>;
        topProjects: unknown[];
        topArticles: unknown[];
        topReferrerHosts: unknown[];
      };
    };
    expect(body.data.totalViews).toBeGreaterThan(0);
    expect(Array.isArray(body.data.series)).toBe(true);
    expect(Array.isArray(body.data.topProjects)).toBe(true);
  });

  it('rejects an invalid groupBy value', async () => {
    const { cookie, ip } = await loginAsAdmin(app, ORIGIN);
    const res = await request(app)
      .get('/api/v1/admin/analytics?groupBy=century')
      .set('X-Forwarded-For', ip)
      .set('Cookie', cookie);
    expect(res.status).toBe(400);
  });
});
