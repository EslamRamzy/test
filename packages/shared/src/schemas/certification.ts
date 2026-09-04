import { z } from 'zod';
import { httpsUrlSchema } from './primitives.js';

/** `certifications` — `issueDate`/`expirationDate` are ISO date strings (date-only, no time-of-day meaning for a certification). `certificateMediaId` references a `Media` row uploaded through Phase 9's media library; this schema only ever stores the id. */
export const certificationCreateSchema = z
  .object({
    name: z.string().trim().min(1).max(200),
    issuer: z.string().trim().min(1).max(200),
    description: z.string().trim().max(2000).optional(),
    certificateMediaId: z.number().int().positive().optional(),
    credentialUrl: httpsUrlSchema.optional(),
    issueDate: z.iso.date().optional(),
    expirationDate: z.iso.date().optional(),
    visible: z.boolean().optional(),
  })
  .strict();
export type CertificationCreateInput = z.infer<typeof certificationCreateSchema>;

export const certificationUpdateSchema = certificationCreateSchema.partial().strict();
export type CertificationUpdateInput = z.infer<typeof certificationUpdateSchema>;
