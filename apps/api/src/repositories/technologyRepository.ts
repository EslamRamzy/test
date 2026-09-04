import { prisma } from '../config/prisma.js';

/**
 * Technologies have no draft/publish workflow (docs/architecture/02 §3) —
 * every row is always public, so there is no `*ForAdmin` split here the way
 * there is for Project/Article/SecurityResearch.
 */
const PUBLIC_SELECT = {
  id: true,
  name: true,
  slug: true,
  icon: true,
  category: true,
  websiteUrl: true,
} as const;

export function findAllPublic(category: string | undefined) {
  return prisma.technology.findMany({
    where: category ? { category } : {},
    select: PUBLIC_SELECT,
    orderBy: [{ displayOrder: 'asc' }, { name: 'asc' }],
  });
}

export function findByIds(ids: number[]) {
  return prisma.technology.findMany({
    where: { id: { in: ids } },
    select: PUBLIC_SELECT,
  });
}

export function count() {
  return prisma.technology.count();
}
