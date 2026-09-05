import type { Metadata } from 'next';
import { listEducation, listExperience } from '@/lib/api/endpoints';
import { getPublicSiteUrl } from '@/lib/config';
import { AnalyticsBeacon } from '@/features/analytics/AnalyticsBeacon';
import { formatDate } from '@/lib/utils/formatDate';

export const metadata: Metadata = {
  title: 'Experience',
  description: 'Work experience and education.',
  alternates: { canonical: `${getPublicSiteUrl()}/experience` },
};

function dateRange(startDate: string, endDate: string | null, isCurrent?: boolean): string {
  const start = formatDate(startDate);
  if (isCurrent) return `${start} — Present`;
  if (!endDate) return start;
  return `${start} — ${formatDate(endDate)}`;
}

/** doc 06 §2 names no dedicated `/education` route; education is presented alongside experience on one CV page. */
export default async function ExperiencePage() {
  const [experience, education] = await Promise.all([listExperience(), listEducation()]);

  return (
    <div className="container py-5">
      <AnalyticsBeacon entityType="PAGE" />
      <h1 className="h2 mb-4">Experience</h1>

      {experience.length === 0 ? (
        <p style={{ color: 'var(--color-text-muted)' }}>No experience listed yet.</p>
      ) : (
        <div className="d-flex flex-column gap-4 mb-5">
          {experience.map((entry) => (
            <div key={entry.id} className="border-bottom pb-4">
              <div className="d-flex justify-content-between flex-wrap gap-2">
                <h2 className="h5 mb-0">{entry.position}</h2>
                <span className="small" style={{ color: 'var(--color-text-muted)' }}>
                  {dateRange(entry.startDate, entry.endDate, entry.isCurrent)}
                </span>
              </div>
              <p className="mb-2" style={{ color: 'var(--color-text-muted)' }}>
                {entry.organization}
                {entry.location && ` · ${entry.location}`}
              </p>
              {entry.description && <p className="mb-2">{entry.description}</p>}
              {entry.achievements.length > 0 && (
                <ul className="mb-2">
                  {entry.achievements.map((achievement) => (
                    <li key={achievement}>{achievement}</li>
                  ))}
                </ul>
              )}
              {entry.technologies.length > 0 && (
                <ul className="list-unstyled d-flex flex-wrap gap-2 mb-0">
                  {entry.technologies.map((tech) => (
                    <li key={tech.id} className="badge text-bg-secondary fw-normal">
                      {tech.name}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ))}
        </div>
      )}

      {education.length > 0 && (
        <>
          <h2 className="h3 mb-4">Education</h2>
          <div className="d-flex flex-column gap-4">
            {education.map((entry) => (
              <div key={entry.id} className="border-bottom pb-4">
                <div className="d-flex justify-content-between flex-wrap gap-2">
                  <h3 className="h5 mb-0">
                    {entry.degree}
                    {entry.field && `, ${entry.field}`}
                  </h3>
                  <span className="small" style={{ color: 'var(--color-text-muted)' }}>
                    {dateRange(entry.startDate, entry.endDate)}
                  </span>
                </div>
                <p className="mb-2" style={{ color: 'var(--color-text-muted)' }}>
                  {entry.institution}
                </p>
                {entry.description && <p className="mb-0">{entry.description}</p>}
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
