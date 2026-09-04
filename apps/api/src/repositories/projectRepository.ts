import type {
  ProjectCreateInput,
  ProjectImageCreateInput,
  ProjectUpdateInput,
} from '@portfolio/shared';
import type { Prisma } from '../../generated/prisma/client.js';
import { prisma } from '../config/prisma.js';
import type { PrismaClientOrTx } from '../config/prisma.js';
import { ConflictError, NotFoundError } from '../errors/AppError.js';
import { stripUndefined } from '../lib/stripUndefined.js';
import type { AdminCrudListParams } from '../services/adminCrudFactory.js';
import { isUniqueConstraintError } from './prismaErrors.js';

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

/** Admin dashboard counter: every project regardless of status. `ForAdmin`-suffixed (see below). */
export function countAllForAdmin() {
  return prisma.project.count();
}

/** slug + updatedAt only, for `GET /sitemap-data` (docs/architecture/03 §3). */
export function findSlugsForSitemap() {
  return prisma.project.findMany({
    where: publishedWhere(),
    select: { slug: true, updatedAt: true },
  });
}

// --- Admin CRUD + tabbed-editor endpoints (docs/architecture/03 §5, 07 §3-4) --

const ADMIN_INCLUDE = {
  coverMedia: true,
  images: { include: { media: true }, orderBy: { displayOrder: 'asc' as const } },
  features: { orderBy: { displayOrder: 'asc' as const } },
  sections: { orderBy: { displayOrder: 'asc' as const } },
  technologies: { include: { technology: true } },
  assessments: {
    include: {
      tests: { orderBy: { displayOrder: 'asc' as const } },
      findings: { orderBy: { displayOrder: 'asc' as const } },
    },
    orderBy: { id: 'asc' as const },
  },
} satisfies Prisma.ProjectInclude;

export type ProjectAdminRow = Prisma.ProjectGetPayload<{ include: typeof ADMIN_INCLUDE }>;

export interface ProjectAdminListParams extends AdminCrudListParams {
  q?: string | undefined;
  status?: 'DRAFT' | 'PUBLISHED' | 'ARCHIVED' | undefined;
  category?: string | undefined;
  featured?: boolean | undefined;
  sort?: string | undefined;
  order?: 'asc' | 'desc' | undefined;
}

/** `sort` allow-list — same reasoning as `articleRepository.ts`'s own. */
function resolveOrderBy(
  sort: string | undefined,
  order: 'asc' | 'desc' | undefined,
): Prisma.ProjectOrderByWithRelationInput | Prisma.ProjectOrderByWithRelationInput[] {
  const direction = order ?? 'asc';
  switch (sort) {
    case 'title':
      return { title: direction };
    case 'publishedAt':
      return { publishedAt: direction };
    case 'createdAt':
      return { createdAt: direction };
    default:
      return [{ displayOrder: direction }, { title: 'asc' }];
  }
}

export async function list(params: ProjectAdminListParams) {
  const where: Prisma.ProjectWhereInput = {
    ...(params.status ? { status: params.status } : {}),
    ...(params.category ? { category: params.category } : {}),
    ...(params.featured !== undefined ? { featured: params.featured } : {}),
    ...(params.q
      ? { OR: [{ title: { contains: params.q } }, { slug: { contains: params.q } }] }
      : {}),
  };

  const [items, total] = await Promise.all([
    prisma.project.findMany({
      where,
      include: ADMIN_INCLUDE,
      orderBy: resolveOrderBy(params.sort, params.order),
      skip: (params.page - 1) * params.pageSize,
      take: params.pageSize,
    }),
    prisma.project.count({ where }),
  ]);

  return { items, total };
}

/** Admin read regardless of status (docs/architecture/05 §5) — `ForAdmin` suffix keeps this out of public controllers (eslint.config.mjs). Supersedes the placeholder `findAnyByIdForAdmin` this file carried since Phase 2 (no relations, no callers) — Phase 8 is the first thing that actually reads a single project for admin use, and the tabbed editor needs every relation. */
export function findByIdForAdmin(id: number, client: PrismaClientOrTx = prisma) {
  return client.project.findUnique({ where: { id }, include: ADMIN_INCLUDE });
}

