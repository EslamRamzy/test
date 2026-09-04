/**
 * Seed — dev/test only (docs/architecture/02 §10). Refuses to run when
 * NODE_ENV=production unless invoked with --force, because production must
 * never contain demo content (brief §21, §54).
 *
 * Populates the entities the doc explicitly scopes here: technologies,
 * projects, articles, security research, and timeline entries. It
 * deliberately does NOT invent certifications, experience, or education —
 * those are real biographical claims about a real person, and there is no
 * factual basis here to invent them, demo label or not. Run `db:bootstrap`
 * first; this script assumes the admin user and skill categories exist.
 *
 * Every run is recorded as one audit log entry (action: SEED_DEMO_DATA) so
 * it is always obvious, from the audit trail alone, that a database contains
 * seeded content rather than real admin-authored content.
 *
 * Usage: npm run db:seed -w @portfolio/api [-- --force]
 */
import { applyDatabasePragmas, disconnectDatabase, prisma } from '../src/config/prisma.js';

const FORCE = process.argv.includes('--force');

const TECHNOLOGIES = [
  { name: 'React', slug: 'react', category: 'Frontend' },
  { name: 'Next.js', slug: 'nextjs', category: 'Frontend' },
  { name: 'TypeScript', slug: 'typescript', category: 'Language' },
  { name: 'Node.js', slug: 'nodejs', category: 'Backend' },
  { name: 'Express', slug: 'express', category: 'Backend' },
  { name: 'SQLite', slug: 'sqlite', category: 'Database' },
  { name: 'Prisma', slug: 'prisma', category: 'Database' },
  { name: 'Docker', slug: 'docker', category: 'DevOps' },
] as const;

async function seedTechnologies(): Promise<Record<string, number>> {
  const ids: Record<string, number> = {};
  for (const [index, tech] of TECHNOLOGIES.entries()) {
    const row = await prisma.technology.upsert({
      where: { slug: tech.slug },
      update: {},
      create: { ...tech, displayOrder: index },
    });
    ids[tech.slug] = row.id;
  }
  return ids;
}

async function seedProjects(techIds: Record<string, number>): Promise<void> {
  const existing = await prisma.project.findUnique({ where: { slug: 'portfolio-platform' } });
  if (existing) return;

  const project = await prisma.project.create({
    data: {
      title: 'Portfolio Platform',
      slug: 'portfolio-platform',
      shortDescription: 'A personal portfolio platform with a full admin dashboard and REST API.',
      fullDescription:
        'This very project — Next.js public site, Express API, SQLite, JWT auth, and a security-first design.',
      category: 'WEB_APP',
      status: 'PUBLISHED',
      featured: true,
      publishedAt: new Date(),
      problem: 'A static portfolio cannot be updated without editing and redeploying code.',
      solution:
        'A layered Next.js + Express platform where every piece of content is a database row, managed from an admin dashboard.',
      architecture: 'Two origins (public site + API) behind Caddy, sharing one SQLite database.',
      securityTested: true,
      securitySummary:
        'Authentication, authorization and input-handling tests passed; see the assessment below.',
      technologies: {
        create: [
          { technologyId: techIds['nextjs'] ?? 0 },
          { technologyId: techIds['express'] ?? 0 },
          { technologyId: techIds['typescript'] ?? 0 },
          { technologyId: techIds['sqlite'] ?? 0 },
          { technologyId: techIds['prisma'] ?? 0 },
        ].filter((t) => t.technologyId !== 0),
      },
    },
  });

  await prisma.securityAssessment.create({
    data: {
      projectId: project.id,
      title: 'Initial security assessment',
      scope: 'Authentication, authorization, and input validation on the admin API.',
      status: 'COMPLETED',
      isPublic: true,
      assessedAt: new Date(),
      tests: {
        create: [
          { testType: 'AUTHENTICATION', result: 'PASS', displayOrder: 0 },
          { testType: 'AUTHORIZATION', result: 'PASS', displayOrder: 1 },
          { testType: 'IDOR', result: 'PASS', displayOrder: 2 },
          { testType: 'XSS', result: 'PASS', displayOrder: 3 },
          {
            testType: 'SQL_INJECTION',
            result: 'NOT_APPLICABLE',
            notes: 'Prisma parameterises all queries.',
            displayOrder: 4,
          },
          { testType: 'RATE_LIMITING', result: 'PASS', displayOrder: 5 },
        ],
      },
      findings: {
        create: [
          {
            title: 'Example: verbose error message on an internal endpoint (demo finding)',
            severity: 'LOW',
            status: 'FIXED',
            description:
              'A demo finding illustrating the findings model. Not a real vulnerability.',
            isPublic: true,
            discoveredAt: new Date(),
            resolvedAt: new Date(),
          },
        ],
      },
    },
  });
}

