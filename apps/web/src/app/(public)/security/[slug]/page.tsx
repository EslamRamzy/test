import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { getResearch, listResearch } from '@/lib/api/endpoints';
import { getPublicSiteUrl } from '@/lib/config';
import { renderMarkdown } from '@/lib/markdown/render';
import { MarkdownBody } from '@/lib/markdown/MarkdownBody';
import { formatDate } from '@/lib/utils/formatDate';
import { JsonLd } from '@/components/seo/JsonLd';
import { PublicMediaImage } from '@/components/ui/PublicMediaImage';

interface ResearchPageProps {
  params: Promise<{ slug: string }>;
}

export async function generateStaticParams() {
  const { items } = await listResearch({ pageSize: 50 });
  return items.map((item) => ({ slug: item.slug }));
}
export const dynamicParams = true;

export async function generateMetadata({ params }: ResearchPageProps): Promise<Metadata> {
  const { slug } = await params;
  const research = await getResearch(slug);
  if (!research) return {};

  return {
    title: research.title,
    // Omitted, not `undefined`, when there's no description — see
    // `(public)/page.tsx`'s comment: lets the root layout's fallback
    // description take over instead of rendering an empty meta tag.
    ...(research.description ? { description: research.description } : {}),
    alternates: { canonical: `${getPublicSiteUrl()}/security/${research.slug}` },
    // No `openGraph.images` — see projects/[slug]/page.tsx's comment: Next
    // resolves the sibling `opengraph-image.tsx` into this automatically,
    // and hand-building the URL guessed the wrong path (verified 404).
    openGraph: {
      title: research.title,
      ...(research.description ? { description: research.description } : {}),
      type: 'article',
    },
  };
}

export default async function ResearchPage({ params }: ResearchPageProps) {
  const { slug } = await params;
  const research = await getResearch(slug);
  if (!research) notFound();

  const html = await renderMarkdown(research.content);

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: research.title,
    ...(research.description ? { description: research.description } : {}),
    ...(research.publishedAt ? { datePublished: research.publishedAt } : {}),
  };
  const siteUrl = getPublicSiteUrl();
  const breadcrumbJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Security', item: `${siteUrl}/security` },
      {
        '@type': 'ListItem',
        position: 2,
        name: research.title,
        item: `${siteUrl}/security/${research.slug}`,
      },
    ],
  };

  return (
    <article className="container py-5 tone-security">
      <JsonLd data={jsonLd} />
      <JsonLd data={breadcrumbJsonLd} />
      <nav aria-label="Breadcrumb" className="mb-3">
        <ol className="breadcrumb small">
          <li className="breadcrumb-item">
            <Link href="/security">Security</Link>
          </li>
          <li className="breadcrumb-item active" aria-current="page">
            {research.title}
          </li>
        </ol>
      </nav>

      <h1 className="h2 mb-2">{research.title}</h1>
      {research.publishedAt && (
        <p className="mb-4 small" style={{ color: 'var(--color-text-muted)' }}>
          <time dateTime={research.publishedAt}>{formatDate(research.publishedAt)}</time>
        </p>
      )}

      {research.coverMedia && (
        <div className="ratio ratio-16x9 mb-5">
          <PublicMediaImage
            media={research.coverMedia}
            fill
            priority
            sizes="(max-width: 992px) 100vw, 900px"
            className="rounded-3 object-fit-cover"
          />
        </div>
      )}

      <MarkdownBody html={html} className="mb-5" />

      {research.tags.length > 0 && (
        <div className="d-flex flex-wrap gap-2 mb-5">
          {research.tags.map((tag) => (
            <span key={tag.id} className="badge text-bg-secondary fw-normal">
              #{tag.name}
            </span>
          ))}
        </div>
      )}

      {research.references.length > 0 && (
        <section className="pt-4 border-top">
          <h2 className="h5 mb-3">References</h2>
          <ul>
            {research.references.map((ref) => (
              <li key={ref.url}>
                <a href={ref.url} target="_blank" rel="noopener noreferrer">
                  {ref.label}
                </a>
              </li>
            ))}
          </ul>
        </section>
      )}
    </article>
  );
}
