import type { AdminListQuery } from '@portfolio/shared';
import { educationAdminService } from '../../services/educationService.js';
import { createAdminCrudController } from './crudFactory.js';

export const educationController = createAdminCrudController(educationAdminService, (query) => {
  const q = query as unknown as AdminListQuery;
  return { page: q.page, pageSize: q.pageSize, q: q.q };
});
