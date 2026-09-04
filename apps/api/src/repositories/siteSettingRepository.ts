import { prisma } from '../config/prisma.js';
import type { PrismaClientOrTx } from '../config/prisma.js';

/**
 * `isPublic` gates exposure through the public API (docs/architecture/02 §6:
 * "an admin-only setting must never leak through GET /profile or /stats") —
 * enforced here, not by trusting every caller to remember the filter.
 */
export function findPublicSettings() {
  return prisma.siteSetting.findMany({
    where: { isPublic: true },
    orderBy: { key: 'asc' },
  });
}

// --- Admin (docs/architecture/03 §5: "GET grouped", "PATCH bulk") ----------

/** Every setting regardless of `isPublic`, for the admin table — grouping by `groupName` is the caller's job (the DTO shape, not a query concern). */
export function findAllForAdmin(client: PrismaClientOrTx = prisma) {
  return client.siteSetting.findMany({ orderBy: [{ groupName: 'asc' }, { key: 'asc' }] });
}

export function findByKey(key: string, client: PrismaClientOrTx = prisma) {
  return client.siteSetting.findUnique({ where: { key } });
}

/**
 * Upserts a single `{key, value}` pair — a NEW key is created with
 * `valueType: 'STRING'` and `isPublic: false` (the safe default: an
 * unrecognised setting never leaks publicly just because someone typed a
 * new key), since there is no separate "create a setting" endpoint (doc03
 * §5 lists only `GET`/`PATCH`) and no seed data pre-populates this table —
 * `siteSettingService.ts`'s own comment has the full reasoning for why
 * bulk-update doubles as create.
 */
export function upsertOne(key: string, value: string | null, client: PrismaClientOrTx = prisma) {
  return client.siteSetting.upsert({
    where: { key },
    create: { key, value, valueType: 'STRING', isPublic: false },
    update: { value },
  });
}
