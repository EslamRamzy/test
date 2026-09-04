import { randomBytes, randomUUID } from 'node:crypto';
import request from 'supertest';
import { afterAll, describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';
import { env } from '../src/config/env.js';
import { prisma } from '../src/config/prisma.js';
import { loginAsAdmin } from './helpers/adminAuth.js';

/**
 * `/api/v1/admin/projects` — the largest admin resource (doc07 §3's tabbed
 * editor). Mirrors `adminArticles.test.ts`'s shape for the shared parts
 * (CRUD, publish workflow, draft isolation) and adds coverage for the
 * project-specific endpoints doc03 §5 lists: technologies, images,
 * sections, featured.
 */

const app = createApp();
const ORIGIN = env.CORS_ORIGIN[0];
if (!ORIGIN) throw new Error('test setup: env.CORS_ORIGIN is empty');

const createdProjectIds: number[] = [];
const createdMediaIds: number[] = [];
const createdTechnologyIds: number[] = [];

afterAll(async () => {
  if (createdProjectIds.length > 0) {
    await prisma.project.deleteMany({ where: { id: { in: createdProjectIds } } });
  }
  if (createdMediaIds.length > 0) {
    await prisma.media.deleteMany({ where: { id: { in: createdMediaIds } } });
  }
  if (createdTechnologyIds.length > 0) {
    await prisma.technology.deleteMany({ where: { id: { in: createdTechnologyIds } } });
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
      kind: 'PROJECT_COVER',
    },
  });
  createdMediaIds.push(media.id);
  return media.id;
}

async function createFixtureTechnology(): Promise<number> {
  const tech = await prisma.technology.create({
    data: { name: `Tech ${randomUUID()}`, slug: `tech-${randomUUID()}` },
  });
  createdTechnologyIds.push(tech.id);
  return tech.id;
}

function searchToken(): string {
  return `zzp${randomBytes(6).toString('hex')}`;
}

