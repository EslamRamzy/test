import type { SitemapEntryDto } from '@portfolio/shared';
import { findSlugsForSitemap as findArticleSlugs } from '../repositories/articleRepository.js';
import { findSlugsForSitemap as findProjectSlugs } from '../repositories/projectRepository.js';
import { findSlugsForSitemap as findResearchSlugs } from '../repositories/securityResearchRepository.js';

/** `GET /sitemap-data` (docs/architecture/03 §3) — feeds `apps/web/src/app/sitemap.ts` (doc 06 §8). */
export async function getSitemapData(): Promise<SitemapEntryDto[]> {
  const [projects, articles, research] = await Promise.all([
    findProjectSlugs(),
    findArticleSlugs(),
    findResearchSlugs(),
  ]);

  return [
    ...projects.map((row) => ({
      entityType: 'PROJECT' as const,
      slug: row.slug,
      updatedAt: row.updatedAt.toISOString(),
    })),
    ...articles.map((row) => ({
      entityType: 'ARTICLE' as const,
      slug: row.slug,
      updatedAt: row.updatedAt.toISOString(),
    })),
    ...research.map((row) => ({
      entityType: 'RESEARCH' as const,
      slug: row.slug,
      updatedAt: row.updatedAt.toISOString(),
    })),
  ];
}
