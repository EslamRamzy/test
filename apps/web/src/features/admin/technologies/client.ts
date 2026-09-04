import type {
  TechnologyCreateInput,
  TechnologyRow,
  TechnologyUpdateInput,
} from '@portfolio/shared';
import { createAdminResourceClient } from '@/lib/api/adminResource';
import { createAdminResourceHooks } from '@/features/admin/lib/adminResourceHooks';

export const technologiesClient = createAdminResourceClient<
  TechnologyRow,
  TechnologyCreateInput,
  TechnologyUpdateInput
>('/api/v1/admin/technologies', { reorder: true });

export const technologiesHooks = createAdminResourceHooks(technologiesClient, 'admin-technologies');
