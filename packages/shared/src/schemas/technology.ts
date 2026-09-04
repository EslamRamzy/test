import { z } from 'zod';
import { httpsUrlSchema, slugSchema } from './primitives.js';

/**
 * `technologies` (docs/architecture/03 §5, docs/architecture/07 §3:
 * "Icon picker, category, website, usage count"). `icon` is a free-text
 * identifier (an icon-font class name or similar), not a URL — the actual
 * glyph rendering is a frontend concern, this just stores which one.
 *
 * One create schema, `.partial()` for update (`PATCH` — every field
 * optional, present-and-set fields only) — this pattern repeats across
 * every simple resource in this file's siblings rather than hand-writing
 * two near-identical object shapes per entity.
 */
export const technologyCreateSchema = z
  .object({
    name: z.string().trim().min(1).max(100),
    slug: slugSchema,
    icon: z.string().trim().max(100).optional(),
    category: z.string().trim().max(50).optional(),
    websiteUrl: httpsUrlSchema.optional(),
  })
  .strict();
export type TechnologyCreateInput = z.infer<typeof technologyCreateSchema>;

export const technologyUpdateSchema = technologyCreateSchema.partial().strict();
export type TechnologyUpdateInput = z.infer<typeof technologyUpdateSchema>;
