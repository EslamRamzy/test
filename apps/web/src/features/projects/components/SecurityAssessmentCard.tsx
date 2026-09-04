import type { PublicSecurityAssessmentDto } from '@portfolio/shared';
import { SeverityBadge } from '@/components/ui/SeverityBadge';

const TEST_RESULT_LABELS: Record<string, string> = {
  PASS: 'Pass',
  ISSUES_FOUND: 'Issues found',
  NOT_APPLICABLE: 'N/A',
  NOT_TESTED: 'Not tested',
};

const TEST_RESULT_CLASSES: Record<string, string> = {
  PASS: 'text-bg-success',
  ISSUES_FOUND: 'text-bg-danger',
  NOT_APPLICABLE: 'text-bg-secondary',
  NOT_TESTED: 'text-bg-secondary',
};

const STATUS_LABELS: Record<PublicSecurityAssessmentDto['status'], string> = {
  PLANNED: 'Planned',
  IN_PROGRESS: 'In progress',
  COMPLETED: 'Completed',
  RETESTED: 'Retested',
};

/**
 * Every finding this component receives has ALREADY passed the doc 05 §4
 * public-safety filter server-side (`projectRepository.ts`'s
 * `PUBLIC_PROJECT_DETAIL_SELECT`) — an OPEN CRITICAL/HIGH finding is never
 * even in the payload this component renders from.
 */
export function SecurityAssessmentCard({
  assessment,
}: {
  assessment: PublicSecurityAssessmentDto;
}): React.JSX.Element {
  return (
    <div className="card mb-4">
      <div className="card-body">
        <div className="d-flex justify-content-between align-items-start mb-2">
          <h3 className="h5 mb-0">{assessment.title}</h3>
          <span className="badge text-bg-secondary fw-normal">
            {STATUS_LABELS[assessment.status]}
          </span>
        </div>
        {assessment.summary && (
          <p style={{ color: 'var(--color-text-muted)' }}>{assessment.summary}</p>
        )}

        {assessment.tests.length > 0 && (
          <ul className="list-unstyled d-flex flex-wrap gap-2 mb-3">
            {assessment.tests.map((test) => (
              <li key={test.testType}>
                <span
                  className={`badge fw-normal ${TEST_RESULT_CLASSES[test.result] ?? 'text-bg-secondary'}`}
                >
                  {test.testType.replaceAll('_', ' ')}:{' '}
                  {TEST_RESULT_LABELS[test.result] ?? test.result}
                </span>
              </li>
            ))}
          </ul>
        )}

        {assessment.findings.length > 0 && (
          <div className="table-responsive">
            <table className="table table-sm align-middle">
              <thead>
                <tr>
                  <th scope="col">Severity</th>
                  <th scope="col">Finding</th>
                  <th scope="col">Status</th>
                </tr>
              </thead>
              <tbody>
                {assessment.findings.map((finding) => (
                  <tr key={finding.id}>
                    <td>
                      <SeverityBadge severity={finding.severity} />
                    </td>
                    <td>{finding.title}</td>
                    <td className="small" style={{ color: 'var(--color-text-muted)' }}>
                      {finding.status.replaceAll('_', ' ')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
