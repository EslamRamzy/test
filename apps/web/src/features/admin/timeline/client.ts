import type { TimelineEntryRow } from '@portfolio/shared';
import { createAdminResourceClient } from '@/lib/api/adminResource';
import { createAdminResourceHooks } from '@/features/admin/lib/adminResourceHooks';
import type { TimelineEntryFormValues } from './formSchema';

export const timelineClient = createAdminResourceClient<
  TimelineEntryRow,
  TimelineEntryFormValues,
  TimelineEntryFormValues
>('/api/v1/admin/timeline', { reorder: true });

export const timelineHooks = createAdminResourceHooks(timelineClient, 'admin-timeline');
