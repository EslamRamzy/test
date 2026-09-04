import { prisma } from '../config/prisma.js';

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
