import type { MetadataRoute } from 'next';
import { getPublicSiteUrl } from '@/lib/config';

/** Disallows `/admin`, `/api`, `/search` (docs/architecture/06 §8) — an indexed search-results page is low-value duplicate content, and `/admin` should never appear in a search engine at all. */
export default function robots(): MetadataRoute.Robots {
  const siteUrl = getPublicSiteUrl();
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: ['/admin', '/api', '/search'],
    },
    sitemap: `${siteUrl}/sitemap.xml`,
  };
}
