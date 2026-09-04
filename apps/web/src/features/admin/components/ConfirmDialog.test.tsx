import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ConfirmDialog } from './ConfirmDialog';

/**
 * The one piece of real logic worth a real test here: `requireTypedConfirmation`
 * gating Confirm (docs/architecture/07 §2, §6) — a bug that let Confirm
 * enable without an exact match would let a destructive action through
 * without the confirmation it exists to require.
 */
describe('ConfirmDialog', () => {
  it('without requireTypedConfirmation, Confirm is enabled immediately and calls onConfirm', () => {
    const onConfirm = vi.fn();
    render(
      <ConfirmDialog
        show
        title="Sign out?"
        message="Are you sure?"
        onConfirm={onConfirm}
        onCancel={vi.fn()}
      />,
    );

    const confirmButton = screen.getByRole('button', { name: 'Confirm' });
    expect(confirmButton).toBeEnabled();
    fireEvent.click(confirmButton);
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it('calls onCancel when Cancel is clicked', () => {
    const onCancel = vi.fn();
    render(
      <ConfirmDialog
        show
        title="Delete?"
        message="Sure?"
        onConfirm={vi.fn()}
        onCancel={onCancel}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it('with requireTypedConfirmation, Confirm stays disabled until the input matches exactly', () => {
    const onConfirm = vi.fn();
    render(
      <ConfirmDialog
        show
        title="Delete project?"
        message="This cannot be undone."
        requireTypedConfirmation="Portfolio Platform"
        onConfirm={onConfirm}
        onCancel={vi.fn()}
      />,
    );

    const confirmButton = screen.getByRole('button', { name: 'Confirm' });
    const input = screen.getByLabelText(/Type/i);

    expect(confirmButton).toBeDisabled();

    fireEvent.change(input, { target: { value: 'Portfolio Platfor' } });
    expect(confirmButton).toBeDisabled();

    fireEvent.change(input, { target: { value: 'portfolio platform' } });
    expect(confirmButton).toBeDisabled();

    fireEvent.change(input, { target: { value: 'Portfolio Platform' } });
    expect(confirmButton).toBeEnabled();

    fireEvent.click(confirmButton);
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it('resets the typed value when reopened, rather than carrying over a previous match', () => {
    const { rerender } = render(
      <ConfirmDialog
        show
        title="Delete project?"
        message="This cannot be undone."
        requireTypedConfirmation="Portfolio Platform"
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
      />,
    );

    fireEvent.change(screen.getByLabelText(/Type/i), {
      target: { value: 'Portfolio Platform' },
    });
    expect(screen.getByRole('button', { name: 'Confirm' })).toBeEnabled();

    // Close, then reopen for a DIFFERENT entity — the previous entity's
    // typed match must not silently satisfy this one's requirement.
    rerender(
      <ConfirmDialog
        show={false}
        title="Delete project?"
        message="This cannot be undone."
        requireTypedConfirmation="Portfolio Platform"
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
      />,
    );
    rerender(
      <ConfirmDialog
        show
        title="Delete article?"
        message="This cannot be undone."
        requireTypedConfirmation="A Different Title"
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
      />,
    );

    expect(screen.getByRole('button', { name: 'Confirm' })).toBeDisabled();
  });

  it('disables both buttons and relabels Confirm while confirming', () => {
    render(
      <ConfirmDialog
        show
        title="Sign out?"
        message="Sure?"
        confirming
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
      />,
    );

    expect(screen.getByRole('button', { name: 'Working…' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeDisabled();
  });
});
