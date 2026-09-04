import type { AdminListQuery } from '@portfolio/shared';
import { socialLinkAdminService } from '../../services/socialLinkService.js';
import { createAdminCrudController } from './crudFactory.js';

export const socialLinkController = createAdminCrudController(socialLinkAdminService, (query) => {
  const q = query as unknown as AdminListQuery;
  return { page: q.page, pageSize: q.pageSize, q: q.q };
});
