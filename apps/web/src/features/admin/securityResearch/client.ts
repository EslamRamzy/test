import type { SecurityResearchAdminRow } from '@portfolio/shared';
import { createAdminResourceClient, createPublishActions } from '@/lib/api/adminResource';
import {
  createAdminResourceHooks,
  createPublishActionHooks,
} from '@/features/admin/lib/adminResourceHooks';
import type { SecurityResearchWirePayload } from './formSchema';

const RESOURCE_KEY = 'admin-security-research';

/** No `{ reorder: true }` — same reasoning as `articles/client.ts`: no `displayOrder`, ordered by `publishedAt`/`title`. */
export const securityResearchClient = createAdminResourceClient<
  SecurityResearchAdminRow,
  SecurityResearchWirePayload,
  SecurityResearchWirePayload
>('/api/v1/admin/security-research');

export const securityResearchHooks = createAdminResourceHooks(securityResearchClient, RESOURCE_KEY);

const securityResearchPublishActions = createPublishActions<SecurityResearchAdminRow>(
  '/api/v1/admin/security-research',
);
export const securityResearchPublishHooks = createPublishActionHooks(
  securityResearchPublishActions,
  RESOURCE_KEY,
);
