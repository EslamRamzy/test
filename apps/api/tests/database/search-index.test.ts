import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createTestDatabase, type TestDatabase } from '../helpers/testDb.js';

/**
 * The FTS5 search index and its maintenance triggers (docs/architecture/02
 * §2, §6). The property under test is the one the design leans on for
 * safety: a draft can NEVER be found through search, because it is never
 * written to the index in the first place — this is verified through every
 * status transition, not just the initial insert.
 */
describe('search_index synchronisation', () => {
  let db: TestDatabase;

  beforeAll(async () => {
    db = await createTestDatabase();
  });

  afterAll(async () => {
    await db.cleanup();
  });

  async function searchFor(term: string): Promise<{ slug: string }[]> {
    return db.prisma.$queryRawUnsafe<{ slug: string }[]>(
      `SELECT slug FROM search_index WHERE search_index MATCH ?`,
      term,
    );
  }

  it('a DRAFT project is never indexed', async () => {
    await db.prisma.project.create({
      data: {
        title: 'Alpha Widget Ne1',
        slug: 'alpha-widget',
        shortDescription: 'd',
        category: 'WEB_APP',
        status: 'DRAFT',
      },
    });
    expect(await searchFor('Ne1')).toHaveLength(0);
  });

  it('publishing a project adds it to the index', async () => {
    const project = await db.prisma.project.create({
      data: {
        title: 'Beta Widget Ne2',
        slug: 'beta-widget',
        shortDescription: 'd',
        category: 'WEB_APP',
        status: 'DRAFT',
      },
    });
    expect(await searchFor('Ne2')).toHaveLength(0);

    await db.prisma.project.update({
      where: { id: project.id },
      data: { status: 'PUBLISHED', publishedAt: new Date() },
    });

    const hits = await searchFor('Ne2');
    expect(hits).toHaveLength(1);
    expect(hits[0]?.slug).toBe('beta-widget');
  });

  it('unpublishing (back to DRAFT) removes it from the index', async () => {
    const project = await db.prisma.project.create({
      data: {
        title: 'Gamma Widget Ne3',
        slug: 'gamma-widget',
        shortDescription: 'd',
        category: 'WEB_APP',
        status: 'PUBLISHED',
        publishedAt: new Date(),
      },
    });
    expect(await searchFor('Ne3')).toHaveLength(1);

    await db.prisma.project.update({ where: { id: project.id }, data: { status: 'DRAFT' } });
    expect(await searchFor('Ne3')).toHaveLength(0);
  });

  it('archiving removes it from the index', async () => {
    const project = await db.prisma.project.create({
      data: {
        title: 'Delta Widget Ne4',
        slug: 'delta-widget',
        shortDescription: 'd',
        category: 'WEB_APP',
        status: 'PUBLISHED',
        publishedAt: new Date(),
      },
    });
    await db.prisma.project.update({ where: { id: project.id }, data: { status: 'ARCHIVED' } });
    expect(await searchFor('Ne4')).toHaveLength(0);
  });

  it('editing published content updates the indexed text', async () => {
    const project = await db.prisma.project.create({
      data: {
        title: 'Epsilon Widget Ne5',
        slug: 'epsilon-widget',
        shortDescription: 'd',
        category: 'WEB_APP',
        status: 'PUBLISHED',
        publishedAt: new Date(),
      },
    });
    expect(await searchFor('Ne5')).toHaveLength(1);

    await db.prisma.project.update({
      where: { id: project.id },
      data: { title: 'Epsilon Widget Ne5Renamed' },
    });

    expect(await searchFor('Ne5')).toHaveLength(0);
    expect(await searchFor('Ne5Renamed')).toHaveLength(1);
  });

  it('deleting a published project removes it from the index', async () => {
    const project = await db.prisma.project.create({
      data: {
        title: 'Zeta Widget Ne6',
        slug: 'zeta-widget',
        shortDescription: 'd',
        category: 'WEB_APP',
        status: 'PUBLISHED',
        publishedAt: new Date(),
      },
    });
    await db.prisma.project.delete({ where: { id: project.id } });
    expect(await searchFor('Ne6')).toHaveLength(0);
  });

  it('a published article is indexed and an unpublished one is not', async () => {
    const author = await db.prisma.user.create({
      data: { email: 'search-author@test.dev', passwordHash: 'h', name: 'Author' },
    });
    await db.prisma.article.create({
      data: {
        title: 'Draft Article Ne7',
        slug: 'draft-article',
        content: 'c',
        authorId: author.id,
      },
    });
    expect(await searchFor('Ne7')).toHaveLength(0);

    await db.prisma.article.create({
      data: {
        title: 'Published Article Ne8',
        slug: 'published-article',
        content: 'c',
        authorId: author.id,
        status: 'PUBLISHED',
        publishedAt: new Date(),
      },
    });
    expect(await searchFor('Ne8')).toHaveLength(1);
  });

  it('a published research entry is indexed', async () => {
    await db.prisma.securityResearch.create({
      data: {
        title: 'Research Entry Ne9',
        slug: 'research-entry',
        content: 'c',
        category: 'RESEARCH',
        status: 'PUBLISHED',
        publishedAt: new Date(),
      },
    });
    expect(await searchFor('Ne9')).toHaveLength(1);
  });

  it('a technology is indexed immediately — no publish gate applies', async () => {
    const tech = await db.prisma.technology.create({
      data: { name: 'FrameworkNe10', slug: 'framework-ne10' },
    });
    expect(await searchFor('FrameworkNe10')).toHaveLength(1);

    await db.prisma.technology.delete({ where: { id: tech.id } });
    expect(await searchFor('FrameworkNe10')).toHaveLength(0);
  });
});
