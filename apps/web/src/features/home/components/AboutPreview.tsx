import type { ProfileDto, SkillCategoryDto } from '@portfolio/shared';
import Link from 'next/link';

/**
 * One large statement, not a paragraph (design concept §11) — `shortBio`
 * (falling back to `fullBio`) IS that statement; nothing here is
 * hardcoded copy standing in for it. The four "pillars" underneath reuse
 * real skill-category names (already fetched for `SkillsPreview` on the
 * same page — see `(public)/page.tsx`) rather than inventing a fixed
 * label set: capability areas an admin actually maintains, not fabricated
 * marketing copy pretending to be structured data.
 */
export function AboutPreview({
  profile,
  skillCategories,
}: {
  profile: ProfileDto;
  skillCategories: SkillCategoryDto[];
}): React.JSX.Element | null {
  const statement = profile.shortBio ?? profile.fullBio;
  if (!statement) return null;

  const pillars = skillCategories.slice(0, 4);

  return (
    <section className="about-preview">
      <div className="container">
        <div className="row">
          <div className="col-lg-9">
            <p className="about-preview__eyebrow">About</p>
            <p className="about-preview__statement">{statement}</p>
            <Link href="/about" className="section-link">
              Read more
              <span className="bi bi-arrow-right ms-2" aria-hidden="true" />
            </Link>
          </div>
        </div>

        {pillars.length > 0 && (
          <div className="about-preview__pillars">
            {pillars.map((category, index) => (
              <div
                className="about-preview__pillar"
                key={category.id}
                style={{ '--i': index } as React.CSSProperties}
              >
                <span className={category.icon ?? 'bi bi-check2'} aria-hidden="true" />
                <span className="about-preview__pillar-name">{category.name}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
