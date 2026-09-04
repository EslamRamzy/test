import { z } from 'zod';
import { emailSchema } from './primitives.js';

/**
 * `GET|PATCH /admin/profile` (doc 03 §5, doc 07 §3: "Profile (name,
 * headline, bio, avatar)"). A singleton — no `id` in the body; the
 * repository always targets the one `CHECK (id = 1)` row. Partial by
 * design (every field optional): a `PATCH` naturally edits one section of
 * the profile form at a time.
 */
export const profileUpdateSchema = z
  .object({
    fullName: z.string().trim().min(1).max(150).optional(),
    headline: z.string().trim().max(200).optional(),
    shortBio: z.string().trim().max(500).optional(),
    fullBio: z.string().trim().max(20_000).optional(),
    location: z.string().trim().max(150).optional(),
    publicEmail: emailSchema.optional(),
    avatarMediaId: z.number().int().positive().optional(),
    resumeMediaId: z.number().int().positive().optional(),
    availableForWork: z.boolean().optional(),
  })
  .strict();
export type ProfileUpdateInput = z.infer<typeof profileUpdateSchema>;
