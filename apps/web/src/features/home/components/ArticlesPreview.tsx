import type { ArticleListItemDto } from '@portfolio/shared';
import Link from 'next/link';
import { PublicMediaImage } from '@/components/ui/PublicMediaImage';
import { formatDate } from '@/lib/utils/formatDate';

/**
 * Modern tech editorial, not blog cards (design concept §15): one featured
 * article with its cover image, then a plain list — title, category, date,
 * reading time — where hovering moves the title and arrow rather than
 * lifting a card.
 */
export function ArticlesPreview({
  articles,
}: {
  articles: ArticleListItemDto[];
}): React.JSX.Element | null {
  if (articles.length === 0) return null;

  const [lead, ...rest] = articles;

  return (
    <section className="articles-preview">
      <div className="container">
        <div className="d-flex justify-content-between align-items-center">
          <h2 className="section-heading mb-0">Latest Articles</h2>
          <Link href="/articles" className="section-link">
            View all
            <span className="bi bi-arrow-right ms-2" aria-hidden="true" />
          </Link>
        </div>

        {lead && (
          <Link href={`/articles/${lead.slug}`} className="article-lead" data-cursor="Read">
            {lead.coverMedia && (
              <div className="article-lead__media">
                <PublicMediaImage
                  media={lead.coverMedia}
                  fill
                  sizes="(max-width: 992px) 100vw, 40vw"
                  className="article-lead__img"
                />
              </div>
            )}
            <div className="article-lead__body">
              {lead.category && (
                <span className="article-lead__category">{lead.category.name}</span>
              )}
              <h3 className="article-lead__title">{lead.title}</h3>
              {lead.excerpt && <p className="article-lead__excerpt">{lead.excerpt}</p>}
              <span className="article-lead__meta">
                {lead.publishedAt && formatDate(lead.publishedAt)}
                {lead.publishedAt && ' · '}
                {lead.readingTimeMinutes} min read
              </span>
            </div>
          </Link>
        )}

        {rest.length > 0 && (
          <ul className="article-list">
            {rest.map((article) => (
              <li key={article.id}>
                <Link href={`/articles/${article.slug}`} className="article-row">
                  <span className="article-row__meta">
                    {article.category?.name ?? 'Article'}
                    {article.publishedAt && ` · ${formatDate(article.publishedAt)}`}
                  </span>
                  <span className="article-row__title">{article.title}</span>
                  <span className="article-row__right">
                    <span className="article-row__time">{article.readingTimeMinutes} min</span>
                    <span className="bi bi-arrow-right article-row__arrow" aria-hidden="true" />
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
