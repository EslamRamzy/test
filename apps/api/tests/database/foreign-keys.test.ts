import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createTestDatabase, type TestDatabase } from '../helpers/testDb.js';

/**
 * The three ON DELETE behaviours the schema actually uses
 * (docs/architecture/02 §7), each verified against a real relationship in
 * the schema rather than a synthetic table — so a mismatch between the
 * documented intent and what Prisma actually generated cannot hide.
 */
describe('foreign key behaviour', () => {
  let db: TestDatabase;

  beforeAll(async () => {
    db = await createTestDatabase();
  });

  afterAll(async () => {
    await db.cleanup();
  });

  it('rejects an insert referencing a non-existent parent row', async () => {
    await expect(
      db.prisma.$executeRawUnsafe(
        `INSERT INTO project_technologies (project_id, technology_id) VALUES (999999, 999999)`,
      ),
    ).rejects.toThrow(/foreign key/i);
  });

  it('CASCADE: deleting a project removes its security findings', async () => {
    const project = await db.prisma.project.create({
      data: { title: 'p', slug: 'cascade-p', shortDescription: 'd', category: 'WEB_APP' },
    });
    const assessment = await db.prisma.securityAssessment.create({
      data: { projectId: project.id, title: 'a' },
    });
    await db.prisma.securityFinding.create({
      data: { assessmentId: assessment.id, title: 'f', severity: 'LOW' },
    });

    await db.prisma.project.delete({ where: { id: project.id } });

    const remaining = await db.prisma.securityFinding.count({
      where: { assessmentId: assessment.id },
    });
    expect(remaining).toBe(0);
  });

  it('RESTRICT: a user who authored an article cannot be deleted', async () => {
    const author = await db.prisma.user.create({
      data: { email: 'restrict@test.dev', passwordHash: 'h', name: 'Author' },
    });
    await db.prisma.article.create({
      data: { title: 'r', slug: 'restrict-a', content: 'c', authorId: author.id },
    });

    await expect(db.prisma.user.delete({ where: { id: author.id } })).rejects.toThrow(
      /foreign key/i,
    );

    // The article must still exist — RESTRICT means the delete never happened,
    // not that it happened and left an orphan.
    const stillThere = await db.prisma.article.findUnique({ where: { slug: 'restrict-a' } });
    expect(stillThere).not.toBeNull();
  });

  it('SET NULL: deleting a media row clears projects.coverMediaId', async () => {
    const media = await db.prisma.media.create({
      data: {
        filename: 'setnull.jpg',
        originalName: 'setnull.jpg',
        mimeType: 'image/jpeg',
        sizeBytes: 1,
        checksumSha256: 'x',
        storagePath: '/x',
        kind: 'PROJECT_COVER',
      },
    });
    const project = await db.prisma.project.create({
      data: {
        title: 'p',
        slug: 'setnull-p',
        shortDescription: 'd',
        category: 'WEB_APP',
        coverMediaId: media.id,
      },
    });

    await db.prisma.media.delete({ where: { id: media.id } });

    const reloaded = await db.prisma.project.findUniqueOrThrow({ where: { id: project.id } });
    expect(reloaded.coverMediaId).toBeNull();
  });
});
