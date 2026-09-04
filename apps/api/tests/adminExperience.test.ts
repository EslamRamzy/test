import request from 'supertest';
import { afterAll, describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';
import { env } from '../src/config/env.js';
import { prisma } from '../src/config/prisma.js';
import { loginAsAdmin } from './helpers/adminAuth.js';

const app = createApp();
const ORIGIN = env.CORS_ORIGIN[0];
if (!ORIGIN) throw new Error('test setup: env.CORS_ORIGIN is empty');

const createdExperienceIds: number[] = [];
const createdTechnologyIds: number[] = [];

afterAll(async () => {
  if (createdExperienceIds.length > 0) {
    await prisma.experience.deleteMany({ where: { id: { in: createdExperienceIds } } });
  }
  if (createdTechnologyIds.length > 0) {
    await prisma.technology.deleteMany({ where: { id: { in: createdTechnologyIds } } });
  }
});

describe('/api/v1/admin/experience', () => {
  it('creates with achievements + technologies, then a partial update leaves both untouched', async () => {
    const { cookie, ip, csrfToken } = await loginAsAdmin(app, ORIGIN);

    const tech = await prisma.technology.create({
      data: { name: `Tech ${Date.now()}`, slug: `tech-${Date.now()}` },
    });
    createdTechnologyIds.push(tech.id);

    const createRes = await request(app)
      .post('/api/v1/admin/experience')
      .set('X-Forwarded-For', ip)
      .set('Origin', ORIGIN)
      .set('Cookie', cookie)
      .set('X-CSRF-Token', csrfToken)
      .send({
        position: 'Security Engineer',
        organization: 'Acme',
        startDate: '2022-01-01',
        achievements: ['Found 12 critical vulnerabilities', 'Led the bug bounty program'],
        technologyIds: [tech.id],
      });
    expect(createRes.status).toBe(201);
    const created = createRes.body as {
      data: { id: number; achievements: Array<{ text: string }>; technologies: unknown[] };
    };
    createdExperienceIds.push(created.data.id);
    expect(created.data.achievements.map((a) => a.text)).toEqual([
      'Found 12 critical vulnerabilities',
      'Led the bug bounty program',
    ]);
    expect(created.data.technologies).toHaveLength(1);

    // A PATCH touching only `position` must NOT wipe achievements/technologies
    // (the "replace only when the caller actually sent the field" contract
    // `experienceRepository.ts`'s own comment documents).
    const updateRes = await request(app)
      .patch(`/api/v1/admin/experience/${created.data.id}`)
      .set('X-Forwarded-For', ip)
      .set('Origin', ORIGIN)
      .set('Cookie', cookie)
      .set('X-CSRF-Token', csrfToken)
      .send({ position: 'Senior Security Engineer' });
    expect(updateRes.status).toBe(200);
    const updated = updateRes.body as {
      data: { position: string; achievements: Array<{ text: string }>; technologies: unknown[] };
    };
    expect(updated.data.position).toBe('Senior Security Engineer');
    expect(updated.data.achievements).toHaveLength(2);
    expect(updated.data.technologies).toHaveLength(1);

    // An update that DOES send achievements replaces the whole set.
    const replaceRes = await request(app)
      .patch(`/api/v1/admin/experience/${created.data.id}`)
      .set('X-Forwarded-For', ip)
      .set('Origin', ORIGIN)
      .set('Cookie', cookie)
      .set('X-CSRF-Token', csrfToken)
      .send({ achievements: ['Just one now'] });
    expect(replaceRes.status).toBe(200);
    const replaced = replaceRes.body as { data: { achievements: Array<{ text: string }> } };
    expect(replaced.data.achievements.map((a) => a.text)).toEqual(['Just one now']);
  });
});
