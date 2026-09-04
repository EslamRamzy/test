import type { SkillCreateInput, SkillRow, SkillUpdateInput } from '@portfolio/shared';
import { createAdminResourceClient } from '@/lib/api/adminResource';
import { createAdminResourceHooks } from '@/features/admin/lib/adminResourceHooks';

export const skillsClient = createAdminResourceClient<SkillRow, SkillCreateInput, SkillUpdateInput>(
  '/api/v1/admin/skills',
  { reorder: true },
);

export const skillsHooks = createAdminResourceHooks(skillsClient, 'admin-skills');