export async function existsBySlug(
  slug: string,
  client: PrismaClientOrTx = prisma,
): Promise<boolean> {
  const row = await client.project.findUnique({ where: { slug }, select: { id: true } });
  return row !== null;
}

/**
 * `features` is a "replace the whole set" field (`project.ts`'s own schema
 * comment, same reasoning as `experienceRepository.ts`'s `achievements`).
 * `technologyIds`/images/sections each have their OWN dedicated endpoint
 * (doc03 §5) and are never part of this create/update — see
 * `setTechnologies`/`addImage`/`replaceSections` below.
 */
type ProjectFeatureInput = NonNullable<ProjectCreateInput['features']>[number];

function createFeaturesWrite(features: ProjectFeatureInput[] | undefined) {
  return features !== undefined
    ? {
        features: {
          create: features.map((f, index) => ({ ...stripUndefined(f), displayOrder: index })),
        },
      }
    : {};
}

function updateFeaturesWrite(features: ProjectFeatureInput[] | undefined) {
  return features !== undefined
    ? {
        features: {
          deleteMany: {},
          create: features.map((f, index) => ({ ...stripUndefined(f), displayOrder: index })),
        },
      }
    : {};
}

export async function create(data: ProjectCreateInput, client: PrismaClientOrTx = prisma) {
  const { features, ...scalars } = data;
  // Explicitly typed as the "unchecked" variant (plain scalar FK ids like
  // `coverMediaId`, not a nested `coverMedia: { connect: ... } }`) — without
  // this annotation, TS cannot decide between Prisma's two create-input
  // union members on its own once a union-typed spread (`createFeaturesWrite`'s
  // conditional return) is mixed in, and silently infers the WRONG one
  // (confirmed: `coverMediaId` typed as `never`). Same root cause
  // `experienceRepository.ts`'s own comment describes for its create/update.
  const createData: Prisma.ProjectUncheckedCreateInput = {
    ...stripUndefined(scalars),
    ...createFeaturesWrite(features),
  };
  try {
    return await client.project.create({ data: createData, include: ADMIN_INCLUDE });
  } catch (error) {
    if (isUniqueConstraintError(error))
      throw new ConflictError('A project with this slug already exists');
    throw error;
  }
}

export async function update(
  id: number,
  data: ProjectUpdateInput,
  client: PrismaClientOrTx = prisma,
) {
  const { features, ...scalars } = data;
  const updateData: Prisma.ProjectUncheckedUpdateInput = {
    ...stripUndefined(scalars),
    ...updateFeaturesWrite(features),
  };
  try {
    return await client.project.update({
      where: { id },
      data: updateData,
      include: ADMIN_INCLUDE,
    });
  } catch (error) {
    if (isUniqueConstraintError(error))
      throw new ConflictError('A project with this slug already exists');
    throw error;
  }
}

export async function remove(id: number, client: PrismaClientOrTx = prisma): Promise<void> {
  await client.project.delete({ where: { id } });
}

/** Bare status/publishedAt transition, shared by publish/unpublish/archive — same shape as `articleRepository.ts`'s own. */
export function setStatus(
  id: number,
  status: 'DRAFT' | 'PUBLISHED' | 'ARCHIVED',
  publishedAt: Date | null | undefined,
  client: PrismaClientOrTx = prisma,
) {
  return client.project.update({
    where: { id },
    data: { status, ...(publishedAt !== undefined ? { publishedAt } : {}) },
    include: ADMIN_INCLUDE,
  });
}

export function setFeatured(id: number, featured: boolean, client: PrismaClientOrTx = prisma) {
  return client.project.update({ where: { id }, data: { featured }, include: ADMIN_INCLUDE });
}

