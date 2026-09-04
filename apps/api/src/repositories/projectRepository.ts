import { prisma } from '../config/prisma.js';

/**
 * Repository skeleton for Project (docs/architecture/11 Phase 2 deliverable).
 * Full CRUD, pagination, filtering and the service layer that calls this
 * arrive in Phase 5 (Public API) and Phase 8 (admin content management).
 * This file exists now to fix the load-bearing pattern in code, not just in
 * documentation, before more repositories are built on top of it.
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

const PUBLIC_PROJECT_SELECT = {
  id: true,
  title: true,
  slug: true,
  shortDescription: true,
  fullDescription: true,
  category: true,
  featured: true,
  coverMediaId: true,
  problem: true,
  solution: true,
  architecture: true,
  challenges: true,
  solutionsDetail: true,
  lessonsLearned: true,
  deploymentNotes: true,
  githubUrl: true,
  liveUrl: true,
  securityTested: true,
  securitySummary: true,
  testingSummary: true,
  visibleSectionsJson: true,
  publishedAt: true,
  // Deliberately excluded from the public shape: status, displayOrder,
  // viewCount, createdAt/updatedAt are internal bookkeeping, not public API.
} as const;

/**
 * The ONLY way public code may read a project. Hardcodes the status and
 * publish-date filter — there is no argument that could disable it.
 */
export function findPublishedBySlug(slug: string) {
  return prisma.project.findFirst({
    where: {
      slug,
      status: 'PUBLISHED',
      publishedAt: { lte: new Date() },
    },
    select: PUBLIC_PROJECT_SELECT,
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
