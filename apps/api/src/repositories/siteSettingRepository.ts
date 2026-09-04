import { prisma } from '../config/prisma.js';

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
