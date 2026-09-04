import { z } from 'zod';
import { httpsUrlSchema, isoDateAsDate } from './primitives.js';

/** `certifications` — `issueDate`/`expirationDate` accept an ISO date-only string (`isoDateAsDate`, no time-of-day meaning for a certification) and parse to a real `Date` (see `primitives.ts`'s own comment on why). `certificateMediaId` references a `Media` row uploaded through Phase 9's media library; this schema only ever stores the id. */
export const certificationCreateSchema = z
  .object({
    name: z.string().trim().min(1).max(200),
    issuer: z.string().trim().min(1).max(200),
    description: z.string().trim().max(2000).optional(),
    certificateMediaId: z.number().int().positive().optional(),
    credentialUrl: httpsUrlSchema.optional(),
    issueDate: isoDateAsDate.optional(),
    expirationDate: isoDateAsDate.optional(),
    visible: z.boolean().optional(),
  })
  .strict();
export type CertificationCreateInput = z.infer<typeof certificationCreateSchema>;

export const certificationUpdateSchema = certificationCreateSchema.partial().strict();
export type CertificationUpdateInput = z.infer<typeof certificationUpdateSchema>;
