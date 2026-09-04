import { prisma } from '../config/prisma.js';

export function findAll() {
  return prisma.articleCategory.findMany({ orderBy: { displayOrder: 'asc' } });
}

export function findBySlug(slug: string) {
  return prisma.articleCategory.findUnique({ where: { slug } });
}
