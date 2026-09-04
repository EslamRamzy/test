import type { SkillCategoryDto } from '@portfolio/shared';
import * as skillRepository from '../repositories/skillRepository.js';
import { findVisibleCategoriesWithSkills } from '../repositories/skillRepository.js';
import { createAdminCrudService } from './adminCrudFactory.js';

export async function listSkillCategories(): Promise<SkillCategoryDto[]> {
  const categories = await findVisibleCategoriesWithSkills();
  return categories.map((category) => ({
    id: category.id,
    name: category.name,
    slug: category.slug,
    icon: category.icon,
    skills: category.skills.map((skill) => ({
      id: skill.id,
      name: skill.name,
      icon: skill.icon,
      description: skill.description,
      level: skill.level as SkillCategoryDto['skills'][number]['level'],
    })),
  }));
}

// --- Admin CRUD (docs/architecture/03 §5) -----------------------------------

type SkillRow = NonNullable<Awaited<ReturnType<typeof skillRepository.findById>>>;

export const skillAdminService = createAdminCrudService<
  SkillRow,
  Parameters<typeof skillRepository.create>[0],
  Parameters<typeof skillRepository.update>[1],
  skillRepository.SkillListParams
>({
  entityName: 'SKILL',
  repository: skillRepository,
  getRowId: (row) => row.id,
});
