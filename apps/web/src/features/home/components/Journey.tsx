import type { TimelineEntryDto } from '@portfolio/shared';
import { Reveal } from '@/components/ui/Reveal';
import { formatDate } from '@/lib/utils/formatDate';

/**
 * Vertical, minimal, animated (design concept §16) — the connecting line
 * is drawn once (CSS `::before` on the list), each point stagger-reveals
 * on its own via `Reveal`'s `stagger` variant.
 */
export function Journey({ entries }: { entries: TimelineEntryDto[] }): React.JSX.Element | null {
  if (entries.length === 0) return null;

  return (
    <section className="journey">
      <div className="container">
        <h2 className="section-heading">Journey</h2>
        <Reveal variant="stagger" className="journey__list">
          {entries.map((entry, index) => (
            <div
              className="journey__point"
              key={entry.id}
              style={{ '--i': index } as React.CSSProperties}
            >
              <span className="journey__dot" aria-hidden="true" />
              <span className="journey__date">
                {entry.yearLabel ?? formatDate(entry.entryDate)}
              </span>
              <h3 className="journey__title">{entry.title}</h3>
              {entry.description && <p className="journey__desc">{entry.description}</p>}
            </div>
          ))}
        </Reveal>
      </div>
    </section>
  );
}
