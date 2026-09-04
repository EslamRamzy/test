import type { SocialLinkCreateInput, SocialLinkUpdateInput } from '@portfolio/shared';
import { prisma } from '../config/prisma.js';
import type { PrismaClientOrTx } from '../config/prisma.js';
import { stripUndefined } from '../lib/stripUndefined.js';
import type { AdminCrudListParams } from '../services/adminCrudFactory.js';

export function findEnabled() {
  return prisma.socialLink.findMany({
    where: { enabled: true },
    orderBy: { displayOrder: 'asc' },
  });
}

// --- Admin CRUD (docs/architecture/03 §5) -----------------------------------

export interface SocialLinkListParams extends AdminCrudListParams {
  q?: string | undefined;
}

export async function list(params: SocialLinkListParams) {
  const where = params.q ? { platform: { contains: params.q } } : {};
  const [items, total] = await Promise.all([
    prisma.socialLink.findMany({
      where,
      orderBy: { displayOrder: 'asc' },
      skip: (params.page - 1) * params.pageSize,
      take: params.pageSize,
    }),
    prisma.socialLink.count({ where }),
  ]);
  return { items, total };
}

export function findById(id: number, client: PrismaClientOrTx = prisma) {
  return client.socialLink.findUnique({ where: { id } });
}

export function create(data: SocialLinkCreateInput, client: PrismaClientOrTx = prisma) {
  return client.socialLink.create({ data: stripUndefined(data) });
}

export function update(id: number, data: SocialLinkUpdateInput, client: PrismaClientOrTx = prisma) {
  return client.socialLink.update({ where: { id }, data: stripUndefined(data) });
}

export async function remove(id: number, client: PrismaClientOrTx = prisma): Promise<void> {
  await client.socialLink.delete({ where: { id } });
}

export async function reorder(
  items: Array<{ id: number; displayOrder: number }>,
  client: PrismaClientOrTx = prisma,
): Promise<void> {
  await Promise.all(
    items.map((item) =>
      client.socialLink.update({
        where: { id: item.id },
        data: { displayOrder: item.displayOrder },
      }),
    ),
  );
}
