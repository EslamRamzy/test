import type { AdminListQuery } from '@portfolio/shared';
import { skillCategoryAdminService } from '../../services/skillCategoryService.js';
import { createAdminCrudController } from './crudFactory.js';

export const skillCategoryController = createAdminCrudController(
  skillCategoryAdminService,
  (query) => {
    const q = query as unknown as AdminListQuery;
    return { page: q.page, pageSize: q.pageSize, q: q.q };
  },
);
