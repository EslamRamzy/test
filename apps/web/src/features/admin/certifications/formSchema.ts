import { certificationCreateSchema } from '@portfolio/shared';
import type { z } from 'zod';
import {
  emptyStringsToUndefined,
  optionalDateOnlySchema,
  withFieldOverrides,
} from '@/features/admin/lib/formValues';

/**
 * `certificationCreateSchema`'s `issueDate`/`expirationDate` are
 * `isoDateAsDate` — valid for the server's own `create`/`update` calls, but
 * a `<input type="date">` needs `z.input<...>` (the pre-transform shape:
 * plain `"YYYY-MM-DD"` strings), which is exactly what this resolver
 * produces by swapping the transform back out (`formValues.ts`'s own doc).
 * `CertificationFormValues` is that same `z.input` shape — used as the
 * form's field type, the Create page's payload type, AND the Edit page's
 * payload type (same as every other simple module here: one
 * `<EntityForm>` field set works for both because `certificationUpdateSchema`
 * is `certificationCreateSchema.partial()` — a fully-populated create-shaped
 * object is already a valid update payload too).
 */
export const certificationFormSchema = emptyStringsToUndefined(
  withFieldOverrides(certificationCreateSchema, {
    issueDate: optionalDateOnlySchema,
    expirationDate: optionalDateOnlySchema,
  }),
);
export type CertificationFormValues = z.input<typeof certificationCreateSchema>;
