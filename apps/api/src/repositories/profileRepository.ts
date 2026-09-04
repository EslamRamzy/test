import { prisma } from '../config/prisma.js';

/** The `profiles` table is a singleton — `id = 1` is enforced by a CHECK constraint (docs/architecture/02 §5). */
export function findProfile() {
  return prisma.profile.findUnique({
    where: { id: 1 },
    include: { avatarMedia: true, resumeMedia: true },
  });
}
