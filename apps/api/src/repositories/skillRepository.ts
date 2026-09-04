import type { SkillCreateInput, SkillUpdateInput } from '@portfolio/shared';
import { prisma } from '../config/prisma.js';
import type { PrismaClientOrTx } from '../config/prisma.js';
import { NotFoundError } from '../errors/AppError.js';
import { stripUndefined } from '../lib/stripUndefined.js';
import type { AdminCrudListParams } from '../services/adminCrudFactory.js';

/**
 * Skill categories and their skills, both gated on `visible` (docs/
 * architecture/02 §5) — the closest thing this resource has to a draft
 * state: an admin can stage a skill or an entire category without it
 * appearing publicly, by leaving `visible: false`.
 */
export function findVisibleCategoriesWithSkills() {
  return prisma.skillCategory.findMany({
    where: { visible: true },
    orderBy: { displayOrder: 'asc' },
    include: {
      skills: {
        where: { visible: true },
        orderBy: { displayOrder: 'asc' },
        select: { id: true, name: true, icon: true, description: true, level: true },
      },
    },
  });
}

// --- Admin CRUD (docs/architecture/03 §5) -----------------------------------

export interface SkillListParams extends AdminCrudListParams {
  q?: string | undefined;
  categoryId?: number | undefined;
}

export async function list(params: SkillListParams) {
  const where = {
    ...(params.q ? { name: { contains: params.q } } : {}),
    ...(params.categoryId !== undefined ? { categoryId: params.categoryId } : {}),
  };
  const [items, total] = await Promise.all([
    prisma.skill.findMany({
      where,
      orderBy: [{ categoryId: 'asc' as const }, { displayOrder: 'asc' as const }],
      skip: (params.page - 1) * params.pageSize,
      take: params.pageSize,
    }),
    prisma.skill.count({ where }),
  ]);
  return { items, total };
}

export function findById(id: number, client: PrismaClientOrTx = prisma) {
  return client.skill.findUnique({ where: { id } });
}

/** Doc 07 §3: "Grouped by category" — a skill's category must already exist; a bad `categoryId` is a client error (404), not a foreign-key 500. */
async function assertCategoryExists(categoryId: number, client: PrismaClientOrTx): Promise<void> {
  const category = await client.skillCategory.findUnique({ where: { id: categoryId } });
  if (!category) throw new NotFoundError('Skill category not found');
}

// `Skill` has no unique constraint of its own (unlike `SkillCategory`'s
// name/slug) — two skills named identically, even within one category, are
// a legitimate if odd state the schema doesn't forbid, so there is no
// `isUniqueConstraintError` handling here the way `skillCategoryRepository.
// ts` has.
export async function create(data: SkillCreateInput, client: PrismaClientOrTx = prisma) {
  await assertCategoryExists(data.categoryId, client);
  return client.skill.create({ data: stripUndefined(data) });
}

export function update(id: number, data: SkillUpdateInput, client: PrismaClientOrTx = prisma) {
  return client.skill.update({ where: { id }, data: stripUndefined(data) });
}

export async function remove(id: number, client: PrismaClientOrTx = prisma): Promise<void> {
  await client.skill.delete({ where: { id } });
}

export async function reorder(
  items: Array<{ id: number; displayOrder: number }>,
  client: PrismaClientOrTx = prisma,
): Promise<void> {
  await Promise.all(
    items.map((item) =>
      client.skill.update({ where: { id: item.id }, data: { displayOrder: item.displayOrder } }),
    ),
  );
}
