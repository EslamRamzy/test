import type { MetadataRoute } from 'next';
import { getSitemapData } from '@/lib/api/endpoints';
import { getPublicSiteUrl } from '@/lib/config';

const ENTITY_PATH: Record<string, string> = {
  PROJECT: '/projects',
  ARTICLE: '/articles',
  RESEARCH: '/security',
};

const STATIC_ROUTES = [
  '',
  '/about',
  '/projects',
  '/articles',
  '/security',
  '/certifications',
  '/experience',
  '/contact',
];

/** Reads published slugs + `updatedAt` from the API (docs/architecture/06 §8), never a hand-maintained list. */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const siteUrl = getPublicSiteUrl();
  const entries = await getSitemapData();

  const staticEntries: MetadataRoute.Sitemap = STATIC_ROUTES.map((path) => ({
    url: `${siteUrl}${path}`,
    lastModified: new Date(),
  }));

  const contentEntries: MetadataRoute.Sitemap = entries.map((entry) => ({
    url: `${siteUrl}${ENTITY_PATH[entry.entityType]}/${entry.slug}`,
    lastModified: new Date(entry.updatedAt),
  }));

  return [...staticEntries, ...contentEntries];
}
