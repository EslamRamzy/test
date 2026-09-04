import type { AdminListQuery } from '@portfolio/shared';
import { timelineAdminService } from '../../services/timelineService.js';
import { createAdminCrudController } from './crudFactory.js';

export const timelineController = createAdminCrudController(timelineAdminService, (query) => {
  const q = query as unknown as AdminListQuery;
  return { page: q.page, pageSize: q.pageSize, q: q.q };
});
