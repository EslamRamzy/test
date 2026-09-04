import type {
  ApiFieldError,
  ArticleCreateInput,
  ArticleDetailDto,
  ArticleListItemDto,
  ArticleListQuery,
  ArticleUpdateInput,
} from '@portfolio/shared';
import { prisma } from '../config/prisma.js';
import { ConflictError, NotFoundError, ValidationError } from '../errors/AppError.js';
import { buildPaginationMeta } from '../lib/httpResponse.js';
import { toPublicMediaRefOrNull } from '../lib/mediaUrl.js';
import { computeReadingTimeMinutes } from '../lib/readingTime.js';
import { revalidateTags } from '../lib/revalidate.js';
import { generateDuplicateSlug } from '../lib/slug.js';
import * as articleRepository from '../repositories/articleRepository.js';
import type { ArticleAdminListParams, ArticleAdminRow } from '../repositories/articleRepository.js';
import * as auditLogRepository from '../repositories/auditLogRepository.js';
import type { AdminCrudActor } from './adminCrudFactory.js';

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

// --- Admin CRUD + publish workflow (docs/architecture/07 §4) ---------------
//
// Not built on `services/adminCrudFactory.ts` (unlike the simple modules) —
// `create`/`update` need `actor.id` threaded into the repository call
// itself (as `authorId`, and to derive `readingTimeMinutes`), which that
// factory's `repository.create(data, client?)` signature has no slot for.
// `list`/read are still the identical shape, just hand-written here rather
// than fighting the factory's types to reuse two thin functions.

export async function listArticlesForAdmin(params: ArticleAdminListParams) {
  const { items, total } = await articleRepository.list(params);
  return { items, meta: buildPaginationMeta(params.page, params.pageSize, total) };
}

export async function getArticleForAdmin(id: number): Promise<ArticleAdminRow> {
  const row = await articleRepository.findByIdForAdmin(id);
  if (!row) throw new NotFoundError('Article not found');
  return row;
}

export async function createArticle(
  data: ArticleCreateInput,
  actor: AdminCrudActor,
): Promise<ArticleAdminRow> {
  const readingTimeMinutes = computeReadingTimeMinutes(data.content);
  return prisma.$transaction(async (tx) => {
    const row = await articleRepository.create(
      { ...data, authorId: actor.id, readingTimeMinutes },
      tx,
    );
    await auditLogRepository.record(
      { userId: actor.id, action: 'ARTICLE_CREATE', entityType: 'ARTICLE', entityId: row.id },
      tx,
    );
    return row;
  });
}

export async function updateArticle(
  id: number,
  data: ArticleUpdateInput,
  actor: AdminCrudActor,
): Promise<ArticleAdminRow> {
  const row = await prisma.$transaction(async (tx) => {
    const existing = await articleRepository.findByIdForAdmin(id, tx);
    if (!existing) throw new NotFoundError('Article not found');

    // Recomputed only when `content` is actually part of this patch — see
    // `ArticleAdminUpdateData`'s own comment on why this stays undefined
    // (not merely "unchanged") otherwise.
    const readingTimeMinutes =
      data.content !== undefined ? computeReadingTimeMinutes(data.content) : undefined;

    const updated = await articleRepository.update(
      id,
      { ...data, ...(readingTimeMinutes !== undefined ? { readingTimeMinutes } : {}) },
      tx,
    );
    await auditLogRepository.record(
      { userId: actor.id, action: 'ARTICLE_UPDATE', entityType: 'ARTICLE', entityId: id },
      tx,
    );
    return updated;
  });

  // A plain field edit to an already-published article (fixing a typo,
  // swapping the cover image) leaves stale content on the live public page
  // otherwise — publish/unpublish/archive are not the only actions that can
  // change what a published row's public page should show.
  if (row.status === 'PUBLISHED') await revalidateTags(['articles', `article:${row.slug}`]);
  return row;
}

export async function removeArticle(id: number, actor: AdminCrudActor): Promise<void> {
  await prisma.$transaction(async (tx) => {
    const existing = await articleRepository.findByIdForAdmin(id, tx);
    if (!existing) throw new NotFoundError('Article not found');
    // Doc07 §4's state diagram has no `PUBLISHED -> [*]: delete` transition
    // — only DRAFT and ARCHIVED may be deleted; a published article must be
    // unpublished or archived first.
    if (existing.status === 'PUBLISHED') {
      throw new ConflictError(
        'A published article must be unpublished or archived before it can be deleted',
      );
    }
    await articleRepository.remove(id, tx);
    await auditLogRepository.record(
      { userId: actor.id, action: 'ARTICLE_DELETE', entityType: 'ARTICLE', entityId: id },
      tx,
    );
  });
}

