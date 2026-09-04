import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { afterAll, describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';
import { env } from '../src/config/env.js';
import { prisma } from '../src/config/prisma.js';
import { loginAsAdmin } from './helpers/adminAuth.js';

/**
 * `/api/v1/admin/projects/:id/assessments`, `/api/v1/admin/assessments`,
 * `/api/v1/admin/findings` — doc03 §5's nested security-assessment group.
 * Doc10 §3's named "Findings safety" case (an OPEN + CRITICAL finding must
 * never become public) gets its own dedicated coverage below, both on
 * create and on update.
 */

const app = createApp();
const ORIGIN = env.CORS_ORIGIN[0];
if (!ORIGIN) throw new Error('test setup: env.CORS_ORIGIN is empty');

const createdProjectIds: number[] = [];

afterAll(async () => {
  if (createdProjectIds.length > 0) {
    await prisma.project.deleteMany({ where: { id: { in: createdProjectIds } } });
  }
});

async function createFixtureProject(
  app: ReturnType<typeof createApp>,
  cookie: string,
  ip: string,
  csrfToken: string,
): Promise<number> {
  const res = await request(app)
    .post('/api/v1/admin/projects')
    .set('X-Forwarded-For', ip)
    .set('Origin', ORIGIN!)
    .set('Cookie', cookie)
    .set('X-CSRF-Token', csrfToken)
    .send({
      title: 'Assessment Fixture',
      slug: `assessment-fixture-${randomUUID()}`,
      shortDescription: 'x',
      category: 'WEB_APP',
    });
  const id = (res.body as { data: { id: number } }).data.id;
  createdProjectIds.push(id);
  return id;
}

describe('/api/v1/admin/projects/:id/assessments', () => {
  it('requires authentication', async () => {
    const res = await request(app)
      .get('/api/v1/admin/projects/1/assessments')
      .set('X-Forwarded-For', '10.9.3.1');
    expect(res.status).toBe(401);
  });

  it('404s for a nonexistent project', async () => {
    const { cookie, ip, csrfToken } = await loginAsAdmin(app, ORIGIN!);
    const res = await request(app)
      .post('/api/v1/admin/projects/999999999/assessments')
      .set('X-Forwarded-For', ip)
      .set('Origin', ORIGIN!)
      .set('Cookie', cookie)
      .set('X-CSRF-Token', csrfToken)
      .send({ title: 'Assessment' });
    expect(res.status).toBe(404);
  });

  it('creates, lists, reads, updates, and deletes an assessment — with audit entries', async () => {
    const { cookie, ip, csrfToken } = await loginAsAdmin(app, ORIGIN!);
    const projectId = await createFixtureProject(app, cookie, ip, csrfToken);

    const createRes = await request(app)
      .post(`/api/v1/admin/projects/${projectId}/assessments`)
      .set('X-Forwarded-For', ip)
      .set('Origin', ORIGIN!)
      .set('Cookie', cookie)
      .set('X-CSRF-Token', csrfToken)
      .send({ title: 'Full Penetration Test', scope: 'The whole app' });
    expect(createRes.status).toBe(201);
    const created = (createRes.body as { data: { id: number; status: string } }).data;
    expect(created.status).toBe('PLANNED');

    const listRes = await request(app)
      .get(`/api/v1/admin/projects/${projectId}/assessments`)
      .set('X-Forwarded-For', ip)
      .set('Cookie', cookie);
    expect(listRes.status).toBe(200);
    expect((listRes.body as { data: Array<{ id: number }> }).data).toHaveLength(1);

    const readRes = await request(app)
      .get(`/api/v1/admin/assessments/${created.id}`)
      .set('X-Forwarded-For', ip)
      .set('Cookie', cookie);
    expect(readRes.status).toBe(200);

    const updateRes = await request(app)
      .patch(`/api/v1/admin/assessments/${created.id}`)
      .set('X-Forwarded-For', ip)
      .set('Origin', ORIGIN!)
      .set('Cookie', cookie)
      .set('X-CSRF-Token', csrfToken)
      .send({ status: 'IN_PROGRESS' });
    expect(updateRes.status).toBe(200);
    expect((updateRes.body as { data: { status: string } }).data.status).toBe('IN_PROGRESS');

    const auditActions = (
      await prisma.auditLog.findMany({
        where: { entityType: 'ASSESSMENT', entityId: created.id },
        orderBy: { id: 'asc' },
      })
    ).map((entry) => entry.action);
    expect(auditActions).toEqual(['ASSESSMENT_CREATE', 'ASSESSMENT_UPDATE']);

    const deleteRes = await request(app)
      .delete(`/api/v1/admin/assessments/${created.id}`)
      .set('X-Forwarded-For', ip)
      .set('Origin', ORIGIN!)
      .set('Cookie', cookie)
      .set('X-CSRF-Token', csrfToken);
    expect(deleteRes.status).toBe(200);
  });

  it('upserts the test checklist by testType, without touching unrelated entries', async () => {
    const { cookie, ip, csrfToken } = await loginAsAdmin(app, ORIGIN!);
    const projectId = await createFixtureProject(app, cookie, ip, csrfToken);

    const createRes = await request(app)
      .post(`/api/v1/admin/projects/${projectId}/assessments`)
      .set('X-Forwarded-For', ip)
      .set('Origin', ORIGIN!)
      .set('Cookie', cookie)
      .set('X-CSRF-Token', csrfToken)
      .send({ title: 'Checklist Assessment' });
    const assessmentId = (createRes.body as { data: { id: number } }).data.id;

    const firstUpsert = await request(app)
      .put(`/api/v1/admin/assessments/${assessmentId}/tests`)
      .set('X-Forwarded-For', ip)
      .set('Origin', ORIGIN!)
      .set('Cookie', cookie)
      .set('X-CSRF-Token', csrfToken)
      .send([
        { testType: 'XSS', result: 'PASS' },
        { testType: 'IDOR', result: 'ISSUES_FOUND', notes: 'Found one' },
      ]);
    expect(firstUpsert.status).toBe(200);
    const firstTests = (firstUpsert.body as { data: { tests: Array<{ testType: string }> } }).data
      .tests;
    expect(firstTests).toHaveLength(2);

    // Upserting XSS again updates it in place; IDOR is untouched.
    const secondUpsert = await request(app)
      .put(`/api/v1/admin/assessments/${assessmentId}/tests`)
      .set('X-Forwarded-For', ip)
      .set('Origin', ORIGIN!)
      .set('Cookie', cookie)
      .set('X-CSRF-Token', csrfToken)
      .send([{ testType: 'XSS', result: 'ISSUES_FOUND', notes: 'Actually found a reflected XSS' }]);
    expect(secondUpsert.status).toBe(200);
    const secondTests = (
      secondUpsert.body as { data: { tests: Array<{ testType: string; result: string }> } }
    ).data.tests;
    expect(secondTests).toHaveLength(2);
    const xss = secondTests.find((t) => t.testType === 'XSS');
    const idor = secondTests.find((t) => t.testType === 'IDOR');
    expect(xss?.result).toBe('ISSUES_FOUND');
    expect(idor?.result).toBe('ISSUES_FOUND');

    const auditActions = (
      await prisma.auditLog.findMany({
        where: {
          entityType: 'ASSESSMENT',
          entityId: assessmentId,
          action: 'ASSESSMENT_TESTS_UPSERT',
        },
      })
    ).length;
    expect(auditActions).toBe(2);
  });

  it('manages findings, with the OPEN+CRITICAL/HIGH never-public rule enforced on both create and update', async () => {
    const { cookie, ip, csrfToken } = await loginAsAdmin(app, ORIGIN!);
    const projectId = await createFixtureProject(app, cookie, ip, csrfToken);

    const assessmentRes = await request(app)
      .post(`/api/v1/admin/projects/${projectId}/assessments`)
      .set('X-Forwarded-For', ip)
      .set('Origin', ORIGIN!)
      .set('Cookie', cookie)
      .set('X-CSRF-Token', csrfToken)
      .send({ title: 'Findings Assessment' });
    const assessmentId = (assessmentRes.body as { data: { id: number } }).data.id;

    // Rejected: OPEN + CRITICAL + isPublic:true, at create time.
    const blockedCreate = await request(app)
      .post(`/api/v1/admin/assessments/${assessmentId}/findings`)
      .set('X-Forwarded-For', ip)
      .set('Origin', ORIGIN!)
      .set('Cookie', cookie)
      .set('X-CSRF-Token', csrfToken)
      .send({ title: 'Critical bug', severity: 'CRITICAL', isPublic: true });
    expect(blockedCreate.status).toBe(400);
    expect(blockedCreate.body).toMatchObject({
      error: { code: 'VALIDATION_ERROR', details: [{ field: 'isPublic' }] },
    });

    // The same finding, NOT public, is allowed (status defaults to OPEN).
    const createRes = await request(app)
      .post(`/api/v1/admin/assessments/${assessmentId}/findings`)
      .set('X-Forwarded-For', ip)
      .set('Origin', ORIGIN!)
      .set('Cookie', cookie)
      .set('X-CSRF-Token', csrfToken)
      .send({ title: 'Critical bug', severity: 'CRITICAL' });
    expect(createRes.status).toBe(201);
    const created = (createRes.body as { data: { id: number; status: string } }).data;
    expect(created.status).toBe('OPEN');

    const listRes = await request(app)
      .get(`/api/v1/admin/assessments/${assessmentId}/findings`)
      .set('X-Forwarded-For', ip)
      .set('Cookie', cookie);
    expect(listRes.status).toBe(200);
    expect((listRes.body as { data: unknown[] }).data).toHaveLength(1);

    // Rejected: PATCH { isPublic: true } alone, against the EXISTING
    // severity (CRITICAL) and status (OPEN) — not just the patch body.
    const blockedUpdate = await request(app)
      .patch(`/api/v1/admin/findings/${created.id}`)
      .set('X-Forwarded-For', ip)
      .set('Origin', ORIGIN!)
      .set('Cookie', cookie)
      .set('X-CSRF-Token', csrfToken)
      .send({ isPublic: true });
    expect(blockedUpdate.status).toBe(400);

    // Marking it FIXED first, THEN making it public, is allowed.
    const fixRes = await request(app)
      .patch(`/api/v1/admin/findings/${created.id}`)
      .set('X-Forwarded-For', ip)
      .set('Origin', ORIGIN!)
      .set('Cookie', cookie)
      .set('X-CSRF-Token', csrfToken)
      .send({ status: 'FIXED', isPublic: true });
    expect(fixRes.status).toBe(200);
    expect((fixRes.body as { data: { isPublic: boolean; status: string } }).data).toMatchObject({
      status: 'FIXED',
      isPublic: true,
    });

    const auditActions = (
      await prisma.auditLog.findMany({
        where: { entityType: 'FINDING', entityId: created.id },
        orderBy: { id: 'asc' },
      })
    ).map((entry) => entry.action);
    expect(auditActions).toEqual(['FINDING_CREATE', 'FINDING_UPDATE']);

    const deleteRes = await request(app)
      .delete(`/api/v1/admin/findings/${created.id}`)
      .set('X-Forwarded-For', ip)
      .set('Origin', ORIGIN!)
      .set('Cookie', cookie)
      .set('X-CSRF-Token', csrfToken);
    expect(deleteRes.status).toBe(200);

    const afterDelete = await prisma.securityFinding.findUnique({ where: { id: created.id } });
    expect(afterDelete).toBeNull();
  });

  it('a MEDIUM/LOW severity finding may be public even while OPEN', async () => {
    const { cookie, ip, csrfToken } = await loginAsAdmin(app, ORIGIN!);
    const projectId = await createFixtureProject(app, cookie, ip, csrfToken);

    const assessmentRes = await request(app)
      .post(`/api/v1/admin/projects/${projectId}/assessments`)
      .set('X-Forwarded-For', ip)
      .set('Origin', ORIGIN!)
      .set('Cookie', cookie)
      .set('X-CSRF-Token', csrfToken)
      .send({ title: 'Low Severity Assessment' });
    const assessmentId = (assessmentRes.body as { data: { id: number } }).data.id;

    const createRes = await request(app)
      .post(`/api/v1/admin/assessments/${assessmentId}/findings`)
      .set('X-Forwarded-For', ip)
      .set('Origin', ORIGIN!)
      .set('Cookie', cookie)
      .set('X-CSRF-Token', csrfToken)
      .send({ title: 'Minor info leak', severity: 'LOW', isPublic: true });
    expect(createRes.status).toBe(201);
    expect((createRes.body as { data: { isPublic: boolean } }).data.isPublic).toBe(true);
  });

  it('returns 404 for a nonexistent assessment/finding, and 400 for a malformed body', async () => {
    const { cookie, ip, csrfToken } = await loginAsAdmin(app, ORIGIN!);

    const notFoundAssessment = await request(app)
      .get('/api/v1/admin/assessments/999999999')
      .set('X-Forwarded-For', ip)
      .set('Cookie', cookie);
    expect(notFoundAssessment.status).toBe(404);

    const notFoundFinding = await request(app)
      .patch('/api/v1/admin/findings/999999999')
      .set('X-Forwarded-For', ip)
      .set('Origin', ORIGIN!)
      .set('Cookie', cookie)
      .set('X-CSRF-Token', csrfToken)
      .send({ status: 'FIXED' });
    expect(notFoundFinding.status).toBe(404);

    const projectId = await createFixtureProject(app, cookie, ip, csrfToken);
    const badBody = await request(app)
      .post(`/api/v1/admin/projects/${projectId}/assessments`)
      .set('X-Forwarded-For', ip)
      .set('Origin', ORIGIN!)
      .set('Cookie', cookie)
      .set('X-CSRF-Token', csrfToken)
      .send({}); // missing required title
    expect(badBody.status).toBe(400);
    expect(badBody.body).toMatchObject({ error: { code: 'VALIDATION_ERROR' } });
  });
});
