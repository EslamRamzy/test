import type { TagCreateInput, TagRow, TagUpdateInput } from '@portfolio/shared';
import { createAdminResourceClient } from '@/lib/api/adminResource';
import { createAdminResourceHooks } from '@/features/admin/lib/adminResourceHooks';

/** No `{ reorder: true }` — `Tag` has no `displayOrder` column (`tag.ts`'s own comment: rendered alphabetically or by-count, never manually curated). */
export const tagsClient = createAdminResourceClient<TagRow, TagCreateInput, TagUpdateInput>(
  '/api/v1/admin/tags',
);

export const tagsHooks = createAdminResourceHooks(tagsClient, 'admin-tags');
