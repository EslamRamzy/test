import type { SecurityResearchListItemDto } from '@portfolio/shared';
import Link from 'next/link';
import { ResearchCard } from '@/features/security/components/ResearchCard';

/**
 * The one place cyan appears (design concept §14 + `_themes.scss`'s
 * `.tone-security` — nothing outside this scope reads `--color-accent-2`
 * directly, which is what keeps it meaning something here). A thin
 * scanning-line sweep across an abstract technical grid stands in for
 * "systems/security," deliberately never a fake terminal or Matrix-style
 * effect (design concept's own explicit "avoid" list).
 */
export function SecurityPreview({
  research,
}: {
  research: SecurityResearchListItemDto[];
}): React.JSX.Element | null {
  if (research.length === 0) return null;

  return (
    <section className="security-preview tone-security">
      <div className="security-preview__scanpanel" aria-hidden="true">
        <div className="security-preview__scanline" />
      </div>
      <div className="container">
        <div className="d-flex justify-content-between align-items-center">
          <h2 className="section-heading mb-0">Security Research</h2>
          <Link href="/security" className="section-link">
            View all
            <span className="bi bi-arrow-right ms-2" aria-hidden="true" />
          </Link>
        </div>
        <div className="row g-4 mt-1">
          {research.map((item) => (
            <div className="col-md-6 col-lg-4" key={item.id}>
              <ResearchCard research={item} />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
