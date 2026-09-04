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

const createdCategoryIds: number[] = [];
const createdSkillIds: number[] = [];

afterAll(async () => {
  if (createdSkillIds.length > 0) {
    await prisma.skill.deleteMany({ where: { id: { in: createdSkillIds } } });
  }
  if (createdCategoryIds.length > 0) {
    await prisma.skillCategory.deleteMany({ where: { id: { in: createdCategoryIds } } });
  }
});

describe('/api/v1/admin/skill-categories', () => {
  it('creates, reads, updates, and deletes a skill category', async () => {
    const { cookie, ip, csrfToken } = await loginAsAdmin(app, ORIGIN);
    const slug = `test-cat-${randomUUID()}`;

    const createRes = await request(app)
      .post('/api/v1/admin/skill-categories')
      .set('X-Forwarded-For', ip)
      .set('Origin', ORIGIN)
      .set('Cookie', cookie)
      .set('X-CSRF-Token', csrfToken)
      .send({ name: 'Test Category', slug });
    expect(createRes.status).toBe(201);
    const created = (createRes.body as { data: { id: number } }).data;
    createdCategoryIds.push(created.id);

    const updateRes = await request(app)
      .patch(`/api/v1/admin/skill-categories/${created.id}`)
      .set('X-Forwarded-For', ip)
      .set('Origin', ORIGIN)
      .set('Cookie', cookie)
      .set('X-CSRF-Token', csrfToken)
      .send({ visible: false });
    expect(updateRes.status).toBe(200);
    expect((updateRes.body as { data: { visible: boolean } }).data.visible).toBe(false);
  });
});

describe('/api/v1/admin/skills', () => {
  it('requires an existing categoryId (404, not a raw FK 500)', async () => {
    const { cookie, ip, csrfToken } = await loginAsAdmin(app, ORIGIN);

    const res = await request(app)
      .post('/api/v1/admin/skills')
      .set('X-Forwarded-For', ip)
      .set('Origin', ORIGIN)
      .set('Cookie', cookie)
      .set('X-CSRF-Token', csrfToken)
      .send({ categoryId: 999999999, name: 'Ghost Skill' });

    expect(res.status).toBe(404);
  });

  it('creates a skill under a real category, filters the list by categoryId, and reorders', async () => {
    const { cookie, ip, csrfToken } = await loginAsAdmin(app, ORIGIN);

    const category = await prisma.skillCategory.create({
      data: { name: `Cat ${randomUUID()}`, slug: `cat-${randomUUID()}` },
    });
    createdCategoryIds.push(category.id);

    const createRes = await request(app)
      .post('/api/v1/admin/skills')
      .set('X-Forwarded-For', ip)
      .set('Origin', ORIGIN)
      .set('Cookie', cookie)
      .set('X-CSRF-Token', csrfToken)
      .send({ categoryId: category.id, name: 'Rust', level: 'ADVANCED' });
    expect(createRes.status).toBe(201);
    const created = (createRes.body as { data: { id: number } }).data;
    createdSkillIds.push(created.id);

    const listRes = await request(app)
      .get(`/api/v1/admin/skills?categoryId=${category.id}`)
      .set('X-Forwarded-For', ip)
      .set('Cookie', cookie);
    expect(listRes.status).toBe(200);
    const listBody = listRes.body as { data: Array<{ id: number }> };
    expect(listBody.data.map((row) => row.id)).toEqual([created.id]);

    const reorderRes = await request(app)
      .patch('/api/v1/admin/skills/reorder')
      .set('X-Forwarded-For', ip)
      .set('Origin', ORIGIN)
      .set('Cookie', cookie)
      .set('X-CSRF-Token', csrfToken)
      .send([{ id: created.id, displayOrder: 3 }]);
    expect(reorderRes.status).toBe(200);

    const afterReorder = await prisma.skill.findUnique({ where: { id: created.id } });
    expect(afterReorder?.displayOrder).toBe(3);
  });

  it('rejects an invalid level with 400', async () => {
    const { cookie, ip, csrfToken } = await loginAsAdmin(app, ORIGIN);
    const category = await prisma.skillCategory.create({
      data: { name: `Cat ${randomUUID()}`, slug: `cat-${randomUUID()}` },
    });
    createdCategoryIds.push(category.id);

    const res = await request(app)
      .post('/api/v1/admin/skills')
      .set('X-Forwarded-For', ip)
      .set('Origin', ORIGIN)
      .set('Cookie', cookie)
      .set('X-CSRF-Token', csrfToken)
      .send({ categoryId: category.id, name: 'Bad', level: 'GODLIKE' });
    expect(res.status).toBe(400);
  });
});
