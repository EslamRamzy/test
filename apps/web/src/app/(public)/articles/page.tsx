import type { Metadata } from 'next';
import Link from 'next/link';
import { listArticleCategories, listArticles } from '@/lib/api/endpoints';
import { getPublicSiteUrl } from '@/lib/config';
import { ArticleCard } from '@/features/articles/components/ArticleCard';
import { Pagination } from '@/components/ui/Pagination';

export const metadata: Metadata = {
  title: 'Articles',
  description: 'Writing on software development and application security.',
  alternates: { canonical: `${getPublicSiteUrl()}/articles` },
};

interface ArticlesPageProps {
  searchParams: Promise<Record<string, string | undefined>>;
}

export default async function ArticlesPage({ searchParams }: ArticlesPageProps) {
  const params = await searchParams;
  const page = Number(params.page ?? '1') || 1;
  const category = params.category;

  const [{ items: articles, meta }, categories] = await Promise.all([
    listArticles({ page, category }),
    listArticleCategories(),
  ]);

  function buildHref(overrides: Record<string, string | undefined>): string {
    const next = new URLSearchParams();
    const merged = { category, ...overrides };
    for (const [key, value] of Object.entries(merged)) {
      if (value) next.set(key, value);
    }
    const query = next.toString();
    return query ? `/articles?${query}` : '/articles';
  }

  return (
    <div className="container py-5">
      <h1 className="h2 mb-4">Articles</h1>

      {categories.length > 0 && (
        <div className="d-flex flex-wrap gap-2 mb-4" role="group" aria-label="Filter by category">
          <Link
            href={buildHref({ category: undefined, page: undefined })}
            className={`btn btn-sm ${!category ? 'btn-primary' : 'btn-outline-secondary'}`}
          >
            All
          </Link>
          {categories.map((cat) => (
            <Link
              key={cat.id}
              href={buildHref({ category: cat.slug, page: undefined })}
              className={`btn btn-sm ${category === cat.slug ? 'btn-primary' : 'btn-outline-secondary'}`}
            >
              {cat.name}
            </Link>
          ))}
        </div>
      )}

      {articles.length === 0 ? (
        <p style={{ color: 'var(--color-text-muted)' }}>No articles published yet.</p>
      ) : (
        <div className="row g-4 mb-4">
          {articles.map((article) => (
            <div className="col-md-6 col-lg-4" key={article.id}>
              <ArticleCard article={article} headingLevel="h2" />
            </div>
          ))}
        </div>
      )}

      <Pagination meta={meta} buildHref={(targetPage) => buildHref({ page: String(targetPage) })} />
    </div>
  );
}
