import { z } from 'zod';
import { slugSchema } from './primitives.js';

/**
 * `articles` (doc 07 §3: "Markdown editor, cover picker, tags, category,
 * computed reading time, scheduled publishedAt").
 *
 * Deliberately absent from this schema:
 * - `status` — never set directly here; the editorial workflow (doc 07 §4)
 *   moves an article between DRAFT/PUBLISHED/ARCHIVED only through the
 *   dedicated `POST .../publish|unpublish|archive` actions, each running
 *   its own readiness check. A create/update body that could also silently
 *   flip `status` would let a plain field edit bypass that gate.
 * - `readingTimeMinutes` — "computed reading time" is exactly that: derived
 *   from `content`'s length by the service layer on every write, never
 *   client-supplied (a client sending a fabricated value would just be
 *   overwritten).
 * - `authorId` — set to the acting admin from `req.user`, not accepted from
 *   the request body; doc 07 names no author-picker feature.
 *
 * `publishedAt` IS here, separate from the publish action itself — doc 07
 * §4: "publishedAt may be set in the future... so scheduling works with no
 * scheduler process." Setting it doesn't publish the article by itself
 * (`status` still gates public visibility); it only decides when a
 * schedule-published article's date is deemed to have arrived.
 */
export const articleCreateSchema = z
  .object({
    title: z.string().trim().min(1).max(200),
    slug: slugSchema,
    excerpt: z.string().trim().max(500).optional(),
    content: z.string().trim().min(1).max(100_000),
    coverMediaId: z.number().int().positive().optional(),
    categoryId: z.number().int().positive().optional(),
    publishedAt: z.iso.datetime().optional(),
    tagIds: z.array(z.number().int().positive()).max(50).optional(),
  })
  .strict();
export type ArticleCreateInput = z.infer<typeof articleCreateSchema>;

export const articleUpdateSchema = articleCreateSchema.partial().strict();
export type ArticleUpdateInput = z.infer<typeof articleUpdateSchema>;
