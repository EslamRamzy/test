import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { afterAll, describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';
import { prisma } from '../src/config/prisma.js';

const app = createApp();
const createdProjectIds: number[] = [];

async function createPublishedProject(title: string) {
  const slug = `search-test-${randomUUID()}`;
  const project = await prisma.project.create({
    data: {
      title,
      slug,
      shortDescription: 'A short description used only in search tests.',
      category: 'SECURITY_TOOL',
      status: 'PUBLISHED',
      publishedAt: new Date(),
      visibleSectionsJson: '[]',
    },
  });
  createdProjectIds.push(project.id);
  return slug;
}

afterAll(async () => {
  if (createdProjectIds.length) {
    await prisma.project.deleteMany({ where: { id: { in: createdProjectIds } } });
  }
});

describe('GET /search', () => {
  it('finds a published project by a substring of its title (prefix match)', async () => {
    const marker = randomUUID().slice(0, 8);
    const slug = await createPublishedProject(`ZebraScanner-${marker} Toolkit`);

    const res = await request(app).get(`/api/v1/search?q=ZebraScanner-${marker}`);
    expect(res.status).toBe(200);
    const body = res.body as { data: Array<{ slug: string; entityType: string }> };
    expect(body.data.some((r) => r.slug === slug && r.entityType === 'PROJECT')).toBe(true);
  });

  it('filters by type', async () => {
    const marker = randomUUID().slice(0, 8);
    const slug = await createPublishedProject(`FilterCheck-${marker}`);

    const wrongType = await request(app).get(
      `/api/v1/search?q=FilterCheck-${marker}&type=articles`,
    );
    const wrongTypeBody = wrongType.body as { data: Array<{ slug: string }> };
    expect(wrongTypeBody.data.some((r) => r.slug === slug)).toBe(false);

    const rightType = await request(app).get(
      `/api/v1/search?q=FilterCheck-${marker}&type=projects`,
    );
    const rightTypeBody = rightType.body as { data: Array<{ slug: string }> };
    expect(rightTypeBody.data.some((r) => r.slug === slug)).toBe(true);
  });

  it.each([
    'OR',
    'AND',
    'NOT',
    '"',
    '""',
    '*',
    '-',
    'col:value',
    '(unbalanced',
    'a OR 1=1',
    "'; DROP TABLE search_index; --",
  ])('does not throw on FTS5-special or SQL-special input: %j', async (weird) => {
    const res = await request(app).get(`/api/v1/search?q=${encodeURIComponent(weird || 'x')}`);
    // Must never 500 — a 400 (schema rejects e.g. a 1-char query) or 200
    // (empty or real results) are both fine; an internal error is not.
    expect(res.status).not.toBe(500);
  });

  it('rejects a query under 2 characters', async () => {
    const res = await request(app).get('/api/v1/search?q=a');
    expect(res.status).toBe(400);
  });

  it('the search_index table still exists and is queryable after the special-input sweep (no corruption)', async () => {
    const count = await prisma.$queryRaw<
      Array<{ n: bigint }>
    >`SELECT COUNT(*) as n FROM search_index`;
    expect(count[0]).toBeDefined();
  });
});
