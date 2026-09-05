import { prisma } from '../config/prisma.js';

/**
 * The rollup table's own write path (doc09 §10, Phase 13). No `upsert()`
 * via Prisma's generated compound-unique shorthand
 * (`day_path_entityType_entityId`) — the schema's own `@@unique([day, path,
 * entityType, entityId])` includes two NULLABLE columns, and Prisma's
 * generated `*CompoundUniqueInput` type for it requires `entityType:
 * string`/`entityId: number` with no `null` variant at all (confirmed
 * directly against the generated client — `generated/prisma/models/
 * AnalyticsDaily.ts`), which makes the shorthand unusable for the most
 * common case here: a plain page path with no associated project/article.
 * `findFirst` + `create`/`update` sidesteps the limitation entirely — a
 * `where` clause (as opposed to a unique-input shorthand) handles `null`
 * fields exactly the way a hand-written `IS NULL` would.
 */
export interface UpsertDailyInput {
  day: Date;
  path: string;
  entityType: string | null;
  entityId: number | null;
  views: number;
  uniqueVisitors: number;
}

export async function upsert(input: UpsertDailyInput): Promise<void> {
  const where = {
    day: input.day,
    path: input.path,
    entityType: input.entityType,
    entityId: input.entityId,
  };

  const existing = await prisma.analyticsDaily.findFirst({ where });

  if (existing) {
    await prisma.analyticsDaily.update({
      where: { id: existing.id },
      data: { views: input.views, uniqueVisitors: input.uniqueVisitors },
    });
    return;
  }

  await prisma.analyticsDaily.create({
    data: { ...where, views: input.views, uniqueVisitors: input.uniqueVisitors },
  });
}
