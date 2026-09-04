import { z } from 'zod';
import { slugSchema } from './primitives.js';

/**
 * `tags` and `article-categories` — both small, flat, no `displayOrder`
 * (neither model has one; tags render alphabetically/by-count on the
 * public site, categories are few enough not to need manual ordering).
 * Reused by both Articles and Security Research (`ArticleTag`/
 * `ResearchTag` are separate join tables over the same `Tag` row).
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

/** `article-categories` — Articles only; Security Research's own `category` is a fixed enum (`RESEARCH_CATEGORIES`), not a separate table. */
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
