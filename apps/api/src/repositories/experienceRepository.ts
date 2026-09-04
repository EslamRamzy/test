import type { ExperienceCreateInput, ExperienceUpdateInput } from '@portfolio/shared';
import { prisma } from '../config/prisma.js';
import type { PrismaClientOrTx } from '../config/prisma.js';
import { stripUndefined } from '../lib/stripUndefined.js';
import type { AdminCrudListParams } from '../services/adminCrudFactory.js';

export function findVisible() {
  return prisma.experience.findMany({
    where: { visible: true },
    orderBy: [{ startDate: 'desc' }, { displayOrder: 'asc' }],
    include: {
      achievements: { orderBy: { displayOrder: 'asc' } },
      technologies: {
        include: {
          technology: {
            select: {
              id: true,
              name: true,
              slug: true,
              icon: true,
              category: true,
              websiteUrl: true,
            },
          },
        },
      },
    },
  });
}

/** Earliest recorded start date, for the QuickStats "years of experience" counter. */
export async function findEarliestStartDate(): Promise<Date | null> {
  const earliest = await prisma.experience.findFirst({
    where: { visible: true },
    orderBy: { startDate: 'asc' },
    select: { startDate: true },
  });
  return earliest?.startDate ?? null;
}

// --- Admin CRUD (docs/architecture/03 §5) -----------------------------------

const ADMIN_INCLUDE = {
  achievements: { orderBy: { displayOrder: 'asc' as const } },
  technologies: { include: { technology: true } },
};

export interface ExperienceListParams extends AdminCrudListParams {
  q?: string | undefined;
}

export async function list(params: ExperienceListParams) {
  const where = params.q
    ? { OR: [{ position: { contains: params.q } }, { organization: { contains: params.q } }] }
    : {};
  const [items, total] = await Promise.all([
    prisma.experience.findMany({
      where,
      include: ADMIN_INCLUDE,
      orderBy: [{ startDate: 'desc' as const }, { displayOrder: 'asc' as const }],
      skip: (params.page - 1) * params.pageSize,
      take: params.pageSize,
    }),
    prisma.experience.count({ where }),
  ]);
  return { items, total };
}

export function findById(id: number, client: PrismaClientOrTx = prisma) {
  return client.experience.findUnique({ where: { id }, include: ADMIN_INCLUDE });
}

/**
 * `achievements`/`technologyIds` are "replace the whole set" fields
 * (`experience.ts`'s own schema comment) — extracted out of the plain
 * scalar data here and turned into nested writes, since Prisma has no
 * single `set` primitive for a one-to-many with its own rows
 * (`achievements`) or for an explicit many-to-many join table
 * (`technologies`, unlike an implicit relation, which does support `set`).
 * Only present when the caller actually sent one — omitted (not merely
 * empty) means "leave unchanged," which matters for `update` in
 * particular (a `PATCH` that touches `position` only must not silently
 * wipe every achievement).
 *
 * `create` and `update` need genuinely different nested-write shapes here,
 * not the same one — `deleteMany` (clear whatever rows already exist
 * before creating the new set) is only a valid nested action inside an
 * UPDATE; a CREATE has no existing rows to delete yet, and Prisma rejects
 * `deleteMany` there outright ("Unknown argument `deleteMany`," confirmed
 * against the real database, not assumed). Two functions, not one shared
 * helper branching on a boolean, because the underlying operations really
 * are different, not a stylistic choice.
 */
function createRelationWrites(
  achievements: string[] | undefined,
  technologyIds: number[] | undefined,
) {
  return {
    ...(achievements !== undefined
      ? {
          achievements: {
            create: achievements.map((text, index) => ({ text, displayOrder: index })),
          },
        }
      : {}),
    ...(technologyIds !== undefined
      ? { technologies: { create: technologyIds.map((technologyId) => ({ technologyId })) } }
      : {}),
  };
}

function updateRelationWrites(
  achievements: string[] | undefined,
  technologyIds: number[] | undefined,
) {
  return {
    ...(achievements !== undefined
      ? {
          achievements: {
            deleteMany: {},
            create: achievements.map((text, index) => ({ text, displayOrder: index })),
          },
        }
      : {}),
    ...(technologyIds !== undefined
      ? {
          technologies: {
            deleteMany: {},
            create: technologyIds.map((technologyId) => ({ technologyId })),
          },
        }
      : {}),
  };
}

export function create(data: ExperienceCreateInput, client: PrismaClientOrTx = prisma) {
  const { achievements, technologyIds, ...scalars } = data;
  return client.experience.create({
    data: { ...stripUndefined(scalars), ...createRelationWrites(achievements, technologyIds) },
    include: ADMIN_INCLUDE,
  });
}

export function update(id: number, data: ExperienceUpdateInput, client: PrismaClientOrTx = prisma) {
  const { achievements, technologyIds, ...scalars } = data;
  return client.experience.update({
    where: { id },
    data: { ...stripUndefined(scalars), ...updateRelationWrites(achievements, technologyIds) },
    include: ADMIN_INCLUDE,
  });
}

export async function remove(id: number, client: PrismaClientOrTx = prisma): Promise<void> {
  await client.experience.delete({ where: { id } });
}

export async function reorder(
  items: Array<{ id: number; displayOrder: number }>,
  client: PrismaClientOrTx = prisma,
): Promise<void> {
  await Promise.all(
    items.map((item) =>
      client.experience.update({
        where: { id: item.id },
        data: { displayOrder: item.displayOrder },
      }),
    ),
  );
}
