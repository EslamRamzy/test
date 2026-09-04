import type { CertificationRow } from '@portfolio/shared';
import { createAdminResourceClient } from '@/lib/api/adminResource';
import { createAdminResourceHooks } from '@/features/admin/lib/adminResourceHooks';
import type { CertificationWirePayload } from './formSchema';

/** `TCreate`/`TUpdate` are the WIRE shape (`z.input` of the unmodified shared schema — dates as strings, `certificateMediaId` as a real number) — `toCertificationWirePayload` is what turns a validated form value into this, called from each page's own `mutateAsync`. */
export const certificationsClient = createAdminResourceClient<
  CertificationRow,
  CertificationWirePayload,
  CertificationWirePayload
>('/api/v1/admin/certifications', { reorder: true });

export const certificationsHooks = createAdminResourceHooks(
  certificationsClient,
  'admin-certifications',
);
