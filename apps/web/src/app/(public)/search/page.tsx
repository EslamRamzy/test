import type { Metadata } from 'next';
import Link from 'next/link';
import type { SearchResultDto } from '@portfolio/shared';
import { search } from '@/lib/api/endpoints';
import { getPublicSiteUrl } from '@/lib/config';
import { AnalyticsBeacon } from '@/features/analytics/AnalyticsBeacon';

export const metadata: Metadata = {
  title: 'Search',
  description: 'Search projects, articles, security research, and technologies.',
  // The base path, not `/search?q=...` — every query string would otherwise
  // be its own "distinct" canonical URL, and `robots.ts` already excludes
  // this route from indexing entirely for the same reason.
  alternates: { canonical: `${getPublicSiteUrl()}/search` },
};

const ENTITY_PATH: Record<SearchResultDto['entityType'], string | null> = {
  PROJECT: '/projects',
  ARTICLE: '/articles',
  RESEARCH: '/security',
  TECHNOLOGY: null, // technologies have no dedicated detail page
};

const ENTITY_LABEL: Record<SearchResultDto['entityType'], string> = {
  PROJECT: 'Project',
  ARTICLE: 'Article',
  RESEARCH: 'Security Research',
  TECHNOLOGY: 'Technology',
};

interface SearchPageProps {
  searchParams: Promise<{ q?: string }>;
}

export default async function SearchPage({ searchParams }: SearchPageProps) {
  const { q } = await searchParams;
  const query = q?.trim() ?? '';
  const results = query.length >= 2 ? await search({ q: query }) : [];

  return (
    <div className="container search-page">
      <AnalyticsBeacon entityType="PAGE" />
      <div className="search-page__header">
        <h1 className="h2 search-page__title">Search</h1>
        <p className="search-page__subtitle">
          Look across every project, article, and security writeup at once — press <kbd>⌘K</kbd>{' '}
          anywhere on the site for the same search without leaving the page.
        </p>
      </div>

      <form action="/search" method="get" className="search-page__form" role="search">
        <div className="search-page__input-group">
          <input
            type="search"
            name="q"
            defaultValue={query}
            className="search-page__input"
            placeholder="Search projects, articles, research…"
            aria-label="Search"
            minLength={2}
          />
          <button type="submit" className="search-page__submit" aria-label="Search">
            <span className="bi bi-search" aria-hidden="true" />
          </button>
        </div>
      </form>

      {query.length > 0 && query.length < 2 && (
        <p className="search-page__hint">Enter at least 2 characters to search.</p>
      )}

      {query.length >= 2 && (
        <p aria-live="polite" className="search-page__count">
          {results.length} result{results.length === 1 ? '' : 's'} for &ldquo;{query}&rdquo;
        </p>
      )}

      {results.length > 0 && (
        <ul className="search-page__results">
          {results.map((result) => {
            const basePath = ENTITY_PATH[result.entityType];
            return (
              <li key={`${result.entityType}-${result.entityId}`} className="search-page__result">
                <span className="search-page__result-badge">{ENTITY_LABEL[result.entityType]}</span>
                <h2 className="h5 search-page__result-title">
                  {basePath ? (
                    <Link href={`${basePath}/${result.slug}`}>{result.title}</Link>
                  ) : (
                    result.title
                  )}
                </h2>
                <p className="search-page__result-snippet">{result.snippet}</p>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
