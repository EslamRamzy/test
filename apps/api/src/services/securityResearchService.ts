import type {
  SecurityResearchDetailDto,
  SecurityResearchListItemDto,
  SecurityResearchListQuery,
} from '@portfolio/shared';
import { buildPaginationMeta } from '../lib/httpResponse.js';
import { toPublicMediaRefOrNull } from '../lib/mediaUrl.js';
import * as researchRepository from '../repositories/securityResearchRepository.js';

type ListRow = Awaited<ReturnType<typeof researchRepository.findPublishedList>>['items'][number];

function toListItemDto(row: ListRow): SecurityResearchListItemDto {
  return {
    id: row.id,
    title: row.title,
    slug: row.slug,
    description: row.description,
    category: row.category as SecurityResearchListItemDto['category'],
    coverMedia: toPublicMediaRefOrNull(row.coverMedia),
    tags: row.tags.map(({ tag }) => tag),
    publishedAt: row.publishedAt ? row.publishedAt.toISOString() : null,
  };
}

export async function listResearch(query: SecurityResearchListQuery) {
  const { items, total } = await researchRepository.findPublishedList({
    category: query.category,
    tagSlug: query.tag,
    page: query.page,
    pageSize: query.pageSize,
    sort: query.sort,
    order: query.order,
  });
  return {
    items: items.map(toListItemDto),
    meta: buildPaginationMeta(query.page, query.pageSize, total),
  };
}

export async function getResearchBySlug(slug: string): Promise<SecurityResearchDetailDto | null> {
  const research = await researchRepository.findPublishedBySlug(slug);
  if (!research) return null;

  return { ...toListItemDto(research), content: research.content, references: research.references };
}

export async function getLatestResearch(limit: number): Promise<SecurityResearchListItemDto[]> {
  const rows = await researchRepository.findLatestPublished(limit);
  return rows.map(toListItemDto);
}
