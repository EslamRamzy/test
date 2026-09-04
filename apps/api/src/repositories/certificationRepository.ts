import { prisma } from '../config/prisma.js';

export function findVisible() {
  return prisma.certification.findMany({
    where: { visible: true },
    orderBy: { displayOrder: 'asc' },
    include: { certificateMedia: true },
  });
}
