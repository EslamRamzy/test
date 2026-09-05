import { z } from 'zod';
import { MEDIA_KINDS } from '../constants/content.js';

/**
 * The media library (docs/architecture/07 §3: "Media — Grid, upload
 * (drag-drop), filter by kind, alt-text editing, usage list, delete blocked
 * while referenced"; docs/architecture/09 §7 for the upload control set).
 *
 * There is deliberately no "media create schema" here: the multipart upload
 * body (`kind`, optional `altText`) is validated by `mediaUploadFieldsSchema`
 * below, but the FILE itself is never something Zod validates — that is
 * `lib/mediaProcessing.ts`'s job (real magic bytes, not a client-asserted
 * MIME type or extension), applied to the raw buffer multer hands the
 * controller, well before anything here runs.
 */

/** The non-file fields multer parses off the same multipart request as the upload — `req.body` fields alongside `req.file`. */
export const mediaUploadFieldsSchema = z
  .object({
    kind: z.enum(MEDIA_KINDS),
    altText: z.string().trim().max(300).optional(),
  })
  .strict();
export type MediaUploadFields = z.infer<typeof mediaUploadFieldsSchema>;

/**
 * `PATCH /admin/media/:id` — doc03 §5's own documented shape: "alt text,
 * kind". Every other column is derived from the file itself at upload time
 * and is never revised after the fact. Both fields are optional (a caller
 * updates just the one it means to change) — `altText` is additionally
 * nullable, since clearing it back to "no alt text" is a real, distinct
 * action from leaving it untouched (an absent key vs. an explicit `null`).
 */
export const mediaUpdateSchema = z
  .object({
    altText: z.string().trim().max(300).nullable().optional(),
    kind: z.enum(MEDIA_KINDS).optional(),
  })
  .strict();
export type MediaUpdateInput = z.infer<typeof mediaUpdateSchema>;
