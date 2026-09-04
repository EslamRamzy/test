import type { ArticleCreateInput, ArticleUpdateInput } from '@portfolio/shared';
import type { Prisma } from '../../generated/prisma/client.js';
import { prisma } from '../config/prisma.js';
import type { PrismaClientOrTx } from '../config/prisma.js';
import { ConflictError } from '../errors/AppError.js';
import { stripUndefined } from '../lib/stripUndefined.js';
import type { AdminCrudListParams } from '../services/adminCrudFactory.js';
import { isUniqueConstraintError } from './prismaErrors.js';

/**
 * Public article reads (docs/architecture/02 §4, docs/architecture/05 §5).
 * Every function here hardcodes `status: 'PUBLISHED'` and `publishedAt: {
 * lte: now}` — there is no parameter that could disable that filter, the
 * same draft-visibility pattern `projectRepository.ts` established in
 * Phase 2. Admin-facing reads (`*ForAdmin`) arrive with Phase 8's content
 * management.
 */

const PUBLIC_ARTICLE_SELECT = {
  id: true,
  title: true,
  slug: true,
  excerpt: true,
  readingTimeMinutes: true,
  publishedAt: true,
  coverMedia: { select: { id: true, filename: true, altText: true, width: true, height: true } },
  category: { select: { id: true, name: true, slug: true, description: true } },
  tags: { select: { tag: { select: { id: true, name: true, slug: true } } } },
} satisfies Prisma.ArticleSelect;

type ArticleSortKey = 'publishedAt' | 'title';

function buildOrderBy(
  sort: ArticleSortKey,
  order: 'asc' | 'desc',
): Prisma.ArticleOrderByWithRelationInput {
  return { [sort]: order };
}

export interface ArticleListFilter {
  categorySlug: string | undefined;
  tagSlug: string | undefined;
  page: number;
  pageSize: number;
  sort: ArticleSortKey;
  order: 'asc' | 'desc';
}

function publishedWhere(extra: Prisma.ArticleWhereInput = {}): Prisma.ArticleWhereInput {
  return { status: 'PUBLISHED', publishedAt: { lte: new Date() }, ...extra };
}

export async function findPublishedList(filter: ArticleListFilter) {
  const where = publishedWhere({
    ...(filter.categorySlug ? { category: { slug: filter.categorySlug } } : {}),
    ...(filter.tagSlug ? { tags: { some: { tag: { slug: filter.tagSlug } } } } : {}),
  });

  const [items, total] = await Promise.all([
    prisma.article.findMany({
      where,
      select: PUBLIC_ARTICLE_SELECT,
      orderBy: buildOrderBy(filter.sort, filter.order),
      skip: (filter.page - 1) * filter.pageSize,
      take: filter.pageSize,
    }),
    prisma.article.count({ where }),
  ]);

  return { items, total };
}

export function findPublishedBySlug(slug: string) {
  return prisma.article.findFirst({
    where: publishedWhere({ slug }),
    select: { ...PUBLIC_ARTICLE_SELECT, content: true },
  });
}

export function findRelated(articleId: number, categoryId: number | null, limit: number) {
  return prisma.article.findMany({
    where: publishedWhere({ id: { not: articleId }, ...(categoryId ? { categoryId } : {}) }),
    select: PUBLIC_ARTICLE_SELECT,
    orderBy: { publishedAt: 'desc' },
    take: limit,
  });
}

export function findLatestPublished(limit: number) {
  return prisma.article.findMany({
    where: publishedWhere(),
    select: PUBLIC_ARTICLE_SELECT,
    orderBy: { publishedAt: 'desc' },
    take: limit,
  });
}

export function countPublished() {
  return prisma.article.count({ where: publishedWhere() });
}

/** Admin dashboard counter: every article regardless of status. `ForAdmin`-suffixed (see docs/architecture/05 §5). */
export function countAllForAdmin() {
  return prisma.article.count();
}

/** slug + updatedAt only, for `GET /sitemap-data` (docs/architecture/03 §3). */
export function findSlugsForSitemap() {
  return prisma.article.findMany({
    where: publishedWhere(),
    select: { slug: true, updatedAt: true },
  });
}

// --- Admin CRUD + publish workflow (docs/architecture/03 §5, 07 §4) --------

const ADMIN_INCLUDE = {
  coverMedia: { select: { id: true, filename: true, altText: true, width: true, height: true } },
  author: { select: { id: true, name: true } },
  category: true,
  tags: { include: { tag: true } },
} satisfies Prisma.ArticleInclude;

export type ArticleAdminRow = Prisma.ArticleGetPayload<{ include: typeof ADMIN_INCLUDE }>;

export interface ArticleAdminListParams extends AdminCrudListParams {
  q?: string | undefined;
  status?: 'DRAFT' | 'PUBLISHED' | 'ARCHIVED' | undefined;
  sort?: string | undefined;
  order?: 'asc' | 'desc' | undefined;
}

