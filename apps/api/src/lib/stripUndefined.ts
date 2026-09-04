/**
 * Removes every key whose value is `undefined` from an object, and types
 * the result accordingly (`DefinedOnly<T>`) rather than returning `T`
 * unchanged.
 *
 * Every admin write schema (`packages/shared/src/schemas/*.ts`) uses plain
 * `.optional()` for an omittable field, which Zod infers as `key?: T`
 * (TypeScript reports this as `T | undefined` in diagnostics). Prisma's own
 * generated `*CreateInput`/`*UpdateInput` types for a nullable column are
 * `key?: T | null` — optional, but NEVER `undefined` when the key is
 * present — so passing a Zod-parsed object straight into `prisma.model.
 * create({ data })` fails under `exactOptionalPropertyTypes` the moment
 * any optional field is genuinely omitted by the caller (its value is
 * `undefined`, not absent-in-the-object-type sense once destructured
 * through a generic). Stripping `undefined`-valued keys first, and
 * re-typing the result with `undefined` excluded from every property,
 * is what makes the same object assignable to Prisma's input type.
 */
export type DefinedOnly<T> = { [K in keyof T]: Exclude<T[K], undefined> };

export function stripUndefined<T extends object>(obj: T): DefinedOnly<T> {
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj)) {
    if (value !== undefined) result[key] = value;
  }
  return result as DefinedOnly<T>;
}
