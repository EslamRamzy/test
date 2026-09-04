import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { afterAll, describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';
import { prisma } from '../src/config/prisma.js';

/**
 * The draft-isolation suite Phase 5's own exit criterion requires (docs/
 * architecture/11: "draft-isolation suite green"; doc 10 §3: "create a
 * draft, then assert the public list omits it, the public detail returns
 * 404, it is absent from /search... Then publish and assert all four
 * flip"), plus broader smoke coverage across the rest of the public API.
 * Rows are seeded directly via the Prisma singleton (there is no admin API
 * yet to create them through — that's Phase 8), against the real FTS5
 * triggers, so this also exercises the actual trigger SQL Phase 2 wrote,
 * not a re-implementation of it.
 */

const app = createApp();

const createdProjectIds: number[] = [];
const createdArticleIds: number[] = [];
const createdResearchIds: number[] = [];
const createdUserIds: number[] = [];

async function createTestAuthor() {
  const user = await prisma.user.create({
    data: {
      email: `author-${randomUUID()}@eslamramzy.test`,
      passwordHash: 'not-a-real-hash',
      name: 'Test Author',
      role: 'ADMIN',
    },
  });
  createdUserIds.push(user.id);
  return user.id;
}

async function createProject(overrides: {
  status?: string;
  publishedAt?: Date | null;
  title?: string;
  visibleSectionsJson?: string;
}) {
  const slug = `test-project-${randomUUID()}`;
  const project = await prisma.project.create({
    data: {
      title: overrides.title ?? 'Draft Isolation Test Project',
      slug,
      shortDescription: 'A short description used only in tests.',
      category: 'WEB_APP',
      status: overrides.status ?? 'DRAFT',
      publishedAt: overrides.publishedAt,
      visibleSectionsJson: overrides.visibleSectionsJson ?? '[]',
    },
  });
  createdProjectIds.push(project.id);
  return { project, slug };
}

async function createArticle(overrides: {
  status?: string;
  publishedAt?: Date | null;
  title?: string;
}) {
  const authorId = await createTestAuthor();
  const slug = `test-article-${randomUUID()}`;
  const article = await prisma.article.create({
    data: {
      title: overrides.title ?? 'Draft Isolation Test Article',
      slug,
      content: 'Body content used only in tests.',
      authorId,
      status: overrides.status ?? 'DRAFT',
      publishedAt: overrides.publishedAt,
    },
  });
  createdArticleIds.push(article.id);
  return { article, slug };
}

async function createResearch(overrides: {
  status?: string;
  publishedAt?: Date | null;
  title?: string;
}) {
  const slug = `test-research-${randomUUID()}`;
  const research = await prisma.securityResearch.create({
    data: {
      title: overrides.title ?? 'Draft Isolation Test Research',
      slug,
      content: 'Body content used only in tests.',
      category: 'RESEARCH',
      status: overrides.status ?? 'DRAFT',
      publishedAt: overrides.publishedAt,
    },
  });
  createdResearchIds.push(research.id);
  return { research, slug };
}

afterAll(async () => {
  if (createdProjectIds.length)
    await prisma.project.deleteMany({ where: { id: { in: createdProjectIds } } });
  if (createdArticleIds.length)
    await prisma.article.deleteMany({ where: { id: { in: createdArticleIds } } });
  if (createdResearchIds.length)
    await prisma.securityResearch.deleteMany({ where: { id: { in: createdResearchIds } } });
  if (createdUserIds.length)
    await prisma.user.deleteMany({ where: { id: { in: createdUserIds } } });
});

describe('project draft isolation', () => {
  it('a draft is absent from the public list', async () => {
    const { slug } = await createProject({ status: 'DRAFT' });
    const res = await request(app).get('/api/v1/projects?pageSize=50');
    const body = res.body as { data: Array<{ slug: string }> };
    expect(body.data.some((p) => p.slug === slug)).toBe(false);
  });

  it('a draft returns 404 on detail, not 403 (doc 03 §1 draft leakage rule)', async () => {
    const { slug } = await createProject({ status: 'DRAFT' });
    const res = await request(app).get(`/api/v1/projects/${slug}`);
    expect(res.status).toBe(404);
    expect(res.body).toMatchObject({ success: false, error: { code: 'NOT_FOUND' } });
  });

  it('an archived project is also invisible', async () => {
    const { slug } = await createProject({ status: 'ARCHIVED', publishedAt: new Date() });
    expect((await request(app).get(`/api/v1/projects/${slug}`)).status).toBe(404);
  });

  it('a PUBLISHED project with a future publishedAt is not yet visible (scheduled publish)', async () => {
    const future = new Date(Date.now() + 24 * 60 * 60 * 1000);
    const { slug } = await createProject({ status: 'PUBLISHED', publishedAt: future });
    expect((await request(app).get(`/api/v1/projects/${slug}`)).status).toBe(404);
  });

  it('publishing flips visibility across list, detail, and search', async () => {
    const uniqueTitle = `Findable Title ${randomUUID()}`;
    const { slug, project } = await createProject({ status: 'DRAFT', title: uniqueTitle });

    expect((await request(app).get(`/api/v1/projects/${slug}`)).status).toBe(404);
    const searchBefore = await request(app).get(
      `/api/v1/search?q=${encodeURIComponent(uniqueTitle)}`,
    );
    const searchBeforeBody = searchBefore.body as { data: Array<{ slug: string }> };
    expect(searchBeforeBody.data.some((r) => r.slug === slug)).toBe(false);

    await prisma.project.update({
      where: { id: project.id },
      data: { status: 'PUBLISHED', publishedAt: new Date() },
    });

    const detail = await request(app).get(`/api/v1/projects/${slug}`);
    expect(detail.status).toBe(200);

    const list = await request(app).get('/api/v1/projects?pageSize=50');
    const listBody = list.body as { data: Array<{ slug: string }> };
    expect(listBody.data.some((p) => p.slug === slug)).toBe(true);

    const searchAfter = await request(app).get(
      `/api/v1/search?q=${encodeURIComponent(uniqueTitle)}`,
    );
    const searchAfterBody = searchAfter.body as { data: Array<{ slug: string }> };
    expect(searchAfterBody.data.some((r) => r.slug === slug)).toBe(true);
  });

  it('filters by category', async () => {
    const { slug } = await createProject({ status: 'PUBLISHED', publishedAt: new Date() });
    await prisma.project.update({ where: { slug }, data: { category: 'CLI' } });

    const matching = await request(app).get('/api/v1/projects?category=CLI&pageSize=50');
    const matchingBody = matching.body as { data: Array<{ slug: string }> };
    expect(matchingBody.data.some((p) => p.slug === slug)).toBe(true);

    const nonMatching = await request(app).get('/api/v1/projects?category=MOBILE&pageSize=50');
    const nonMatchingBody = nonMatching.body as { data: Array<{ slug: string }> };
    expect(nonMatchingBody.data.some((p) => p.slug === slug)).toBe(false);
  });

  it('rejects an invalid sort key with a validation error', async () => {
    const res = await request(app).get('/api/v1/projects?sort=notARealColumn');
    expect(res.status).toBe(400);
    expect(res.body).toMatchObject({ error: { code: 'VALIDATION_ERROR' } });
  });

  it('returns the pagination envelope', async () => {
    const res = await request(app).get('/api/v1/projects?page=1&pageSize=5');
    expect(res.body).toMatchObject({
      success: true,
      meta: { page: 1, pageSize: 5 },
    });
    expect(Array.isArray((res.body as { data: unknown }).data)).toBe(true);
  });
});

describe('security finding public-safety rule (doc 05 §4)', () => {
  it('never surfaces an OPEN CRITICAL/HIGH finding publicly, even with isPublic: true', async () => {
    const { slug, project } = await createProject({ status: 'PUBLISHED', publishedAt: new Date() });

    const assessment = await prisma.securityAssessment.create({
      data: {
        projectId: project.id,
        title: 'Test assessment',
        isPublic: true,
        status: 'COMPLETED',
      },
    });

    const dangerous = await prisma.securityFinding.create({
      data: {
        assessmentId: assessment.id,
        title: 'Still-open critical bug',
        severity: 'CRITICAL',
        status: 'OPEN',
        isPublic: true, // even flagged public — the rule must still hide it
      },
    });
    const safe = await prisma.securityFinding.create({
      data: {
        assessmentId: assessment.id,
        title: 'Fixed critical bug',
        severity: 'CRITICAL',
        status: 'FIXED',
        isPublic: true,
      },
    });
    const mediumOpen = await prisma.securityFinding.create({
      data: {
        assessmentId: assessment.id,
        title: 'Open medium issue',
        severity: 'MEDIUM',
        status: 'OPEN',
        isPublic: true,
      },
    });
    const notFlaggedPublic = await prisma.securityFinding.create({
      data: {
        assessmentId: assessment.id,
        title: 'Not flagged public',
        severity: 'LOW',
        status: 'FIXED',
        isPublic: false,
      },
    });

    const res = await request(app).get(`/api/v1/projects/${slug}`);
    expect(res.status).toBe(200);
    const body = res.body as {
      data: { assessments: Array<{ findings: Array<{ id: number; title: string }> }> };
    };
    const findingIds = body.data.assessments.flatMap((a) => a.findings.map((f) => f.id));

    expect(findingIds).not.toContain(dangerous.id);
    expect(findingIds).toContain(safe.id);
    expect(findingIds).toContain(mediumOpen.id);
    expect(findingIds).not.toContain(notFlaggedPublic.id);
  });

  it('hides the whole assessment when isPublic is false, regardless of its findings', async () => {
    const { slug, project } = await createProject({ status: 'PUBLISHED', publishedAt: new Date() });
    const assessment = await prisma.securityAssessment.create({
      data: {
        projectId: project.id,
        title: 'Private assessment',
        isPublic: false,
        status: 'COMPLETED',
      },
    });
    await prisma.securityFinding.create({
      data: {
        assessmentId: assessment.id,
        title: 'A finding in a private assessment',
        severity: 'LOW',
        status: 'FIXED',
        isPublic: true,
      },
    });

    const res = await request(app).get(`/api/v1/projects/${slug}`);
    const body = res.body as { data: { assessments: Array<{ id: number }> } };
    expect(body.data.assessments.some((a) => a.id === assessment.id)).toBe(false);
  });
});

describe('article draft isolation', () => {
  it('a draft is absent from the list and 404s on detail', async () => {
    const { slug } = await createArticle({ status: 'DRAFT' });
    const list = await request(app).get('/api/v1/articles?pageSize=50');
    const listBody = list.body as { data: Array<{ slug: string }> };
    expect(listBody.data.some((a) => a.slug === slug)).toBe(false);

    const detail = await request(app).get(`/api/v1/articles/${slug}`);
    expect(detail.status).toBe(404);
  });

  it('publishing makes it visible', async () => {
    const { slug, article } = await createArticle({ status: 'DRAFT' });
    await prisma.article.update({
      where: { id: article.id },
      data: { status: 'PUBLISHED', publishedAt: new Date() },
    });
    const detail = await request(app).get(`/api/v1/articles/${slug}`);
    expect(detail.status).toBe(200);
    const body = detail.body as { data: { related: unknown[] } };
    expect(Array.isArray(body.data.related)).toBe(true);
  });
});

describe('security research draft isolation', () => {
  it('a draft is absent from the list and 404s on detail', async () => {
    const { slug } = await createResearch({ status: 'DRAFT' });
    const list = await request(app).get('/api/v1/security?pageSize=50');
    const listBody = list.body as { data: Array<{ slug: string }> };
    expect(listBody.data.some((r) => r.slug === slug)).toBe(false);

    expect((await request(app).get(`/api/v1/security/${slug}`)).status).toBe(404);
  });

  it('publishing makes it visible with its references', async () => {
    const { slug, research } = await createResearch({ status: 'DRAFT' });
    await prisma.researchReference.create({
      data: {
        researchId: research.id,
        label: 'CWE-79',
        url: 'https://cwe.mitre.org/data/definitions/79.html',
      },
    });
    await prisma.securityResearch.update({
      where: { id: research.id },
      data: { status: 'PUBLISHED', publishedAt: new Date() },
    });

    const detail = await request(app).get(`/api/v1/security/${slug}`);
    expect(detail.status).toBe(200);
    const body = detail.body as { data: { references: Array<{ label: string }> } };
    expect(body.data.references.some((r) => r.label === 'CWE-79')).toBe(true);
  });
});

describe('home aggregate', () => {
  it('assembles the full shape', async () => {
    const res = await request(app).get('/api/v1/home');
    // Whether this is 200 or 404 depends on whether prisma/bootstrap has
    // ever run against this shared test database — either is a legitimate
    // outcome for this suite (bootstrap is a separate script, never run by
    // the test harness), so the assertion is about SHAPE when it succeeds.
    if (res.status === 200) {
      const body = res.body as { data: Record<string, unknown> };
      for (const key of [
        'profile',
        'stats',
        'featuredProjects',
        'skillCategories',
        'latestArticles',
        'latestResearch',
        'timeline',
        'socialLinks',
      ]) {
        expect(body.data).toHaveProperty(key);
      }
    } else {
      expect(res.status).toBe(404);
    }
  });
});

describe('sitemap data', () => {
  it('includes a newly-published project and excludes a draft one', async () => {
    const { slug: publishedSlug } = await createProject({
      status: 'PUBLISHED',
      publishedAt: new Date(),
    });
    const { slug: draftSlug } = await createProject({ status: 'DRAFT' });

    const res = await request(app).get('/api/v1/sitemap-data');
    const body = res.body as { data: Array<{ slug: string }> };
    expect(body.data.some((entry) => entry.slug === publishedSlug)).toBe(true);
    expect(body.data.some((entry) => entry.slug === draftSlug)).toBe(false);
  });
});

describe('simple list-only public resources', () => {
  it.each([
    ['/api/v1/technologies'],
    ['/api/v1/skills'],
    ['/api/v1/certifications'],
    ['/api/v1/experience'],
    ['/api/v1/education'],
    ['/api/v1/timeline'],
    ['/api/v1/social-links'],
    ['/api/v1/articles/categories'],
    ['/api/v1/tags'],
  ])('%s returns a 200 array envelope', async (path) => {
    const res = await request(app).get(path);
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ success: true });
    expect(Array.isArray((res.body as { data: unknown }).data)).toBe(true);
  });
});
