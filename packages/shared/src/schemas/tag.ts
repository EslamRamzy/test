import { z } from 'zod';
import { slugSchema } from './primitives.js';

/**
 * `tags` — small and flat, no `displayOrder` (the model has none; tags
 * render alphabetically or by-count on the public site, never in a
 * manually-curated order). Reused by both Articles and Security Research
 * (`ArticleTag`/`ResearchTag` are separate join tables over the same `Tag`
 * row).
 */
export const tagCreateSchema = z
  .object({
    name: z.string().trim().min(1).max(50),
    slug: slugSchema,
  })
  .strict();
export type TagCreateInput = z.infer<typeof tagCreateSchema>;

export const tagUpdateSchema = tagCreateSchema.partial().strict();
export type TagUpdateInput = z.infer<typeof tagUpdateSchema>;

/** `article-categories` — Articles only; Security Research's own `category` is a fixed enum (`RESEARCH_CATEGORIES`), not a separate table. Unlike `Tag`, this model DOES have `displayOrder` — reorderable via the standard `PATCH .../reorder` shape. */
export const articleCategoryCreateSchema = z
  .object({
    name: z.string().trim().min(1).max(50),
    slug: slugSchema,
    description: z.string().trim().max(500).optional(),
  })
  .strict();
export type ArticleCategoryCreateInput = z.infer<typeof articleCategoryCreateSchema>;

export const articleCategoryUpdateSchema = articleCategoryCreateSchema.partial().strict();
export type ArticleCategoryUpdateInput = z.infer<typeof articleCategoryUpdateSchema>;
