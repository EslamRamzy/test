import { RESEARCH_CATEGORIES } from '../constants/content.js';
import { z } from 'zod';
import { httpsUrlSchema, isoDatetimeAsDate, slugSchema } from './primitives.js';

/**
 * `security-research` — same "no `status` field, no scheduler needed"
 * reasoning as `article.ts`. `references` is a plain `{label, url}[]`, not
 * `{id, ...}`: same "replace the whole repeater set on every write" pattern
 * as `experience.ts`'s `achievements`, since `ResearchReference` rows have
 * no independent identity a client needs to address individually.
 */
export const securityResearchCreateSchema = z
  .object({
    title: z.string().trim().min(1).max(200),
    slug: slugSchema,
    description: z.string().trim().max(500).optional(),
    content: z.string().trim().min(1).max(100_000),
    category: z.enum(RESEARCH_CATEGORIES),
    coverMediaId: z.number().int().positive().optional(),
    publishedAt: isoDatetimeAsDate.optional(),
    tagIds: z.array(z.number().int().positive()).max(50).optional(),
    references: z
      .array(
        z
          .object({
            label: z.string().trim().min(1).max(200),
            url: httpsUrlSchema,
          })
          .strict(),
      )
      .max(50)
      .optional(),
  })
  .strict();
export type SecurityResearchCreateInput = z.infer<typeof securityResearchCreateSchema>;

export const securityResearchUpdateSchema = securityResearchCreateSchema.partial().strict();
export type SecurityResearchUpdateInput = z.infer<typeof securityResearchUpdateSchema>;
