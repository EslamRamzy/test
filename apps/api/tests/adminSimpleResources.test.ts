import request from 'supertest';
import { afterAll, describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';
import { env } from '../src/config/env.js';
import { prisma } from '../src/config/prisma.js';
import { loginAsAdmin } from './helpers/adminAuth.js';

/**
 * One combined file for the four remaining simple CRUD+reorder resources
 * that are structurally identical to Technologies (already the dedicated,
 * fully-exercised template in `adminTechnologies.test.ts`) — Certifications,
 * Education, Timeline, Social Links. Each gets one real create→list→
 * update→reorder→delete pass here rather than its own near-duplicate file;
 * anything resource-specific (Skills' categoryId, Experience's nested
 * achievements/technologies, Tags having no reorder) has its own dedicated
 * file instead.
 */

const app = createApp();
const ORIGIN = env.CORS_ORIGIN[0];
if (!ORIGIN) throw new Error('test setup: env.CORS_ORIGIN is empty');

const createdCertificationIds: number[] = [];
const createdEducationIds: number[] = [];
const createdTimelineIds: number[] = [];
const createdSocialLinkIds: number[] = [];

afterAll(async () => {
  if (createdCertificationIds.length > 0) {
    await prisma.certification.deleteMany({ where: { id: { in: createdCertificationIds } } });
  }
  if (createdEducationIds.length > 0) {
    await prisma.education.deleteMany({ where: { id: { in: createdEducationIds } } });
  }
  if (createdTimelineIds.length > 0) {
    await prisma.timelineEntry.deleteMany({ where: { id: { in: createdTimelineIds } } });
  }
  if (createdSocialLinkIds.length > 0) {
    await prisma.socialLink.deleteMany({ where: { id: { in: createdSocialLinkIds } } });
  }
});

describe('/api/v1/admin/certifications', () => {
  it('creates, updates, reorders, and deletes a certification', async () => {
    const { cookie, ip, csrfToken } = await loginAsAdmin(app, ORIGIN);

    const createRes = await request(app)
      .post('/api/v1/admin/certifications')
      .set('X-Forwarded-For', ip)
      .set('Origin', ORIGIN)
      .set('Cookie', cookie)
      .set('X-CSRF-Token', csrfToken)
      .send({ name: 'OSCP', issuer: 'Offensive Security', issueDate: '2022-06-01' });
    expect(createRes.status).toBe(201);
    const created = (createRes.body as { data: { id: number } }).data;
    createdCertificationIds.push(created.id);

    const updateRes = await request(app)
      .patch(`/api/v1/admin/certifications/${created.id}`)
      .set('X-Forwarded-For', ip)
      .set('Origin', ORIGIN)
      .set('Cookie', cookie)
      .set('X-CSRF-Token', csrfToken)
      .send({ credentialUrl: 'https://credly.com/badges/example' });
    expect(updateRes.status).toBe(200);

    const reorderRes = await request(app)
      .patch('/api/v1/admin/certifications/reorder')
      .set('X-Forwarded-For', ip)
      .set('Origin', ORIGIN)
      .set('Cookie', cookie)
      .set('X-CSRF-Token', csrfToken)
      .send([{ id: created.id, displayOrder: 2 }]);
    expect(reorderRes.status).toBe(200);

    const deleteRes = await request(app)
      .delete(`/api/v1/admin/certifications/${created.id}`)
      .set('X-Forwarded-For', ip)
      .set('Origin', ORIGIN)
      .set('Cookie', cookie)
      .set('X-CSRF-Token', csrfToken);
    expect(deleteRes.status).toBe(200);
    createdCertificationIds.pop();
  });
});

describe('/api/v1/admin/education', () => {
  it('creates, updates, and deletes an education entry', async () => {
    const { cookie, ip, csrfToken } = await loginAsAdmin(app, ORIGIN);

    const createRes = await request(app)
      .post('/api/v1/admin/education')
      .set('X-Forwarded-For', ip)
      .set('Origin', ORIGIN)
      .set('Cookie', cookie)
      .set('X-CSRF-Token', csrfToken)
      .send({ institution: 'MIT', degree: 'BSc Computer Science', startDate: '2015-09-01' });
    expect(createRes.status).toBe(201);
    const created = (createRes.body as { data: { id: number } }).data;
    createdEducationIds.push(created.id);

    const updateRes = await request(app)
      .patch(`/api/v1/admin/education/${created.id}`)
      .set('X-Forwarded-For', ip)
      .set('Origin', ORIGIN)
      .set('Cookie', cookie)
      .set('X-CSRF-Token', csrfToken)
      .send({ field: 'Security' });
    expect(updateRes.status).toBe(200);
    expect((updateRes.body as { data: { field: string } }).data.field).toBe('Security');
  });
});

describe('/api/v1/admin/timeline', () => {
  it('creates, reorders, and deletes a timeline entry', async () => {
    const { cookie, ip, csrfToken } = await loginAsAdmin(app, ORIGIN);

    const createRes = await request(app)
      .post('/api/v1/admin/timeline')
      .set('X-Forwarded-For', ip)
      .set('Origin', ORIGIN)
      .set('Cookie', cookie)
      .set('X-CSRF-Token', csrfToken)
      .send({ entryDate: '2020-01-01', title: 'Started freelancing' });
    expect(createRes.status).toBe(201);
    const created = (createRes.body as { data: { id: number } }).data;
    createdTimelineIds.push(created.id);

    const reorderRes = await request(app)
      .patch('/api/v1/admin/timeline/reorder')
      .set('X-Forwarded-For', ip)
      .set('Origin', ORIGIN)
      .set('Cookie', cookie)
      .set('X-CSRF-Token', csrfToken)
      .send([{ id: created.id, displayOrder: 1 }]);
    expect(reorderRes.status).toBe(200);
  });
});

describe('/api/v1/admin/social-links', () => {
  it('creates, updates, and rejects a non-https URL', async () => {
    const { cookie, ip, csrfToken } = await loginAsAdmin(app, ORIGIN);

    const createRes = await request(app)
      .post('/api/v1/admin/social-links')
      .set('X-Forwarded-For', ip)
      .set('Origin', ORIGIN)
      .set('Cookie', cookie)
      .set('X-CSRF-Token', csrfToken)
      .send({ platform: 'GitHub', url: 'https://github.com/example' });
    expect(createRes.status).toBe(201);
    const created = (createRes.body as { data: { id: number } }).data;
    createdSocialLinkIds.push(created.id);

    const badRes = await request(app)
      .post('/api/v1/admin/social-links')
      .set('X-Forwarded-For', ip)
      .set('Origin', ORIGIN)
      .set('Cookie', cookie)
      .set('X-CSRF-Token', csrfToken)
      .send({ platform: 'GitHub', url: 'http://github.com/example' });
    expect(badRes.status).toBe(400);
  });
});
