import { PROJECT_CATEGORIES } from '../constants/content.js';
import { z } from 'zod';
import { httpsUrlSchema, idSchema, isoDatetimeAsDate, slugSchema } from './primitives.js';

/**
 * `projects` — the most complex module (doc 07 §3: "Tabbed editor:
 * Overview · Case Study · Technologies · Media · Security · SEO"). Split
 * across several schemas, one per doc 03 §5's "Project-specific" endpoint
 * list, rather than one giant object — `visibleSectionsJson`, technology
 * assignment, images and featured status each have their OWN endpoint
 * precisely so a small change (toggling `featured`) doesn't require
 * resending the entire case-study body.
 *
 * Same "no `status` here" reasoning as `article.ts`: publish/unpublish/
 * archive are dedicated actions with their own readiness check (doc 07
 * §4), not a field this schema exposes.
 *
 * `features` (the `ProjectFeature` repeater) IS included directly — unlike
 * technologies/images/sections, doc 03 §5 lists no dedicated endpoint for
 * it, so it follows the same "replace the whole set on every write"
 * pattern as `experience.ts`'s `achievements`.
 */
export const projectCreateSchema = z
  .object({
    title: z.string().trim().min(1).max(200),
    slug: slugSchema,
    shortDescription: z.string().trim().min(1).max(300),
    fullDescription: z.string().trim().max(5000).optional(),
    category: z.enum(PROJECT_CATEGORIES),
    coverMediaId: z.number().int().positive().optional(),

    // --- Case-study body (D5 hybrid — see schema.prisma's own comment) ---
    problem: z.string().trim().max(20_000).optional(),
    solution: z.string().trim().max(20_000).optional(),
    architecture: z.string().trim().max(20_000).optional(),
    challenges: z.string().trim().max(20_000).optional(),
    solutionsDetail: z.string().trim().max(20_000).optional(),
    lessonsLearned: z.string().trim().max(20_000).optional(),
    deploymentNotes: z.string().trim().max(20_000).optional(),

    // https only, no javascript:/data: — doc 03 §7's own validation
    // example uses exactly this schema for these two fields; matched here
    // rather than the more permissive `webUrlSchema` (which is for local
    // dev-only values, not admin-authored content headed for production).
    githubUrl: httpsUrlSchema.optional(),
    liveUrl: httpsUrlSchema.optional(),
    securityTested: z.boolean().optional(),
    securitySummary: z.string().trim().max(5000).optional(),
    testingSummary: z.string().trim().max(5000).optional(),
    publishedAt: isoDatetimeAsDate.optional(),

    features: z
      .array(
        z
          .object({
            title: z.string().trim().min(1).max(200),
            description: z.string().trim().max(1000).optional(),
          })
          .strict(),
      )
      .max(50)
      .optional(),
  })
  .strict();
export type ProjectCreateInput = z.infer<typeof projectCreateSchema>;

export const projectUpdateSchema = projectCreateSchema.partial().strict();
export type ProjectUpdateInput = z.infer<typeof projectUpdateSchema>;

/** `PUT /admin/projects/:id/technologies` — the whole assignment set, not incremental add/remove (matches `ProjectTechnology`'s own plain join-table shape: no per-row metadata to preserve). */
export const projectTechnologiesInputSchema = z
  .object({
    technologyIds: z.array(z.number().int().positive()).max(100),
  })
  .strict();
export type ProjectTechnologiesInput = z.infer<typeof projectTechnologiesInputSchema>;

/** `POST /admin/projects/:id/images` — one image per call; `PATCH .../images/reorder` (below) handles bulk ordering, `DELETE .../images/:imageId` removal. */
export const projectImageCreateSchema = z
  .object({
    mediaId: z.number().int().positive(),
    caption: z.string().trim().max(300).optional(),
  })
  .strict();
export type ProjectImageCreateInput = z.infer<typeof projectImageCreateSchema>;

/**
 * `PATCH /admin/projects/:id/sections` — doc 07 §8's section visibility
 * manager. One entry per section key; a BUILT-IN key (matching a
 * `Project` column — `problem`, `solution`, etc.) needs only `visible`/
 * `displayOrder` here (its content lives in the column above), while a
 * CUSTOM key (no matching column) also needs `title`/`body` since its
 * content lives entirely in this row. The service layer decides which
 * case applies per key; this schema accepts either shape rather than two
 * separate ones, since the two cases share every field except which of
 * `title`/`body` are actually meaningful.
 */
export const projectSectionInputSchema = z
  .object({
    sectionKey: z.string().trim().min(1).max(50),
    title: z.string().trim().min(1).max(200).optional(),
    body: z.string().trim().max(50_000).optional(),
    visible: z.boolean(),
    displayOrder: z.number().int().min(0),
  })
  .strict();
export const projectSectionsUpdateSchema = z.array(projectSectionInputSchema).max(50);
export type ProjectSectionsUpdateInput = z.infer<typeof projectSectionsUpdateSchema>;

/** `POST /admin/projects/:id/featured` — its own endpoint (doc 03 §5) rather than folded into the general update, since toggling this one flag from the project list is the common case (doc 07 §3: "Featured toggle"). */
export const projectFeaturedInputSchema = z.object({ featured: z.boolean() }).strict();
export type ProjectFeaturedInput = z.infer<typeof projectFeaturedInputSchema>;

/**
 * `DELETE /admin/projects/:id/images/:imageId` — a route param schema, not
 * body/query. `idParamSchema` alone won't do here: `validate()` REPLACES
 * `req.params` with the parsed object (its own comment says so), so a
 * schema that only knows about `id` would silently strip `imageId` out of
 * `req.params` before the controller ever reads it.
 */
export const projectImageParamSchema = z.object({ id: idSchema, imageId: idSchema }).strict();
export type ProjectImageParam = z.infer<typeof projectImageParamSchema>;
