import type { SkillCategoryCreateInput, SkillCategoryUpdateInput } from '@portfolio/shared';
import { prisma } from '../config/prisma.js';
import type { PrismaClientOrTx } from '../config/prisma.js';
import { ConflictError } from '../errors/AppError.js';
import { stripUndefined } from '../lib/stripUndefined.js';
import type { AdminCrudListParams } from '../services/adminCrudFactory.js';
import { isUniqueConstraintError } from './prismaErrors.js';

/** Admin CRUD for `skill_categories` — public reads live in `skillRepository.ts` (`findVisibleCategoriesWithSkills`), which this file does not touch. */

export interface SkillCategoryListParams extends AdminCrudListParams {
  q?: string | undefined;
}

export async function list(params: SkillCategoryListParams) {
  const where = params.q ? { name: { contains: params.q } } : {};
  const [items, total] = await Promise.all([
    prisma.skillCategory.findMany({
      where,
      orderBy: [{ displayOrder: 'asc' as const }, { name: 'asc' as const }],
      skip: (params.page - 1) * params.pageSize,
      take: params.pageSize,
    }),
    prisma.skillCategory.count({ where }),
  ]);
  return { items, total };
}

export function findById(id: number, client: PrismaClientOrTx = prisma) {
  return client.skillCategory.findUnique({ where: { id } });
}

export async function create(data: SkillCategoryCreateInput, client: PrismaClientOrTx = prisma) {
  try {
    return await client.skillCategory.create({ data: stripUndefined(data) });
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      throw new ConflictError('A skill category with this name or slug already exists');
    }
    throw error;
  }
}

export async function update(
  id: number,
  data: SkillCategoryUpdateInput,
  client: PrismaClientOrTx = prisma,
) {
  try {
    return await client.skillCategory.update({ where: { id }, data: stripUndefined(data) });
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      throw new ConflictError('A skill category with this name or slug already exists');
    }
    throw error;
  }
}

export async function remove(id: number, client: PrismaClientOrTx = prisma): Promise<void> {
  await client.skillCategory.delete({ where: { id } });
}

export async function reorder(
  items: Array<{ id: number; displayOrder: number }>,
  client: PrismaClientOrTx = prisma,
): Promise<void> {
  await Promise.all(
    items.map((item) =>
      client.skillCategory.update({
        where: { id: item.id },
        data: { displayOrder: item.displayOrder },
      }),
    ),
  );
}
