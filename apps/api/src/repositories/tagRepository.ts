import type { TagCreateInput, TagUpdateInput } from '@portfolio/shared';
import { prisma } from '../config/prisma.js';
import type { PrismaClientOrTx } from '../config/prisma.js';
import { ConflictError } from '../errors/AppError.js';
import { stripUndefined } from '../lib/stripUndefined.js';
import type { AdminCrudListParams } from '../services/adminCrudFactory.js';
import { isUniqueConstraintError } from './prismaErrors.js';

/**
 * "Used tags with counts" (docs/architecture/03 §3) — only tags attached to
 * at least one PUBLISHED article or research piece, counting only those
 * published attachments. A tag with zero public content is not worth
 * showing in a public tag cloud, and would otherwise let an admin's
 * in-progress draft tag leak by name.
 */
export async function findUsedWithCounts() {
  const tags = await prisma.tag.findMany({
    select: {
      id: true,
      name: true,
      slug: true,
      _count: {
        select: {
          articles: { where: { article: { status: 'PUBLISHED' } } },
          research: { where: { research: { status: 'PUBLISHED' } } },
        },
      },
    },
    orderBy: { name: 'asc' },
  });

  return tags
    .map((tag) => ({
      id: tag.id,
      name: tag.name,
      slug: tag.slug,
      count: tag._count.articles + tag._count.research,
    }))
    .filter((tag) => tag.count > 0)
    .sort((a, b) => b.count - a.count);
}

export function findBySlug(slug: string) {
  return prisma.tag.findUnique({ where: { slug } });
}

// --- Admin CRUD (docs/architecture/03 §5) -----------------------------------
// No `reorder` here — `Tag` has no `displayOrder` column (unlike its
// sibling `article-categories`); `Sidebar.tsx`/routes never mount a
// `PATCH /reorder` for this resource for that reason.

export interface TagListParams extends AdminCrudListParams {
  q?: string | undefined;
}

export async function list(params: TagListParams) {
  const where = params.q ? { name: { contains: params.q } } : {};
  const [items, total] = await Promise.all([
    prisma.tag.findMany({
      where,
      orderBy: { name: 'asc' },
      skip: (params.page - 1) * params.pageSize,
      take: params.pageSize,
    }),
    prisma.tag.count({ where }),
  ]);
  return { items, total };
}

export function findById(id: number, client: PrismaClientOrTx = prisma) {
  return client.tag.findUnique({ where: { id } });
}

export async function create(data: TagCreateInput, client: PrismaClientOrTx = prisma) {
  try {
    return await client.tag.create({ data: stripUndefined(data) });
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      throw new ConflictError('A tag with this name or slug already exists');
    }
    throw error;
  }
}

export async function update(id: number, data: TagUpdateInput, client: PrismaClientOrTx = prisma) {
  try {
    return await client.tag.update({ where: { id }, data: stripUndefined(data) });
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      throw new ConflictError('A tag with this name or slug already exists');
    }
    throw error;
  }
}

export async function remove(id: number, client: PrismaClientOrTx = prisma): Promise<void> {
  await client.tag.delete({ where: { id } });
}
