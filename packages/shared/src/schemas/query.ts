import { z } from 'zod';
import {
  MEDIA_KINDS,
  MESSAGE_STATUSES,
  PROJECT_CATEGORIES,
  RESEARCH_CATEGORIES,
} from '../constants/content.js';
import { isoDateAsDate, paginationQuerySchema, slugSchema } from './primitives.js';

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

/**
 * `GET /admin/{resource}` (doc 03 §5): "?page,pageSize,q,status,sort —
 * includes drafts." One shared shape for every admin list endpoint,
 * unlike the public list schemas above (each of which names its own
 * resource-specific filters) — the admin CRUD factory (`services/
 * adminCrudFactory.ts`) is what makes this reusable across ~13
 * structurally different resources in the first place, so its query
 * schema is generic too. `sort` stays a plain string here, validated
 * against a per-resource allow-list the factory's own caller supplies
 * (never interpolated into a query directly) — a single Zod schema can't
 * statically enumerate 13 different resources' own sortable columns.
 */
export const adminListQuerySchema = paginationQuerySchema
  .extend({
    q: z.string().trim().max(100).optional(),
    status: z.enum(['DRAFT', 'PUBLISHED', 'ARCHIVED']).optional(),
    sort: z.string().trim().max(50).optional(),
    order: z.enum(['asc', 'desc']).optional(),
  })
  .strict();
export type AdminListQuery = z.infer<typeof adminListQuerySchema>;

/** `GET /admin/skills` — the one simple resource whose list needs a filter `adminListQuerySchema` doesn't have (doc 07 §3: "Grouped by category"). A dedicated `.extend()` rather than adding `categoryId` to the generic schema itself, which every OTHER resource's `.strict()` validation would then also have to explicitly reject. */
export const skillListQuerySchema = adminListQuerySchema
  .extend({
    categoryId: z.coerce.number().int().positive().optional(),
  })
  .strict();
export type SkillListQuery = z.infer<typeof skillListQuerySchema>;

/** `GET /admin/security-research` — same reasoning as `skillListQuerySchema`'s own: a filter no other admin list resource has. */
export const researchAdminListQuerySchema = adminListQuerySchema
  .extend({
    category: z.enum(RESEARCH_CATEGORIES).optional(),
  })
  .strict();
export type ResearchAdminListQuery = z.infer<typeof researchAdminListQuerySchema>;

/** `GET /admin/projects` — same reasoning, `category`/`featured` filters the public project list also has (doc03 §3), reused here for the admin table. */
export const projectAdminListQuerySchema = adminListQuerySchema
  .extend({
    category: z.enum(PROJECT_CATEGORIES).optional(),
    featured: booleanQueryParam,
  })
  .strict();
export type ProjectAdminListQuery = z.infer<typeof projectAdminListQuerySchema>;

/**
 * `GET /admin/audit-logs` — "?action,entityType,userId,from,to,page" (doc03
 * §5). `action`/`entityType` are plain strings, not enums: audit action
 * names are ad-hoc per module (`ARTICLE_PUBLISH`, `PROJECT_REORDER`, ...),
 * spread across every service in this codebase with no single governing
 * constant to enumerate them against — the filter just needs to match
 * whatever string a caller already knows an audit entry carries.
 */
export const auditLogQuerySchema = paginationQuerySchema
  .extend({
    action: z.string().trim().min(1).max(100).optional(),
    entityType: z.string().trim().min(1).max(50).optional(),
    userId: z.coerce.number().int().positive().optional(),
    from: isoDateAsDate.optional(),
    to: isoDateAsDate.optional(),
  })
  .strict();
export type AuditLogQuery = z.infer<typeof auditLogQuerySchema>;

/**
 * `GET /admin/media` — search over `originalName`/`altText`, filter by
 * `kind`. Not built on `adminListQuerySchema`: media has no draft/published
 * `status` to filter by, and `q`'s target columns differ from every other
 * resource's title/slug search — a fresh `.extend()` off the bare pagination
 * schema keeps `.strict()` from having to explain away a `status` param this
 * resource can never receive.
 */
export const mediaAdminListQuerySchema = paginationQuerySchema
  .extend({
    q: z.string().trim().max(100).optional(),
    kind: z.enum(MEDIA_KINDS).optional(),
  })
  .strict();
export type MediaAdminListQuery = z.infer<typeof mediaAdminListQuerySchema>;

/**
 * `GET /admin/messages` (doc03 §5: "?status,q,page"). Not `adminListQuerySchema`:
 * that schema's `status` is the three DRAFT/PUBLISHED/ARCHIVED editorial
 * states every content resource shares — messages have their own, unrelated
 * three-value status enum (`MESSAGE_STATUSES`), and `q` here searches
 * name/email/subject/message, not a title/slug.
 */
export const messageAdminListQuerySchema = paginationQuerySchema
  .extend({
    q: z.string().trim().max(100).optional(),
    status: z.enum(MESSAGE_STATUSES).optional(),
  })
  .strict();
export type MessageAdminListQuery = z.infer<typeof messageAdminListQuerySchema>;
