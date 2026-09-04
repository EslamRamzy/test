import type { PaginationMeta } from '@portfolio/shared';
import Link from 'next/link';

/** Shared pagination control (docs/architecture/03 §2) — every list page passes its own `meta` and href builder. */
export function Pagination({
  meta,
  buildHref,
}: {
  meta: PaginationMeta;
  buildHref: (page: number) => string;
}): React.JSX.Element | null {
  if (meta.totalPages <= 1) return null;

  const hasPrevious = meta.page > 1;
  const hasNext = meta.page < meta.totalPages;

  return (
    <nav aria-label="Pagination" className="d-flex justify-content-between align-items-center">
      {hasPrevious ? (
        <Link href={buildHref(meta.page - 1)} className="btn btn-outline-secondary btn-sm">
          <span className="bi bi-arrow-left me-1" aria-hidden="true" />
          Previous
        </Link>
      ) : (
        <span />
      )}
      <span className="small" style={{ color: 'var(--color-text-muted)' }}>
        Page {meta.page} of {meta.totalPages}
      </span>
      {hasNext ? (
        <Link href={buildHref(meta.page + 1)} className="btn btn-outline-secondary btn-sm">
          Next
          <span className="bi bi-arrow-right ms-1" aria-hidden="true" />
        </Link>
      ) : (
        <span />
      )}
    </nav>
  );
}
