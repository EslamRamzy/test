import type { ProfileUpdateInput } from '@portfolio/shared';
import { prisma } from '../config/prisma.js';
import type { PrismaClientOrTx } from '../config/prisma.js';
import { stripUndefined } from '../lib/stripUndefined.js';

/** The `profiles` table is a singleton — `id = 1` is enforced by a CHECK constraint (docs/architecture/02 §5). */
export function findProfile() {
  return prisma.profile.findUnique({
    where: { id: 1 },
    include: { avatarMedia: true, resumeMedia: true },
  });
}

/** Admin read/write of the same singleton row — `id: 1` always, never accepted from the caller (docs/architecture/03 §5's own "no `id` in the body" note). */
export function findProfileForAdmin(client: PrismaClientOrTx = prisma) {
  return client.profile.findUnique({
    where: { id: 1 },
    include: { avatarMedia: true, resumeMedia: true },
  });
}

export function updateProfile(data: ProfileUpdateInput, client: PrismaClientOrTx = prisma) {
  return client.profile.update({
    where: { id: 1 },
    data: stripUndefined(data),
    include: { avatarMedia: true, resumeMedia: true },
  });
}
