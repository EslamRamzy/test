import type { ArticleListItemDto } from '@portfolio/shared';
import Link from 'next/link';
import { ArticleCard } from '@/features/articles/components/ArticleCard';

export function ArticlesPreview({
  articles,
}: {
  articles: ArticleListItemDto[];
}): React.JSX.Element | null {
  if (articles.length === 0) return null;

  return (
    <section className="py-5 border-bottom">
      <div className="container">
        <div className="d-flex justify-content-between align-items-center mb-4">
          <h2 className="h3 mb-0">Latest Articles</h2>
          <Link href="/articles" className="link-primary">
            View all <span className="bi bi-arrow-right" aria-hidden="true" />
          </Link>
        </div>
        <div className="row g-4">
          {articles.map((article) => (
            <div className="col-md-6 col-lg-4" key={article.id}>
              <ArticleCard article={article} />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
