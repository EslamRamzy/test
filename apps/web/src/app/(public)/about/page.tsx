import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getProfile, listSkillCategories } from '@/lib/api/endpoints';
import { getPublicSiteUrl } from '@/lib/config';
import { JsonLd } from '@/components/seo/JsonLd';
import { PublicMediaImage } from '@/components/ui/PublicMediaImage';
import { AnalyticsBeacon } from '@/features/analytics/AnalyticsBeacon';
import { SkillsPreview } from '@/features/home/components/SkillsPreview';

export async function generateMetadata(): Promise<Metadata> {
  const profile = await getProfile().catch(() => null);
  if (!profile) return {};
  const description = profile.shortBio ?? profile.headline;
  return {
    title: `About — ${profile.fullName}`,
    // Omitted, not `undefined` — see `(public)/page.tsx`'s comment: this
    // lets the root layout's own description fallback take over instead
    // of rendering no `<meta name="description">` at all.
    ...(description ? { description } : {}),
    alternates: { canonical: `${getPublicSiteUrl()}/about` },
  };
}

export default async function AboutPage() {
  const [profile, skillCategories] = await Promise.all([getProfile(), listSkillCategories()]);
  if (!profile) notFound();

  const bioParagraphs = (profile.fullBio ?? profile.shortBio ?? '').split(/\n{2,}/).filter(Boolean);

  // `Person` JSON-LD (docs/architecture/06 §8) — the canonical structured
  // description of who this whole site is about, so it belongs on the page
  // that IS that description, not the homepage.
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Person',
    name: profile.fullName,
    url: getPublicSiteUrl(),
    ...(profile.headline ? { jobTitle: profile.headline } : {}),
    ...(profile.shortBio ? { description: profile.shortBio } : {}),
    ...(profile.location ? { address: profile.location } : {}),
    ...(profile.avatar ? { image: profile.avatar.url } : {}),
    ...(profile.socialLinks.length > 0
      ? { sameAs: profile.socialLinks.map((link) => link.url) }
      : {}),
  };

  return (
    <>
      <AnalyticsBeacon entityType="PAGE" />
      <JsonLd data={jsonLd} />
      <section className="py-5 border-bottom">
        <div className="container">
          {/* No `g-*` gutter utility — see Hero.tsx's comment: it
              overflows past `.container`'s own fixed padding at narrow
              viewports (confirmed at 320px). */}
          <div className="row align-items-start">
            {profile.avatar && (
              <div className="col-md-4 text-center">
                <PublicMediaImage
                  media={profile.avatar}
                  width={320}
                  height={320}
                  className="rounded-4 border w-100"
                  sizes="(max-width: 768px) 200px, 320px"
                />
              </div>
            )}
            <div className="col-md-8">
              <h1 className="h2 mb-2">About {profile.fullName}</h1>
              {profile.headline && (
                <p className="fs-5 mb-3" style={{ color: 'var(--color-text-muted)' }}>
                  {profile.headline}
                </p>
              )}
              {bioParagraphs.length > 0 ? (
                bioParagraphs.map((paragraph, index) => (
                  // Index-as-key is safe here: paragraphs from one fetched bio string are never reordered/added mid-list.
                  <p key={index} className="mb-3">
                    {paragraph}
                  </p>
                ))
              ) : (
                <p className="mb-3" style={{ color: 'var(--color-text-muted)' }}>
                  No biography has been written yet.
                </p>
              )}
              {profile.location && (
                <p className="mb-0 small" style={{ color: 'var(--color-text-muted)' }}>
                  <span className="bi bi-geo-alt me-1" aria-hidden="true" />
                  {profile.location}
                </p>
              )}
            </div>
          </div>
        </div>
      </section>
      <SkillsPreview skillCategories={skillCategories} />
    </>
  );
}
