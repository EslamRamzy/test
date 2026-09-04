import type { TimelineEntryCreateInput, TimelineEntryUpdateInput } from '@portfolio/shared';
import { prisma } from '../config/prisma.js';
import type { PrismaClientOrTx } from '../config/prisma.js';
import { stripUndefined } from '../lib/stripUndefined.js';
import type { AdminCrudListParams } from '../services/adminCrudFactory.js';

export function findVisible(limit?: number) {
  return prisma.timelineEntry.findMany({
    where: { visible: true },
    orderBy: [{ entryDate: 'desc' }, { displayOrder: 'asc' }],
    ...(limit ? { take: limit } : {}),
  });
}

// --- Admin CRUD (docs/architecture/03 §5) -----------------------------------

export interface TimelineListParams extends AdminCrudListParams {
  q?: string | undefined;
}

export async function list(params: TimelineListParams) {
  const where = params.q ? { title: { contains: params.q } } : {};
  const [items, total] = await Promise.all([
    prisma.timelineEntry.findMany({
      where,
      orderBy: [{ entryDate: 'desc' as const }, { displayOrder: 'asc' as const }],
      skip: (params.page - 1) * params.pageSize,
      take: params.pageSize,
    }),
    prisma.timelineEntry.count({ where }),
  ]);
  return { items, total };
}

export function findById(id: number, client: PrismaClientOrTx = prisma) {
  return client.timelineEntry.findUnique({ where: { id } });
}

export function create(data: TimelineEntryCreateInput, client: PrismaClientOrTx = prisma) {
  return client.timelineEntry.create({ data: stripUndefined(data) });
}

export function update(
  id: number,
  data: TimelineEntryUpdateInput,
  client: PrismaClientOrTx = prisma,
) {
  return client.timelineEntry.update({ where: { id }, data: stripUndefined(data) });
}

export async function remove(id: number, client: PrismaClientOrTx = prisma): Promise<void> {
  await client.timelineEntry.delete({ where: { id } });
}

export async function reorder(
  items: Array<{ id: number; displayOrder: number }>,
  client: PrismaClientOrTx = prisma,
): Promise<void> {
  await Promise.all(
    items.map((item) =>
      client.timelineEntry.update({
        where: { id: item.id },
        data: { displayOrder: item.displayOrder },
      }),
    ),
  );
}