/** `sort` allow-list (same reasoning as `technologyRepository.ts`'s own) — an attacker-controlled string never reaches Prisma's query builder as anything but one of these literal orderBy shapes. */
function resolveOrderBy(
  sort: string | undefined,
  order: 'asc' | 'desc' | undefined,
): Prisma.ArticleOrderByWithRelationInput {
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

export async function list(params: ArticleAdminListParams) {
  const where: Prisma.ArticleWhereInput = {
    ...(params.status ? { status: params.status } : {}),
    ...(params.q
      ? { OR: [{ title: { contains: params.q } }, { slug: { contains: params.q } }] }
      : {}),
  };

  const [items, total] = await Promise.all([
    prisma.article.findMany({
      where,
      include: ADMIN_INCLUDE,
      orderBy: resolveOrderBy(params.sort, params.order),
      skip: (params.page - 1) * params.pageSize,
      take: params.pageSize,
    }),
    prisma.article.count({ where }),
  ]);

  return { items, total };
}

/** Admin read regardless of status (docs/architecture/05 §5) — the `ForAdmin` suffix is what the lint rule in `eslint.config.mjs` keys off to keep this unreachable from public controllers. */
export function findByIdForAdmin(id: number, client: PrismaClientOrTx = prisma) {
  return client.article.findUnique({ where: { id }, include: ADMIN_INCLUDE });
}

/** For `lib/slug.ts`'s duplicate-slug generator — the only place this repository checks slug existence without also reading the whole row. */
export async function existsBySlug(
  slug: string,
  client: PrismaClientOrTx = prisma,
): Promise<boolean> {
  const row = await client.article.findUnique({ where: { slug }, select: { id: true } });
  return row !== null;
}

/**
 * `tagIds` is a "replace the whole set" field (same reasoning as
 * `experienceRepository.ts`'s `achievements`/`technologyIds`) — Prisma has
 * no `set` primitive for an explicit many-to-many join table
 * (`ArticleTag`), only `create`/`deleteMany`/nested writes. `create` and
 * `update` need different nested-write shapes for the identical reason
 * that file documents: `deleteMany` is only a valid nested action inside
 * an UPDATE, never a CREATE.
 */
function createTagsWrite(tagIds: number[] | undefined) {
  return tagIds !== undefined ? { tags: { create: tagIds.map((tagId) => ({ tagId })) } } : {};
}

function updateTagsWrite(tagIds: number[] | undefined) {
  return tagIds !== undefined
    ? { tags: { deleteMany: {}, create: tagIds.map((tagId) => ({ tagId })) } }
    : {};
}

/**
 * The repository-level create/update shapes add two fields the Zod schema
 * deliberately excludes (`article.ts`'s own comment): `authorId` (the
 * acting admin, injected by the service from `req.user`, never
 * client-supplied) and `readingTimeMinutes` (computed by the service from
 * `content`, via `lib/readingTime.ts`).
 */
export type ArticleAdminCreateData = ArticleCreateInput & {
  authorId: number;
  readingTimeMinutes: number;
};

/** `readingTimeMinutes` is optional here, unlike on create — the service only recomputes it when `content` is actually part of the patch; omitted (not merely unchanged) otherwise so `stripUndefined` leaves the column untouched. */
export type ArticleAdminUpdateData = ArticleUpdateInput & { readingTimeMinutes?: number };

export async function create(data: ArticleAdminCreateData, client: PrismaClientOrTx = prisma) {
  const { tagIds, ...scalars } = data;
  try {
    return await client.article.create({
      data: { ...stripUndefined(scalars), ...createTagsWrite(tagIds) },
      include: ADMIN_INCLUDE,
    });
  } catch (error) {
    if (isUniqueConstraintError(error))
      throw new ConflictError('An article with this slug already exists');
    throw error;
  }
}

export async function update(
  id: number,
  data: ArticleAdminUpdateData,
  client: PrismaClientOrTx = prisma,
) {
  const { tagIds, ...scalars } = data;
  try {
    return await client.article.update({
      where: { id },
      data: { ...stripUndefined(scalars), ...updateTagsWrite(tagIds) },
      include: ADMIN_INCLUDE,
    });
  } catch (error) {
    if (isUniqueConstraintError(error))
      throw new ConflictError('An article with this slug already exists');
    throw error;
  }
}

export async function remove(id: number, client: PrismaClientOrTx = prisma): Promise<void> {
  await client.article.delete({ where: { id } });
}

/** Bare status/publishedAt transition, shared by publish/unpublish/archive — the editorial-state part of the write is always exactly this shape (doc07 §4); only which status and whether `publishedAt` also changes differs per caller. */
export function setStatus(
  id: number,
  status: 'DRAFT' | 'PUBLISHED' | 'ARCHIVED',
  publishedAt: Date | null | undefined,
  client: PrismaClientOrTx = prisma,
) {
  return client.article.update({
    where: { id },
    data: { status, ...(publishedAt !== undefined ? { publishedAt } : {}) },
    include: ADMIN_INCLUDE,
  });
}

/** Duplicate: a new DRAFT copy of an existing article's editable fields — never the original's `status`/`publishedAt`/`viewCount`, and a fresh, collision-safe slug (doc07 §3's "Duplicate" action). */
export function duplicate(
  source: ArticleAdminRow,
  slug: string,
  authorId: number,
  client: PrismaClientOrTx = prisma,
) {
  return client.article.create({
    data: {
      title: `${source.title} (Copy)`,
      slug,
      excerpt: source.excerpt,
      content: source.content,
      coverMediaId: source.coverMediaId,
      categoryId: source.categoryId,
      authorId,
      readingTimeMinutes: source.readingTimeMinutes,
      status: 'DRAFT',
      tags: { create: source.tags.map(({ tagId }) => ({ tagId })) },
    },
    include: ADMIN_INCLUDE,
  });
}
