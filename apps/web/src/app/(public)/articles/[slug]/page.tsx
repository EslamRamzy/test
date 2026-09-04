import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { getArticle, listArticles } from '@/lib/api/endpoints';
import { getPublicSiteUrl } from '@/lib/config';
import { renderMarkdown } from '@/lib/markdown/render';
import { MarkdownBody } from '@/lib/markdown/MarkdownBody';
import { formatDate } from '@/lib/utils/formatDate';
import { JsonLd } from '@/components/seo/JsonLd';
import { PublicMediaImage } from '@/components/ui/PublicMediaImage';
import { ArticleCard } from '@/features/articles/components/ArticleCard';

interface ArticlePageProps {
  params: Promise<{ slug: string }>;
}

export async function generateStaticParams() {
  const { items } = await listArticles({ pageSize: 50 });
  return items.map((article) => ({ slug: article.slug }));
}
export const dynamicParams = true;

export async function generateMetadata({ params }: ArticlePageProps): Promise<Metadata> {
  const { slug } = await params;
  const result = await getArticle(slug);
  if (!result) return {};

  return {
    title: result.title,
    // Omitted, not `undefined`, when there's no excerpt — see
    // `(public)/page.tsx`'s comment: lets the root layout's fallback
    // description take over instead of rendering an empty meta tag.
    ...(result.excerpt ? { description: result.excerpt } : {}),
    alternates: { canonical: `${getPublicSiteUrl()}/articles/${result.slug}` },
    // No `openGraph.images` — see projects/[slug]/page.tsx's comment: Next
    // resolves the sibling `opengraph-image.tsx` into this automatically,
    // and hand-building the URL guessed the wrong path (verified 404).
    openGraph: {
      title: result.title,
      ...(result.excerpt ? { description: result.excerpt } : {}),
      type: 'article',
    },
  };
}

export default async function ArticlePage({ params }: ArticlePageProps) {
  const { slug } = await params;
  const result = await getArticle(slug);
  if (!result) notFound();

  // `getArticle` returns the article's own fields flat, alongside `related`
  // (matching the API's actual response shape — `authController.ts`'s
  // `detail` handler spreads `{...article, related}` rather than nesting
  // it), so `article` here is everything in `result` except `related`.
  const { related, ...article } = result;
  const html = await renderMarkdown(article.content);

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'BlogPosting',
    headline: article.title,
    ...(article.excerpt ? { description: article.excerpt } : {}),
    ...(article.publishedAt ? { datePublished: article.publishedAt } : {}),
  };
  const siteUrl = getPublicSiteUrl();
  const breadcrumbJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Articles', item: `${siteUrl}/articles` },
      {
        '@type': 'ListItem',
        position: 2,
        name: article.title,
        item: `${siteUrl}/articles/${article.slug}`,
      },
    ],
  };

  return (
    <article className="container py-5">
      <JsonLd data={jsonLd} />
      <JsonLd data={breadcrumbJsonLd} />

      <nav aria-label="Breadcrumb" className="mb-3">
        <ol className="breadcrumb small">
          <li className="breadcrumb-item">
            <Link href="/articles">Articles</Link>
          </li>
          <li className="breadcrumb-item active" aria-current="page">
            {article.title}
          </li>
        </ol>
      </nav>

      {article.category && (
        <span className="badge text-bg-secondary fw-normal mb-2">{article.category.name}</span>
      )}
      <h1 className="h2 mb-2">{article.title}</h1>
      <p className="mb-4 small" style={{ color: 'var(--color-text-muted)' }}>
        {article.publishedAt && (
          <time dateTime={article.publishedAt}>{formatDate(article.publishedAt)}</time>
        )}
        {article.publishedAt && ' · '}
        {article.readingTimeMinutes} min read
      </p>

      {article.coverMedia && (
        <div className="ratio ratio-16x9 mb-5">
          <PublicMediaImage
            media={article.coverMedia}
            fill
            priority
            sizes="(max-width: 992px) 100vw, 900px"
            className="rounded-3 object-fit-cover"
          />
        </div>
      )}

      <MarkdownBody html={html} className="mb-5" />

      {article.tags.length > 0 && (
        <div className="d-flex flex-wrap gap-2 mb-5">
          {article.tags.map((tag) => (
            <span key={tag.id} className="badge text-bg-secondary fw-normal">
              #{tag.name}
            </span>
          ))}
        </div>
      )}

      {related.length > 0 && (
        <section className="mt-5 pt-4 border-top">
          <h2 className="h4 mb-4">Related Articles</h2>
          <div className="row g-4">
            {related.map((item) => (
              <div className="col-md-4" key={item.id}>
                <ArticleCard article={item} />
              </div>
            ))}
          </div>
        </section>
      )}
    </article>
  );
}
