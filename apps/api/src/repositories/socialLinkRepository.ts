import { prisma } from '../config/prisma.js';

export function findEnabled() {
  return prisma.socialLink.findMany({
    where: { enabled: true },
    orderBy: { displayOrder: 'asc' },
  });
}
