import type { ExperienceRow } from '@portfolio/shared';
import { createAdminResourceClient } from '@/lib/api/adminResource';
import { createAdminResourceHooks } from '@/features/admin/lib/adminResourceHooks';
import type { ExperienceWirePayload } from './formSchema';

export const experienceClient = createAdminResourceClient<
  ExperienceRow,
  ExperienceWirePayload,
  ExperienceWirePayload
>('/api/v1/admin/experience', { reorder: true });

export const experienceHooks = createAdminResourceHooks(experienceClient, 'admin-experience');
