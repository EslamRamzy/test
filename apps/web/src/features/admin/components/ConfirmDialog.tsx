'use client';

import { useEffect, useState } from 'react';
import Button from 'react-bootstrap/Button';
import Modal from 'react-bootstrap/Modal';

/**
 * docs/architecture/07 §2, §6: "Required before every destructive action";
 * "destructive confirms require typing the entity title." A single
 * component covers both shapes this project needs: a plain Yes/Cancel
 * confirmation (e.g. Topbar's sign-out) when `requireTypedConfirmation` is
 * omitted, and a typed-match confirmation (Phase 8's entity deletes) when
 * it is set — Confirm stays disabled until the input matches exactly.
 */
export interface ConfirmDialogProps {
  show: boolean;
  title: string;
  message: React.ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: 'danger' | 'primary';
  /** The exact text (typically the entity's title) the visitor must retype before Confirm enables. */
  requireTypedConfirmation?: string;
  /** True while the confirmed action is in flight — disables both buttons and relabels Confirm. */
  confirming?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmDialog({
  show,
  title,
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  variant = 'danger',
  requireTypedConfirmation,
  confirming = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps): React.JSX.Element {
  const [typedValue, setTypedValue] = useState('');

  // Every open is a fresh confirmation — a value typed for a PREVIOUS
  // entity must never silently satisfy the check for a new one.
  useEffect(() => {
    if (show) setTypedValue('');
  }, [show]);

  const canConfirm = !requireTypedConfirmation || typedValue === requireTypedConfirmation;

  return (
    <Modal show={show} onHide={onCancel} centered aria-label={title}>
      <Modal.Header closeButton>
        <Modal.Title>{title}</Modal.Title>
      </Modal.Header>
      <Modal.Body>
        <p>{message}</p>
        {requireTypedConfirmation && (
          <div className="mb-0">
            <label
              htmlFor="confirm-dialog-typed-value"
              className="form-label small text-body-secondary"
            >
              Type <strong>{requireTypedConfirmation}</strong> to confirm
            </label>
            <input
              id="confirm-dialog-typed-value"
              type="text"
              className="form-control"
              value={typedValue}
              onChange={(event) => setTypedValue(event.target.value)}
              autoComplete="off"
              autoFocus
            />
          </div>
        )}
      </Modal.Body>
      <Modal.Footer>
        <Button variant="outline-secondary" onClick={onCancel} disabled={confirming}>
          {cancelLabel}
        </Button>
        <Button variant={variant} onClick={onConfirm} disabled={!canConfirm || confirming}>
          {confirming ? 'Working…' : confirmLabel}
        </Button>
      </Modal.Footer>
    </Modal>
  );
}
