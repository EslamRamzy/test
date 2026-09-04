import type { CertificationRow } from '@portfolio/shared';
import { createAdminResourceClient } from '@/lib/api/adminResource';
import { createAdminResourceHooks } from '@/features/admin/lib/adminResourceHooks';
import type { CertificationFormValues } from './formSchema';

/**
 * `TCreate`/`TUpdate` are both the schema's `z.input` shape (dates as plain
 * `"YYYY-MM-DD"` strings, from `formSchema.ts`), not the `z.output`
 * `CertificationCreateInput`/`UpdateInput` (dates as `Date`) — a validated
 * form value already IS this wire payload, no conversion in between. One
 * type for both, same reasoning as `formSchema.ts`'s own doc.
 */
export const certificationsClient = createAdminResourceClient<
  CertificationRow,
  CertificationFormValues,
  CertificationFormValues
>('/api/v1/admin/certifications', { reorder: true });

export const certificationsHooks = createAdminResourceHooks(
  certificationsClient,
  'admin-certifications',
);
