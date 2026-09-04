import { prisma } from '../config/prisma.js';

/**
 * Skill categories and their skills, both gated on `visible` (docs/
 * architecture/02 §5) — the closest thing this resource has to a draft
 * state: an admin can stage a skill or an entire category without it
 * appearing publicly, by leaving `visible: false`.
 */
export function findVisibleCategoriesWithSkills() {
  return prisma.skillCategory.findMany({
    where: { visible: true },
    orderBy: { displayOrder: 'asc' },
    include: {
      skills: {
        where: { visible: true },
        orderBy: { displayOrder: 'asc' },
        select: { id: true, name: true, icon: true, description: true, level: true },
      },
    },
  });
}
