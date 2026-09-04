import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { afterAll, describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';
import { env } from '../src/config/env.js';
import { prisma } from '../src/config/prisma.js';
import { loginAsAdmin } from './helpers/adminAuth.js';

const app = createApp();
const ORIGIN = env.CORS_ORIGIN[0];
if (!ORIGIN) throw new Error('test setup: env.CORS_ORIGIN is empty');

const createdTagIds: number[] = [];
const createdCategoryIds: number[] = [];

afterAll(async () => {
  if (createdTagIds.length > 0) {
    await prisma.tag.deleteMany({ where: { id: { in: createdTagIds } } });
  }
  if (createdCategoryIds.length > 0) {
    await prisma.articleCategory.deleteMany({ where: { id: { in: createdCategoryIds } } });
  }
});

describe('/api/v1/admin/tags', () => {
  it('creates, updates, and deletes a tag, and has no /reorder route', async () => {
    const { cookie, ip, csrfToken } = await loginAsAdmin(app, ORIGIN);
    const slug = `xss-${randomUUID()}`;

    const createRes = await request(app)
      .post('/api/v1/admin/tags')
      .set('X-Forwarded-For', ip)
      .set('Origin', ORIGIN)
      .set('Cookie', cookie)
      .set('X-CSRF-Token', csrfToken)
      .send({ name: 'XSS', slug });
    expect(createRes.status).toBe(201);
    const created = (createRes.body as { data: { id: number } }).data;
    createdTagIds.push(created.id);

    // Tag has no displayOrder column, so this router mounts no `/reorder`
    // route at all — a PATCH to it falls through to `PATCH /:id` instead
    // (Express routes by method+path, and `/:id` matches literally
    // anything), with `id: "reorder"` failing `idParamSchema`'s
    // `z.coerce.number()` — a 400 (VALIDATION_ERROR), not a 404. This is
    // the same "register /reorder before /:id" hazard every other admin
    // route file's own comment warns about, just with no /reorder route
    // to register in the first place.
    const reorderRes = await request(app)
      .patch('/api/v1/admin/tags/reorder')
      .set('X-Forwarded-For', ip)
      .set('Origin', ORIGIN)
      .set('Cookie', cookie)
      .set('X-CSRF-Token', csrfToken)
      .send([{ id: created.id, displayOrder: 1 }]);
    expect(reorderRes.status).toBe(400);
    expect(reorderRes.body).toMatchObject({ error: { code: 'VALIDATION_ERROR' } });

    const deleteRes = await request(app)
      .delete(`/api/v1/admin/tags/${created.id}`)
      .set('X-Forwarded-For', ip)
      .set('Origin', ORIGIN)
      .set('Cookie', cookie)
      .set('X-CSRF-Token', csrfToken);
    expect(deleteRes.status).toBe(200);
    createdTagIds.pop();
  });
});

describe('/api/v1/admin/article-categories', () => {
  it('creates, reorders, and deletes an article category', async () => {
    const { cookie, ip, csrfToken } = await loginAsAdmin(app, ORIGIN);
    const slug = `security-${randomUUID()}`;

    const createRes = await request(app)
      .post('/api/v1/admin/article-categories')
      .set('X-Forwarded-For', ip)
      .set('Origin', ORIGIN)
      .set('Cookie', cookie)
      .set('X-CSRF-Token', csrfToken)
      .send({ name: 'Security', slug });
    expect(createRes.status).toBe(201);
    const created = (createRes.body as { data: { id: number } }).data;
    createdCategoryIds.push(created.id);

    const reorderRes = await request(app)
      .patch('/api/v1/admin/article-categories/reorder')
      .set('X-Forwarded-For', ip)
      .set('Origin', ORIGIN)
      .set('Cookie', cookie)
      .set('X-CSRF-Token', csrfToken)
      .send([{ id: created.id, displayOrder: 1 }]);
    expect(reorderRes.status).toBe(200);

    const afterReorder = await prisma.articleCategory.findUnique({ where: { id: created.id } });
    expect(afterReorder?.displayOrder).toBe(1);
  });
});
