import type { SecurityResearchListItemDto } from '@portfolio/shared';
import Link from 'next/link';
import { PublicMediaImage } from '@/components/ui/PublicMediaImage';
import { formatDate } from '@/lib/utils/formatDate';

const CATEGORY_LABELS: Record<SecurityResearchListItemDto['category'], string> = {
  RESEARCH: 'Research',
  WRITEUP: 'Write-up',
  METHODOLOGY: 'Methodology',
  NOTES: 'Notes',
  TOOL: 'Tool',
};

interface ResearchCardProps {
  research: SecurityResearchListItemDto;
  /** See ProjectCard's `headingLevel` — same reasoning, same fix. */
  headingLevel?: 'h2' | 'h3' | undefined;
}

export function ResearchCard({
  research,
  headingLevel = 'h3',
}: ResearchCardProps): React.JSX.Element {
  const Heading = headingLevel;
  return (
    <Link
      href={`/security/${research.slug}`}
      className="card h-100 text-decoration-none text-reset"
    >
      {research.coverMedia && (
        <div className="ratio ratio-16x9">
          <PublicMediaImage
            media={research.coverMedia}
            fill
            sizes="(max-width: 768px) 100vw, 33vw"
            className="card-img-top object-fit-cover"
          />
        </div>
      )}
      <div className="card-body d-flex flex-column">
        <span className="badge text-bg-secondary fw-normal mb-2 align-self-start">
          {CATEGORY_LABELS[research.category]}
        </span>
        <Heading className="h5">{research.title}</Heading>
        {research.description && (
          <p className="mb-3 flex-grow-1" style={{ color: 'var(--color-text-muted)' }}>
            {research.description}
          </p>
        )}
        {research.publishedAt && (
          <p className="mb-0 small" style={{ color: 'var(--color-text-muted)' }}>
            <time dateTime={research.publishedAt}>{formatDate(research.publishedAt)}</time>
          </p>
        )}
      </div>
    </Link>
  );
}
