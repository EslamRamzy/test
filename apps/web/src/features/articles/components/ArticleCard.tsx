import type { ArticleListItemDto } from '@portfolio/shared';
import Link from 'next/link';
import { PublicMediaImage } from '@/components/ui/PublicMediaImage';
import { formatDate } from '@/lib/utils/formatDate';

interface ArticleCardProps {
  article: ArticleListItemDto;
  /** See ProjectCard's `headingLevel` — same reasoning, same fix. */
  headingLevel?: 'h2' | 'h3' | undefined;
}

export function ArticleCard({ article, headingLevel = 'h3' }: ArticleCardProps): React.JSX.Element {
  const Heading = headingLevel;
  return (
    <Link href={`/articles/${article.slug}`} className="card h-100 text-decoration-none text-reset">
      {article.coverMedia && (
        <div className="ratio ratio-16x9">
          <PublicMediaImage
            media={article.coverMedia}
            fill
            sizes="(max-width: 768px) 100vw, 33vw"
            className="card-img-top object-fit-cover"
          />
        </div>
      )}
      <div className="card-body d-flex flex-column">
        {article.category && (
          <span className="badge text-bg-secondary fw-normal mb-2 align-self-start">
            {article.category.name}
          </span>
        )}
        <Heading className="h5">{article.title}</Heading>
        {article.excerpt && (
          <p className="mb-3 flex-grow-1" style={{ color: 'var(--color-text-muted)' }}>
            {article.excerpt}
          </p>
        )}
        <p className="mb-0 small" style={{ color: 'var(--color-text-muted)' }}>
          {article.publishedAt && (
            <time dateTime={article.publishedAt}>{formatDate(article.publishedAt)}</time>
          )}
          {article.publishedAt && ' · '}
          {article.readingTimeMinutes} min read
        </p>
      </div>
    </Link>
  );
}
