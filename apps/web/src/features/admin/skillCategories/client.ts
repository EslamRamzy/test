import type {
  SkillCategoryCreateInput,
  SkillCategoryRow,
  SkillCategoryUpdateInput,
} from '@portfolio/shared';
import { createAdminResourceClient } from '@/lib/api/adminResource';
import { createAdminResourceHooks } from '@/features/admin/lib/adminResourceHooks';

/** `/api/v1/admin/skill-categories` — the grouping Skills (the actual sidebar module) reorder within (doc07 §3); reached from the Skills list page's "Manage categories" link, not its own Sidebar entry (`skillCategories.routes.ts`'s own comment). */
export const skillCategoriesClient = createAdminResourceClient<
  SkillCategoryRow,
  SkillCategoryCreateInput,
  SkillCategoryUpdateInput
>('/api/v1/admin/skill-categories', { reorder: true });

export const skillCategoriesHooks = createAdminResourceHooks(
  skillCategoriesClient,
  'admin-skill-categories',
);
