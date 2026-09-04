'use client';

import { useState } from 'react';
import { useAnalyticsOverview } from '@/features/admin/analytics/client';

/**
 * `/admin/analytics` (doc07 §3: "Views over time, top projects, top
 * articles, referrer hosts, date-range picker"). Plain tables, not
 * charts — no charting library is installed in this project, and adding
 * one for a single read-only dashboard isn't proportionate; the same real
 * numbers a chart would plot are all here (doc07 §6: "No fake data" — a
 * table of real numbers beats a chart nobody built the library for).
 */
export default function AnalyticsPage(): React.JSX.Element {
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [groupBy, setGroupBy] = useState<'day' | 'week' | 'month'>('day');

  const overviewQuery = useAnalyticsOverview({
    from: from || undefined,
    to: to || undefined,
    groupBy,
  });

  return (
    <div className="admin-resource-page">
      <h1 className="h4 mb-4">Analytics</h1>

      <div className="row g-2 mb-4">
        <div className="col-sm-3">
          <label htmlFor="analytics-from" className="form-label">
            From
          </label>
          <input
            id="analytics-from"
            type="date"
            className="form-control"
            value={from}
            onChange={(event) => setFrom(event.target.value)}
          />
        </div>
        <div className="col-sm-3">
          <label htmlFor="analytics-to" className="form-label">
            To
          </label>
          <input
            id="analytics-to"
            type="date"
            className="form-control"
            value={to}
            onChange={(event) => setTo(event.target.value)}
          />
        </div>
        <div className="col-sm-3">
          <label htmlFor="analytics-groupBy" className="form-label">
            Group by
          </label>
          <select
            id="analytics-groupBy"
            className="form-select"
            value={groupBy}
            onChange={(event) => setGroupBy(event.target.value as 'day' | 'week' | 'month')}
          >
            <option value="day">Day</option>
            <option value="week">Week</option>
            <option value="month">Month</option>
          </select>
        </div>
      </div>

      {overviewQuery.isPending && <p className="text-body-secondary">Loading…</p>}
      {overviewQuery.isError && <div className="alert alert-danger">Couldn’t load analytics.</div>}

      {overviewQuery.data && (
        <>
          <div className="row g-3 mb-4">
            <div className="col-6 col-lg-3">
              <div className="admin-stat-card">
                <div className="admin-stat-card__value">{overviewQuery.data.totalViews}</div>
                <div className="admin-stat-card__label">Total views</div>
              </div>
            </div>
            <div className="col-6 col-lg-3">
              <div className="admin-stat-card">
                <div className="admin-stat-card__value">{overviewQuery.data.uniqueVisitors}</div>
                <div className="admin-stat-card__label">Unique visitors</div>
              </div>
            </div>
          </div>

          <h2 className="h6 text-uppercase text-body-secondary mb-2">Views over time</h2>
          {overviewQuery.data.series.length === 0 ? (
            <p className="text-body-secondary mb-4">No views recorded in this range.</p>
          ) : (
            <div className="table-responsive mb-4">
              <table className="table table-sm">
                <thead>
                  <tr>
                    <th scope="col">Period</th>
                    <th scope="col">Views</th>
                    <th scope="col">Unique visitors</th>
                  </tr>
                </thead>
                <tbody>
                  {overviewQuery.data.series.map((point) => (
                    <tr key={point.bucket}>
                      <td>{point.bucket}</td>
                      <td>{point.views}</td>
                      <td>{point.uniqueVisitors}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <div className="row">
            <div className="col-md-4 mb-4">
              <h2 className="h6 text-uppercase text-body-secondary mb-2">Top projects</h2>
              {overviewQuery.data.topProjects.length === 0 ? (
                <p className="text-body-secondary">No project views yet.</p>
              ) : (
                <ol>
                  {overviewQuery.data.topProjects.map((entry) => (
                    <li key={entry.entityId}>
                      {entry.title} — {entry.views}
                    </li>
                  ))}
                </ol>
              )}
            </div>
            <div className="col-md-4 mb-4">
              <h2 className="h6 text-uppercase text-body-secondary mb-2">Top articles</h2>
              {overviewQuery.data.topArticles.length === 0 ? (
                <p className="text-body-secondary">No article views yet.</p>
              ) : (
                <ol>
                  {overviewQuery.data.topArticles.map((entry) => (
                    <li key={entry.entityId}>
                      {entry.title} — {entry.views}
                    </li>
                  ))}
                </ol>
              )}
            </div>
            <div className="col-md-4 mb-4">
              <h2 className="h6 text-uppercase text-body-secondary mb-2">Referrer hosts</h2>
              {overviewQuery.data.topReferrerHosts.length === 0 ? (
                <p className="text-body-secondary">No referrer data yet.</p>
              ) : (
                <ol>
                  {overviewQuery.data.topReferrerHosts.map((entry) => (
                    <li key={entry.referrerHost}>
                      {entry.referrerHost} — {entry.views}
                    </li>
                  ))}
                </ol>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
