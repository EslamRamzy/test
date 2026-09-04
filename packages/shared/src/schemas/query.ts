import { z } from 'zod';
import { paginationQuerySchema, slugSchema } from './primitives.js';

/**
 * Public list-query schemas (docs/architecture/03 §2, §3): pagination plus
 * a small set of EXPLICIT, NAMED filter params — never a generic
 * query-object filter, which is both an injection and a DoS surface (§2,
 * "Filtering" row) — and a `sort` key validated against a per-resource
 * ALLOW-LIST, never interpolated into a query (§2, "Sorting" row). Each
 * repository maps the validated `sort` string to a real Prisma `orderBy`
 * through its own lookup object, so an attacker-controlled string never
 * reaches the query builder as anything but one of these literal values.
 */

const booleanQueryParam = z
  .enum(['true', 'false'])
  .transform((value) => value === 'true')
  .optional();

export const projectListQuerySchema = paginationQuerySchema
  .extend({
    category: z.string().trim().min(1).max(50).optional(),
    technology: slugSchema.optional(),
    featured: booleanQueryParam,
    securityTested: booleanQueryParam,
    sort: z.enum(['publishedAt', 'title', 'displayOrder']).default('displayOrder'),
    order: z.enum(['asc', 'desc']).default('asc'),
  })
  .strict();
export type ProjectListQuery = z.infer<typeof projectListQuerySchema>;

export const articleListQuerySchema = paginationQuerySchema
  .extend({
    category: slugSchema.optional(),
    tag: slugSchema.optional(),
    sort: z.enum(['publishedAt', 'title']).default('publishedAt'),
    order: z.enum(['asc', 'desc']).default('desc'),
  })
  .strict();
export type ArticleListQuery = z.infer<typeof articleListQuerySchema>;

export const securityResearchListQuerySchema = paginationQuerySchema
  .extend({
    category: z.enum(['RESEARCH', 'WRITEUP', 'METHODOLOGY', 'NOTES', 'TOOL']).optional(),
    tag: slugSchema.optional(),
    sort: z.enum(['publishedAt', 'title']).default('publishedAt'),
    order: z.enum(['asc', 'desc']).default('desc'),
  })
  .strict();
export type SecurityResearchListQuery = z.infer<typeof securityResearchListQuerySchema>;

export const technologyListQuerySchema = z
  .object({
    category: z.string().trim().min(1).max(50).optional(),
  })
  .strict();
export type TechnologyListQuery = z.infer<typeof technologyListQuerySchema>;

export const searchQuerySchema = z
  .object({
    q: z.string().trim().min(2, 'Search query must be at least 2 characters').max(100),
    type: z.enum(['projects', 'articles', 'research', 'technologies']).optional(),
    limit: z.coerce
      .number()
      .int()
      .positive()
      .default(20)
      .transform((n) => Math.min(n, 50)),
  })
  .strict();
export type SearchQuery = z.infer<typeof searchQuerySchema>;
