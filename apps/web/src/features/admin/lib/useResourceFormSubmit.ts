'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import type { FieldValues, UseFormReturn } from 'react-hook-form';
import { ApiError } from '@/lib/api/ApiError';
import { useToast } from '@/features/admin/components/ToastProvider';
import { applyApiErrors } from './applyApiErrors';

/**
 * The submit handler every Create/Edit page in doc07 §2's module pattern
 * needs, regardless of resource: call the mutation, map a
 * `VALIDATION_ERROR`'s field errors onto the form (`applyApiErrors`), toast
 * on success or on any error `applyApiErrors` didn't already pin to a
 * field, and navigate back to the list on success. The mutation call
 * itself and the values-to-payload mapping stay per-resource (`mutateAsync`/
 * `toPayload`) — this hook only owns the outcome handling that's identical
 * across all of them.
 */
export function useResourceFormSubmit<TFieldValues extends FieldValues, TPayload>({
  methods,
  mutateAsync,
  toPayload,
  successMessage,
  redirectTo,
}: {
  methods: UseFormReturn<TFieldValues>;
  mutateAsync: (payload: TPayload) => Promise<unknown>;
  toPayload: (values: TFieldValues) => TPayload;
  successMessage: string;
  redirectTo: string;
}): { onSubmit: (values: TFieldValues) => Promise<void>; busy: boolean } {
  const router = useRouter();
  const { show } = useToast();
  const [busy, setBusy] = useState(false);

  async function onSubmit(values: TFieldValues): Promise<void> {
    setBusy(true);
    try {
      await mutateAsync(toPayload(values));
      show({ message: successMessage, variant: 'success' });
      router.push(redirectTo);
    } catch (error) {
      const appliedToFields = applyApiErrors(methods, error);
      if (!appliedToFields) {
        show({
          message:
            error instanceof ApiError ? error.message : 'Something went wrong. Please try again.',
          variant: 'danger',
          autohideMs: null,
        });
      }
    } finally {
      setBusy(false);
    }
  }

  return { onSubmit, busy };
}
