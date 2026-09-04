import { securityResearchCreateSchema } from '@portfolio/shared';
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
 * Same shape as `articles/formSchema.ts` minus `categoryId` (this
 * resource's `category` is a fixed enum, not a relation, so it needs no
 * override at all) minus `author` (this entity has none). `references`
 * also needs no override — it's already `{label, url}[]`, exactly what
 * `useFieldArray` wants, unlike Experience's `achievements` (a bare
 * `string[]` with no per-row identity).
 */
const researchOverriddenSchema = withFieldOverrides(securityResearchCreateSchema, {
  coverMediaId: optionalPositiveIntStringSchema,
  publishedAt: optionalDatetimeLocalStringSchema,
  tagIds: z
    .array(z.object({ id: z.number(), name: z.string(), slug: z.string() }))
    .max(50)
    .optional(),
});

export type SecurityResearchFormValues = z.input<typeof researchOverriddenSchema>;

export const securityResearchFormSchema = emptyStringsToUndefined(researchOverriddenSchema);

export type SecurityResearchWirePayload = z.input<typeof securityResearchCreateSchema>;

export function toSecurityResearchWirePayload(
  values: SecurityResearchFormValues,
): SecurityResearchWirePayload {
  const { tagIds, coverMediaId, publishedAt, ...rest } = values;
  return {
    ...rest,
    coverMediaId: parseOptionalPositiveInt(coverMediaId),
    publishedAt: parseOptionalDatetimeLocal(publishedAt),
    ...(tagIds !== undefined ? { tagIds: tagIds.map((tag) => tag.id) } : {}),
  };
}