describe('/api/v1/admin/projects', () => {
  it('requires authentication', async () => {
    const res = await request(app).get('/api/v1/admin/projects').set('X-Forwarded-For', '10.9.2.1');
    expect(res.status).toBe(401);
  });

  it('creates, lists, reads, updates, and deletes a draft project — with audit entries and a features repeater', async () => {
    const { cookie, ip, csrfToken } = await loginAsAdmin(app, ORIGIN);
    const slug = `test-project-${randomUUID()}`;

    const createRes = await request(app)
      .post('/api/v1/admin/projects')
      .set('X-Forwarded-For', ip)
      .set('Origin', ORIGIN)
      .set('Cookie', cookie)
      .set('X-CSRF-Token', csrfToken)
      .send({
        title: 'Test Project',
        slug,
        shortDescription: 'A short description',
        category: 'WEB_APP',
        features: [{ title: 'Feature one' }],
      });
    expect(createRes.status).toBe(201);
    const created = (
      createRes.body as { data: { id: number; status: string; features: unknown[] } }
    ).data;
    expect(created.status).toBe('DRAFT');
    expect(created.features).toHaveLength(1);
    createdProjectIds.push(created.id);

    const listRes = await request(app)
      .get(`/api/v1/admin/projects?q=${slug}`)
      .set('X-Forwarded-For', ip)
      .set('Cookie', cookie);
    expect(listRes.status).toBe(200);
    expect(
      (listRes.body as { data: Array<{ id: number }> }).data.some((row) => row.id === created.id),
    ).toBe(true);

    const readRes = await request(app)
      .get(`/api/v1/admin/projects/${created.id}`)
      .set('X-Forwarded-For', ip)
      .set('Cookie', cookie);
    expect(readRes.status).toBe(200);

    const updateRes = await request(app)
      .patch(`/api/v1/admin/projects/${created.id}`)
      .set('X-Forwarded-For', ip)
      .set('Origin', ORIGIN)
      .set('Cookie', cookie)
      .set('X-CSRF-Token', csrfToken)
      .send({ shortDescription: 'An updated description' });
    expect(updateRes.status).toBe(200);
    expect((updateRes.body as { data: { shortDescription: string } }).data.shortDescription).toBe(
      'An updated description',
    );

    const rowAuditActions = (
      await prisma.auditLog.findMany({
        where: { entityType: 'PROJECT', entityId: created.id },
        orderBy: { id: 'asc' },
      })
    ).map((entry) => entry.action);
    expect(rowAuditActions).toEqual(['PROJECT_CREATE', 'PROJECT_UPDATE']);

    const deleteRes = await request(app)
      .delete(`/api/v1/admin/projects/${created.id}`)
      .set('X-Forwarded-For', ip)
      .set('Origin', ORIGIN)
      .set('Cookie', cookie)
      .set('X-CSRF-Token', csrfToken);
    expect(deleteRes.status).toBe(200);
    createdProjectIds.pop();
  });

  it('rejects mass assignment of status, id, viewCount, and displayOrder', async () => {
    const { cookie, ip, csrfToken } = await loginAsAdmin(app, ORIGIN);

    const res = await request(app)
      .post('/api/v1/admin/projects')
      .set('X-Forwarded-For', ip)
      .set('Origin', ORIGIN)
      .set('Cookie', cookie)
      .set('X-CSRF-Token', csrfToken)
      .send({
        title: 'Hack',
        slug: `hack-${randomUUID()}`,
        shortDescription: 'x',
        category: 'WEB_APP',
        id: 999999,
        status: 'PUBLISHED',
        viewCount: 999,
        displayOrder: 999,
      });
    expect(res.status).toBe(400);
    expect(res.body).toMatchObject({ error: { code: 'VALIDATION_ERROR' } });
  });

  it('rejects a duplicate slug with 409', async () => {
    const { cookie, ip, csrfToken } = await loginAsAdmin(app, ORIGIN);
    const slug = `dup-project-${randomUUID()}`;

    const first = await request(app)
      .post('/api/v1/admin/projects')
      .set('X-Forwarded-For', ip)
      .set('Origin', ORIGIN)
      .set('Cookie', cookie)
      .set('X-CSRF-Token', csrfToken)
      .send({ title: 'Dup', slug, shortDescription: 'x', category: 'WEB_APP' });
    expect(first.status).toBe(201);
    createdProjectIds.push((first.body as { data: { id: number } }).data.id);

    const second = await request(app)
      .post('/api/v1/admin/projects')
      .set('X-Forwarded-For', ip)
      .set('Origin', ORIGIN)
      .set('Cookie', cookie)
      .set('X-CSRF-Token', csrfToken)
      .send({ title: 'Dup Again', slug, shortDescription: 'x', category: 'WEB_APP' });
    expect(second.status).toBe(409);
  });

  it('reorders projects in bulk', async () => {
    const { cookie, ip, csrfToken } = await loginAsAdmin(app, ORIGIN);

    const createRes = await request(app)
      .post('/api/v1/admin/projects')
      .set('X-Forwarded-For', ip)
      .set('Origin', ORIGIN)
      .set('Cookie', cookie)
      .set('X-CSRF-Token', csrfToken)
      .send({
        title: 'Reorder Me',
        slug: `reorder-${randomUUID()}`,
        shortDescription: 'x',
        category: 'WEB_APP',
      });
    const created = (createRes.body as { data: { id: number } }).data;
    createdProjectIds.push(created.id);

    const reorderRes = await request(app)
      .patch('/api/v1/admin/projects/reorder')
      .set('X-Forwarded-For', ip)
      .set('Origin', ORIGIN)
      .set('Cookie', cookie)
      .set('X-CSRF-Token', csrfToken)
      .send([{ id: created.id, displayOrder: 7 }]);
    expect(reorderRes.status).toBe(200);

    const afterReorder = await prisma.project.findUnique({ where: { id: created.id } });
    expect(afterReorder?.displayOrder).toBe(7);
  });

  it('blocks publish with a readiness-check list, then publishes, unpublishes, archives, restores, and blocks delete while published', async () => {
    const { cookie, ip, csrfToken } = await loginAsAdmin(app, ORIGIN);
    const slug = `readiness-project-${randomUUID()}`;
    const token = searchToken();

    const createRes = await request(app)
      .post('/api/v1/admin/projects')
      .set('X-Forwarded-For', ip)
      .set('Origin', ORIGIN)
      .set('Cookie', cookie)
      .set('X-CSRF-Token', csrfToken)
      .send({
        title: `Readiness ${token}`,
        slug,
        shortDescription: `About ${token}`,
        category: 'WEB_APP',
      });
    expect(createRes.status).toBe(201);
    const created = (createRes.body as { data: { id: number } }).data;
    createdProjectIds.push(created.id);

    // BLOCKED: no cover, no technologies, no case-study content.
    const blockedRes = await request(app)
      .post(`/api/v1/admin/projects/${created.id}/publish`)
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
    expect(blockedFields).toEqual(['coverMediaId', 'fullDescription', 'technologyIds']);

    // Satisfy: cover, at least one technology, and case-study content.
    const coverMediaId = await createFixtureMedia();
    const technologyId = await createFixtureTechnology();

    const techRes = await request(app)
      .put(`/api/v1/admin/projects/${created.id}/technologies`)
      .set('X-Forwarded-For', ip)
      .set('Origin', ORIGIN)
      .set('Cookie', cookie)
      .set('X-CSRF-Token', csrfToken)
      .send({ technologyIds: [technologyId] });
    expect(techRes.status).toBe(200);
    expect(
      (techRes.body as { data: { technologies: Array<{ technologyId: number }> } }).data
        .technologies,
    ).toHaveLength(1);

    const fixRes = await request(app)
      .patch(`/api/v1/admin/projects/${created.id}`)
      .set('X-Forwarded-For', ip)
      .set('Origin', ORIGIN)
      .set('Cookie', cookie)
      .set('X-CSRF-Token', csrfToken)
      .send({ coverMediaId, problem: 'The problem statement.' });
    expect(fixRes.status).toBe(200);

    const publishRes = await request(app)
      .post(`/api/v1/admin/projects/${created.id}/publish`)
      .set('X-Forwarded-For', ip)
      .set('Origin', ORIGIN)
      .set('Cookie', cookie)
      .set('X-CSRF-Token', csrfToken);
    expect(publishRes.status).toBe(200);
    expect((publishRes.body as { data: { status: string } }).data.status).toBe('PUBLISHED');

    // Visible publicly.
    const publicList = await request(app).get('/api/v1/projects');
    expect(
      (publicList.body as { data: Array<{ slug: string }> }).data.some((r) => r.slug === slug),
    ).toBe(true);

    const publicDetail = await request(app).get(`/api/v1/projects/${slug}`);
    expect(publicDetail.status).toBe(200);

    const searchRes = await request(app).get(`/api/v1/search?q=${token}&type=projects`);
    expect(
      (searchRes.body as { data: Array<{ slug: string }> }).data.some((r) => r.slug === slug),
    ).toBe(true);

    const sitemapRes = await request(app).get('/api/v1/sitemap-data');
    expect(
      (sitemapRes.body as { data: Array<{ slug: string }> }).data.some((r) => r.slug === slug),
    ).toBe(true);

    // Delete blocked while published.
    const deleteWhilePublished = await request(app)
      .delete(`/api/v1/admin/projects/${created.id}`)
      .set('X-Forwarded-For', ip)
      .set('Origin', ORIGIN)
      .set('Cookie', cookie)
      .set('X-CSRF-Token', csrfToken);
    expect(deleteWhilePublished.status).toBe(409);

    // UNPUBLISH -> DRAFT, invisible again.
    const unpublishRes = await request(app)
      .post(`/api/v1/admin/projects/${created.id}/unpublish`)
      .set('X-Forwarded-For', ip)
      .set('Origin', ORIGIN)
      .set('Cookie', cookie)
      .set('X-CSRF-Token', csrfToken);
    expect(unpublishRes.status).toBe(200);
    expect((unpublishRes.body as { data: { status: string } }).data.status).toBe('DRAFT');

    const detailAfterUnpublish = await request(app).get(`/api/v1/projects/${slug}`);
    expect(detailAfterUnpublish.status).toBe(404);

    // Archiving a DRAFT is rejected.
    const archiveDraftRes = await request(app)
      .post(`/api/v1/admin/projects/${created.id}/archive`)
      .set('X-Forwarded-For', ip)
      .set('Origin', ORIGIN)
      .set('Cookie', cookie)
      .set('X-CSRF-Token', csrfToken);
    expect(archiveDraftRes.status).toBe(409);

    // Re-publish, then ARCHIVE.
    await request(app)
      .post(`/api/v1/admin/projects/${created.id}/publish`)
      .set('X-Forwarded-For', ip)
      .set('Origin', ORIGIN)
      .set('Cookie', cookie)
      .set('X-CSRF-Token', csrfToken);

    const archiveRes = await request(app)
      .post(`/api/v1/admin/projects/${created.id}/archive`)
      .set('X-Forwarded-For', ip)
      .set('Origin', ORIGIN)
      .set('Cookie', cookie)
      .set('X-CSRF-Token', csrfToken);
    expect(archiveRes.status).toBe(200);
    expect((archiveRes.body as { data: { status: string } }).data.status).toBe('ARCHIVED');

    // ARCHIVED -> DRAFT via "unpublish" ("restore").
    const restoreRes = await request(app)
      .post(`/api/v1/admin/projects/${created.id}/unpublish`)
      .set('X-Forwarded-For', ip)
      .set('Origin', ORIGIN)
      .set('Cookie', cookie)
      .set('X-CSRF-Token', csrfToken);
    expect(restoreRes.status).toBe(200);
    expect((restoreRes.body as { data: { status: string } }).data.status).toBe('DRAFT');

    const finalDelete = await request(app)
      .delete(`/api/v1/admin/projects/${created.id}`)
      .set('X-Forwarded-For', ip)
      .set('Origin', ORIGIN)
      .set('Cookie', cookie)
      .set('X-CSRF-Token', csrfToken);
    expect(finalDelete.status).toBe(200);
    createdProjectIds.pop();
  });

  it('duplicates a project as a new draft with a derived, collision-safe slug', async () => {
    const { cookie, ip, csrfToken } = await loginAsAdmin(app, ORIGIN);
    const slug = `original-project-${randomUUID()}`;

    const createRes = await request(app)
      .post('/api/v1/admin/projects')
      .set('X-Forwarded-For', ip)
      .set('Origin', ORIGIN)
      .set('Cookie', cookie)
      .set('X-CSRF-Token', csrfToken)
      .send({ title: 'Original', slug, shortDescription: 'x', category: 'WEB_APP' });
    const created = (createRes.body as { data: { id: number } }).data;
    createdProjectIds.push(created.id);

    const duplicateRes = await request(app)
      .post(`/api/v1/admin/projects/${created.id}/duplicate`)
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
    createdProjectIds.push(duplicated.id);

    const duplicateAudit = await prisma.auditLog.findFirst({
      where: { entityType: 'PROJECT', entityId: duplicated.id, action: 'PROJECT_DUPLICATE' },
    });
    expect(duplicateAudit).not.toBeNull();
  });

  it('manages images: add, reorder, and remove — with cross-project ownership enforced', async () => {
    const { cookie, ip, csrfToken } = await loginAsAdmin(app, ORIGIN);

    const projectA = (
      await request(app)
        .post('/api/v1/admin/projects')
        .set('X-Forwarded-For', ip)
        .set('Origin', ORIGIN)
        .set('Cookie', cookie)
        .set('X-CSRF-Token', csrfToken)
        .send({
          title: 'Project A',
          slug: `project-a-${randomUUID()}`,
          shortDescription: 'x',
          category: 'WEB_APP',
        })
    ).body as { data: { id: number } };
    createdProjectIds.push(projectA.data.id);

    const projectB = (
      await request(app)
        .post('/api/v1/admin/projects')
        .set('X-Forwarded-For', ip)
        .set('Origin', ORIGIN)
        .set('Cookie', cookie)
        .set('X-CSRF-Token', csrfToken)
        .send({
          title: 'Project B',
          slug: `project-b-${randomUUID()}`,
          shortDescription: 'x',
          category: 'WEB_APP',
        })
    ).body as { data: { id: number } };
    createdProjectIds.push(projectB.data.id);

    const mediaId1 = await createFixtureMedia();
    const mediaId2 = await createFixtureMedia();

    const add1 = await request(app)
      .post(`/api/v1/admin/projects/${projectA.data.id}/images`)
      .set('X-Forwarded-For', ip)
      .set('Origin', ORIGIN)
      .set('Cookie', cookie)
      .set('X-CSRF-Token', csrfToken)
      .send({ mediaId: mediaId1, caption: 'First' });
    expect(add1.status).toBe(201);

    const add2 = await request(app)
      .post(`/api/v1/admin/projects/${projectA.data.id}/images`)
      .set('X-Forwarded-For', ip)
      .set('Origin', ORIGIN)
      .set('Cookie', cookie)
      .set('X-CSRF-Token', csrfToken)
      .send({ mediaId: mediaId2, caption: 'Second' });
    expect(add2.status).toBe(201);
    const images = (add2.body as { data: { images: Array<{ id: number; displayOrder: number }> } })
      .data.images;
    expect(images).toHaveLength(2);
    expect(images[1]?.displayOrder).toBe(1);

    const reorderRes = await request(app)
      .patch(`/api/v1/admin/projects/${projectA.data.id}/images/reorder`)
      .set('X-Forwarded-For', ip)
      .set('Origin', ORIGIN)
      .set('Cookie', cookie)
      .set('X-CSRF-Token', csrfToken)
      .send([
        { id: images[0]!.id, displayOrder: 5 },
        { id: images[1]!.id, displayOrder: 0 },
      ]);
    expect(reorderRes.status).toBe(200);

    // IDOR: an image belonging to Project A cannot be reordered by
    // addressing it through Project B's URL.
    const crossProjectReorder = await request(app)
      .patch(`/api/v1/admin/projects/${projectB.data.id}/images/reorder`)
      .set('X-Forwarded-For', ip)
      .set('Origin', ORIGIN)
      .set('Cookie', cookie)
      .set('X-CSRF-Token', csrfToken)
      .send([{ id: images[0]!.id, displayOrder: 0 }]);
    expect(crossProjectReorder.status).toBe(404);

    // IDOR: same for delete.
    const crossProjectDelete = await request(app)
      .delete(`/api/v1/admin/projects/${projectB.data.id}/images/${images[0]!.id}`)
      .set('X-Forwarded-For', ip)
      .set('Origin', ORIGIN)
      .set('Cookie', cookie)
      .set('X-CSRF-Token', csrfToken);
    expect(crossProjectDelete.status).toBe(404);

    const removeRes = await request(app)
      .delete(`/api/v1/admin/projects/${projectA.data.id}/images/${images[0]!.id}`)
      .set('X-Forwarded-For', ip)
      .set('Origin', ORIGIN)
      .set('Cookie', cookie)
      .set('X-CSRF-Token', csrfToken);
    expect(removeRes.status).toBe(200);

    const afterRemove = await prisma.projectImage.findMany({
      where: { projectId: projectA.data.id },
    });
    expect(afterRemove).toHaveLength(1);
  });

  it('manages sections: built-in visibility/order and a custom section, replacing the whole set on every write', async () => {
    const { cookie, ip, csrfToken } = await loginAsAdmin(app, ORIGIN);

    const createRes = await request(app)
      .post('/api/v1/admin/projects')
      .set('X-Forwarded-For', ip)
      .set('Origin', ORIGIN)
      .set('Cookie', cookie)
      .set('X-CSRF-Token', csrfToken)
      .send({
        title: 'Sections Project',
        slug: `sections-${randomUUID()}`,
        shortDescription: 'x',
        category: 'WEB_APP',
        problem: 'The problem',
        solution: 'The solution',
      });
    const created = (createRes.body as { data: { id: number } }).data;
    createdProjectIds.push(created.id);

    const firstUpdate = await request(app)
      .patch(`/api/v1/admin/projects/${created.id}/sections`)
      .set('X-Forwarded-For', ip)
      .set('Origin', ORIGIN)
      .set('Cookie', cookie)
      .set('X-CSRF-Token', csrfToken)
      .send([
        { sectionKey: 'solution', visible: true, displayOrder: 0 },
        { sectionKey: 'problem', visible: true, displayOrder: 1 },
        {
          sectionKey: 'customSection',
          title: 'A Custom Section',
          body: 'Custom body content',
          visible: true,
          displayOrder: 2,
        },
      ]);
    expect(firstUpdate.status).toBe(200);

    const afterFirst = await prisma.project.findUnique({ where: { id: created.id } });
    expect(JSON.parse(afterFirst!.visibleSectionsJson) as string[]).toEqual([
      'solution',
      'problem',
      'customSection',
    ]);
    const customRows = await prisma.projectSection.findMany({ where: { projectId: created.id } });
    expect(customRows).toHaveLength(1);
    expect(customRows[0]?.sectionKey).toBe('customSection');
    expect(customRows[0]?.body).toBe('Custom body content');

    // Replacing the whole set again, omitting the custom section, deletes
    // its row and drops it from visibleSectionsJson.
    const secondUpdate = await request(app)
      .patch(`/api/v1/admin/projects/${created.id}/sections`)
      .set('X-Forwarded-For', ip)
      .set('Origin', ORIGIN)
      .set('Cookie', cookie)
      .set('X-CSRF-Token', csrfToken)
      .send([
        { sectionKey: 'problem', visible: true, displayOrder: 0 },
        { sectionKey: 'solution', visible: false, displayOrder: 1 },
      ]);
    expect(secondUpdate.status).toBe(200);

    const afterSecond = await prisma.project.findUnique({ where: { id: created.id } });
    expect(JSON.parse(afterSecond!.visibleSectionsJson) as string[]).toEqual(['problem']);
    const customRowsAfter = await prisma.projectSection.findMany({
      where: { projectId: created.id },
    });
    expect(customRowsAfter).toHaveLength(0);
  });

  it('toggles featured', async () => {
    const { cookie, ip, csrfToken } = await loginAsAdmin(app, ORIGIN);

    const createRes = await request(app)
      .post('/api/v1/admin/projects')
      .set('X-Forwarded-For', ip)
      .set('Origin', ORIGIN)
      .set('Cookie', cookie)
      .set('X-CSRF-Token', csrfToken)
      .send({
        title: 'Featured Me',
        slug: `featured-${randomUUID()}`,
        shortDescription: 'x',
        category: 'WEB_APP',
      });
    const created = (createRes.body as { data: { id: number; featured: boolean } }).data;
    expect(created.featured).toBe(false);
    createdProjectIds.push(created.id);

    const featureRes = await request(app)
      .post(`/api/v1/admin/projects/${created.id}/featured`)
      .set('X-Forwarded-For', ip)
      .set('Origin', ORIGIN)
      .set('Cookie', cookie)
      .set('X-CSRF-Token', csrfToken)
      .send({ featured: true });
    expect(featureRes.status).toBe(200);
    expect((featureRes.body as { data: { featured: boolean } }).data.featured).toBe(true);
  });

  it('returns 404 for a nonexistent id, and 400 for a malformed body', async () => {
    const { cookie, ip, csrfToken } = await loginAsAdmin(app, ORIGIN);

    const notFound = await request(app)
      .get('/api/v1/admin/projects/999999999')
      .set('X-Forwarded-For', ip)
      .set('Cookie', cookie);
    expect(notFound.status).toBe(404);

    const badBody = await request(app)
      .post('/api/v1/admin/projects')
      .set('X-Forwarded-For', ip)
      .set('Origin', ORIGIN)
      .set('Cookie', cookie)
      .set('X-CSRF-Token', csrfToken)
      .send({ title: '' }); // missing required slug/shortDescription/category
    expect(badBody.status).toBe(400);
    expect(badBody.body).toMatchObject({ error: { code: 'VALIDATION_ERROR' } });
  });
});
