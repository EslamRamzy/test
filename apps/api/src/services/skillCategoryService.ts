import * as skillCategoryRepository from '../repositories/skillCategoryRepository.js';
import { createAdminCrudService } from './adminCrudFactory.js';

type SkillCategoryRow = NonNullable<Awaited<ReturnType<typeof skillCategoryRepository.findById>>>;

export const skillCategoryAdminService = createAdminCrudService<
  SkillCategoryRow,
  Parameters<typeof skillCategoryRepository.create>[0],
  Parameters<typeof skillCategoryRepository.update>[1],
  skillCategoryRepository.SkillCategoryListParams
>({
  entityName: 'SKILL_CATEGORY',
  repository: skillCategoryRepository,
  getRowId: (row) => row.id,
});
