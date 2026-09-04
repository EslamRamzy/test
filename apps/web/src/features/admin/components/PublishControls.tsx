import Button from 'react-bootstrap/Button';
import ButtonGroup from 'react-bootstrap/ButtonGroup';
import type { ContentStatus } from './StatusBadge';

/**
 * Publish · Unpublish · Archive · Duplicate, state-aware disabling (doc07
 * §2). No Preview button here — that is D6's signed-preview-token +
 * Next.js Draft Mode feature, which has no backing `POST
 * /admin/preview-token` endpoint in this phase (doc03 §5 lists it, but
 * Phase 8's own exit criterion — "created entirely through /admin appear
 * correctly on the public site" — never requires previewing BEFORE
 * publish); a deliberate scope trim, not an oversight.
 *
 * Doc07 §4's diagram draws `ARCHIVED -> DRAFT` as "restore," a visually
 * distinct transition from `PUBLISHED -> DRAFT` ("unpublish") — but both
 * hit the identical `POST .../unpublish` endpoint (`articleService.ts`'s
 * own comment on the API side), so this component picks the button LABEL
 * from the current status while calling the one `onUnpublish` handler
 * either way.
 */
export interface PublishControlsProps {
  status: ContentStatus;
  onPublish: () => void;
  onUnpublish: () => void;
  onArchive: () => void;
  onDuplicate: () => void;
  /** True while any action is in flight — disables every button so a second click can't race the first. */
  busy?: boolean;
}

export function PublishControls({
  status,
  onPublish,
  onUnpublish,
  onArchive,
  onDuplicate,
  busy = false,
}: PublishControlsProps): React.JSX.Element {
  return (
    <ButtonGroup className="admin-publish-controls" aria-label="Publishing actions">
      {status === 'DRAFT' && (
        <Button variant="success" onClick={onPublish} disabled={busy}>
          <span className="bi bi-cloud-upload" aria-hidden="true" /> Publish
        </Button>
      )}
      {status === 'PUBLISHED' && (
        <>
          <Button variant="outline-secondary" onClick={onUnpublish} disabled={busy}>
            <span className="bi bi-arrow-counterclockwise" aria-hidden="true" /> Unpublish
          </Button>
          <Button variant="outline-dark" onClick={onArchive} disabled={busy}>
            <span className="bi bi-archive" aria-hidden="true" /> Archive
          </Button>
        </>
      )}
      {status === 'ARCHIVED' && (
        <Button variant="outline-secondary" onClick={onUnpublish} disabled={busy}>
          <span className="bi bi-arrow-counterclockwise" aria-hidden="true" /> Restore to Draft
        </Button>
      )}
      <Button variant="outline-primary" onClick={onDuplicate} disabled={busy}>
        <span className="bi bi-files" aria-hidden="true" /> Duplicate
      </Button>
    </ButtonGroup>
  );
}
