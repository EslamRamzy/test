import { certificationCreateSchema } from '@portfolio/shared';
import type { z } from 'zod';
import {
  emptyStringsToUndefined,
  optionalDateOnlySchema,
  optionalPositiveIntStringSchema,
  parseOptionalPositiveInt,
  withFieldOverrides,
} from '@/features/admin/lib/formValues';

/**
 * `certificationCreateSchema`'s `issueDate`/`expirationDate` are
 * `isoDateAsDate` — valid for the server's own `create`/`update` calls, but
 * a `<input type="date">` needs `z.input<...>` (the pre-transform shape:
 * plain `"YYYY-MM-DD"` strings), which is exactly what this resolver
 * produces by swapping the transform back out (`formValues.ts`'s own doc).
 * `certificateMediaId` is overridden the same way, via
 * `optionalPositiveIntStringSchema` (see that schema's own doc) —
 * `toCertificationWirePayload` below is the one place its validated string
 * becomes the number the server actually expects.
 */
const certificationOverriddenSchema = withFieldOverrides(certificationCreateSchema, {
  issueDate: optionalDateOnlySchema,
  expirationDate: optionalDateOnlySchema,
  certificateMediaId: optionalPositiveIntStringSchema,
});

// `z.input` of THIS intermediate schema, not of the final
// `emptyStringsToUndefined`-wrapped one below — `emptyStringsToUndefined`
// wraps every field in `z.preprocess`, whose own `z.input` type is
// `unknown` by design (a preprocess step accepts anything before
// validating it), which would erase every field's real type here.
export type CertificationFormValues = z.input<typeof certificationOverriddenSchema>;

export const certificationFormSchema = emptyStringsToUndefined(certificationOverriddenSchema);

/** The actual `POST`/`PATCH` body shape — `z.input` of the UNMODIFIED shared schema (`certificateMediaId` back to a real `number`). */
export type CertificationWirePayload = z.input<typeof certificationCreateSchema>;

export function toCertificationWirePayload(
  values: CertificationFormValues,
): CertificationWirePayload {
  return { ...values, certificateMediaId: parseOptionalPositiveInt(values.certificateMediaId) };
}
