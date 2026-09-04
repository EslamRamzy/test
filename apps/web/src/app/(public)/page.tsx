import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getHome } from '@/lib/api/endpoints';
import { Reveal } from '@/components/ui/Reveal';
import { AboutPreview } from '@/features/home/components/AboutPreview';
import { ArticlesPreview } from '@/features/home/components/ArticlesPreview';
import { ContactCta } from '@/features/home/components/ContactCta';
import { FeaturedProjects } from '@/features/home/components/FeaturedProjects';
import { Hero } from '@/features/home/components/Hero';
import { Journey } from '@/features/home/components/Journey';
import { QuickStats } from '@/features/home/components/QuickStats';
import { SecurityPreview } from '@/features/home/components/SecurityPreview';
import { SkillsPreview } from '@/features/home/components/SkillsPreview';

export async function generateMetadata(): Promise<Metadata> {
  const home = await getHome().catch(() => null);
  if (!home) return {};

  const description = home.profile.headline ?? home.profile.shortBio;

  return {
    title: home.profile.fullName,
    // Omitted entirely (not set to `description: undefined`) when there's
    // no headline/bio yet, so the root layout's own `generateMetadata()`
    // fallback (profile's `seo.default_description` setting, or the
    // hardcoded default) actually takes over instead of rendering no
    // description tag at all — a real Lighthouse run caught the latter.
    ...(description ? { description } : {}),
  };
}

/**
 * The ten homepage sections (docs/architecture/06 §6): nine rendered here,
 * in doc order, each returning `null` on empty data rather than an empty
 * shell (same section) — the tenth, Footer, is `(public)/layout.tsx`'s job
 * since it belongs on every page, not just this one.
 */
export default async function HomePage() {
  const home = await getHome();
  // The API already turns "no profile row" into the same 404 shape doc 03
  // §1 defines for any other absent resource (see homeService.ts) — this
  // is that shape reaching Next's own styled 404, not an unexpected state.
  if (!home) notFound();

  return (
    <>
      {/* Hero stays un-revealed — it's above the fold on load, so a
          scroll-triggered fade would just delay the first thing a visitor
          sees instead of animating an entrance. Every section below it is
          typically below the fold at first paint, so each gets the
          one-shot IntersectionObserver reveal (docs/architecture/06 §5). */}
      <Hero profile={home.profile} />
      <Reveal>
        <QuickStats stats={home.stats} />
      </Reveal>
      <Reveal>
        <AboutPreview profile={home.profile} />
      </Reveal>
      <Reveal>
        <SkillsPreview skillCategories={home.skillCategories} />
      </Reveal>
      <Reveal>
        <FeaturedProjects projects={home.featuredProjects} />
      </Reveal>
      <Reveal>
        <SecurityPreview research={home.latestResearch} />
      </Reveal>
      <Reveal>
        <ArticlesPreview articles={home.latestArticles} />
      </Reveal>
      <Reveal>
        <Journey entries={home.timeline} />
      </Reveal>
      <Reveal>
        <ContactCta />
      </Reveal>
    </>
  );
}
