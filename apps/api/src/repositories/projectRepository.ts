import type { Prisma } from '../../generated/prisma/client.js';
import { prisma } from '../config/prisma.js';

/**
 * Project repository (docs/architecture/11 Phase 2 skeleton, filled in for
 * Phase 5's public reads and extended by Phase 8's admin CRUD).
 *
 * The pattern (docs/architecture/05 §5): public code and admin code call
 * TWO DIFFERENT, EXPLICITLY NAMED functions — never one function with an
 * `includeDrafts` boolean that could default wrong or be passed a
 * user-controlled value. That shape of bug is exactly how draft content
 * leaks publicly, so it is designed out at the type level: there is no
 * parameter to get wrong.
 *
 * Enforcement, not just convention: an ESLint rule
 * (`no-restricted-syntax` in eslint.config.mjs, scoped to
 * `controllers/public/**` and `routes/public/**`) forbids importing any
 * repository export whose name ends in `ForAdmin`. Breaking the naming
 * convention below would silently disable that protection, so the
 * `*ForAdmin` suffix on the admin-facing function is not just a style
 * choice — it is the mechanism.
 */

const TECHNOLOGY_SELECT = {
  id: true,
  name: true,
  slug: true,
  icon: true,
  category: true,
  websiteUrl: true,
} satisfies Prisma.TechnologySelect;

const MEDIA_SELECT = {
  id: true,
  filename: true,
  altText: true,
  width: true,
  height: true,
} satisfies Prisma.MediaSelect;

/** List-item shape — deliberately lighter than the detail select below (no case-study body fields). */
const PUBLIC_PROJECT_LIST_SELECT = {
  id: true,
  title: true,
  slug: true,
  shortDescription: true,
  category: true,
  featured: true,
  securityTested: true,
  publishedAt: true,
  coverMedia: { select: MEDIA_SELECT },
  technologies: { select: { technology: { select: TECHNOLOGY_SELECT } } },
} satisfies Prisma.ProjectSelect;

/**
 * Full case-study shape. `visibleSectionsJson` decides at the SERVICE layer
 * which of these fields the response actually surfaces (decision D5) — the
 * repository's job is only draft visibility, not section visibility.
 */
const PUBLIC_PROJECT_DETAIL_SELECT = {
  ...PUBLIC_PROJECT_LIST_SELECT,
  fullDescription: true,
  problem: true,
  solution: true,
  architecture: true,
  challenges: true,
  solutionsDetail: true,
  lessonsLearned: true,
  deploymentNotes: true,
  githubUrl: true,
  liveUrl: true,
  securitySummary: true,
  testingSummary: true,
  visibleSectionsJson: true,
  images: {
    select: { caption: true, media: { select: MEDIA_SELECT } },
    orderBy: { displayOrder: 'asc' },
  },
  features: {
    select: { title: true, description: true },
    orderBy: { displayOrder: 'asc' },
  },
  sections: {
    where: { visible: true },
    select: { sectionKey: true, title: true, body: true },
    orderBy: { displayOrder: 'asc' },
  },
  /**
   * Public-safety rule (docs/architecture/05 §4): an assessment is public
   * only if `isPublic`, and within it, a finding is public only if its own
   * `isPublic` AND it is not a CRITICAL/HIGH finding that is still OPEN —
   * that second half can never be overridden by the `isPublic` flag alone,
   * so it is not a parameter here either, the same reasoning as the
   * draft-visibility split above.
   */
  assessments: {
    where: { isPublic: true },
    select: {
      id: true,
      title: true,
      scope: true,
      methodology: true,
      summary: true,
      status: true,
      assessedAt: true,
      retestedAt: true,
      tests: {
        select: { testType: true, result: true, notes: true },
        orderBy: { displayOrder: 'asc' },
      },
      findings: {
        where: {
          isPublic: true,
          NOT: { AND: [{ severity: { in: ['CRITICAL', 'HIGH'] } }, { status: 'OPEN' }] },
        },
        select: {
          id: true,
          title: true,
          severity: true,
          description: true,
          impact: true,
          affectedComponent: true,
          remediation: true,
          status: true,
          cweId: true,
          discoveredAt: true,
          resolvedAt: true,
        },
        orderBy: { displayOrder: 'asc' },
      },
    },
  },
} satisfies Prisma.ProjectSelect;

