import { z } from 'zod';

/** `education` — same date/visibility shape as `experience.ts`, no repeater or many-to-many fields (the schema has none to assign). */
export const educationCreateSchema = z
  .object({
    institution: z.string().trim().min(1).max(200),
    degree: z.string().trim().min(1).max(200),
    field: z.string().trim().max(200).optional(),
    description: z.string().trim().max(2000).optional(),
    startDate: z.iso.date(),
    endDate: z.iso.date().optional(),
    visible: z.boolean().optional(),
  })
  .strict();
export type EducationCreateInput = z.infer<typeof educationCreateSchema>;

export const educationUpdateSchema = educationCreateSchema.partial().strict();
export type EducationUpdateInput = z.infer<typeof educationUpdateSchema>;
