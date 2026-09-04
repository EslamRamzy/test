/**
 * Client-side slug derivation — matches `slugSchema`'s own regex exactly
 * (`packages/shared/src/schemas/primitives.ts`: `/^[a-z0-9]+(?:-[a-z0-9]+)*$/`),
 * so a slug this function produces always passes server-side validation
 * without a round trip. Used wherever the admin UI derives a slug from a
 * typed name rather than asking for one directly (`<TagInput>`'s
 * create-on-the-fly path).
 */
export function slugify(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}
