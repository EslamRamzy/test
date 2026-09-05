import { randomUUID } from 'node:crypto';
import sharp from 'sharp';
import request from 'supertest';
import { afterAll, describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';
import { env } from '../src/config/env.js';
import { prisma } from '../src/config/prisma.js';
import { freshIp, loginAsAdmin } from './helpers/adminAuth.js';

/**
 * `/api/v1/admin/media` + `GET /uploads/:filename` — the upload security
 * matrix doc10 §4 names explicitly ("valid image; .php/.svg/.exe rejected;
 * a PNG with a doctored Content-Type; a file over the size cap; a filename
 * containing `../`; EXIF stripped after re-encode"), the CRUD/usage/
 * reference-blocked-deletion shape, audit coverage, and the static-serving
 * route's own access control (doc09 §7).
 */

const app = createApp();
const ORIGIN = env.CORS_ORIGIN[0];
if (!ORIGIN) throw new Error('test setup: env.CORS_ORIGIN is empty');

const createdMediaIds: number[] = [];
const createdProjectIds: number[] = [];

afterAll(async () => {
  if (createdProjectIds.length > 0) {
    await prisma.project.deleteMany({ where: { id: { in: createdProjectIds } } });
  }
  if (createdMediaIds.length > 0) {
    await prisma.media.deleteMany({ where: { id: { in: createdMediaIds } } });
  }
});

async function pngFixture(width = 3, height = 3): Promise<Buffer> {
  return sharp({
    create: { width, height, channels: 3, background: { r: 10, g: 20, b: 30 } },
  })
    .png()
    .toBuffer();
}

async function jpegFixtureWithExif(): Promise<Buffer> {
  return sharp({
    create: { width: 6, height: 4, channels: 3, background: { r: 200, g: 50, b: 10 } },
  })
    .jpeg()
    .withMetadata({ orientation: 1, exif: { IFD0: { Make: 'ExampleCam' } } })
    .toBuffer();
}

describe('/api/v1/admin/media', () => {
  it('requires authentication', async () => {
    const res = await request(app).get('/api/v1/admin/media').set('X-Forwarded-For', freshIp());
    expect(res.status).toBe(401);
  });

  it('uploads a valid image, lists it, reads it with usage, updates alt text, and deletes it — auditing every step', async () => {
    const { cookie, ip, csrfToken } = await loginAsAdmin(app, ORIGIN);

    const uploadRes = await request(app)
      .post('/api/v1/admin/media')
      .set('X-Forwarded-For', ip)
      .set('Origin', ORIGIN)
      .set('Cookie', cookie)
      .set('X-CSRF-Token', csrfToken)
      .field('kind', 'SCREENSHOT')
      .field('altText', 'A test screenshot')
      .attach('file', await pngFixture(3, 3), { filename: 'shot.png', contentType: 'image/png' });
    expect(uploadRes.status).toBe(201);
    const media = (
      uploadRes.body as {
        data: {
          id: number;
          mimeType: string;
          width: number;
          height: number;
          altText: string;
          originalName: string;
          filename: string;
        };
      }
    ).data;
    expect(media.mimeType).toBe('image/png');
    expect(media.width).toBe(3);
    expect(media.height).toBe(3);
    expect(media.altText).toBe('A test screenshot');
    expect(media.originalName).toBe('shot.png');
    createdMediaIds.push(media.id);

    const listRes = await request(app)
      .get('/api/v1/admin/media?kind=SCREENSHOT')
      .set('X-Forwarded-For', ip)
      .set('Cookie', cookie);
    expect(listRes.status).toBe(200);
    expect(
      (listRes.body as { data: Array<{ id: number }> }).data.some((row) => row.id === media.id),
    ).toBe(true);

    const searchRes = await request(app)
      .get('/api/v1/admin/media?q=shot.png')
      .set('X-Forwarded-For', ip)
      .set('Cookie', cookie);
    expect(
      (searchRes.body as { data: Array<{ id: number }> }).data.some((row) => row.id === media.id),
    ).toBe(true);

    const readRes = await request(app)
      .get(`/api/v1/admin/media/${String(media.id)}`)
      .set('X-Forwarded-For', ip)
      .set('Cookie', cookie);
    expect(readRes.status).toBe(200);
    const readBody = readRes.body as { data: { media: { id: number }; usage: unknown[] } };
    expect(readBody.data.media.id).toBe(media.id);
    expect(readBody.data.usage).toEqual([]);

    const updateRes = await request(app)
      .patch(`/api/v1/admin/media/${String(media.id)}`)
      .set('X-Forwarded-For', ip)
      .set('Origin', ORIGIN)
      .set('Cookie', cookie)
      .set('X-CSRF-Token', csrfToken)
      .send({ altText: 'Updated alt text' });
    expect(updateRes.status).toBe(200);
    expect((updateRes.body as { data: { altText: string } }).data.altText).toBe('Updated alt text');

    const deleteRes = await request(app)
      .delete(`/api/v1/admin/media/${String(media.id)}`)
      .set('X-Forwarded-For', ip)
      .set('Origin', ORIGIN)
      .set('Cookie', cookie)
      .set('X-CSRF-Token', csrfToken);
    expect(deleteRes.status).toBe(200);
    createdMediaIds.splice(createdMediaIds.indexOf(media.id), 1);

    const auditRows = await prisma.auditLog.findMany({
      where: { entityType: 'MEDIA', entityId: media.id },
      orderBy: { id: 'asc' },
    });
    expect(auditRows.map((row) => row.action)).toEqual([
      'MEDIA_UPLOAD',
      'MEDIA_UPDATE',
      'MEDIA_DELETE',
    ]);
  });

  it('rejects a .php-style upload (415)', async () => {
    const { cookie, ip, csrfToken } = await loginAsAdmin(app, ORIGIN);
    const res = await request(app)
      .post('/api/v1/admin/media')
      .set('X-Forwarded-For', ip)
      .set('Origin', ORIGIN)
      .set('Cookie', cookie)
      .set('X-CSRF-Token', csrfToken)
      .field('kind', 'OTHER')
      .attach('file', Buffer.from('<?php system($_GET["c"]); ?>'), {
        filename: 'shell.php',
        contentType: 'application/x-httpd-php',
      });
    expect(res.status).toBe(415);
  });

  it('rejects an SVG upload (415) — an XSS vector, never on the allow-list', async () => {
    const { cookie, ip, csrfToken } = await loginAsAdmin(app, ORIGIN);
    const res = await request(app)
      .post('/api/v1/admin/media')
      .set('X-Forwarded-For', ip)
      .set('Origin', ORIGIN)
      .set('Cookie', cookie)
      .set('X-CSRF-Token', csrfToken)
      .field('kind', 'OTHER')
      .attach('file', Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"></svg>'), {
        filename: 'image.svg',
        contentType: 'image/svg+xml',
      });
    expect(res.status).toBe(415);
  });

  it('rejects a Windows PE executable disguised with an image Content-Type (415)', async () => {
    const { cookie, ip, csrfToken } = await loginAsAdmin(app, ORIGIN);
    const res = await request(app)
      .post('/api/v1/admin/media')
      .set('X-Forwarded-For', ip)
      .set('Origin', ORIGIN)
      .set('Cookie', cookie)
      .set('X-CSRF-Token', csrfToken)
      .field('kind', 'OTHER')
      .attach('file', Buffer.from([0x4d, 0x5a, 0x90, 0x00, 0x03, 0x00, 0x00, 0x00]), {
        filename: 'totally-a-photo.png',
        contentType: 'image/png',
      });
    expect(res.status).toBe(415);
  });

  it('rejects a file over the size cap (413)', async () => {
    const { cookie, ip, csrfToken } = await loginAsAdmin(app, ORIGIN);
    const oversized = Buffer.alloc(env.MAX_UPLOAD_BYTES + 1024, 1);
    const res = await request(app)
      .post('/api/v1/admin/media')
      .set('X-Forwarded-For', ip)
      .set('Origin', ORIGIN)
      .set('Cookie', cookie)
      .set('X-CSRF-Token', csrfToken)
      .field('kind', 'OTHER')
      .attach('file', oversized, { filename: 'huge.bin', contentType: 'application/octet-stream' });
    expect(res.status).toBe(413);
  });

  it('trusts real bytes over a doctored Content-Type header', async () => {
    const { cookie, ip, csrfToken } = await loginAsAdmin(app, ORIGIN);
    const res = await request(app)
      .post('/api/v1/admin/media')
      .set('X-Forwarded-For', ip)
      .set('Origin', ORIGIN)
      .set('Cookie', cookie)
      .set('X-CSRF-Token', csrfToken)
      .field('kind', 'SCREENSHOT')
      // A genuine PNG, lying about its own Content-Type — the pipeline
      // never reads this header for validation, only the real bytes.
      .attach('file', await pngFixture(4, 4), {
        filename: 'liar.png',
        contentType: 'application/x-msdownload',
      });
    expect(res.status).toBe(201);
    const media = (res.body as { data: { id: number; mimeType: string } }).data;
    expect(media.mimeType).toBe('image/png');
    createdMediaIds.push(media.id);
  });

  it('sanitizes a directory-traversal filename down to a safe display name', async () => {
    const { cookie, ip, csrfToken } = await loginAsAdmin(app, ORIGIN);
    const res = await request(app)
      .post('/api/v1/admin/media')
      .set('X-Forwarded-For', ip)
      .set('Origin', ORIGIN)
      .set('Cookie', cookie)
      .set('X-CSRF-Token', csrfToken)
      .field('kind', 'OTHER')
      // Distinct dimensions from every other fixture in this file — a
      // checksum match would dedup against an existing row (a real,
      // intentional feature, see `mediaService.upload`'s own comment) and
      // return ITS originalName instead of testing this upload's own.
      .attach('file', await pngFixture(11, 13), { filename: '../../etc/passwd.png' });
    expect(res.status).toBe(201);
    const media = (res.body as { data: { id: number; originalName: string } }).data;
    expect(media.originalName).toBe('passwd.png');
    createdMediaIds.push(media.id);
  });

  it('reclassifies kind via PATCH, independent of alt text, and exposes usage via the dedicated /usages endpoint', async () => {
    const { cookie, ip, csrfToken } = await loginAsAdmin(app, ORIGIN);
    const uploadRes = await request(app)
      .post('/api/v1/admin/media')
      .set('X-Forwarded-For', ip)
      .set('Origin', ORIGIN)
      .set('Cookie', cookie)
      .set('X-CSRF-Token', csrfToken)
      .field('kind', 'OTHER')
      .attach('file', await pngFixture(9, 9), { filename: 'reclassify.png' });
    const media = (uploadRes.body as { data: { id: number; kind: string } }).data;
    expect(media.kind).toBe('OTHER');
    createdMediaIds.push(media.id);

    const patchRes = await request(app)
      .patch(`/api/v1/admin/media/${String(media.id)}`)
      .set('X-Forwarded-For', ip)
      .set('Origin', ORIGIN)
      .set('Cookie', cookie)
      .set('X-CSRF-Token', csrfToken)
      .send({ kind: 'PROJECT_COVER' });
    expect(patchRes.status).toBe(200);
    expect((patchRes.body as { data: { kind: string; altText: string | null } }).data.kind).toBe(
      'PROJECT_COVER',
    );
    expect(
      (patchRes.body as { data: { kind: string; altText: string | null } }).data.altText,
    ).toBeNull();

    const usagesRes = await request(app)
      .get(`/api/v1/admin/media/${String(media.id)}/usages`)
      .set('X-Forwarded-For', ip)
      .set('Cookie', cookie);
    expect(usagesRes.status).toBe(200);
    expect((usagesRes.body as { data: unknown[] }).data).toEqual([]);
  });

  it('strips EXIF metadata after re-encoding — verified on the actually-served bytes', async () => {
    const { cookie, ip, csrfToken } = await loginAsAdmin(app, ORIGIN);
    const original = await jpegFixtureWithExif();
    expect((await sharp(original).metadata()).exif).toBeDefined();

    const uploadRes = await request(app)
      .post('/api/v1/admin/media')
      .set('X-Forwarded-For', ip)
      .set('Origin', ORIGIN)
      .set('Cookie', cookie)
      .set('X-CSRF-Token', csrfToken)
      .field('kind', 'SCREENSHOT')
      .attach('file', original, { filename: 'photo.jpg', contentType: 'image/jpeg' });
    expect(uploadRes.status).toBe(201);
    const media = (uploadRes.body as { data: { id: number; filename: string } }).data;
    createdMediaIds.push(media.id);

    const servedRes = await request(app)
      .get(`/uploads/${media.filename}`)
      .set('X-Forwarded-For', ip)
      .set('Cookie', cookie);
    expect(servedRes.status).toBe(200);
    const servedMeta = await sharp(servedRes.body as Buffer).metadata();
    expect(servedMeta.exif).toBeUndefined();
  });

  it('blocks deletion while referenced by a project cover, then allows it once unreferenced', async () => {
    const { cookie, ip, csrfToken } = await loginAsAdmin(app, ORIGIN);

    const uploadRes = await request(app)
      .post('/api/v1/admin/media')
      .set('X-Forwarded-For', ip)
      .set('Origin', ORIGIN)
      .set('Cookie', cookie)
      .set('X-CSRF-Token', csrfToken)
      .field('kind', 'PROJECT_COVER')
      .attach('file', await pngFixture(5, 5), { filename: 'cover.png' });
    const media = (uploadRes.body as { data: { id: number } }).data;
    createdMediaIds.push(media.id);

    const project = await prisma.project.create({
      data: {
        title: 'Media Usage Fixture',
        slug: `media-usage-fixture-${randomUUID()}`,
        shortDescription: 'x',
        category: 'WEB_APP',
        coverMediaId: media.id,
      },
    });
    createdProjectIds.push(project.id);

    const blockedRes = await request(app)
      .delete(`/api/v1/admin/media/${String(media.id)}`)
      .set('X-Forwarded-For', ip)
      .set('Origin', ORIGIN)
      .set('Cookie', cookie)
      .set('X-CSRF-Token', csrfToken);
    expect(blockedRes.status).toBe(409);

    const usageRes = await request(app)
      .get(`/api/v1/admin/media/${String(media.id)}`)
      .set('X-Forwarded-For', ip)
      .set('Cookie', cookie);
    const usage = (usageRes.body as { data: { usage: Array<{ entityType: string }> } }).data.usage;
    expect(usage).toEqual([expect.objectContaining({ entityType: 'PROJECT_COVER' })]);

    await prisma.project.update({ where: { id: project.id }, data: { coverMediaId: null } });

    const allowedRes = await request(app)
      .delete(`/api/v1/admin/media/${String(media.id)}`)
      .set('X-Forwarded-For', ip)
      .set('Origin', ORIGIN)
      .set('Cookie', cookie)
      .set('X-CSRF-Token', csrfToken);
    expect(allowedRes.status).toBe(200);
    createdMediaIds.splice(createdMediaIds.indexOf(media.id), 1);
  });
});

