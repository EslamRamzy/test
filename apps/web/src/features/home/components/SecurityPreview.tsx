import type { SecurityResearchListItemDto } from '@portfolio/shared';
import Link from 'next/link';
import { ResearchCard } from '@/features/security/components/ResearchCard';

export function SecurityPreview({
  research,
}: {
  research: SecurityResearchListItemDto[];
}): React.JSX.Element | null {
  if (research.length === 0) return null;

  return (
    <section className="py-5 border-bottom" style={{ backgroundColor: 'var(--color-surface)' }}>
      <div className="container">
        <div className="d-flex justify-content-between align-items-center mb-4">
          <h2 className="h3 mb-0">Security Research</h2>
          <Link href="/security" className="link-primary">
            View all <span className="bi bi-arrow-right" aria-hidden="true" />
          </Link>
        </div>
        <div className="row g-4">
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
