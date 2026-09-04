import { educationCreateSchema } from '@portfolio/shared';
import type { z } from 'zod';
import {
  dateOnlySchema,
  emptyStringsToUndefined,
  optionalDateOnlySchema,
  withFieldOverrides,
} from '@/features/admin/lib/formValues';

/** Same reasoning as `certifications/formSchema.ts`: `startDate`/`endDate` swapped for the date-only-string schema so a `<input type="date">` and `zodResolver` agree on one shape. `startDate` is required (`dateOnlySchema`); `endDate` stays optional (`optionalDateOnlySchema`). */
export const educationFormSchema = emptyStringsToUndefined(
  withFieldOverrides(educationCreateSchema, {
    startDate: dateOnlySchema,
    endDate: optionalDateOnlySchema,
  }),
);
export type EducationFormValues = z.input<typeof educationCreateSchema>;
