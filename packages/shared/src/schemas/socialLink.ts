import { z } from 'zod';
import { httpsUrlSchema } from './primitives.js';

/** `social-links` (doc 07 §3: "Reorder, enable/disable, platform icon"). `platform` is free text (e.g. "GitHub", "LinkedIn") — the frontend maps it to an icon via `icon`, not a fixed enum, since the exact set of platforms is never CHECK-constrained in the schema. */
export const socialLinkCreateSchema = z
  .object({
    platform: z.string().trim().min(1).max(50),
    label: z.string().trim().max(100).optional(),
    url: httpsUrlSchema,
    icon: z.string().trim().max(100).optional(),
    enabled: z.boolean().optional(),
  })
  .strict();
export type SocialLinkCreateInput = z.infer<typeof socialLinkCreateSchema>;

export const socialLinkUpdateSchema = socialLinkCreateSchema.partial().strict();
export type SocialLinkUpdateInput = z.infer<typeof socialLinkUpdateSchema>;
