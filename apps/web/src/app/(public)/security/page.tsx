import type { Metadata } from 'next';
import Link from 'next/link';
import { listResearch } from '@/lib/api/endpoints';
import { ResearchCard } from '@/features/security/components/ResearchCard';
import { Pagination } from '@/components/ui/Pagination';

export const metadata: Metadata = {
  title: 'Security Research',
  description: 'Security research, write-ups, and methodology notes.',
};

const CATEGORIES = ['RESEARCH', 'WRITEUP', 'METHODOLOGY', 'NOTES', 'TOOL'] as const;
const CATEGORY_LABELS: Record<(typeof CATEGORIES)[number], string> = {
  RESEARCH: 'Research',
  WRITEUP: 'Write-up',
  METHODOLOGY: 'Methodology',
  NOTES: 'Notes',
  TOOL: 'Tool',
};

interface SecurityPageProps {
  searchParams: Promise<Record<string, string | undefined>>;
}

export default async function SecurityPage({ searchParams }: SecurityPageProps) {
  const params = await searchParams;
  const page = Number(params.page ?? '1') || 1;
  const category = params.category;

  const { items: research, meta } = await listResearch({ page, category });

  function buildHref(overrides: Record<string, string | undefined>): string {
    const next = new URLSearchParams();
    const merged = { category, ...overrides };
    for (const [key, value] of Object.entries(merged)) {
      if (value) next.set(key, value);
    }
    const query = next.toString();
    return query ? `/security?${query}` : '/security';
  }

  return (
    <div className="container py-5">
      <h1 className="h2 mb-4">Security Research</h1>

      <div className="d-flex flex-wrap gap-2 mb-4" role="group" aria-label="Filter by category">
        <Link
          href={buildHref({ category: undefined, page: undefined })}
          className={`btn btn-sm ${!category ? 'btn-primary' : 'btn-outline-secondary'}`}
        >
          All
        </Link>
        {CATEGORIES.map((value) => (
          <Link
            key={value}
            href={buildHref({ category: value, page: undefined })}
            className={`btn btn-sm ${category === value ? 'btn-primary' : 'btn-outline-secondary'}`}
          >
            {CATEGORY_LABELS[value]}
          </Link>
        ))}
      </div>

      {research.length === 0 ? (
        <p style={{ color: 'var(--color-text-muted)' }}>No research published yet.</p>
      ) : (
        <div className="row g-4 mb-4">
          {research.map((item) => (
            <div className="col-md-6 col-lg-4" key={item.id}>
              <ResearchCard research={item} headingLevel="h2" />
            </div>
          ))}
        </div>
      )}

      <Pagination meta={meta} buildHref={(targetPage) => buildHref({ page: String(targetPage) })} />
    </div>
  );
}
