import { z } from 'zod';

/**
 * `experiences` (doc 07 §3: "achievements repeater... `is_current` toggle").
 * `achievements` is a plain string array here, not an array of `{id, text}`
 * objects — the repository layer owns replacing the whole
 * `ExperienceAchievement` set on every write (simplest correct behavior for
 * a repeater with no independent identity of its own), so the wire shape
 * only ever needs the text, in order.
 *
 * `technologyIds` mirrors `PUT /admin/projects/:id/technologies`'s own
 * shape (`project.ts`) — same many-to-many assignment pattern, same "whole
 * set, not incremental add/remove" semantics.
 */
export const experienceCreateSchema = z
  .object({
    position: z.string().trim().min(1).max(150),
    organization: z.string().trim().min(1).max(150),
    location: z.string().trim().max(150).optional(),
    description: z.string().trim().max(5000).optional(),
    startDate: z.iso.date(),
    endDate: z.iso.date().optional(),
    isCurrent: z.boolean().optional(),
    visible: z.boolean().optional(),
    achievements: z.array(z.string().trim().min(1).max(300)).max(50).optional(),
    technologyIds: z.array(z.number().int().positive()).max(100).optional(),
  })
  .strict();
export type ExperienceCreateInput = z.infer<typeof experienceCreateSchema>;

export const experienceUpdateSchema = experienceCreateSchema.partial().strict();
export type ExperienceUpdateInput = z.infer<typeof experienceUpdateSchema>;
