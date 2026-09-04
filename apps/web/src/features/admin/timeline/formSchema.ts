import { timelineEntryCreateSchema } from '@portfolio/shared';
import type { z } from 'zod';
import {
  dateOnlySchema,
  emptyStringsToUndefined,
  withFieldOverrides,
} from '@/features/admin/lib/formValues';

/** `entryDate` is required (unlike Certifications'/Education's optional dates), so it's overridden with the non-optional `dateOnlySchema`, same reasoning as `certifications/formSchema.ts`. */
export const timelineEntryFormSchema = emptyStringsToUndefined(
  withFieldOverrides(timelineEntryCreateSchema, { entryDate: dateOnlySchema }),
);
export type TimelineEntryFormValues = z.input<typeof timelineEntryCreateSchema>;