/** `PATCH /admin/projects/reorder` (doc03 §5's generic bulk-reorder shape — Project has `displayOrder`, unlike Article/SecurityResearch). */
export async function reorder(
  items: Array<{ id: number; displayOrder: number }>,
  client: PrismaClientOrTx = prisma,
): Promise<void> {
  await Promise.all(
    items.map((item) =>
      client.project.update({ where: { id: item.id }, data: { displayOrder: item.displayOrder } }),
    ),
  );
}

/** `PUT /admin/projects/:id/technologies` — the whole assignment set (doc03 §5, `project.ts`'s own schema comment: "not incremental add/remove"). */
export async function setTechnologies(
  id: number,
  technologyIds: number[],
  client: PrismaClientOrTx = prisma,
) {
  await client.projectTechnology.deleteMany({ where: { projectId: id } });
  if (technologyIds.length > 0) {
    await client.projectTechnology.createMany({
      data: technologyIds.map((technologyId) => ({ projectId: id, technologyId })),
    });
  }
  return findByIdForAdmin(id, client);
}

/** `POST /admin/projects/:id/images` — appended after whatever images already exist. */
export async function addImage(
  id: number,
  input: ProjectImageCreateInput,
  client: PrismaClientOrTx = prisma,
) {
  const maxOrder = await client.projectImage.aggregate({
    where: { projectId: id },
    _max: { displayOrder: true },
  });
  await client.projectImage.create({
    data: {
      projectId: id,
      mediaId: input.mediaId,
      ...(input.caption !== undefined ? { caption: input.caption } : {}),
      displayOrder: (maxOrder._max.displayOrder ?? -1) + 1,
    },
  });
  return findByIdForAdmin(id, client);
}

/**
 * `updateMany` per item, not `update` — `.update()`'s `where` must resolve
 * to a single unique field/index, and `ProjectImage` has no compound
 * `(id, projectId)` unique constraint to filter on both at once. `.updateMany()`
 * accepts an arbitrary filter, which is also what makes the same
 * cross-project ownership check `removeImage` needs possible here: a
 * `count` of 0 means that image id doesn't belong to this project (doc10
 * §3's "IDOR: cross-entity id substitution").
 */
export async function reorderImages(
  id: number,
  items: Array<{ id: number; displayOrder: number }>,
  client: PrismaClientOrTx = prisma,
) {
  for (const item of items) {
    const { count } = await client.projectImage.updateMany({
      where: { id: item.id, projectId: id },
      data: { displayOrder: item.displayOrder },
    });
    if (count === 0) throw new NotFoundError(`Project image ${item.id} not found`);
  }
  return findByIdForAdmin(id, client);
}

/**
 * Scoped to `projectId` explicitly, not just the image's own `id` — an
 * autoincrement PK is guessable/enumerable, and without this check an admin
 * (or a probing request) could delete an image belonging to a DIFFERENT
 * project by id alone (doc10 §3's "IDOR: cross-entity id substitution").
 * `updateMany`'s count tells us whether a row scoped to both ids actually
 * existed, without a separate read first.
 */
export async function removeImage(
  id: number,
  imageId: number,
  client: PrismaClientOrTx = prisma,
): Promise<void> {
  const { count } = await client.projectImage.deleteMany({
    where: { id: imageId, projectId: id },
  });
  if (count === 0) throw new NotFoundError('Project image not found');
}

/**
 * `PATCH /admin/projects/:id/sections` (doc07 §8's section visibility
 * manager). `BUILT_IN_SECTION_KEYS` matches `projectService.ts`'s (the
 * PUBLIC service) `BUILT_IN_SECTION_TITLES` exactly — that file, not doc02's
 * prose, is the ground truth for which keys the public renderer actually
 * treats as built-ins (confirmed by reading it: it recognises exactly these
 * seven, not `security`/`testing`, which the prose additionally names but
 * which the running renderer exposes as their own always-present DTO
 * fields, `securitySummary`/`testingSummary`, never as toggleable sections).
 *
 * A built-in entry needs no `ProjectSection` row at all — its content lives
 * in the named `Project` column, and its title is the renderer's own fixed
 * label, not admin-editable per project — so this endpoint only ever
 * touches `ProjectSection` rows for CUSTOM keys, then recomputes
 * `visibleSectionsJson` (the single source of truth for order+visibility,
 * D5) from the FULL incoming list, built-ins included.
 *
 * Custom entries omitted from `entries` are deleted — the same
 * "replace the whole set on every write" contract as `features`/
 * `achievements` elsewhere in this codebase.
 */
