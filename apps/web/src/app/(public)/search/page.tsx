import type { Metadata } from 'next';
import Link from 'next/link';
import type { SearchResultDto } from '@portfolio/shared';
import { search } from '@/lib/api/endpoints';

export const metadata: Metadata = {
  title: 'Search',
  description: 'Search projects, articles, security research, and technologies.',
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
    <div className="container py-5">
      <h1 className="h2 mb-4">Search</h1>

      <form action="/search" method="get" className="mb-4" role="search">
        <div className="input-group">
          <input
            type="search"
            name="q"
            defaultValue={query}
            className="form-control"
            placeholder="Search projects, articles, research…"
            aria-label="Search"
            minLength={2}
          />
          <button type="submit" className="btn btn-primary" aria-label="Search">
            <span className="bi bi-search" aria-hidden="true" />
          </button>
        </div>
      </form>

      {query.length > 0 && query.length < 2 && (
        <p style={{ color: 'var(--color-text-muted)' }}>Enter at least 2 characters to search.</p>
      )}

      {query.length >= 2 && (
        <p aria-live="polite" className="small mb-4" style={{ color: 'var(--color-text-muted)' }}>
          {results.length} result{results.length === 1 ? '' : 's'} for &ldquo;{query}&rdquo;
        </p>
      )}

      {results.length > 0 && (
        <ul className="list-unstyled d-flex flex-column gap-3">
          {results.map((result) => {
            const basePath = ENTITY_PATH[result.entityType];
            return (
              <li key={`${result.entityType}-${result.entityId}`} className="border-bottom pb-3">
                <span className="badge text-bg-secondary fw-normal mb-1">
                  {ENTITY_LABEL[result.entityType]}
                </span>
                <h2 className="h5 mb-1">
                  {basePath ? (
                    <Link href={`${basePath}/${result.slug}`}>{result.title}</Link>
                  ) : (
                    result.title
                  )}
                </h2>
                <p className="mb-0" style={{ color: 'var(--color-text-muted)' }}>
                  {result.snippet}
                </p>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
