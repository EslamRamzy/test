import type { StatsDto } from '@portfolio/shared';

const STAT_LABELS: Array<{ key: keyof StatsDto; label: string; suffix?: string }> = [
  { key: 'yearsOfExperience', label: 'Years of Experience', suffix: '+' },
  { key: 'projectsCount', label: 'Projects Shipped' },
  { key: 'articlesCount', label: 'Articles Written' },
  { key: 'technologiesCount', label: 'Technologies' },
];

/** Doc 06 §6: "All counters in QuickStats come from GET /stats — no hardcoded numbers anywhere." */
export function QuickStats({ stats }: { stats: StatsDto }): React.JSX.Element {
  return (
    <section className="py-5 border-bottom" style={{ backgroundColor: 'var(--color-surface)' }}>
      <div className="container">
        <div className="row text-center g-4">
          {STAT_LABELS.map(({ key, label, suffix }) => (
            <div className="col-6 col-md-3" key={key}>
              <p className="display-6 fw-bold mb-0" style={{ color: 'var(--color-accent)' }}>
                {stats[key]}
                {suffix}
              </p>
              <p className="mb-0 small" style={{ color: 'var(--color-text-muted)' }}>
                {label}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
