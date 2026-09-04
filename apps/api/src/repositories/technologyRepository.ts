import type { TechnologyCreateInput, TechnologyUpdateInput } from '@portfolio/shared';
import { prisma } from '../config/prisma.js';
import type { PrismaClientOrTx } from '../config/prisma.js';
import { ConflictError } from '../errors/AppError.js';
import { stripUndefined } from '../lib/stripUndefined.js';
import type { AdminCrudListParams } from '../services/adminCrudFactory.js';
import { isUniqueConstraintError } from './prismaErrors.js';

/**
 * Technologies have no draft/publish workflow (docs/architecture/02 §3) —
 * every row is always public, so there is no `*ForAdmin` split here the way
 * there is for Project/Article/SecurityResearch: the admin `list`/
 * `findById` below read the exact same rows the public ones do, just
 * without the `PUBLIC_SELECT` projection (the admin UI needs every column
 * to populate an edit form).
 */
const PUBLIC_SELECT = {
  id: true,
  name: true,
  slug: true,
  icon: true,
  category: true,
  websiteUrl: true,
} as const;

export function findAllPublic(category: string | undefined) {
  return prisma.technology.findMany({
    where: category ? { category } : {},
    select: PUBLIC_SELECT,
    orderBy: [{ displayOrder: 'asc' }, { name: 'asc' }],
  });
}

export function findByIds(ids: number[]) {
  return prisma.technology.findMany({
    where: { id: { in: ids } },
    select: PUBLIC_SELECT,
  });
}

export function count() {
  return prisma.technology.count();
}

// --- Admin CRUD (docs/architecture/03 §5) -----------------------------------

export interface TechnologyListParams extends AdminCrudListParams {
  q?: string | undefined;
  sort?: string | undefined;
  order?: 'asc' | 'desc' | undefined;
}

/** `sort` allow-list (doc 03 §2's "Sorting" row applies here too, even though this is the admin list, not a public one) — an attacker-controlled string never reaches Prisma's query builder as anything but one of these literal orderBy shapes. */
function resolveOrderBy(sort: string | undefined, order: 'asc' | 'desc' | undefined) {
  const direction = order ?? 'asc';
  switch (sort) {
    case 'name':
      return { name: direction } as const;
    case 'category':
      return [{ category: direction }, { name: 'asc' as const }];
    default:
      return [{ displayOrder: direction }, { name: 'asc' as const }];
  }
}

export async function list(params: TechnologyListParams) {
  // Matches name OR slug — an admin searching this list plausibly remembers
  // either one, and there is nothing else on this row worth matching against.
  const where = params.q
    ? { OR: [{ name: { contains: params.q } }, { slug: { contains: params.q } }] }
    : {};

  const [items, total] = await Promise.all([
    prisma.technology.findMany({
      where,
      orderBy: resolveOrderBy(params.sort, params.order),
      skip: (params.page - 1) * params.pageSize,
      take: params.pageSize,
    }),
    prisma.technology.count({ where }),
  ]);

  return { items, total };
}

export function findById(id: number, client: PrismaClientOrTx = prisma) {
  return client.technology.findUnique({ where: { id } });
}

export async function create(data: TechnologyCreateInput, client: PrismaClientOrTx = prisma) {
  try {
    return await client.technology.create({ data: stripUndefined(data) });
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      throw new ConflictError('A technology with this name or slug already exists');
    }
    throw error;
  }
}

export async function update(
  id: number,
  data: TechnologyUpdateInput,
  client: PrismaClientOrTx = prisma,
) {
  try {
    return await client.technology.update({ where: { id }, data: stripUndefined(data) });
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      throw new ConflictError('A technology with this name or slug already exists');
    }
    throw error;
  }
}

export async function remove(id: number, client: PrismaClientOrTx = prisma): Promise<void> {
  await client.technology.delete({ where: { id } });
}

export async function reorder(
  items: Array<{ id: number; displayOrder: number }>,
  client: PrismaClientOrTx = prisma,
): Promise<void> {
  await Promise.all(
    items.map((item) =>
      client.technology.update({
        where: { id: item.id },
        data: { displayOrder: item.displayOrder },
      }),
    ),
  );
}
