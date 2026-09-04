import type { ArticleDetailDto, ArticleListItemDto, ArticleListQuery } from '@portfolio/shared';
import { buildPaginationMeta } from '../lib/httpResponse.js';
import { toPublicMediaRefOrNull } from '../lib/mediaUrl.js';
import * as articleRepository from '../repositories/articleRepository.js';

type ListRow = Awaited<ReturnType<typeof articleRepository.findPublishedList>>['items'][number];

function toListItemDto(row: ListRow): ArticleListItemDto {
  return {
    id: row.id,
    title: row.title,
    slug: row.slug,
    excerpt: row.excerpt,
    coverMedia: toPublicMediaRefOrNull(row.coverMedia),
    category: row.category,
    tags: row.tags.map(({ tag }) => tag),
    readingTimeMinutes: row.readingTimeMinutes,
    publishedAt: row.publishedAt ? row.publishedAt.toISOString() : null,
  };
}

export async function listArticles(query: ArticleListQuery) {
  const { items, total } = await articleRepository.findPublishedList({
    categorySlug: query.category,
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

export interface ArticleWithRelated {
  article: ArticleDetailDto;
  related: ArticleListItemDto[];
}

/** Doc 03 §3: "GET /articles/:slug — + related articles." */
export async function getArticleBySlug(slug: string): Promise<ArticleWithRelated | null> {
  const article = await articleRepository.findPublishedBySlug(slug);
  if (!article) return null;

  const related = await articleRepository.findRelated(article.id, article.category?.id ?? null, 3);

  return {
    article: { ...toListItemDto(article), content: article.content },
    related: related.map(toListItemDto),
  };
}

export async function getLatestArticles(limit: number): Promise<ArticleListItemDto[]> {
  const rows = await articleRepository.findLatestPublished(limit);
  return rows.map(toListItemDto);
}
