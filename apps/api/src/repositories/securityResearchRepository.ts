import type { SecurityResearchCreateInput, SecurityResearchUpdateInput } from '@portfolio/shared';
import type { Prisma } from '../../generated/prisma/client.js';
import { prisma } from '../config/prisma.js';
import type { PrismaClientOrTx } from '../config/prisma.js';
import { ConflictError } from '../errors/AppError.js';
import { stripUndefined } from '../lib/stripUndefined.js';
import type { AdminCrudListParams } from '../services/adminCrudFactory.js';
import { isUniqueConstraintError } from './prismaErrors.js';

const PUBLIC_RESEARCH_SELECT = {
  id: true,
  title: true,
  slug: true,
  description: true,
  category: true,
  publishedAt: true,
  coverMedia: { select: { id: true, filename: true, altText: true, width: true, height: true } },
  tags: { select: { tag: { select: { id: true, name: true, slug: true } } } },
} satisfies Prisma.SecurityResearchSelect;

type ResearchSortKey = 'publishedAt' | 'title';

function buildOrderBy(
  sort: ResearchSortKey,
  order: 'asc' | 'desc',
): Prisma.SecurityResearchOrderByWithRelationInput {
  return { [sort]: order };
}

export interface ResearchListFilter {
  category: string | undefined;
  tagSlug: string | undefined;
  page: number;
  pageSize: number;
  sort: ResearchSortKey;
  order: 'asc' | 'desc';
}

function publishedWhere(
  extra: Prisma.SecurityResearchWhereInput = {},
): Prisma.SecurityResearchWhereInput {
  return { status: 'PUBLISHED', publishedAt: { lte: new Date() }, ...extra };
}

export async function findPublishedList(filter: ResearchListFilter) {
  const where = publishedWhere({
    ...(filter.category ? { category: filter.category } : {}),
    ...(filter.tagSlug ? { tags: { some: { tag: { slug: filter.tagSlug } } } } : {}),
  });

  const [items, total] = await Promise.all([
    prisma.securityResearch.findMany({
      where,
      select: PUBLIC_RESEARCH_SELECT,
      orderBy: buildOrderBy(filter.sort, filter.order),
      skip: (filter.page - 1) * filter.pageSize,
      take: filter.pageSize,
    }),
    prisma.securityResearch.count({ where }),
  ]);

  return { items, total };
}

export function findPublishedBySlug(slug: string) {
  return prisma.securityResearch.findFirst({
    where: publishedWhere({ slug }),
    select: {
      ...PUBLIC_RESEARCH_SELECT,
      content: true,
      references: { select: { label: true, url: true }, orderBy: { displayOrder: 'asc' } },
    },
  });
}

export function findLatestPublished(limit: number) {
  return prisma.securityResearch.findMany({
    where: publishedWhere(),
    select: PUBLIC_RESEARCH_SELECT,
    orderBy: { publishedAt: 'desc' },
    take: limit,
  });
}

export function countPublished() {
  return prisma.securityResearch.count({ where: publishedWhere() });
}

/** slug + updatedAt only, for `GET /sitemap-data` (docs/architecture/03 §3). */
export function findSlugsForSitemap() {
  return prisma.securityResearch.findMany({
    where: publishedWhere(),
    select: { slug: true, updatedAt: true },
  });
}

// --- Admin CRUD + publish workflow (docs/architecture/03 §5, 07 §4) --------

const ADMIN_INCLUDE = {
  coverMedia: { select: { id: true, filename: true, altText: true, width: true, height: true } },
  tags: { include: { tag: true } },
  references: { orderBy: { displayOrder: 'asc' as const } },
} satisfies Prisma.SecurityResearchInclude;

export type SecurityResearchAdminRow = Prisma.SecurityResearchGetPayload<{
  include: typeof ADMIN_INCLUDE;
}>;

export interface SecurityResearchAdminListParams extends AdminCrudListParams {
  q?: string | undefined;
  status?: 'DRAFT' | 'PUBLISHED' | 'ARCHIVED' | undefined;
  category?: string | undefined;
  sort?: string | undefined;
  order?: 'asc' | 'desc' | undefined;
}

/** `sort` allow-list — same reasoning as `articleRepository.ts`'s own. */
function resolveOrderBy(
  sort: string | undefined,
  order: 'asc' | 'desc' | undefined,
): Prisma.SecurityResearchOrderByWithRelationInput {
  const direction = order ?? 'desc';
  switch (sort) {
    case 'title':
      return { title: direction };
    case 'publishedAt':
      return { publishedAt: direction };
    case 'createdAt':
      return { createdAt: direction };
    default:
      return { updatedAt: direction };
  }
}

