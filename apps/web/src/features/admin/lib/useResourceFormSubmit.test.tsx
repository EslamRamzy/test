import { act, renderHook, waitFor } from '@testing-library/react';
import { useForm } from 'react-hook-form';
import { describe, expect, it, vi } from 'vitest';
import { ApiError } from '@/lib/api/ApiError';
import { ToastProvider } from '@/features/admin/components/ToastProvider';
import { useResourceFormSubmit } from './useResourceFormSubmit';

const pushMock = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: pushMock }),
}));

interface Values {
  name: string;
}

function setup(mutateAsync: (payload: unknown) => Promise<unknown>) {
  return renderHook(
    () => {
      const methods = useForm<Values>({ defaultValues: { name: '' } });
      void methods.formState.errors;
      const submit = useResourceFormSubmit<Values, { name: string }>({
        methods,
        mutateAsync,
        toPayload: (values) => ({ name: values.name }),
        successMessage: 'Technology saved.',
        redirectTo: '/admin/technologies',
      });
      return { methods, submit };
    },
    { wrapper: ({ children }) => <ToastProvider>{children}</ToastProvider> },
  );
}

describe('useResourceFormSubmit', () => {
  it('calls mutateAsync with the mapped payload, toasts, and navigates on success', async () => {
    pushMock.mockClear();
    const mutateAsync = vi.fn().mockResolvedValue({ id: 1 });
    const { result } = setup(mutateAsync);

    await act(async () => {
      await result.current.submit.onSubmit({ name: 'React' });
    });

    expect(mutateAsync).toHaveBeenCalledWith({ name: 'React' });
    expect(pushMock).toHaveBeenCalledWith('/admin/technologies');
  });

  it('maps a VALIDATION_ERROR onto the form field and does not navigate', async () => {
    pushMock.mockClear();
    const mutateAsync = vi
      .fn()
      .mockRejectedValue(
        new ApiError(400, 'Request validation failed', 'VALIDATION_ERROR', [
          { field: 'name', message: 'Already taken' },
        ]),
      );
    const { result } = setup(mutateAsync);

    await act(async () => {
      await result.current.submit.onSubmit({ name: 'Dup' });
    });

    expect(result.current.methods.formState.errors.name?.message).toBe('Already taken');
    expect(pushMock).not.toHaveBeenCalled();
  });

  it('shows a toast (rather than a field error) for a non-field error', async () => {
    pushMock.mockClear();
    const mutateAsync = vi.fn().mockRejectedValue(new ApiError(500, 'Server exploded'));
    const { result } = setup(mutateAsync);

    await act(async () => {
      await result.current.submit.onSubmit({ name: 'React' });
    });

    expect(await waitFor(() => document.body.textContent)).toContain('Server exploded');
    expect(pushMock).not.toHaveBeenCalled();
  });
});
