import type { AdminListQuery } from '@portfolio/shared';
import { experienceAdminService } from '../../services/experienceService.js';
import { createAdminCrudController } from './crudFactory.js';

export const experienceController = createAdminCrudController(experienceAdminService, (query) => {
  const q = query as unknown as AdminListQuery;
  return { page: q.page, pageSize: q.pageSize, q: q.q };
});
