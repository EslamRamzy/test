import type { AdminListQuery } from '@portfolio/shared';
import { articleCategoryAdminService } from '../../services/articleCategoryService.js';
import { createAdminCrudController } from './crudFactory.js';

export const articleCategoryController = createAdminCrudController(
  articleCategoryAdminService,
  (query) => {
    const q = query as unknown as AdminListQuery;
    return { page: q.page, pageSize: q.pageSize, q: q.q };
  },
);
