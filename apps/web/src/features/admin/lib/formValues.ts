import { z, type ZodObject, type ZodRawShape, type ZodTypeAny } from 'zod';

/**
 * `<input type="date">` round-trips a plain `"YYYY-MM-DD"` string — the
 * exact wire format the server's `z.iso.date()` accepts, but NOT what the
 * shared `isoDateAsDate` schema (`packages/shared/src/schemas/
 * primitives.ts`) produces: it transforms that string into a real `Date`,
 * which is right for every repository's `create`/`update` call but wrong
 * for a controlled form field typed by the SAME shared schema — `useForm<T>`
 * and its `zodResolver` must agree on one shape, so `T` would have to be a
 * `Date` too, and a native date input has no `Date` to give it.
 *
 * `withFieldOverrides` (below) is how a module's own client-side resolver
 * schema swaps `isoDateAsDate` back out for a plain `z.iso.date()` — same
 * validation, no transform — so the resolver's output type matches the
 * form's own string-typed fields exactly, and a valid payload IS already
 * the string the server expects, with no Date round-trip anywhere.
 */
export const dateOnlySchema = z.iso.date();
export const optionalDateOnlySchema = z.iso.date().optional();

/** Server's `"2022-06-01T00:00:00.000Z"` -> the input's `"2022-06-01"`, for populating an Edit page's `defaultValues` from a fetched row. `null`/`undefined` (an unset optional date) becomes `''`, matching an empty `<input type="date">`. */
export function toDateInputValue(iso: string | null | undefined): string {
  return iso ? iso.slice(0, 10) : '';
}

/**
 * A controlled text/date input's "cleared" value is `''`, not `undefined` —
 * but every optional field in the shared create/update schemas (doc07 §2's
 * "the shared schema" for `zodResolver`) is `.optional()`, which validates
 * `undefined`, not the empty string an empty input actually submits.
 * Wrapping every field of an object schema in this preprocess step is what
 * lets a page reuse the exact shared schema as its resolver without every
 * optional field needing its own bespoke client-only variant.
 */
export function emptyStringsToUndefined<T extends ZodRawShape>(schema: ZodObject<T>): ZodObject<T> {
  const shape = schema.shape;
  const wrapped = Object.fromEntries(
    Object.entries(shape).map(([key, fieldSchema]) => [
      key,
      z.preprocess((value) => (value === '' ? undefined : value), fieldSchema as ZodTypeAny),
    ]),
  );
  return z.object(wrapped) as unknown as ZodObject<T>;
}

/**
 * Swaps named fields of a shared object schema for a different schema —
 * this module's own use is replacing an `isoDateAsDate` field with the
 * date-only-string `dateOnlySchema`/`optionalDateOnlySchema` above, but it
 * stays generic rather than a one-off date helper. Apply this BEFORE
 * `emptyStringsToUndefined`, so the replacement field is also covered by
 * the empty-string preprocessing.
 */
export function withFieldOverrides<
  T extends ZodRawShape,
  O extends Partial<Record<keyof T, ZodTypeAny>>,
>(
  schema: ZodObject<T>,
  overrides: O,
): ZodObject<Omit<T, keyof O> & { [K in keyof O]: O[K] extends ZodTypeAny ? O[K] : never }> {
  const shape = { ...schema.shape, ...overrides };
  return z.object(shape) as unknown as ZodObject<
    Omit<T, keyof O> & { [K in keyof O]: O[K] extends ZodTypeAny ? O[K] : never }
  >;
}
