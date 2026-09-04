import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { createTestDatabase, type TestDatabase } from '../helpers/testDb.js';

/**
 * Every CHECK constraint hand-added to the migration SQL (docs/architecture/02
 * §9), verified against the real SQLite engine — not against a mock. A CHECK
 * constraint that silently fails to apply (a typo in the migration, a
 * mismatched column name) would otherwise only be discovered by a bad row
 * making it into production.
 */
describe('CHECK constraints', () => {
  let db: TestDatabase;

  beforeAll(async () => {
    db = await createTestDatabase();
  });

  afterEach(async () => {
    // Cheap full reset between cases — this file only ever inserts a
    // handful of rows, so truncating everything is simpler than tracking
    // per-test cleanup and keeps every case order-independent.
    const tables = [
      'security_findings',
      'security_assessment_tests',
      'security_assessments',
      'projects',
      'articles',
      'security_research',
      'skills',
      'skill_categories',
      'media',
      'contact_messages',
      'site_settings',
      'page_views',
      'profiles',
      'users',
    ];
    for (const table of tables) {
      await db.prisma.$executeRawUnsafe(`DELETE FROM "${table}";`);
    }
  });

  afterAll(async () => {
    await db.cleanup();
  });

  async function expectRejected(fn: () => Promise<unknown>): Promise<void> {
    await expect(fn()).rejects.toThrow(/constraint/i);
  }

  it('users.role only accepts ADMIN, SUPER_ADMIN, EDITOR', async () => {
    await expectRejected(() =>
      db.prisma.user.create({
        data: { email: 'a@test.dev', passwordHash: 'h', name: 'A', role: 'HACKER' },
      }),
    );
    const ok = await db.prisma.user.create({
      data: { email: 'b@test.dev', passwordHash: 'h', name: 'B', role: 'EDITOR' },
    });
    expect(ok.role).toBe('EDITOR');
  });

  it('projects.status only accepts DRAFT, PUBLISHED, ARCHIVED', async () => {
    await expectRejected(() =>
      db.prisma.project.create({
        data: { title: 't', slug: 's', shortDescription: 'd', category: 'WEB_APP', status: 'LIVE' },
      }),
    );
  });

  it('projects.category only accepts the defined categories', async () => {
    await expectRejected(() =>
      db.prisma.project.create({
        data: { title: 't', slug: 's', shortDescription: 'd', category: 'GAME' },
      }),
    );
  });

  it('security_assessments.status only accepts the defined statuses', async () => {
    const project = await db.prisma.project.create({
      data: { title: 't', slug: 's', shortDescription: 'd', category: 'WEB_APP' },
    });
    await expectRejected(() =>
      db.prisma.securityAssessment.create({
        data: { projectId: project.id, title: 'a', status: 'DONE' },
      }),
    );
  });

  it('security_assessment_tests.test_type only accepts the 15 defined types', async () => {
    const project = await db.prisma.project.create({
      data: { title: 't', slug: 's', shortDescription: 'd', category: 'WEB_APP' },
    });
    const assessment = await db.prisma.securityAssessment.create({
      data: { projectId: project.id, title: 'a' },
    });
    await expectRejected(() =>
      db.prisma.securityAssessmentTest.create({
        data: { assessmentId: assessment.id, testType: 'PORT_SCAN' },
      }),
    );
    const ok = await db.prisma.securityAssessmentTest.create({
      data: { assessmentId: assessment.id, testType: 'SQL_INJECTION' },
    });
    expect(ok.testType).toBe('SQL_INJECTION');
  });

  it('security_assessment_tests.result only accepts the defined results', async () => {
    const project = await db.prisma.project.create({
      data: { title: 't', slug: 's', shortDescription: 'd', category: 'WEB_APP' },
    });
    const assessment = await db.prisma.securityAssessment.create({
      data: { projectId: project.id, title: 'a' },
    });
    await expectRejected(() =>
      db.prisma.securityAssessmentTest.create({
        data: { assessmentId: assessment.id, testType: 'XSS', result: 'MAYBE' },
      }),
    );
  });

  it('security_findings.severity only accepts the 5 defined severities', async () => {
    const project = await db.prisma.project.create({
      data: { title: 't', slug: 's', shortDescription: 'd', category: 'WEB_APP' },
    });
    const assessment = await db.prisma.securityAssessment.create({
      data: { projectId: project.id, title: 'a' },
    });
    await expectRejected(() =>
      db.prisma.securityFinding.create({
        data: { assessmentId: assessment.id, title: 'f', severity: 'EXTREME' },
      }),
    );
  });

  it('security_findings.status only accepts the defined statuses', async () => {
    const project = await db.prisma.project.create({
      data: { title: 't', slug: 's', shortDescription: 'd', category: 'WEB_APP' },
    });
    const assessment = await db.prisma.securityAssessment.create({
      data: { projectId: project.id, title: 'a' },
    });
    await expectRejected(() =>
      db.prisma.securityFinding.create({
        data: { assessmentId: assessment.id, title: 'f', severity: 'LOW', status: 'IGNORED' },
      }),
    );
  });

  it('articles.status only accepts DRAFT, PUBLISHED, ARCHIVED', async () => {
    const author = await db.prisma.user.create({
      data: { email: 'author@test.dev', passwordHash: 'h', name: 'Author' },
    });
    await expectRejected(() =>
      db.prisma.article.create({
        data: { title: 't', slug: 's', content: 'c', authorId: author.id, status: 'LIVE' },
      }),
    );
  });

  it('security_research.category only accepts the 5 defined categories', async () => {
    await expectRejected(() =>
      db.prisma.securityResearch.create({
        data: { title: 't', slug: 's', content: 'c', category: 'EXPLOIT' },
      }),
    );
  });

  it('security_research.status only accepts DRAFT, PUBLISHED, ARCHIVED', async () => {
    await expectRejected(() =>
      db.prisma.securityResearch.create({
        data: { title: 't', slug: 's', content: 'c', category: 'RESEARCH', status: 'LIVE' },
      }),
    );
  });

  it('skills.level only accepts BEGINNER, INTERMEDIATE, ADVANCED', async () => {
    const category = await db.prisma.skillCategory.create({ data: { name: 'C', slug: 'c' } });
    await expectRejected(() =>
      db.prisma.skill.create({ data: { categoryId: category.id, name: 'S', level: 'EXPERT' } }),
    );
  });

  it('media.kind only accepts the 7 defined kinds', async () => {
    await expectRejected(() =>
      db.prisma.media.create({
        data: {
          filename: 'f.jpg',
          originalName: 'f.jpg',
          mimeType: 'image/jpeg',
          sizeBytes: 1,
          checksumSha256: 'x',
          storagePath: '/x',
          kind: 'BACKGROUND',
        },
      }),
    );
  });

  it('contact_messages.status only accepts UNREAD, READ, ARCHIVED', async () => {
    await expectRejected(() =>
      db.prisma.contactMessage.create({
        data: { name: 'n', email: 'e@test.dev', message: 'm', status: 'SPAM' },
      }),
    );
  });

  it('site_settings.value_type only accepts STRING, NUMBER, BOOLEAN, JSON', async () => {
    await expectRejected(() =>
      db.prisma.siteSetting.create({ data: { key: 'k', valueType: 'ARRAY' } }),
    );
  });

  it('page_views.entity_type only accepts PROJECT, ARTICLE, RESEARCH, PAGE — but allows NULL', async () => {
    await expectRejected(() =>
      db.prisma.pageView.create({
        data: { path: '/', visitorHash: 'h', entityType: 'COMMENT' },
      }),
    );
    const ok = await db.prisma.pageView.create({ data: { path: '/', visitorHash: 'h' } });
    expect(ok.entityType).toBeNull();
  });

  it('profiles is a singleton: only id=1 may ever exist', async () => {
    const first = await db.prisma.profile.create({ data: { fullName: 'Eslam Ramzy' } });
    expect(first.id).toBe(1);
    await expectRejected(() => db.prisma.profile.create({ data: { fullName: 'Someone Else' } }));
  });
});
