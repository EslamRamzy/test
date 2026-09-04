import type { TimelineEntryDto } from '@portfolio/shared';
import { formatDate } from '@/lib/utils/formatDate';

export function Journey({ entries }: { entries: TimelineEntryDto[] }): React.JSX.Element | null {
  if (entries.length === 0) return null;

  return (
    <section className="py-5 border-bottom" style={{ backgroundColor: 'var(--color-surface)' }}>
      <div className="container">
        <h2 className="h3 mb-4">Journey</h2>
        <ol className="list-unstyled position-relative ps-4 mb-0" style={{ maxWidth: '70ch' }}>
          <div
            className="position-absolute top-0 bottom-0"
            style={{ left: '0.3rem', width: '2px', backgroundColor: 'var(--color-border)' }}
            aria-hidden="true"
          />
          {entries.map((entry) => (
            <li key={entry.id} className="position-relative mb-4 ps-3">
              <span
                className="position-absolute rounded-circle"
                style={{
                  left: '-1.5rem',
                  top: '0.35rem',
                  width: '0.6rem',
                  height: '0.6rem',
                  backgroundColor: 'var(--color-accent)',
                }}
                aria-hidden="true"
              />
              <p className="mb-0 small" style={{ color: 'var(--color-text-muted)' }}>
                {entry.yearLabel ?? formatDate(entry.entryDate)}
              </p>
              <h3 className="h6 mb-1">{entry.title}</h3>
              {entry.description && <p className="mb-0">{entry.description}</p>}
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