type ProjectSortKey = 'publishedAt' | 'title' | 'displayOrder';

function buildOrderBy(
  sort: ProjectSortKey,
  order: 'asc' | 'desc',
): Prisma.ProjectOrderByWithRelationInput {
  return { [sort]: order };
}

function publishedWhere(extra: Prisma.ProjectWhereInput = {}): Prisma.ProjectWhereInput {
  return { status: 'PUBLISHED', publishedAt: { lte: new Date() }, ...extra };
}

export interface ProjectListFilter {
  category: string | undefined;
  technology: string | undefined;
  featured: boolean | undefined;
  securityTested: boolean | undefined;
  page: number;
  pageSize: number;
  sort: ProjectSortKey;
  order: 'asc' | 'desc';
}

export async function findPublishedList(filter: ProjectListFilter) {
  const where = publishedWhere({
    ...(filter.category ? { category: filter.category } : {}),
    ...(filter.technology
      ? { technologies: { some: { technology: { slug: filter.technology } } } }
      : {}),
    ...(filter.featured !== undefined ? { featured: filter.featured } : {}),
    ...(filter.securityTested !== undefined ? { securityTested: filter.securityTested } : {}),
  });

  const [items, total] = await Promise.all([
    prisma.project.findMany({
      where,
      select: PUBLIC_PROJECT_LIST_SELECT,
      orderBy: buildOrderBy(filter.sort, filter.order),
      skip: (filter.page - 1) * filter.pageSize,
      take: filter.pageSize,
    }),
    prisma.project.count({ where }),
  ]);

  return { items, total };
}

/**
 * The ONLY way public code may read a full project case study. Hardcodes
 * the status and publish-date filter — there is no argument that could
 * disable it.
 */
export function findPublishedBySlug(slug: string) {
  return prisma.project.findFirst({
    where: publishedWhere({ slug }),
    select: PUBLIC_PROJECT_DETAIL_SELECT,
  });
}

/** Same category or sharing at least one technology, max `limit` (doc 03 §3: "max 3"). */
export function findRelated(
  projectId: number,
  category: string,
  technologyIds: number[],
  limit: number,
) {
  return prisma.project.findMany({
    where: publishedWhere({
      id: { not: projectId },
      OR: [
        { category },
        ...(technologyIds.length > 0
          ? [{ technologies: { some: { technologyId: { in: technologyIds } } } }]
          : []),
      ],
    }),
    select: PUBLIC_PROJECT_LIST_SELECT,
    orderBy: { publishedAt: 'desc' },
    take: limit,
  });
}

export function findFeaturedPublished(limit: number) {
  return prisma.project.findMany({
    where: publishedWhere({ featured: true }),
    select: PUBLIC_PROJECT_LIST_SELECT,
    orderBy: [{ displayOrder: 'asc' }, { publishedAt: 'desc' }],
    take: limit,
  });
}

export function countPublished() {
  return prisma.project.count({ where: publishedWhere() });
}

/** slug + updatedAt only, for `GET /sitemap-data` (docs/architecture/03 §3). */
export function findSlugsForSitemap() {
  return prisma.project.findMany({
    where: publishedWhere(),
    select: { slug: true, updatedAt: true },
  });
}

/**
 * Admin-only read: any status, full column set. The `ForAdmin` suffix is
 * required — see the file header and docs/architecture/05 §5.
 */
export function findAnyByIdForAdmin(id: number) {
  return prisma.project.findUnique({ where: { id } });
}

/**
 * Admin-only list: every project regardless of status, for the dashboard
 * table. Also `ForAdmin`-suffixed for the same reason.
 */
export function findAllForAdmin() {
  return prisma.project.findMany({ orderBy: [{ displayOrder: 'asc' }, { id: 'asc' }] });
}
