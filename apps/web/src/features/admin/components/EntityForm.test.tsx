import { fireEvent, render, screen } from '@testing-library/react';
import { useForm } from 'react-hook-form';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { EntityForm } from './EntityForm';

interface Values {
  title: string;
}

function Harness({
  onSubmit,
  onCancel,
  defaultValues = { title: '' },
  busy = false,
}: {
  onSubmit: (values: Values) => void;
  onCancel?: () => void;
  defaultValues?: Values;
  busy?: boolean;
}) {
  const methods = useForm<Values>({ defaultValues });
  return (
    <EntityForm
      methods={methods}
      onSubmit={onSubmit}
      busy={busy}
      {...(onCancel ? { onCancel } : {})}
    >
      <input aria-label="Title" {...methods.register('title', { required: 'Title is required' })} />
    </EntityForm>
  );
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('EntityForm', () => {
  it('submits the form values through react-hook-form', async () => {
    const onSubmit = vi.fn();
    render(<Harness onSubmit={onSubmit} />);

    fireEvent.change(screen.getByLabelText('Title'), { target: { value: 'My Project' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    await vi.waitFor(() => {
      expect(onSubmit).toHaveBeenCalledWith(
        expect.objectContaining({ title: 'My Project' }),
        expect.anything(),
      );
    });
  });

  it('shows an error summary linking to the invalid field when validation fails', async () => {
    const onSubmit = vi.fn();
    render(<Harness onSubmit={onSubmit} />);

    // Empty title fails the `required` rule registered above.
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    await vi.waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent('Title is required');
    });
    expect(screen.getByRole('link', { name: /title/ })).toHaveAttribute('href', '#field-title');
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('renders a Cancel button only when onCancel is provided, and calls it', () => {
    const onCancel = vi.fn();
    const { rerender } = render(<Harness onSubmit={vi.fn()} />);
    expect(screen.queryByRole('button', { name: 'Cancel' })).not.toBeInTheDocument();

    rerender(<Harness onSubmit={vi.fn()} onCancel={onCancel} />);
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it('disables Save (and Cancel) while busy', () => {
    render(<Harness onSubmit={vi.fn()} onCancel={vi.fn()} busy />);
    expect(screen.getByRole('button', { name: 'Saving…' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeDisabled();
  });

  it('warns before unload once the form becomes dirty', () => {
    render(<Harness onSubmit={vi.fn()} defaultValues={{ title: 'Original' }} />);

    const event = new Event('beforeunload', { cancelable: true });
    window.dispatchEvent(event);
    expect(event.defaultPrevented).toBe(false); // not dirty yet

    fireEvent.change(screen.getByLabelText('Title'), { target: { value: 'Changed' } });

    const eventAfterEdit = new Event('beforeunload', { cancelable: true });
    window.dispatchEvent(eventAfterEdit);
    expect(eventAfterEdit.defaultPrevented).toBe(true);
  });
});
