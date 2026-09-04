import { prisma } from '../config/prisma.js';

/**
 * "Used tags with counts" (docs/architecture/03 §3) — only tags attached to
 * at least one PUBLISHED article or research piece, counting only those
 * published attachments. A tag with zero public content is not worth
 * showing in a public tag cloud, and would otherwise let an admin's
 * in-progress draft tag leak by name.
 */
export async function findUsedWithCounts() {
  const tags = await prisma.tag.findMany({
    select: {
      id: true,
      name: true,
      slug: true,
      _count: {
        select: {
          articles: { where: { article: { status: 'PUBLISHED' } } },
          research: { where: { research: { status: 'PUBLISHED' } } },
        },
      },
    },
    orderBy: { name: 'asc' },
  });

  return tags
    .map((tag) => ({
      id: tag.id,
      name: tag.name,
      slug: tag.slug,
      count: tag._count.articles + tag._count.research,
    }))
    .filter((tag) => tag.count > 0)
    .sort((a, b) => b.count - a.count);
}

export function findBySlug(slug: string) {
  return prisma.tag.findUnique({ where: { slug } });
}
