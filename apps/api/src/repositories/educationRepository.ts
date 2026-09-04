import type { EducationCreateInput, EducationUpdateInput } from '@portfolio/shared';
import { prisma } from '../config/prisma.js';
import type { PrismaClientOrTx } from '../config/prisma.js';
import { stripUndefined } from '../lib/stripUndefined.js';
import type { AdminCrudListParams } from '../services/adminCrudFactory.js';

export function findVisible() {
  return prisma.education.findMany({
    where: { visible: true },
    orderBy: [{ startDate: 'desc' }, { displayOrder: 'asc' }],
  });
}

// --- Admin CRUD (docs/architecture/03 §5) -----------------------------------

export interface EducationListParams extends AdminCrudListParams {
  q?: string | undefined;
}

export async function list(params: EducationListParams) {
  const where = params.q
    ? { OR: [{ institution: { contains: params.q } }, { degree: { contains: params.q } }] }
    : {};
  const [items, total] = await Promise.all([
    prisma.education.findMany({
      where,
      orderBy: [{ startDate: 'desc' as const }, { displayOrder: 'asc' as const }],
      skip: (params.page - 1) * params.pageSize,
      take: params.pageSize,
    }),
    prisma.education.count({ where }),
  ]);
  return { items, total };
}

export function findById(id: number, client: PrismaClientOrTx = prisma) {
  return client.education.findUnique({ where: { id } });
}

export function create(data: EducationCreateInput, client: PrismaClientOrTx = prisma) {
  return client.education.create({ data: stripUndefined(data) });
}

export function update(id: number, data: EducationUpdateInput, client: PrismaClientOrTx = prisma) {
  return client.education.update({ where: { id }, data: stripUndefined(data) });
}

export async function remove(id: number, client: PrismaClientOrTx = prisma): Promise<void> {
  await client.education.delete({ where: { id } });
}

export async function reorder(
  items: Array<{ id: number; displayOrder: number }>,
  client: PrismaClientOrTx = prisma,
): Promise<void> {
  await Promise.all(
    items.map((item) =>
      client.education.update({
        where: { id: item.id },
        data: { displayOrder: item.displayOrder },
      }),
    ),
  );
}
