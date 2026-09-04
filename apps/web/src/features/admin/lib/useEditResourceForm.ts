import { useEffect } from 'react';
import type { FieldValues, UseFormReturn } from 'react-hook-form';
import type { UseQueryResult } from '@tanstack/react-query';

/**
 * The Edit-page half of doc07 §2's module pattern that's identical across
 * every resource: once `hooks.useItem(id)` resolves, reset the form to the
 * fetched row (mapped through the resource's own `toFormValues`) so the
 * fields aren't stuck showing `useForm`'s empty initial `defaultValues`
 * while the fetch is in flight.
 *
 * Deliberately depends on `itemQuery.data` alone (this project has no
 * react-hooks plugin to enforce an exhaustive-deps list — see
 * `ResourceToolbar.tsx`'s own comment on the same tradeoff): `methods` is a
 * stable `useForm()` return for the life of the page, and `toFormValues` is
 * typically a fresh inline function every render — including either would
 * re-run this effect (and silently stomp any edits in progress) on every
 * keystroke, which is exactly the bug this hook exists to avoid.
 */
export function useEditResourceForm<TRow, TFieldValues extends FieldValues>({
  itemQuery,
  methods,
  toFormValues,
}: {
  itemQuery: UseQueryResult<TRow>;
  methods: UseFormReturn<TFieldValues>;
  toFormValues: (row: TRow) => TFieldValues;
}): void {
  useEffect(() => {
    if (!itemQuery.data) return;
    methods.reset(toFormValues(itemQuery.data));
  }, [itemQuery.data]);
}
