import type {
  ApiFieldError,
  SecurityResearchCreateInput,
  SecurityResearchDetailDto,
  SecurityResearchListItemDto,
  SecurityResearchListQuery,
  SecurityResearchUpdateInput,
} from '@portfolio/shared';
import { prisma } from '../config/prisma.js';
import { ConflictError, NotFoundError, ValidationError } from '../errors/AppError.js';
import { buildPaginationMeta } from '../lib/httpResponse.js';
import { toPublicMediaRefOrNull } from '../lib/mediaUrl.js';
import { revalidateTags } from '../lib/revalidate.js';
import { generateDuplicateSlug } from '../lib/slug.js';
import * as researchRepository from '../repositories/securityResearchRepository.js';
import type {
  SecurityResearchAdminListParams,
  SecurityResearchAdminRow,
} from '../repositories/securityResearchRepository.js';
import * as auditLogRepository from '../repositories/auditLogRepository.js';
import type { AdminCrudActor } from './adminCrudFactory.js';

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

// --- Admin CRUD + publish workflow (docs/architecture/07 §4) ---------------
//
// Simpler than `articleService.ts`'s admin half — `SecurityResearch` has no
// `authorId` and no computed field like `readingTimeMinutes`, so
// create/update need nothing threaded in beyond the plain Zod input. Still
// hand-written rather than `createAdminCrudService` for consistency with
// every other publish-workflow resource, and because the delete guard and
// revalidation calls below don't fit that factory's shape either.

export async function listResearchForAdmin(params: SecurityResearchAdminListParams) {
  const { items, total } = await researchRepository.list(params);
  return { items, meta: buildPaginationMeta(params.page, params.pageSize, total) };
}

export async function getResearchForAdmin(id: number): Promise<SecurityResearchAdminRow> {
  const row = await researchRepository.findByIdForAdmin(id);
  if (!row) throw new NotFoundError('Security research entry not found');
  return row;
}

export async function createResearch(
  data: SecurityResearchCreateInput,
  actor: AdminCrudActor,
): Promise<SecurityResearchAdminRow> {
  return prisma.$transaction(async (tx) => {
    const row = await researchRepository.create(data, tx);
    await auditLogRepository.record(
      { userId: actor.id, action: 'RESEARCH_CREATE', entityType: 'RESEARCH', entityId: row.id },
      tx,
    );
    return row;
  });
}

export async function updateResearch(
  id: number,
  data: SecurityResearchUpdateInput,
  actor: AdminCrudActor,
): Promise<SecurityResearchAdminRow> {
  const row = await prisma.$transaction(async (tx) => {
    const existing = await researchRepository.findByIdForAdmin(id, tx);
    if (!existing) throw new NotFoundError('Security research entry not found');
    const updated = await researchRepository.update(id, data, tx);
    await auditLogRepository.record(
      { userId: actor.id, action: 'RESEARCH_UPDATE', entityType: 'RESEARCH', entityId: id },
      tx,
    );
    return updated;
  });

  // Same reasoning as `articleService.updateArticle` — a plain field edit
  // to an already-published entry can leave the live page stale.
  if (row.status === 'PUBLISHED') await revalidateTags(['research', `research:${row.slug}`]);
  return row;
}

export async function removeResearch(id: number, actor: AdminCrudActor): Promise<void> {
  await prisma.$transaction(async (tx) => {
    const existing = await researchRepository.findByIdForAdmin(id, tx);
    if (!existing) throw new NotFoundError('Security research entry not found');
    // Doc07 §4's state diagram has no `PUBLISHED -> [*]: delete` transition.
    if (existing.status === 'PUBLISHED') {
      throw new ConflictError(
        'A published entry must be unpublished or archived before it can be deleted',
      );
    }
    await researchRepository.remove(id, tx);
    await auditLogRepository.record(
      { userId: actor.id, action: 'RESEARCH_DELETE', entityType: 'RESEARCH', entityId: id },
      tx,
    );
  });
}

/**
 * Doc07 §4's readiness check, adapted to what this entity actually has —
 * `category` is required at create time already (`securityResearchCreateSchema`
 * has no `.optional()` on it), so only these two fields can realistically be
 * absent at publish time.
 */
