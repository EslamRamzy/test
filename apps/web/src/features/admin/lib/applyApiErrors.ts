import type { FieldValues, Path, UseFormReturn } from 'react-hook-form';
import { ApiError } from '@/lib/api/ApiError';

/**
 * doc07 §6: "Field-level errors from the API `details` array mapped back
 * onto the form; a summary at the top linking to the first invalid field."
 * The summary itself is `<EntityForm>`'s own job (it reads react-hook-form's
 * `formState.errors`, already populated by this function's `setError`
 * calls); this is only the mapping step, called from a mutation's `onError`.
 *
 * A detail whose `field` doesn't match any known form field (a
 * server-side-only field, or a nested path this simple mapper doesn't
 * understand) is silently dropped from the per-field mapping — the error's
 * `message` is still shown via the toast the caller's own `onError` raises
 * separately, so nothing is lost, just not also pinned to a field.
 */
export function applyApiErrors<TFieldValues extends FieldValues>(
  methods: UseFormReturn<TFieldValues>,
  error: unknown,
): boolean {
  if (!(error instanceof ApiError) || !error.details || error.details.length === 0) {
    return false;
  }

  const knownFields = new Set(Object.keys(methods.getValues()));
  let applied = false;
  for (const detail of error.details) {
    if (!knownFields.has(detail.field)) continue;
    methods.setError(detail.field as Path<TFieldValues>, {
      type: 'server',
      message: detail.message,
    });
    applied = true;
  }
  return applied;
}
