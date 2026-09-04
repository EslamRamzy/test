'use client';

import { useEffect } from 'react';
import { FormProvider, type FieldValues, type UseFormReturn } from 'react-hook-form';

/**
 * `<EntityForm>` — "react-hook-form + zodResolver (the shared schema),
 * dirty tracking, unsaved-changes guard, error summary" (doc07 §2). The
 * FIELDS are still authored per module (every resource's own shape is too
 * different for one generic field-renderer to earn its keep) — this
 * component is the cross-cutting wrapper every one of them shares: the
 * `<form>` element itself, the submit/cancel actions, the error summary,
 * and the `beforeunload` guard.
 *
 * `methods` comes from the page's own `useForm({ resolver:
 * zodResolver(theSharedZodSchema) })` — `<EntityForm>` never constructs
 * the form itself, it just wraps whatever the caller built with the shared
 * schema, which is what keeps this one component usable across ~13
 * differently-shaped resources.
 */
export interface EntityFormProps<TFieldValues extends FieldValues> {
  methods: UseFormReturn<TFieldValues>;
  onSubmit: (values: TFieldValues) => void | Promise<void>;
  children: React.ReactNode;
  submitLabel?: string;
  /** True while the surrounding page's own mutation is in flight — combined with react-hook-form's own `isSubmitting`. */
  busy?: boolean;
  onCancel?: () => void;
}

export function EntityForm<TFieldValues extends FieldValues>({
  methods,
  onSubmit,
  children,
  submitLabel = 'Save',
  busy = false,
  onCancel,
}: EntityFormProps<TFieldValues>): React.JSX.Element {
  const {
    handleSubmit,
    formState: { errors, isDirty, isSubmitting },
  } = methods;

  // doc07 §6: "Never lose work... beforeunload guard while dirty."
  useEffect(() => {
    if (!isDirty) return undefined;
    function handler(event: BeforeUnloadEvent): void {
      event.preventDefault();
    }
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [isDirty]);

  const errorEntries = Object.entries(errors).filter(([, error]) => error);
  const disabled = busy || isSubmitting;

  return (
    <FormProvider {...methods}>
      <form onSubmit={(event) => void handleSubmit(onSubmit)(event)} noValidate>
        {errorEntries.length > 0 && (
          <div className="alert alert-danger admin-entity-form__error-summary" role="alert">
            <p className="mb-1 fw-semibold">Please fix the following:</p>
            <ul className="mb-0">
              {errorEntries.map(([field, error]) => (
                <li key={field}>
                  <a href={`#field-${field}`}>{field}</a>:{' '}
                  {typeof error?.message === 'string' ? error.message : 'Invalid value'}
                </li>
              ))}
            </ul>
          </div>
        )}

        {children}

        <div className="admin-entity-form__actions">
          {onCancel && (
            <button
              type="button"
              className="btn btn-outline-secondary"
              onClick={onCancel}
              disabled={disabled}
            >
              Cancel
            </button>
          )}
          <button type="submit" className="btn btn-primary" disabled={disabled}>
            {disabled ? 'Saving…' : submitLabel}
          </button>
        </div>
      </form>
    </FormProvider>
  );
}