function checkPublishReadiness(research: SecurityResearchAdminRow): void {
  const details: ApiFieldError[] = [];
  if (!research.coverMediaId) {
    details.push({ field: 'coverMediaId', message: 'A cover image is required to publish' });
  }
  if (!research.description) {
    details.push({ field: 'description', message: 'A short description is required to publish' });
  }
  if (details.length > 0) {
    throw new ValidationError(details, 'Entry is not ready to publish');
  }
}

export async function publishResearch(
  id: number,
  actor: AdminCrudActor,
): Promise<SecurityResearchAdminRow> {
  const existing = await researchRepository.findByIdForAdmin(id);
  if (!existing) throw new NotFoundError('Security research entry not found');
  if (existing.status !== 'DRAFT') {
    throw new ConflictError(
      `Only a draft entry can be published (current status: ${existing.status})`,
    );
  }
  checkPublishReadiness(existing);

  const row = await prisma.$transaction(async (tx) => {
    const updated = await researchRepository.setStatus(
      id,
      'PUBLISHED',
      existing.publishedAt ?? new Date(),
      tx,
    );
    await auditLogRepository.record(
      { userId: actor.id, action: 'RESEARCH_PUBLISH', entityType: 'RESEARCH', entityId: id },
      tx,
    );
    return updated;
  });

  await revalidateTags(['research', `research:${row.slug}`]);
  return row;
}

/** Handles both `PUBLISHED -> DRAFT` (unpublish) and `ARCHIVED -> DRAFT` (restore) — same reasoning as `articleService.unpublishArticle`'s own comment. */
export async function unpublishResearch(
  id: number,
  actor: AdminCrudActor,
): Promise<SecurityResearchAdminRow> {
  const existing = await researchRepository.findByIdForAdmin(id);
  if (!existing) throw new NotFoundError('Security research entry not found');
  if (existing.status === 'DRAFT') {
    throw new ConflictError('Entry is already a draft');
  }

  const row = await prisma.$transaction(async (tx) => {
    const updated = await researchRepository.setStatus(id, 'DRAFT', undefined, tx);
    await auditLogRepository.record(
      { userId: actor.id, action: 'RESEARCH_UNPUBLISH', entityType: 'RESEARCH', entityId: id },
      tx,
    );
    return updated;
  });

  await revalidateTags(['research', `research:${row.slug}`]);
  return row;
}

export async function archiveResearch(
  id: number,
  actor: AdminCrudActor,
): Promise<SecurityResearchAdminRow> {
  const existing = await researchRepository.findByIdForAdmin(id);
  if (!existing) throw new NotFoundError('Security research entry not found');
  if (existing.status !== 'PUBLISHED') {
    throw new ConflictError('Only a published entry can be archived');
  }

  const row = await prisma.$transaction(async (tx) => {
    const updated = await researchRepository.setStatus(id, 'ARCHIVED', undefined, tx);
    await auditLogRepository.record(
      { userId: actor.id, action: 'RESEARCH_ARCHIVE', entityType: 'RESEARCH', entityId: id },
      tx,
    );
    return updated;
  });

  await revalidateTags(['research', `research:${row.slug}`]);
  return row;
}

/** Always creates a DRAFT — never publicly visible, so no revalidation call. */
export async function duplicateResearch(
  id: number,
  actor: AdminCrudActor,
): Promise<SecurityResearchAdminRow> {
  const source = await researchRepository.findByIdForAdmin(id);
  if (!source) throw new NotFoundError('Security research entry not found');

  const slug = await generateDuplicateSlug(source.slug, (candidate) =>
    researchRepository.existsBySlug(candidate),
  );

  return prisma.$transaction(async (tx) => {
    const created = await researchRepository.duplicate(source, slug, tx);
    await auditLogRepository.record(
      {
        userId: actor.id,
        action: 'RESEARCH_DUPLICATE',
        entityType: 'RESEARCH',
        entityId: created.id,
      },
      tx,
    );
    return created;
  });
}
