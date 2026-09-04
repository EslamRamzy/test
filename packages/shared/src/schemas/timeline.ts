import { z } from 'zod';

/** `timeline_entries` — `entryDate` drives chronological order; `yearLabel` is a free-text override for display (e.g. "2019 – 2021") shown instead of the raw date where the admin sets one. `category` is free text (no CHECK constraint on this column, unlike `security_research.category`), matching the public repository's own treatment of it. */
export const timelineEntryCreateSchema = z
  .object({
    entryDate: z.iso.date(),
    yearLabel: z.string().trim().max(50).optional(),
    title: z.string().trim().min(1).max(200),
    description: z.string().trim().max(2000).optional(),
    category: z.string().trim().max(50).optional(),
    visible: z.boolean().optional(),
  })
  .strict();
export type TimelineEntryCreateInput = z.infer<typeof timelineEntryCreateSchema>;

export const timelineEntryUpdateSchema = timelineEntryCreateSchema.partial().strict();
export type TimelineEntryUpdateInput = z.infer<typeof timelineEntryUpdateSchema>;
