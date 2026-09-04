import type { SkillListQuery } from '@portfolio/shared';
import { skillAdminService } from '../../services/skillService.js';
import { createAdminCrudController } from './crudFactory.js';

export const skillController = createAdminCrudController(skillAdminService, (query) => {
  const q = query as unknown as SkillListQuery;
  return { page: q.page, pageSize: q.pageSize, q: q.q, categoryId: q.categoryId };
});
