import { experienceCreateSchema } from '@portfolio/shared';
import { z } from 'zod';
import {
  dateOnlySchema,
  emptyStringsToUndefined,
  optionalDateOnlySchema,
  withFieldOverrides,
} from '@/features/admin/lib/formValues';

/**
 * Beyond the date-only-string swap every dated module needs
 * (`certifications/formSchema.ts`'s own doc), `achievements` is ALSO
 * overridden: the wire schema's `string[]` (`experience.ts`'s own comment:
 * "the repository layer owns replacing the whole set... the wire shape
 * only ever needs the text") has no per-item identity for
 * `useFieldArray` to key rows by, so the form models it as `{ text:
 * string }[]` instead — `toExperienceWirePayload` below is the one place
 * that flattens it back to `string[]` before it reaches the resource
 * client.
 */
export const experienceFormSchema = emptyStringsToUndefined(
  withFieldOverrides(experienceCreateSchema, {
    startDate: dateOnlySchema,
    endDate: optionalDateOnlySchema,
    achievements: z
      .array(z.object({ text: z.string().trim().min(1).max(300) }))
      .max(50)
      .optional(),
  }),
);
export type ExperienceFormValues = z.infer<typeof experienceFormSchema>;

/** The actual `POST`/`PATCH` body shape — `z.input` of the UNMODIFIED shared schema, i.e. exactly what the server's own `experienceCreateSchema` expects on the wire (dates as `"YYYY-MM-DD"` strings, achievements as plain `string[]`). */
export type ExperienceWirePayload = z.input<typeof experienceCreateSchema>;

export function toExperienceWirePayload(values: ExperienceFormValues): ExperienceWirePayload {
  const { achievements, ...rest } = values;
  return {
    ...rest,
    ...(achievements !== undefined ? { achievements: achievements.map((a) => a.text) } : {}),
  };
}
