import { randomBytes, randomUUID } from 'node:crypto';
import request from 'supertest';
import { afterAll, describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';
import { env } from '../src/config/env.js';
import { prisma } from '../src/config/prisma.js';
import { loginAsAdmin } from './helpers/adminAuth.js';

/**
 * `/api/v1/admin/security-research` — mirrors `adminArticles.test.ts`'s own
 * shape (both are content resources with the identical editorial workflow,
 * doc07 §4), adapted for what this entity actually has: no author, a
 * `description` field instead of `excerpt`, `category` required at create
 * (so never part of the readiness check), and a `references` repeater
 * instead of a category FK in the readiness check.
 */

const app = createApp();
const ORIGIN = env.CORS_ORIGIN[0];
if (!ORIGIN) throw new Error('test setup: env.CORS_ORIGIN is empty');

const createdResearchIds: number[] = [];
const createdMediaIds: number[] = [];

afterAll(async () => {
  if (createdResearchIds.length > 0) {
    await prisma.securityResearch.deleteMany({ where: { id: { in: createdResearchIds } } });
  }
  if (createdMediaIds.length > 0) {
    await prisma.media.deleteMany({ where: { id: { in: createdMediaIds } } });
  }
});

async function createFixtureMedia(): Promise<number> {
  const media = await prisma.media.create({
    data: {
      filename: `${randomUUID()}.jpg`,
      originalName: 'cover.jpg',
      mimeType: 'image/jpeg',
      sizeBytes: 1024,
      checksumSha256: randomBytes(32).toString('hex'),
      storagePath: `/uploads/${randomUUID()}.jpg`,
      kind: 'ARTICLE_COVER',
    },
  });
  createdMediaIds.push(media.id);
  return media.id;
}

/** FTS5-MATCH-safe (no hyphens — see adminArticles.test.ts's own comment). */
function searchToken(): string {
  return `zzr${randomBytes(6).toString('hex')}`;
}

describe('/api/v1/admin/security-research', () => {
  it('requires authentication', async () => {
    const res = await request(app)
      .get('/api/v1/admin/security-research')
      .set('X-Forwarded-For', '10.9.1.1');
    expect(res.status).toBe(401);
  });

  it('creates, lists, reads, updates, and deletes a draft entry — with audit entries and a references repeater', async () => {
    const { cookie, ip, csrfToken } = await loginAsAdmin(app, ORIGIN);
    const slug = `test-research-${randomUUID()}`;

    const createRes = await request(app)
      .post('/api/v1/admin/security-research')
      .set('X-Forwarded-For', ip)
      .set('Origin', ORIGIN)
      .set('Cookie', cookie)
      .set('X-CSRF-Token', csrfToken)
      .send({
        title: 'Test Research',
        slug,
        content: 'body',
        category: 'RESEARCH',
        references: [{ label: 'CVE-9999-0001', url: 'https://example.com/cve' }],
      });
    expect(createRes.status).toBe(201);
    const created = (
      createRes.body as { data: { id: number; status: string; references: unknown[] } }
    ).data;
    expect(created.status).toBe('DRAFT');
    expect(created.references).toHaveLength(1);
    createdResearchIds.push(created.id);

    const listRes = await request(app)
      .get(`/api/v1/admin/security-research?q=${slug}`)
      .set('X-Forwarded-For', ip)
      .set('Cookie', cookie);
    expect(listRes.status).toBe(200);
    expect(
      (listRes.body as { data: Array<{ id: number }> }).data.some((row) => row.id === created.id),
    ).toBe(true);

    const readRes = await request(app)
      .get(`/api/v1/admin/security-research/${created.id}`)
      .set('X-Forwarded-For', ip)
      .set('Cookie', cookie);
    expect(readRes.status).toBe(200);

    const updateRes = await request(app)
      .patch(`/api/v1/admin/security-research/${created.id}`)
      .set('X-Forwarded-For', ip)
      .set('Origin', ORIGIN)
      .set('Cookie', cookie)
      .set('X-CSRF-Token', csrfToken)
      .send({ category: 'WRITEUP' });
    expect(updateRes.status).toBe(200);
    expect((updateRes.body as { data: { category: string } }).data.category).toBe('WRITEUP');

    const rowAuditActions = (
      await prisma.auditLog.findMany({
        where: { entityType: 'RESEARCH', entityId: created.id },
        orderBy: { id: 'asc' },
      })
    ).map((entry) => entry.action);
    expect(rowAuditActions).toEqual(['RESEARCH_CREATE', 'RESEARCH_UPDATE']);

    const deleteRes = await request(app)
      .delete(`/api/v1/admin/security-research/${created.id}`)
      .set('X-Forwarded-For', ip)
      .set('Origin', ORIGIN)
      .set('Cookie', cookie)
      .set('X-CSRF-Token', csrfToken);
    expect(deleteRes.status).toBe(200);
    createdResearchIds.pop();
  });

  it('rejects an invalid category, and mass assignment of status/id/viewCount', async () => {
    const { cookie, ip, csrfToken } = await loginAsAdmin(app, ORIGIN);

    const badCategory = await request(app)
      .post('/api/v1/admin/security-research')
      .set('X-Forwarded-For', ip)
      .set('Origin', ORIGIN)
      .set('Cookie', cookie)
      .set('X-CSRF-Token', csrfToken)
      .send({ title: 'Bad', slug: `bad-${randomUUID()}`, content: 'body', category: 'BOGUS' });
    expect(badCategory.status).toBe(400);

    const massAssignment = await request(app)
      .post('/api/v1/admin/security-research')
      .set('X-Forwarded-For', ip)
      .set('Origin', ORIGIN)
      .set('Cookie', cookie)
      .set('X-CSRF-Token', csrfToken)
      .send({
        title: 'Hack',
        slug: `hack-${randomUUID()}`,
        content: 'body',
        category: 'RESEARCH',
        id: 999999,
        status: 'PUBLISHED',
        viewCount: 999,
      });
    expect(massAssignment.status).toBe(400);
    expect(massAssignment.body).toMatchObject({ error: { code: 'VALIDATION_ERROR' } });
  });

  it('rejects a duplicate slug with 409', async () => {
    const { cookie, ip, csrfToken } = await loginAsAdmin(app, ORIGIN);
    const slug = `dup-research-${randomUUID()}`;

    const first = await request(app)
      .post('/api/v1/admin/security-research')
      .set('X-Forwarded-For', ip)
      .set('Origin', ORIGIN)
      .set('Cookie', cookie)
      .set('X-CSRF-Token', csrfToken)
      .send({ title: 'Dup', slug, content: 'body', category: 'RESEARCH' });
    expect(first.status).toBe(201);
    createdResearchIds.push((first.body as { data: { id: number } }).data.id);

    const second = await request(app)
      .post('/api/v1/admin/security-research')
      .set('X-Forwarded-For', ip)
      .set('Origin', ORIGIN)
      .set('Cookie', cookie)
      .set('X-CSRF-Token', csrfToken)
      .send({ title: 'Dup Again', slug, content: 'body', category: 'RESEARCH' });
    expect(second.status).toBe(409);
  });

  it('blocks publish with a readiness-check list, then publishes, unpublishes, archives, restores, and blocks delete while published', async () => {
    const { cookie, ip, csrfToken } = await loginAsAdmin(app, ORIGIN);
    const slug = `readiness-research-${randomUUID()}`;
    const token = searchToken();

    const createRes = await request(app)
      .post('/api/v1/admin/security-research')
      .set('X-Forwarded-For', ip)
      .set('Origin', ORIGIN)
      .set('Cookie', cookie)
      .set('X-CSRF-Token', csrfToken)
      .send({
        title: `Readiness ${token}`,
        slug,
        content: `Body about ${token}.`,
        category: 'RESEARCH',
      });
    expect(createRes.status).toBe(201);
    const created = (createRes.body as { data: { id: number } }).data;
    createdResearchIds.push(created.id);

    // BLOCKED: no cover, no description. `category` is already required at
    // create, so it never appears in this list.
    const blockedRes = await request(app)
      .post(`/api/v1/admin/security-research/${created.id}/publish`)
      .set('X-Forwarded-For', ip)
      .set('Origin', ORIGIN)
      .set('Cookie', cookie)
      .set('X-CSRF-Token', csrfToken);
    expect(blockedRes.status).toBe(400);
    const blockedFields = (
      blockedRes.body as { error: { details: Array<{ field: string }> } }
    ).error.details
      .map((d) => d.field)
      .sort();
    expect(blockedFields).toEqual(['coverMediaId', 'description']);

    const coverMediaId = await createFixtureMedia();
    const fixRes = await request(app)
      .patch(`/api/v1/admin/security-research/${created.id}`)
      .set('X-Forwarded-For', ip)
      .set('Origin', ORIGIN)
      .set('Cookie', cookie)
      .set('X-CSRF-Token', csrfToken)
      .send({ description: 'A short description', coverMediaId });
    expect(fixRes.status).toBe(200);

    const publishRes = await request(app)
      .post(`/api/v1/admin/security-research/${created.id}/publish`)
      .set('X-Forwarded-For', ip)
      .set('Origin', ORIGIN)
      .set('Cookie', cookie)
      .set('X-CSRF-Token', csrfToken);
    expect(publishRes.status).toBe(200);
    expect((publishRes.body as { data: { status: string } }).data.status).toBe('PUBLISHED');

    // Visible publicly.
    const publicList = await request(app).get('/api/v1/security');
    expect(
      (publicList.body as { data: Array<{ slug: string }> }).data.some((r) => r.slug === slug),
    ).toBe(true);

    const publicDetail = await request(app).get(`/api/v1/security/${slug}`);
    expect(publicDetail.status).toBe(200);

    const searchRes = await request(app).get(`/api/v1/search?q=${token}&type=research`);
    expect(
      (searchRes.body as { data: Array<{ slug: string }> }).data.some((r) => r.slug === slug),
    ).toBe(true);

    const sitemapRes = await request(app).get('/api/v1/sitemap-data');
    expect(
      (sitemapRes.body as { data: Array<{ slug: string }> }).data.some((r) => r.slug === slug),
    ).toBe(true);

    // Delete blocked while published.
    const deleteWhilePublished = await request(app)
      .delete(`/api/v1/admin/security-research/${created.id}`)
      .set('X-Forwarded-For', ip)
      .set('Origin', ORIGIN)
      .set('Cookie', cookie)
      .set('X-CSRF-Token', csrfToken);
    expect(deleteWhilePublished.status).toBe(409);

    // UNPUBLISH -> DRAFT, invisible again.
    const unpublishRes = await request(app)
      .post(`/api/v1/admin/security-research/${created.id}/unpublish`)
      .set('X-Forwarded-For', ip)
      .set('Origin', ORIGIN)
      .set('Cookie', cookie)
      .set('X-CSRF-Token', csrfToken);
    expect(unpublishRes.status).toBe(200);
    expect((unpublishRes.body as { data: { status: string } }).data.status).toBe('DRAFT');

    const detailAfterUnpublish = await request(app).get(`/api/v1/security/${slug}`);
    expect(detailAfterUnpublish.status).toBe(404);

    // Archiving a DRAFT is rejected.
    const archiveDraftRes = await request(app)
      .post(`/api/v1/admin/security-research/${created.id}/archive`)
      .set('X-Forwarded-For', ip)
      .set('Origin', ORIGIN)
      .set('Cookie', cookie)
      .set('X-CSRF-Token', csrfToken);
    expect(archiveDraftRes.status).toBe(409);

    // Re-publish, then ARCHIVE.
    await request(app)
      .post(`/api/v1/admin/security-research/${created.id}/publish`)
      .set('X-Forwarded-For', ip)
      .set('Origin', ORIGIN)
      .set('Cookie', cookie)
      .set('X-CSRF-Token', csrfToken);

    const archiveRes = await request(app)
      .post(`/api/v1/admin/security-research/${created.id}/archive`)
      .set('X-Forwarded-For', ip)
      .set('Origin', ORIGIN)
      .set('Cookie', cookie)
      .set('X-CSRF-Token', csrfToken);
    expect(archiveRes.status).toBe(200);
    expect((archiveRes.body as { data: { status: string } }).data.status).toBe('ARCHIVED');

    // ARCHIVED -> DRAFT via "unpublish" ("restore").
    const restoreRes = await request(app)
      .post(`/api/v1/admin/security-research/${created.id}/unpublish`)
      .set('X-Forwarded-For', ip)
      .set('Origin', ORIGIN)
      .set('Cookie', cookie)
      .set('X-CSRF-Token', csrfToken);
    expect(restoreRes.status).toBe(200);
    expect((restoreRes.body as { data: { status: string } }).data.status).toBe('DRAFT');

    const finalDelete = await request(app)
      .delete(`/api/v1/admin/security-research/${created.id}`)
      .set('X-Forwarded-For', ip)
      .set('Origin', ORIGIN)
      .set('Cookie', cookie)
      .set('X-CSRF-Token', csrfToken);
    expect(finalDelete.status).toBe(200);
    createdResearchIds.pop();
  });

  it('duplicates an entry as a new draft with a derived, collision-safe slug', async () => {
    const { cookie, ip, csrfToken } = await loginAsAdmin(app, ORIGIN);
    const slug = `original-research-${randomUUID()}`;

    const createRes = await request(app)
      .post('/api/v1/admin/security-research')
      .set('X-Forwarded-For', ip)
      .set('Origin', ORIGIN)
      .set('Cookie', cookie)
      .set('X-CSRF-Token', csrfToken)
      .send({ title: 'Original', slug, content: 'body', category: 'RESEARCH' });
    const created = (createRes.body as { data: { id: number } }).data;
    createdResearchIds.push(created.id);

    const duplicateRes = await request(app)
      .post(`/api/v1/admin/security-research/${created.id}/duplicate`)
      .set('X-Forwarded-For', ip)
      .set('Origin', ORIGIN)
      .set('Cookie', cookie)
      .set('X-CSRF-Token', csrfToken);
    expect(duplicateRes.status).toBe(200);
    const duplicated = (
      duplicateRes.body as { data: { id: number; slug: string; status: string; title: string } }
    ).data;
    expect(duplicated.slug).toBe(`${slug}-copy`);
    expect(duplicated.status).toBe('DRAFT');
    expect(duplicated.title).toBe('Original (Copy)');
    createdResearchIds.push(duplicated.id);

    const duplicateAudit = await prisma.auditLog.findFirst({
      where: { entityType: 'RESEARCH', entityId: duplicated.id, action: 'RESEARCH_DUPLICATE' },
    });
    expect(duplicateAudit).not.toBeNull();
  });

  it('returns 404 for a nonexistent id, and 400 for a malformed body', async () => {
    const { cookie, ip, csrfToken } = await loginAsAdmin(app, ORIGIN);

    const notFound = await request(app)
      .get('/api/v1/admin/security-research/999999999')
      .set('X-Forwarded-For', ip)
      .set('Cookie', cookie);
    expect(notFound.status).toBe(404);

    const badBody = await request(app)
      .post('/api/v1/admin/security-research')
      .set('X-Forwarded-For', ip)
      .set('Origin', ORIGIN)
      .set('Cookie', cookie)
      .set('X-CSRF-Token', csrfToken)
      .send({ title: '' }); // missing required slug/content/category, empty title
    expect(badBody.status).toBe(400);
    expect(badBody.body).toMatchObject({ error: { code: 'VALIDATION_ERROR' } });
  });
});
