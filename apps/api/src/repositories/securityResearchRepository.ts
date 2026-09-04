import type { Prisma } from '../../generated/prisma/client.js';
import { prisma } from '../config/prisma.js';

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
