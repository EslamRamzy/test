import type { AdminListQuery } from '@portfolio/shared';
import { certificationAdminService } from '../../services/certificationService.js';
import { createAdminCrudController } from './crudFactory.js';

export const certificationController = createAdminCrudController(
  certificationAdminService,
  (query) => {
    const q = query as unknown as AdminListQuery;
    return { page: q.page, pageSize: q.pageSize, q: q.q };
  },
);
