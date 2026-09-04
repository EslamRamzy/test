import type { CertificationCreateInput, CertificationUpdateInput } from '@portfolio/shared';
import { prisma } from '../config/prisma.js';
import type { PrismaClientOrTx } from '../config/prisma.js';
import { stripUndefined } from '../lib/stripUndefined.js';
import type { AdminCrudListParams } from '../services/adminCrudFactory.js';

export function findVisible() {
  return prisma.certification.findMany({
    where: { visible: true },
    orderBy: { displayOrder: 'asc' },
    include: { certificateMedia: true },
  });
}

// --- Admin CRUD (docs/architecture/03 §5) -----------------------------------
// No unique constraint on this model (unlike Technology/SkillCategory), so
// no `isUniqueConstraintError` handling here — same reasoning as
// `skillRepository.ts`.

export interface CertificationListParams extends AdminCrudListParams {
  q?: string | undefined;
}

export async function list(params: CertificationListParams) {
  const where = params.q
    ? { OR: [{ name: { contains: params.q } }, { issuer: { contains: params.q } }] }
    : {};
  const [items, total] = await Promise.all([
    prisma.certification.findMany({
      where,
      orderBy: { displayOrder: 'asc' },
      skip: (params.page - 1) * params.pageSize,
      take: params.pageSize,
    }),
    prisma.certification.count({ where }),
  ]);
  return { items, total };
}

export function findById(id: number, client: PrismaClientOrTx = prisma) {
  return client.certification.findUnique({ where: { id } });
}

export function create(data: CertificationCreateInput, client: PrismaClientOrTx = prisma) {
  return client.certification.create({ data: stripUndefined(data) });
}

export function update(
  id: number,
  data: CertificationUpdateInput,
  client: PrismaClientOrTx = prisma,
) {
  return client.certification.update({ where: { id }, data: stripUndefined(data) });
}

export async function remove(id: number, client: PrismaClientOrTx = prisma): Promise<void> {
  await client.certification.delete({ where: { id } });
}

export async function reorder(
  items: Array<{ id: number; displayOrder: number }>,
  client: PrismaClientOrTx = prisma,
): Promise<void> {
  await Promise.all(
    items.map((item) =>
      client.certification.update({
        where: { id: item.id },
        data: { displayOrder: item.displayOrder },
      }),
    ),
  );
}
