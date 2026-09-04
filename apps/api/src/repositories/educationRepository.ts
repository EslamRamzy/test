import { prisma } from '../config/prisma.js';

export function findVisible() {
  return prisma.education.findMany({
    where: { visible: true },
    orderBy: [{ startDate: 'desc' }, { displayOrder: 'asc' }],
  });
}
