import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { afterAll, describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';
import { env } from '../src/config/env.js';
import { prisma } from '../src/config/prisma.js';
import { hashPassword } from '../src/lib/password.js';

/**
 * HTTP-layer wiring for `/api/v1/admin/overview` (docs/architecture/03 §5,
 * docs/architecture/07 §3): real counters over real fixture rows, the
 * `authenticate` gate, and the `noStore` middleware mounted on the
 * `/api/v1/admin` prefix. Helpers below are deliberately duplicated from
 * `tests/auth.test.ts` rather than extracted to `tests/helpers/` — that
 * file's own header explains the same choice for its helpers, and this file
 * follows the established convention rather than introduce a new one.
 */

const app = createApp();
const ORIGIN = env.CORS_ORIGIN[0];
if (!ORIGIN) throw new Error('test setup: env.CORS_ORIGIN is empty');

const PASSWORD = 'a-perfectly-fine-test-password-000';
const createdUserIds: number[] = [];
const createdProjectIds: number[] = [];
const createdArticleIds: number[] = [];
const createdContactMessageIds: number[] = [];

async function createUser() {
  const email = `http-${randomUUID()}@eslamramzy.test`;
  const user = await prisma.user.create({
    data: {
      email,
      passwordHash: await hashPassword(PASSWORD),
      name: 'HTTP Test User',
      role: 'ADMIN',
    },
  });
  createdUserIds.push(user.id);
  return { email, user };
}

afterAll(async () => {
  if (createdContactMessageIds.length > 0) {
    await prisma.contactMessage.deleteMany({ where: { id: { in: createdContactMessageIds } } });
  }
  if (createdProjectIds.length > 0) {
    // `onDelete: Cascade` on SecurityAssessment/SecurityFinding takes care
    // of the fixture's findings — no separate cleanup needed for those.
    await prisma.project.deleteMany({ where: { id: { in: createdProjectIds } } });
  }
  if (createdArticleIds.length > 0) {
    await prisma.article.deleteMany({ where: { id: { in: createdArticleIds } } });
  }
  if (createdUserIds.length > 0) {
    await prisma.user.deleteMany({ where: { id: { in: createdUserIds } } });
  }
});

function cookieHeader(res: request.Response): string {
  const raw = res.headers['set-cookie'] as unknown;
  const list: string[] = Array.isArray(raw)
    ? (raw as string[])
    : typeof raw === 'string'
      ? [raw]
      : [];
  return list.map((entry) => entry.split(';')[0]).join('; ');
}

async function fetchCsrf(forwardedFor: string) {
  const res = await request(app).get('/api/v1/auth/csrf').set('X-Forwarded-For', forwardedFor);
  const body = res.body as { data: { csrfToken: string } };
  return { csrfToken: body.data.csrfToken, cookie: cookieHeader(res) };
}

let ipCounter = 0;
/** A fresh, never-reused source IP for scenarios that must not share a rate-limit bucket with any other test. */
function freshIp(): string {
  ipCounter += 1;
  return `10.1.${Math.floor(ipCounter / 256)}.${ipCounter % 256}`;
}

/** Logs a fresh user in over real HTTP and returns cookies for authenticated requests. */
async function login() {
  const { email, user } = await createUser();
  const ip = freshIp();
  const { csrfToken, cookie } = await fetchCsrf(ip);

  const res = await request(app)
    .post('/api/v1/auth/login')
    .set('X-Forwarded-For', ip)
    .set('Origin', ORIGIN)
    .set('Cookie', cookie)
    .set('X-CSRF-Token', csrfToken)
    .send({ email, password: PASSWORD });

  if (res.status !== 200) {
    throw new Error(`test setup: login failed with ${res.status}: ${JSON.stringify(res.body)}`);
  }

  return { user, cookie: cookieHeader(res), ip };
}

describe('GET /admin/overview', () => {
  it('requires authentication', async () => {
    const res = await request(app).get('/api/v1/admin/overview').set('X-Forwarded-For', freshIp());

    expect(res.status).toBe(401);
    expect(res.body).toMatchObject({ error: { code: 'UNAUTHENTICATED' } });
  });

  it('sends Cache-Control: no-store, private on every response, including 401', async () => {
    const res = await request(app).get('/api/v1/admin/overview').set('X-Forwarded-For', freshIp());

    expect(res.headers['cache-control']).toBe('no-store, private');
  });

  it('returns live counters reflecting real fixture rows, and recent activity from the login audit log', async () => {
    const { user, cookie, ip } = await login();

    const project = await prisma.project.create({
      data: {
        title: `Overview Test Project ${randomUUID()}`,
        slug: `overview-test-project-${randomUUID()}`,
        shortDescription: 'Fixture project for the admin overview test.',
        category: 'WEB_APP',
        status: 'DRAFT',
      },
    });
    createdProjectIds.push(project.id);

    await prisma.securityAssessment.create({
      data: {
        projectId: project.id,
        title: 'Fixture assessment',
        status: 'COMPLETED',
        findings: {
          create: [
            { title: 'Fixture open finding', severity: 'MEDIUM', status: 'OPEN' },
            { title: 'Fixture fixed finding', severity: 'LOW', status: 'FIXED' },
          ],
        },
      },
    });

    const article = await prisma.article.create({
      data: {
        title: `Overview Test Article ${randomUUID()}`,
        slug: `overview-test-article-${randomUUID()}`,
        content: 'Fixture article body.',
        authorId: user.id,
        status: 'DRAFT',
      },
    });
    createdArticleIds.push(article.id);

    const contactMessage = await prisma.contactMessage.create({
      data: {
        name: 'Fixture Sender',
        email: 'fixture-sender@eslamramzy.test',
        message: 'Fixture unread message.',
        status: 'UNREAD',
      },
    });
    createdContactMessageIds.push(contactMessage.id);

    const [beforeProjects, beforeArticles, beforeUnread, beforeOpenFindings] = await Promise.all([
      prisma.project.count(),
      prisma.article.count(),
      prisma.contactMessage.count({ where: { status: 'UNREAD' } }),
      prisma.securityFinding.count({ where: { status: 'OPEN' } }),
    ]);

    const res = await request(app)
      .get('/api/v1/admin/overview')
      .set('X-Forwarded-For', ip)
      .set('Cookie', cookie);

    expect(res.status).toBe(200);
    expect(res.headers['cache-control']).toBe('no-store, private');

    const body = res.body as {
      data: {
        projectsCount: number;
        articlesCount: number;
        unreadMessagesCount: number;
        openFindingsCount: number;
        recentActivity: Array<{
          id: number;
          action: string;
          entityType: string | null;
          entityId: number | null;
          actorName: string | null;
          createdAt: string;
        }>;
      };
    };

    expect(body.data.projectsCount).toBe(beforeProjects);
    expect(body.data.articlesCount).toBe(beforeArticles);
    expect(body.data.unreadMessagesCount).toBe(beforeUnread);
    expect(body.data.openFindingsCount).toBe(beforeOpenFindings);
    expect(body.data.projectsCount).toBeGreaterThanOrEqual(1);
    expect(body.data.articlesCount).toBeGreaterThanOrEqual(1);
    expect(body.data.unreadMessagesCount).toBeGreaterThanOrEqual(1);
    expect(body.data.openFindingsCount).toBeGreaterThanOrEqual(1);

    // The login that produced `cookie` wrote a LOGIN_SUCCESS audit row for
    // this exact user — it must show up in recent activity.
    const loginEntry = body.data.recentActivity.find(
      (entry) => entry.action === 'LOGIN_SUCCESS' && entry.actorName === 'HTTP Test User',
    );
    expect(loginEntry).toBeDefined();
  });
});