export async function list(params: SecurityResearchAdminListParams) {
  const where: Prisma.SecurityResearchWhereInput = {
    ...(params.status ? { status: params.status } : {}),
    ...(params.category ? { category: params.category } : {}),
    ...(params.q
      ? { OR: [{ title: { contains: params.q } }, { slug: { contains: params.q } }] }
      : {}),
  };

  const [items, total] = await Promise.all([
    prisma.securityResearch.findMany({
      where,
      include: ADMIN_INCLUDE,
      orderBy: resolveOrderBy(params.sort, params.order),
      skip: (params.page - 1) * params.pageSize,
      take: params.pageSize,
    }),
    prisma.securityResearch.count({ where }),
  ]);

  return { items, total };
}

/** Admin read regardless of status (docs/architecture/05 §5) — `ForAdmin` suffix keeps this out of public controllers (eslint.config.mjs). */
export function findByIdForAdmin(id: number, client: PrismaClientOrTx = prisma) {
  return client.securityResearch.findUnique({ where: { id }, include: ADMIN_INCLUDE });
}

export async function existsBySlug(
  slug: string,
  client: PrismaClientOrTx = prisma,
): Promise<boolean> {
  const row = await client.securityResearch.findUnique({ where: { slug }, select: { id: true } });
  return row !== null;
}

/**
 * `tagIds` and `references` are both "replace the whole set" fields (same
 * reasoning as `experienceRepository.ts`'s `achievements`/`technologyIds` —
 * `securityResearch.ts`'s own schema comment says so for both). `create`
 * and `update` need different nested-write shapes for the identical reason
 * that file documents: `deleteMany` is only valid inside an UPDATE.
 */
function createRelationWrites(
  tagIds: number[] | undefined,
  references: Array<{ label: string; url: string }> | undefined,
) {
  return {
    ...(tagIds !== undefined ? { tags: { create: tagIds.map((tagId) => ({ tagId })) } } : {}),
    ...(references !== undefined
      ? {
          references: {
            create: references.map((ref, index) => ({ ...ref, displayOrder: index })),
          },
        }
      : {}),
  };
}

function updateRelationWrites(
  tagIds: number[] | undefined,
  references: Array<{ label: string; url: string }> | undefined,
) {
  return {
    ...(tagIds !== undefined
      ? { tags: { deleteMany: {}, create: tagIds.map((tagId) => ({ tagId })) } }
      : {}),
    ...(references !== undefined
      ? {
          references: {
            deleteMany: {},
            create: references.map((ref, index) => ({ ...ref, displayOrder: index })),
          },
        }
      : {}),
  };
}

export async function create(data: SecurityResearchCreateInput, client: PrismaClientOrTx = prisma) {
  const { tagIds, references, ...scalars } = data;
  try {
    return await client.securityResearch.create({
      data: { ...stripUndefined(scalars), ...createRelationWrites(tagIds, references) },
      include: ADMIN_INCLUDE,
    });
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      throw new ConflictError('A security research entry with this slug already exists');
    }
    throw error;
  }
}

export async function update(
  id: number,
  data: SecurityResearchUpdateInput,
  client: PrismaClientOrTx = prisma,
) {
  const { tagIds, references, ...scalars } = data;
  try {
    return await client.securityResearch.update({
      where: { id },
      data: { ...stripUndefined(scalars), ...updateRelationWrites(tagIds, references) },
      include: ADMIN_INCLUDE,
    });
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      throw new ConflictError('A security research entry with this slug already exists');
    }
    throw error;
  }
}

export async function remove(id: number, client: PrismaClientOrTx = prisma): Promise<void> {
  await client.securityResearch.delete({ where: { id } });
}

/** Bare status/publishedAt transition, shared by publish/unpublish/archive — same shape as `articleRepository.ts`'s own. */
export function setStatus(
  id: number,
  status: 'DRAFT' | 'PUBLISHED' | 'ARCHIVED',
  publishedAt: Date | null | undefined,
  client: PrismaClientOrTx = prisma,
) {
  return client.securityResearch.update({
    where: { id },
    data: { status, ...(publishedAt !== undefined ? { publishedAt } : {}) },
    include: ADMIN_INCLUDE,
  });
}

/** Duplicate: a new DRAFT copy of an existing entry's editable fields, references included — never the original's `status`/`publishedAt`/`viewCount` (doc07 §3's "Duplicate" action). */
export function duplicate(
  source: SecurityResearchAdminRow,
  slug: string,
  client: PrismaClientOrTx = prisma,
) {
  return client.securityResearch.create({
    data: {
      title: `${source.title} (Copy)`,
      slug,
      description: source.description,
      content: source.content,
      category: source.category,
      coverMediaId: source.coverMediaId,
      status: 'DRAFT',
      tags: { create: source.tags.map(({ tagId }) => ({ tagId })) },
      references: {
        create: source.references.map((ref) => ({
          label: ref.label,
          url: ref.url,
          displayOrder: ref.displayOrder,
        })),
      },
    },
    include: ADMIN_INCLUDE,
  });
}
