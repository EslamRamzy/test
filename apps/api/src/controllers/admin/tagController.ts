import type { AdminListQuery } from '@portfolio/shared';
import { tagAdminService } from '../../services/tagService.js';
import { createAdminCrudController } from './crudFactory.js';

export const tagController = createAdminCrudController(tagAdminService, (query) => {
  const q = query as unknown as AdminListQuery;
  return { page: q.page, pageSize: q.pageSize, q: q.q };
});
