import { projectCreateSchema } from '@portfolio/shared';
import type { z } from 'zod';
import {
  emptyStringsToUndefined,
  optionalDatetimeLocalStringSchema,
  optionalPositiveIntStringSchema,
  parseOptionalDatetimeLocal,
  parseOptionalPositiveInt,
  withFieldOverrides,
} from '@/features/admin/lib/formValues';

/**
 * The MAIN project form — title through `features`, doc07 §3's Overview
 * and Case Study tabs plus the plain (non-repeater, non-relation) half of
 * the Security tab (`securityTested`/`securitySummary`/`testingSummary`).
 * Everything else the tabbed editor touches (`featured`, technologies,
 * images, sections, assessments/tests/findings) has its OWN dedicated
 * endpoint (`project.ts`'s own schema doc) and so its OWN mutation in
 * `client.ts`, entirely separate from this form and its single `PATCH
 * /:id` submit.
 *
 * Same two overrides as every other dated/id-bearing module.
 */
const projectOverriddenSchema = withFieldOverrides(projectCreateSchema, {
  coverMediaId: optionalPositiveIntStringSchema,
  publishedAt: optionalDatetimeLocalStringSchema,
});

export type ProjectFormValues = z.input<typeof projectOverriddenSchema>;

export const projectFormSchema = emptyStringsToUndefined(projectOverriddenSchema);

export type ProjectWirePayload = z.input<typeof projectCreateSchema>;

export function toProjectWirePayload(values: ProjectFormValues): ProjectWirePayload {
  const { coverMediaId, publishedAt, ...rest } = values;
  return {
    ...rest,
    coverMediaId: parseOptionalPositiveInt(coverMediaId),
    publishedAt: parseOptionalDatetimeLocal(publishedAt),
  };
}
