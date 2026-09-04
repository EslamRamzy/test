import { randomBytes, randomUUID } from 'node:crypto';
import request from 'supertest';
import { afterAll, describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';
import { env } from '../src/config/env.js';
import { prisma } from '../src/config/prisma.js';
import { loginAsAdmin } from './helpers/adminAuth.js';

/**
 * `/api/v1/admin/articles` — real HTTP integration test, covering both the
 * plain CRUD shape and the publish/unpublish/archive/duplicate workflow
 * (doc07 §4). Draft isolation and the publish/unpublish/archive transitions
 * are doc10 §3's own named "explicit high-value cases" for this resource.
 */

const app = createApp();
const ORIGIN = env.CORS_ORIGIN[0];
if (!ORIGIN) throw new Error('test setup: env.CORS_ORIGIN is empty');

const createdArticleIds: number[] = [];
const createdCategoryIds: number[] = [];
const createdMediaIds: number[] = [];

afterAll(async () => {
  if (createdArticleIds.length > 0) {
    await prisma.article.deleteMany({ where: { id: { in: createdArticleIds } } });
  }
  if (createdCategoryIds.length > 0) {
    await prisma.articleCategory.deleteMany({ where: { id: { in: createdCategoryIds } } });
  }
  if (createdMediaIds.length > 0) {
    await prisma.media.deleteMany({ where: { id: { in: createdMediaIds } } });
  }
});

async function createFixtureCategory(): Promise<number> {
  const category = await prisma.articleCategory.create({
    data: { name: `Cat ${randomUUID()}`, slug: `cat-${randomUUID()}` },
  });
  createdCategoryIds.push(category.id);
  return category.id;
}

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

/** A distinctive, FTS5-MATCH-safe search token — alphanumeric only, no hyphens (FTS5's default query syntax treats `-` as a NOT operator). */
function searchToken(): string {
  return `zzq${randomBytes(6).toString('hex')}`;
}

describe('/api/v1/admin/articles', () => {
  it('requires authentication', async () => {
    const res = await request(app).get('/api/v1/admin/articles').set('X-Forwarded-For', '10.9.0.1');
    expect(res.status).toBe(401);
  });

  it('creates, lists, reads, updates, and deletes a draft article — with audit entries for each', async () => {
    const { cookie, ip, csrfToken } = await loginAsAdmin(app, ORIGIN);
    const slug = `test-article-${randomUUID()}`;

    const createRes = await request(app)
      .post('/api/v1/admin/articles')
      .set('X-Forwarded-For', ip)
      .set('Origin', ORIGIN)
      .set('Cookie', cookie)
      .set('X-CSRF-Token', csrfToken)
      .send({ title: 'Test Article', slug, content: 'word '.repeat(50).trim() });
    expect(createRes.status).toBe(201);
    const created = (
      createRes.body as {
        data: { id: number; status: string; readingTimeMinutes: number; author: { id: number } };
      }
    ).data;
    expect(created.status).toBe('DRAFT');
    expect(created.readingTimeMinutes).toBe(1);
    createdArticleIds.push(created.id);

    const listRes = await request(app)
      .get(`/api/v1/admin/articles?q=${slug}`)
      .set('X-Forwarded-For', ip)
      .set('Cookie', cookie);
    expect(listRes.status).toBe(200);
    const listBody = listRes.body as { data: Array<{ id: number }> };
    expect(listBody.data.some((row) => row.id === created.id)).toBe(true);

    const readRes = await request(app)
      .get(`/api/v1/admin/articles/${created.id}`)
      .set('X-Forwarded-For', ip)
      .set('Cookie', cookie);
    expect(readRes.status).toBe(200);

    const updateRes = await request(app)
      .patch(`/api/v1/admin/articles/${created.id}`)
      .set('X-Forwarded-For', ip)
      .set('Origin', ORIGIN)
      .set('Cookie', cookie)
      .set('X-CSRF-Token', csrfToken)
      .send({ content: 'word '.repeat(250).trim() });
    expect(updateRes.status).toBe(200);
    expect(
      (updateRes.body as { data: { readingTimeMinutes: number } }).data.readingTimeMinutes,
    ).toBe(2);

    const rowAuditActions = (
      await prisma.auditLog.findMany({
        where: { entityType: 'ARTICLE', entityId: created.id },
        orderBy: { id: 'asc' },
      })
    ).map((entry) => entry.action);
    expect(rowAuditActions).toEqual(['ARTICLE_CREATE', 'ARTICLE_UPDATE']);

    const deleteRes = await request(app)
      .delete(`/api/v1/admin/articles/${created.id}`)
      .set('X-Forwarded-For', ip)
      .set('Origin', ORIGIN)
      .set('Cookie', cookie)
      .set('X-CSRF-Token', csrfToken);
    expect(deleteRes.status).toBe(200);
    createdArticleIds.pop();
  });

  it('rejects mass assignment of status, id, authorId, readingTimeMinutes, and viewCount', async () => {
    const { cookie, ip, csrfToken } = await loginAsAdmin(app, ORIGIN);

    const res = await request(app)
      .post('/api/v1/admin/articles')
      .set('X-Forwarded-For', ip)
      .set('Origin', ORIGIN)
      .set('Cookie', cookie)
      .set('X-CSRF-Token', csrfToken)
      .send({
        title: 'Hack',
        slug: `hack-${randomUUID()}`,
        content: 'body',
        id: 999999,
        status: 'PUBLISHED',
        authorId: 999999,
        readingTimeMinutes: 999,
        viewCount: 999,
      });
    expect(res.status).toBe(400);
    expect(res.body).toMatchObject({ error: { code: 'VALIDATION_ERROR' } });

    const stillAbsent = await prisma.article.findFirst({ where: { title: 'Hack' } });
    expect(stillAbsent).toBeNull();
  });

  it('rejects a duplicate slug with 409, not a raw 500', async () => {
    const { cookie, ip, csrfToken } = await loginAsAdmin(app, ORIGIN);
    const slug = `dup-article-${randomUUID()}`;

    const first = await request(app)
      .post('/api/v1/admin/articles')
      .set('X-Forwarded-For', ip)
      .set('Origin', ORIGIN)
      .set('Cookie', cookie)
      .set('X-CSRF-Token', csrfToken)
      .send({ title: 'Dup', slug, content: 'body' });
    expect(first.status).toBe(201);
    createdArticleIds.push((first.body as { data: { id: number } }).data.id);

    const second = await request(app)
      .post('/api/v1/admin/articles')
      .set('X-Forwarded-For', ip)
      .set('Origin', ORIGIN)
      .set('Cookie', cookie)
      .set('X-CSRF-Token', csrfToken)
      .send({ title: 'Dup Again', slug, content: 'body' });
    expect(second.status).toBe(409);
  });

  it('blocks publish with a readiness-check list, then publishes once satisfied, then unpublishes, archives, and blocks delete while published', async () => {
    const { cookie, ip, csrfToken } = await loginAsAdmin(app, ORIGIN);
    const slug = `readiness-${randomUUID()}`;
    const token = searchToken();

    const createRes = await request(app)
      .post('/api/v1/admin/articles')
      .set('X-Forwarded-For', ip)
      .set('Origin', ORIGIN)
      .set('Cookie', cookie)
      .set('X-CSRF-Token', csrfToken)
      .send({ title: `Readiness ${token}`, slug, content: `Body about ${token}.` });
    expect(createRes.status).toBe(201);
    const created = (createRes.body as { data: { id: number } }).data;
    createdArticleIds.push(created.id);

    // BLOCKED: no cover, no excerpt, no category.
    const blockedRes = await request(app)
      .post(`/api/v1/admin/articles/${created.id}/publish`)
      .set('X-Forwarded-For', ip)
      .set('Origin', ORIGIN)
      .set('Cookie', cookie)
      .set('X-CSRF-Token', csrfToken);
    expect(blockedRes.status).toBe(400);
    const blockedBody = blockedRes.body as { error: { details: Array<{ field: string }> } };
    const blockedFields = blockedBody.error.details.map((d) => d.field).sort();
    expect(blockedFields).toEqual(['categoryId', 'coverMediaId', 'excerpt']);

    // Satisfy the readiness check.
    const categoryId = await createFixtureCategory();
    const coverMediaId = await createFixtureMedia();
    const fixRes = await request(app)
      .patch(`/api/v1/admin/articles/${created.id}`)
      .set('X-Forwarded-For', ip)
      .set('Origin', ORIGIN)
      .set('Cookie', cookie)
      .set('X-CSRF-Token', csrfToken)
      .send({ excerpt: 'A short excerpt', categoryId, coverMediaId });
    expect(fixRes.status).toBe(200);

    // PUBLISH.
    const publishRes = await request(app)
      .post(`/api/v1/admin/articles/${created.id}/publish`)
      .set('X-Forwarded-For', ip)
      .set('Origin', ORIGIN)
      .set('Cookie', cookie)
      .set('X-CSRF-Token', csrfToken);
    expect(publishRes.status).toBe(200);
    expect((publishRes.body as { data: { status: string } }).data.status).toBe('PUBLISHED');

    // Now visible publicly: list, detail, search, sitemap.
    const publicList = await request(app).get('/api/v1/articles');
    expect(
      (publicList.body as { data: Array<{ slug: string }> }).data.some((a) => a.slug === slug),
    ).toBe(true);

    const publicDetail = await request(app).get(`/api/v1/articles/${slug}`);
    expect(publicDetail.status).toBe(200);

    const searchRes = await request(app).get(`/api/v1/search?q=${token}&type=articles`);
    expect(searchRes.status).toBe(200);
    expect(
      (searchRes.body as { data: Array<{ slug: string }> }).data.some((r) => r.slug === slug),
    ).toBe(true);

    const sitemapRes = await request(app).get('/api/v1/sitemap-data');
    expect(
      (sitemapRes.body as { data: Array<{ slug: string }> }).data.some((r) => r.slug === slug),
    ).toBe(true);

    // Publishing again is rejected — no longer a draft.
    const rePublishRes = await request(app)
      .post(`/api/v1/admin/articles/${created.id}/publish`)
      .set('X-Forwarded-For', ip)
      .set('Origin', ORIGIN)
      .set('Cookie', cookie)
      .set('X-CSRF-Token', csrfToken);
    expect(rePublishRes.status).toBe(409);

    // Archiving directly is fine from PUBLISHED, but delete is blocked first.
    const deleteWhilePublished = await request(app)
      .delete(`/api/v1/admin/articles/${created.id}`)
      .set('X-Forwarded-For', ip)
      .set('Origin', ORIGIN)
      .set('Cookie', cookie)
      .set('X-CSRF-Token', csrfToken);
    expect(deleteWhilePublished.status).toBe(409);

    // UNPUBLISH -> back to DRAFT, invisible again.
    const unpublishRes = await request(app)
      .post(`/api/v1/admin/articles/${created.id}/unpublish`)
      .set('X-Forwarded-For', ip)
      .set('Origin', ORIGIN)
      .set('Cookie', cookie)
      .set('X-CSRF-Token', csrfToken);
    expect(unpublishRes.status).toBe(200);
    expect((unpublishRes.body as { data: { status: string } }).data.status).toBe('DRAFT');

    const detailAfterUnpublish = await request(app).get(`/api/v1/articles/${slug}`);
    expect(detailAfterUnpublish.status).toBe(404);

    const searchAfterUnpublish = await request(app).get(`/api/v1/search?q=${token}&type=articles`);
    expect(
      (searchAfterUnpublish.body as { data: Array<{ slug: string }> }).data.some(
        (r) => r.slug === slug,
      ),
    ).toBe(false);

    // Archiving a DRAFT is rejected — only PUBLISHED can be archived.
    const archiveDraftRes = await request(app)
      .post(`/api/v1/admin/articles/${created.id}/archive`)
      .set('X-Forwarded-For', ip)
      .set('Origin', ORIGIN)
      .set('Cookie', cookie)
      .set('X-CSRF-Token', csrfToken);
    expect(archiveDraftRes.status).toBe(409);

    // Re-publish (readiness check already satisfied), then ARCHIVE.
    await request(app)
      .post(`/api/v1/admin/articles/${created.id}/publish`)
      .set('X-Forwarded-For', ip)
      .set('Origin', ORIGIN)
      .set('Cookie', cookie)
      .set('X-CSRF-Token', csrfToken);

    const archiveRes = await request(app)
      .post(`/api/v1/admin/articles/${created.id}/archive`)
      .set('X-Forwarded-For', ip)
      .set('Origin', ORIGIN)
      .set('Cookie', cookie)
      .set('X-CSRF-Token', csrfToken);
    expect(archiveRes.status).toBe(200);
    expect((archiveRes.body as { data: { status: string } }).data.status).toBe('ARCHIVED');

    const detailAfterArchive = await request(app).get(`/api/v1/articles/${slug}`);
    expect(detailAfterArchive.status).toBe(404);

    // ARCHIVED -> DRAFT via the same "unpublish" endpoint (doc07 §4's "restore").
    const restoreRes = await request(app)
      .post(`/api/v1/admin/articles/${created.id}/unpublish`)
      .set('X-Forwarded-For', ip)
      .set('Origin', ORIGIN)
      .set('Cookie', cookie)
      .set('X-CSRF-Token', csrfToken);
    expect(restoreRes.status).toBe(200);
    expect((restoreRes.body as { data: { status: string } }).data.status).toBe('DRAFT');

    // Now DRAFT — delete is allowed.
    const finalDelete = await request(app)
      .delete(`/api/v1/admin/articles/${created.id}`)
      .set('X-Forwarded-For', ip)
      .set('Origin', ORIGIN)
      .set('Cookie', cookie)
      .set('X-CSRF-Token', csrfToken);
    expect(finalDelete.status).toBe(200);
    createdArticleIds.pop();

    const publishAudit = await prisma.auditLog.findMany({
      where: { entityType: 'ARTICLE', entityId: created.id },
      orderBy: { id: 'asc' },
    });
    expect(publishAudit.map((entry) => entry.action)).toEqual([
      'ARTICLE_CREATE',
      'ARTICLE_UPDATE',
      'ARTICLE_PUBLISH',
      'ARTICLE_UNPUBLISH',
      'ARTICLE_PUBLISH',
      'ARTICLE_ARCHIVE',
      'ARTICLE_UNPUBLISH',
      'ARTICLE_DELETE',
    ]);
  });

  it('duplicates an article as a new draft with a derived, collision-safe slug', async () => {
    const { cookie, ip, csrfToken } = await loginAsAdmin(app, ORIGIN);
    const slug = `original-${randomUUID()}`;

    const createRes = await request(app)
      .post('/api/v1/admin/articles')
      .set('X-Forwarded-For', ip)
      .set('Origin', ORIGIN)
      .set('Cookie', cookie)
      .set('X-CSRF-Token', csrfToken)
      .send({ title: 'Original', slug, content: 'body' });
    const created = (createRes.body as { data: { id: number } }).data;
    createdArticleIds.push(created.id);

    const duplicateRes = await request(app)
      .post(`/api/v1/admin/articles/${created.id}/duplicate`)
      .set('X-Forwarded-For', ip)
      .set('Origin', ORIGIN)
      .set('Cookie', cookie)
      .set('X-CSRF-Token', csrfToken);
    expect(duplicateRes.status).toBe(200);
    const duplicated = (
      duplicateRes.body as { data: { id: number; slug: string; status: string; title: string } }
    ).data;
    expect(duplicated.id).not.toBe(created.id);
    expect(duplicated.slug).toBe(`${slug}-copy`);
    expect(duplicated.status).toBe('DRAFT');
    expect(duplicated.title).toBe('Original (Copy)');
    createdArticleIds.push(duplicated.id);

    // Duplicating again derives "-copy-2" — "-copy" is now taken.
    const secondDuplicateRes = await request(app)
      .post(`/api/v1/admin/articles/${created.id}/duplicate`)
      .set('X-Forwarded-For', ip)
      .set('Origin', ORIGIN)
      .set('Cookie', cookie)
      .set('X-CSRF-Token', csrfToken);
    expect(secondDuplicateRes.status).toBe(200);
    const secondDuplicated = (secondDuplicateRes.body as { data: { id: number; slug: string } })
      .data;
    expect(secondDuplicated.slug).toBe(`${slug}-copy-2`);
    createdArticleIds.push(secondDuplicated.id);

    const duplicateAudit = await prisma.auditLog.findFirst({
      where: { entityType: 'ARTICLE', entityId: duplicated.id, action: 'ARTICLE_DUPLICATE' },
    });
    expect(duplicateAudit).not.toBeNull();
  });

  it('returns 404 for a nonexistent id, and 400 for a malformed body', async () => {
    const { cookie, ip, csrfToken } = await loginAsAdmin(app, ORIGIN);

    const notFound = await request(app)
      .get('/api/v1/admin/articles/999999999')
      .set('X-Forwarded-For', ip)
      .set('Cookie', cookie);
    expect(notFound.status).toBe(404);

    const publishNotFound = await request(app)
      .post('/api/v1/admin/articles/999999999/publish')
      .set('X-Forwarded-For', ip)
      .set('Origin', ORIGIN)
      .set('Cookie', cookie)
      .set('X-CSRF-Token', csrfToken);
    expect(publishNotFound.status).toBe(404);

    const badBody = await request(app)
      .post('/api/v1/admin/articles')
      .set('X-Forwarded-For', ip)
      .set('Origin', ORIGIN)
      .set('Cookie', cookie)
      .set('X-CSRF-Token', csrfToken)
      .send({ title: '' }); // missing required slug/content, empty title
    expect(badBody.status).toBe(400);
    expect(badBody.body).toMatchObject({ error: { code: 'VALIDATION_ERROR' } });
  });
});
