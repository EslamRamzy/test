import Badge from 'react-bootstrap/Badge';

/** Draft / Published / Archived (doc07 §2) — the one place this three-way color mapping lives, so every module's list/edit screen reads it identically. */
export type ContentStatus = 'DRAFT' | 'PUBLISHED' | 'ARCHIVED';

const VARIANT: Record<ContentStatus, string> = {
  DRAFT: 'secondary',
  PUBLISHED: 'success',
  ARCHIVED: 'dark',
};

const LABEL: Record<ContentStatus, string> = {
  DRAFT: 'Draft',
  PUBLISHED: 'Published',
  ARCHIVED: 'Archived',
};

export function StatusBadge({ status }: { status: ContentStatus }): React.JSX.Element {
  return (
    <Badge bg={VARIANT[status]} className="admin-status-badge">
      {LABEL[status]}
    </Badge>
  );
}
