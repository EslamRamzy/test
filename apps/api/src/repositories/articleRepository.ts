import type { Prisma } from '../../generated/prisma/client.js';
import { prisma } from '../config/prisma.js';

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