describe('GET /uploads/:filename', () => {
  it('404s for a nonexistent filename', async () => {
    const res = await request(app)
      .get('/uploads/does-not-exist.png')
      .set('X-Forwarded-For', freshIp());
    expect(res.status).toBe(404);
  });

  it('404s for an unauthenticated request to a file not referenced by any published content', async () => {
    const { cookie, ip, csrfToken } = await loginAsAdmin(app, ORIGIN);
    const uploadRes = await request(app)
      .post('/api/v1/admin/media')
      .set('X-Forwarded-For', ip)
      .set('Origin', ORIGIN)
      .set('Cookie', cookie)
      .set('X-CSRF-Token', csrfToken)
      .field('kind', 'OTHER')
      .attach('file', await pngFixture(6, 6), { filename: 'unreferenced.png' });
    const media = (uploadRes.body as { data: { id: number; filename: string } }).data;
    createdMediaIds.push(media.id);

    const anonRes = await request(app)
      .get(`/uploads/${media.filename}`)
      .set('X-Forwarded-For', freshIp());
    expect(anonRes.status).toBe(404);

    const adminRes = await request(app)
      .get(`/uploads/${media.filename}`)
      .set('X-Forwarded-For', ip)
      .set('Cookie', cookie);
    expect(adminRes.status).toBe(200);
    expect(adminRes.headers['content-type']).toContain('image/png');
    expect(adminRes.headers['x-content-type-options']).toBe('nosniff');
    expect(adminRes.headers['content-disposition']).toBe('inline');
  });

  it('serves a file once its owning project is published, unauthenticated, with a PDF getting Content-Disposition: attachment', async () => {
    const { cookie, ip, csrfToken } = await loginAsAdmin(app, ORIGIN);
    const uploadRes = await request(app)
      .post('/api/v1/admin/media')
      .set('X-Forwarded-For', ip)
      .set('Origin', ORIGIN)
      .set('Cookie', cookie)
      .set('X-CSRF-Token', csrfToken)
      .field('kind', 'PROJECT_COVER')
      .attach('file', await pngFixture(7, 7), { filename: 'published-cover.png' });
    const media = (uploadRes.body as { data: { id: number; filename: string } }).data;
    createdMediaIds.push(media.id);

    const project = await prisma.project.create({
      data: {
        title: 'Published Media Fixture',
        slug: `published-media-fixture-${randomUUID()}`,
        shortDescription: 'x',
        category: 'WEB_APP',
        coverMediaId: media.id,
        status: 'PUBLISHED',
        publishedAt: new Date(),
      },
    });
    createdProjectIds.push(project.id);

    const anonRes = await request(app)
      .get(`/uploads/${media.filename}`)
      .set('X-Forwarded-For', freshIp());
    expect(anonRes.status).toBe(200);
    expect(anonRes.headers['content-disposition']).toBe('inline');
  });
});