export const BUILT_IN_SECTION_KEYS = [
  'problem',
  'solution',
  'architecture',
  'challenges',
  'solutionsDetail',
  'lessonsLearned',
  'deploymentNotes',
] as const;

export interface ProjectSectionEntry {
  sectionKey: string;
  title?: string | undefined;
  body?: string | undefined;
  visible: boolean;
  displayOrder: number;
}

export async function replaceSections(
  id: number,
  entries: ProjectSectionEntry[],
  client: PrismaClientOrTx = prisma,
) {
  const customEntries = entries.filter(
    (entry) => !(BUILT_IN_SECTION_KEYS as readonly string[]).includes(entry.sectionKey),
  );

  await client.projectSection.deleteMany({
    where: { projectId: id, sectionKey: { notIn: customEntries.map((entry) => entry.sectionKey) } },
  });

  for (const entry of customEntries) {
    await client.projectSection.upsert({
      where: { projectId_sectionKey: { projectId: id, sectionKey: entry.sectionKey } },
      create: {
        projectId: id,
        sectionKey: entry.sectionKey,
        title: entry.title ?? entry.sectionKey,
        body: entry.body ?? null,
        displayOrder: entry.displayOrder,
        visible: entry.visible,
      },
      update: {
        title: entry.title ?? entry.sectionKey,
        body: entry.body ?? null,
        displayOrder: entry.displayOrder,
        visible: entry.visible,
      },
    });
  }

  const visibleSectionsJson = JSON.stringify(
    entries
      .filter((entry) => entry.visible)
      .sort((a, b) => a.displayOrder - b.displayOrder)
      .map((entry) => entry.sectionKey),
  );
  await client.project.update({ where: { id }, data: { visibleSectionsJson } });

  return findByIdForAdmin(id, client);
}

/** Duplicate: a new DRAFT copy of an existing project's editable fields — technologies, images and features included, never `status`/`publishedAt`/`viewCount`/`featured` (doc07 §3's "Duplicate" action). Sections are NOT copied: `visibleSectionsJson` resets to `[]` and no `ProjectSection` rows are created, since duplicating a case study wholesale (including any security summary reveal) is a bigger decision than a title/slug copy — the admin re-adds them deliberately. */
export function duplicate(
  source: ProjectAdminRow,
  slug: string,
  client: PrismaClientOrTx = prisma,
) {
  return client.project.create({
    data: {
      title: `${source.title} (Copy)`,
      slug,
      shortDescription: source.shortDescription,
      fullDescription: source.fullDescription,
      category: source.category,
      coverMediaId: source.coverMediaId,
      problem: source.problem,
      solution: source.solution,
      architecture: source.architecture,
      challenges: source.challenges,
      solutionsDetail: source.solutionsDetail,
      lessonsLearned: source.lessonsLearned,
      deploymentNotes: source.deploymentNotes,
      githubUrl: source.githubUrl,
      liveUrl: source.liveUrl,
      securityTested: source.securityTested,
      securitySummary: source.securitySummary,
      testingSummary: source.testingSummary,
      status: 'DRAFT',
      technologies: { create: source.technologies.map(({ technologyId }) => ({ technologyId })) },
      images: {
        create: source.images.map((image) => ({
          mediaId: image.mediaId,
          caption: image.caption,
          displayOrder: image.displayOrder,
        })),
      },
      features: {
        create: source.features.map((feature) => ({
          title: feature.title,
          description: feature.description,
          displayOrder: feature.displayOrder,
        })),
      },
    },
    include: ADMIN_INCLUDE,
  });
}
