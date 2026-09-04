import { prisma } from '../config/prisma.js';

export function findVisible(limit?: number) {
  return prisma.timelineEntry.findMany({
    where: { visible: true },
    orderBy: [{ entryDate: 'desc' }, { displayOrder: 'asc' }],
    ...(limit ? { take: limit } : {}),
  });
}
