import type { SkillCategoryDto } from '@portfolio/shared';
import { findVisibleCategoriesWithSkills } from '../repositories/skillRepository.js';

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
