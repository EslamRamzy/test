import type { PublicSecurityFindingDto } from '@portfolio/shared';

const SEVERITY_LABELS: Record<PublicSecurityFindingDto['severity'], string> = {
  CRITICAL: 'Critical',
  HIGH: 'High',
  MEDIUM: 'Medium',
  LOW: 'Low',
  INFORMATIONAL: 'Informational',
};

/** Severity colors come from `_tokens.scss` (docs/architecture/02 §3) — consistent hues in both themes. */
export function SeverityBadge({
  severity,
}: {
  severity: PublicSecurityFindingDto['severity'];
}): React.JSX.Element {
  const key = severity.toLowerCase();
  return (
    <span
      className="badge fw-normal"
      style={{
        backgroundColor: `var(--color-severity-${key}-soft)`,
        color: `var(--color-severity-${key})`,
      }}
    >
      {SEVERITY_LABELS[severity]}
    </span>
  );
}
