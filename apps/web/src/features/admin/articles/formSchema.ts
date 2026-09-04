import { articleCreateSchema } from '@portfolio/shared';
import { z } from 'zod';
import {
  emptyStringsToUndefined,
  optionalDatetimeLocalStringSchema,
  optionalPositiveIntStringSchema,
  parseOptionalDatetimeLocal,
  parseOptionalPositiveInt,
  withFieldOverrides,
} from '@/features/admin/lib/formValues';

/**
 * Three overrides beyond the plain fields:
 * - `coverMediaId`/`categoryId`: same `optionalPositiveIntStringSchema`
 *   reasoning as `certifications/formSchema.ts` — `categoryId` picks from a
 *   real `<select>`, but the DOM value is still a string either way.
 * - `publishedAt`: `optionalDatetimeLocalStringSchema` (`formValues.ts`'s
 *   own doc) — `<input type="datetime-local">`'s value fails the server's
 *   `isoDatetimeAsDate` outright, so this is validated loosely here and
 *   converted properly in `toArticleWirePayload`.
 * - `tagIds`: still named `tagIds` on the form (so the resolver's output
 *   key matches `ArticleFormValues` exactly — `<EntityForm>`'s
 *   `UseFormReturn<TFieldValues>` has no slot for a renamed field), but
 *   holds full `TagOption[]` objects instead of bare ids — `<TagInput>`
 *   (doc07 §2) works with `{id, name, slug}`, and flattening to real ids is
 *   `toArticleWirePayload`'s job, same shape as `experience/formSchema.ts`'s
 *   achievements handling.
 */
const articleOverriddenSchema = withFieldOverrides(articleCreateSchema, {
  coverMediaId: optionalPositiveIntStringSchema,
  categoryId: optionalPositiveIntStringSchema,
  publishedAt: optionalDatetimeLocalStringSchema,
  tagIds: z
    .array(z.object({ id: z.number(), name: z.string(), slug: z.string() }))
    .max(50)
    .optional(),
});

// See `certifications/formSchema.ts`'s identical comment: `z.input` of this
// intermediate (pre-`emptyStringsToUndefined`) schema, never of the final
// wrapped one, whose own `z.input` collapses to `unknown` per field.
export type ArticleFormValues = z.input<typeof articleOverriddenSchema>;

export const articleFormSchema = emptyStringsToUndefined(articleOverriddenSchema);

/** The actual `POST`/`PATCH` body shape — `z.input` of the UNMODIFIED shared schema. */
export type ArticleWirePayload = z.input<typeof articleCreateSchema>;

export function toArticleWirePayload(values: ArticleFormValues): ArticleWirePayload {
  const { tagIds, coverMediaId, categoryId, publishedAt, ...rest } = values;
  return {
    ...rest,
    coverMediaId: parseOptionalPositiveInt(coverMediaId),
    categoryId: parseOptionalPositiveInt(categoryId),
    publishedAt: parseOptionalDatetimeLocal(publishedAt),
    ...(tagIds !== undefined ? { tagIds: tagIds.map((tag) => tag.id) } : {}),
  };
}
