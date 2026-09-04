'use client';

import { formatAuditTimestamp, humanizeAuditAction } from '@/features/admin/lib/formatAuditEntry';
import { useOverview } from '@/features/admin/hooks/useOverview';

const COUNTER_CARDS = [
  { key: 'projectsCount', label: 'Projects', icon: 'bi-kanban' },
  { key: 'articlesCount', label: 'Articles', icon: 'bi-file-text' },
  { key: 'unreadMessagesCount', label: 'Unread Messages', icon: 'bi-envelope' },
  { key: 'openFindingsCount', label: 'Open Findings', icon: 'bi-shield-exclamation' },
] as const;

/**
 * `GET /admin/overview` (docs/architecture/03 §5, docs/architecture/07 §3)
 * — every number here is that one real query, never a placeholder (doc 07
 * §6: "No fake data — every counter is a real query; empty states say 'No
 * projects yet'... never placeholder rows"). Recent Activity's own empty
 * state follows the same rule: "No activity yet," not a blank list or a
 * fabricated row.
 *
 * A Client Component, not a Server Component reading `serverApi` — this
 * page's data is per-session and mutation-driven (react-query's cache
 * invalidation, doc 07 §5), which is exactly the case that data layer
 * exists for; the public site's Server Components never need it because
 * their data isn't session-scoped in the first place.
 */
export default function AdminDashboardPage(): React.JSX.Element {
  const { data, isPending, isError, refetch } = useOverview();

  if (isPending) {
    return (
      <div className="admin-dashboard">
        <h1 className="h4 mb-4">Dashboard</h1>
        <div className="row g-3">
          {COUNTER_CARDS.map((card) => (
            <div className="col-6 col-lg-3" key={card.key}>
              <div className="admin-stat-card admin-stat-card--loading" aria-hidden="true" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="admin-dashboard">
        <h1 className="h4 mb-4">Dashboard</h1>
        <div className="alert alert-danger d-flex align-items-center justify-content-between">
          <span>Couldn&rsquo;t load the dashboard. Please try again.</span>
          <button type="button" className="btn btn-sm btn-outline-danger" onClick={() => refetch()}>
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="admin-dashboard">
      <h1 className="h4 mb-4">Dashboard</h1>

      <div className="row g-3 mb-5">
        {COUNTER_CARDS.map((card) => (
          <div className="col-6 col-lg-3" key={card.key}>
            <div className="admin-stat-card">
              <span className={`bi ${card.icon} admin-stat-card__icon`} aria-hidden="true" />
              <div className="admin-stat-card__value">{data[card.key]}</div>
              <div className="admin-stat-card__label">{card.label}</div>
            </div>
          </div>
        ))}
      </div>

      <section>
        <h2 className="h6 text-uppercase text-body-secondary mb-3">Recent Activity</h2>
        {data.recentActivity.length === 0 ? (
          <p className="text-body-secondary">No activity yet.</p>
        ) : (
          <ul className="admin-activity-list">
            {data.recentActivity.map((entry) => (
              <li key={entry.id} className="admin-activity-list__item">
                <span className="admin-activity-list__actor">{entry.actorName ?? 'System'}</span>
                <span className="admin-activity-list__action">
                  {humanizeAuditAction(entry.action)}
                </span>
                <time
                  className="admin-activity-list__time"
                  dateTime={entry.createdAt}
                  title={entry.createdAt}
                >
                  {formatAuditTimestamp(entry.createdAt)}
                </time>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