async function seedArticles(): Promise<void> {
  const admin = await prisma.user.findFirst({ where: { role: 'ADMIN' } });
  if (!admin) {
    console.warn('⚠ No admin user found — skipping article seed. Run db:bootstrap first.');
    return;
  }

  const category = await prisma.articleCategory.upsert({
    where: { slug: 'engineering' },
    update: {},
    create: { name: 'Engineering', slug: 'engineering', displayOrder: 0 },
  });

  await prisma.article.upsert({
    where: { slug: 'building-a-secure-contact-form' },
    update: {},
    create: {
      title: 'Building a Secure Contact Form',
      slug: 'building-a-secure-contact-form',
      excerpt: 'Rate limiting, honeypots, and why the response time itself can leak information.',
      content:
        "# Building a Secure Contact Form\n\nA walkthrough of the validation, rate limiting, and spam controls behind this site's contact form.",
      authorId: admin.id,
      categoryId: category.id,
      status: 'PUBLISHED',
      readingTimeMinutes: 4,
      publishedAt: new Date(),
    },
  });
}

async function seedResearch(): Promise<void> {
  await prisma.securityResearch.upsert({
    where: { slug: 'idor-testing-methodology' },
    update: {},
    create: {
      title: 'IDOR Testing Methodology',
      slug: 'idor-testing-methodology',
      description: 'A practical checklist for finding insecure direct object references.',
      content:
        '# IDOR Testing Methodology\n\n1. Enumerate identifiers.\n2. Swap them across sessions.\n3. Compare responses.',
      category: 'METHODOLOGY',
      status: 'PUBLISHED',
      publishedAt: new Date(),
      references: {
        create: [
          {
            label: 'OWASP Testing Guide',
            url: 'https://owasp.org/www-project-web-security-testing-guide/',
            displayOrder: 0,
          },
        ],
      },
    },
  });
}

async function seedTimeline(): Promise<void> {
  const entries = [
    {
      title: 'Started building full-stack applications',
      category: 'DEVELOPMENT',
      entryDate: new Date('2022-01-01'),
    },
    {
      title: 'Began focused security testing practice',
      category: 'SECURITY',
      entryDate: new Date('2024-01-01'),
    },
  ];
  for (const [index, entry] of entries.entries()) {
    const existing = await prisma.timelineEntry.findFirst({ where: { title: entry.title } });
    if (existing) continue;
    await prisma.timelineEntry.create({ data: { ...entry, displayOrder: index } });
  }
}

async function main(): Promise<void> {
  if (process.env['NODE_ENV'] === 'production' && !FORCE) {
    console.error(
      'Refusing to seed demo data with NODE_ENV=production (docs/architecture/02 §10).\n' +
        'Pass --force if you really intend this.',
    );
    process.exitCode = 1;
    return;
  }

  await applyDatabasePragmas();

  const techIds = await seedTechnologies();
  await seedProjects(techIds);
  await seedArticles();
  await seedResearch();
  await seedTimeline();

  await prisma.auditLog.create({
    data: {
      action: 'SEED_DEMO_DATA',
      metadataJson: JSON.stringify({
        forced: FORCE,
        nodeEnv: process.env['NODE_ENV'] ?? 'development',
      }),
    },
  });

  console.log('\nSeed complete.');
}

main()
  .catch((error: unknown) => {
    console.error('Seed failed:', error);
    process.exitCode = 1;
  })
  .finally(() => {
    void disconnectDatabase();
  });
