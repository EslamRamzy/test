import { SKILL_LEVELS } from '../constants/content.js';
import { z } from 'zod';
import { slugSchema } from './primitives.js';

/** `skill-categories` (docs/architecture/03 §5) — the grouping `Skills` (below) are reordered within (doc 07 §3: "Grouped by category, drag-reorder within a category"). */
export const skillCategoryCreateSchema = z
  .object({
    name: z.string().trim().min(1).max(100),
    slug: slugSchema,
    icon: z.string().trim().max(100).optional(),
    visible: z.boolean().optional(),
  })
  .strict();
export type SkillCategoryCreateInput = z.infer<typeof skillCategoryCreateSchema>;

export const skillCategoryUpdateSchema = skillCategoryCreateSchema.partial().strict();
export type SkillCategoryUpdateInput = z.infer<typeof skillCategoryUpdateSchema>;

/** `skills` — `categoryId` is required on create (every skill belongs to exactly one category, `onDelete: Cascade`), but excluded from update: moving a skill to a different category is a distinct, deliberate action this schema doesn't cover — see the service layer if that need arises. */
export const skillCreateSchema = z
  .object({
    categoryId: z.number().int().positive(),
    name: z.string().trim().min(1).max(100),
    icon: z.string().trim().max(100).optional(),
    description: z.string().trim().max(500).optional(),
    level: z.enum(SKILL_LEVELS).optional(),
    visible: z.boolean().optional(),
  })
  .strict();
export type SkillCreateInput = z.infer<typeof skillCreateSchema>;

export const skillUpdateSchema = skillCreateSchema.omit({ categoryId: true }).partial().strict();
export type SkillUpdateInput = z.infer<typeof skillUpdateSchema>;