/**
 * Doc07 §4's readiness check, adapted to the fields Article actually has
 * (the doc's own wording — "missing cover image... no technologies, empty
 * case-study body" — is written for Projects; `title`/`slug`/`content` are
 * already non-optional on every write here, so the only fields that can
 * realistically be absent at publish time are the three checked below).
 */
function checkPublishReadiness(article: ArticleAdminRow): void {
  const details: ApiFieldError[] = [];
  if (!article.coverMediaId) {
    details.push({ field: 'coverMediaId', message: 'A cover image is required to publish' });
  }
  if (!article.excerpt) {
    details.push({ field: 'excerpt', message: 'A short description is required to publish' });
  }
  if (!article.categoryId) {
    details.push({ field: 'categoryId', message: 'A category is required to publish' });
  }
  if (details.length > 0) {
    throw new ValidationError(details, 'Article is not ready to publish');
  }
}

export async function publishArticle(id: number, actor: AdminCrudActor): Promise<ArticleAdminRow> {
  const existing = await articleRepository.findByIdForAdmin(id);
  if (!existing) throw new NotFoundError('Article not found');
  if (existing.status !== 'DRAFT') {
    throw new ConflictError(
      `Only a draft article can be published (current status: ${existing.status})`,
    );
  }
  checkPublishReadiness(existing);

  const row = await prisma.$transaction(async (tx) => {
    // `publishedAt` may already be set to a future date (scheduling, doc07
    // §4) — only defaulted to now when the admin never set one.
    const updated = await articleRepository.setStatus(
      id,
      'PUBLISHED',
      existing.publishedAt ?? new Date(),
      tx,
    );
    await auditLogRepository.record(
      { userId: actor.id, action: 'ARTICLE_PUBLISH', entityType: 'ARTICLE', entityId: id },
      tx,
    );
    return updated;
  });

  await revalidateTags(['articles', `article:${row.slug}`]);
  return row;
}

/** Handles both `PUBLISHED -> DRAFT` (unpublish) and `ARCHIVED -> DRAFT` (restore) — doc03 §5 names one endpoint, `POST .../unpublish`, for what doc07 §4's diagram draws as two differently-labelled transitions; see `articles.routes.ts`'s own comment. */
export async function unpublishArticle(
  id: number,
  actor: AdminCrudActor,
): Promise<ArticleAdminRow> {
  const existing = await articleRepository.findByIdForAdmin(id);
  if (!existing) throw new NotFoundError('Article not found');
  if (existing.status === 'DRAFT') {
    throw new ConflictError('Article is already a draft');
  }

  const row = await prisma.$transaction(async (tx) => {
    // `publishedAt` is left untouched — doc07 §4 never says unpublishing
    // clears the schedule, and preserving it means a re-publish without a
    // new date change keeps the original publication date.
    const updated = await articleRepository.setStatus(id, 'DRAFT', undefined, tx);
    await auditLogRepository.record(
      { userId: actor.id, action: 'ARTICLE_UNPUBLISH', entityType: 'ARTICLE', entityId: id },
      tx,
    );
    return updated;
  });

  await revalidateTags(['articles', `article:${row.slug}`]);
  return row;
}

export async function archiveArticle(id: number, actor: AdminCrudActor): Promise<ArticleAdminRow> {
  const existing = await articleRepository.findByIdForAdmin(id);
  if (!existing) throw new NotFoundError('Article not found');
  if (existing.status !== 'PUBLISHED') {
    throw new ConflictError('Only a published article can be archived');
  }

  const row = await prisma.$transaction(async (tx) => {
    const updated = await articleRepository.setStatus(id, 'ARCHIVED', undefined, tx);
    await auditLogRepository.record(
      { userId: actor.id, action: 'ARTICLE_ARCHIVE', entityType: 'ARTICLE', entityId: id },
      tx,
    );
    return updated;
  });

  await revalidateTags(['articles', `article:${row.slug}`]);
  return row;
}

/** Always creates a DRAFT — never publicly visible, so no revalidation call. */
export async function duplicateArticle(
  id: number,
  actor: AdminCrudActor,
): Promise<ArticleAdminRow> {
  const source = await articleRepository.findByIdForAdmin(id);
  if (!source) throw new NotFoundError('Article not found');

  const slug = await generateDuplicateSlug(source.slug, (candidate) =>
    articleRepository.existsBySlug(candidate),
  );

  return prisma.$transaction(async (tx) => {
    const created = await articleRepository.duplicate(source, slug, actor.id, tx);
    await auditLogRepository.record(
      {
        userId: actor.id,
        action: 'ARTICLE_DUPLICATE',
        entityType: 'ARTICLE',
        entityId: created.id,
      },
      tx,
    );
    return created;
  });
}
