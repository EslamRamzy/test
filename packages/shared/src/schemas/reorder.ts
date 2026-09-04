import { z } from 'zod';
import { idSchema } from './primitives.js';

/**
 * `PATCH /admin/{resource}/reorder` (docs/architecture/03 §5) — bulk
 * `display_order` update, one shape shared by every reorderable resource
 * (technologies, skills, certifications, experience, education, timeline,
 * social links, project images, and so on). A plain array rather than a
 * `{id: displayOrder}` map: the wire shape mirrors exactly what a drag-drop
 * list already holds (an ordered array of ids) with no client-side
 * transform needed before sending it.
 */
export const reorderSchema = z
  .array(
    z
      .object({
        id: idSchema,
        displayOrder: z.number().int().min(0),
      })
      .strict(),
  )
  .min(1)
  .max(500);
export type ReorderInput = z.infer<typeof reorderSchema>;
