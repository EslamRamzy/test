import type { ExperienceDto } from '@portfolio/shared';
import * as experienceRepository from '../repositories/experienceRepository.js';
import { findVisible } from '../repositories/experienceRepository.js';
import { createAdminCrudService } from './adminCrudFactory.js';

export async function listExperience(): Promise<ExperienceDto[]> {
  const rows = await findVisible();
  return rows.map((row) => ({
    id: row.id,
    position: row.position,
    organization: row.organization,
    location: row.location,
    description: row.description,
    startDate: row.startDate.toISOString(),
    endDate: row.endDate ? row.endDate.toISOString() : null,
    isCurrent: row.isCurrent,
    achievements: row.achievements.map((achievement) => achievement.text),
    technologies: row.technologies.map(({ technology }) => ({
      id: technology.id,
      name: technology.name,
      slug: technology.slug,
      icon: technology.icon,
      category: technology.category,
      websiteUrl: technology.websiteUrl,
    })),
  }));
}

// --- Admin CRUD (docs/architecture/03 §5) -----------------------------------

type ExperienceRow = NonNullable<Awaited<ReturnType<typeof experienceRepository.findById>>>;

export const experienceAdminService = createAdminCrudService<
  ExperienceRow,
  Parameters<typeof experienceRepository.create>[0],
  Parameters<typeof experienceRepository.update>[1],
  experienceRepository.ExperienceListParams
>({
  entityName: 'EXPERIENCE',
  repository: experienceRepository,
  getRowId: (row) => row.id,
});
