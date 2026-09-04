import type { AdminListQuery } from '@portfolio/shared';
import { technologyAdminService } from '../../services/technologyService.js';
import { createAdminCrudController } from './crudFactory.js';

export const technologyController = createAdminCrudController(technologyAdminService, (query) => {
  const q = query as unknown as AdminListQuery;
  return {
    page: q.page,
    pageSize: q.pageSize,
    q: q.q,
    sort: q.sort,
    order: q.order,
  };
});
