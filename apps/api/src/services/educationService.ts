import type { EducationDto } from '@portfolio/shared';
import * as educationRepository from '../repositories/educationRepository.js';
import { findVisible } from '../repositories/educationRepository.js';
import { createAdminCrudService } from './adminCrudFactory.js';

export async function listEducation(): Promise<EducationDto[]> {
  const rows = await findVisible();
  return rows.map((row) => ({
    id: row.id,
    institution: row.institution,
    degree: row.degree,
    field: row.field,
    description: row.description,
    startDate: row.startDate.toISOString(),
    endDate: row.endDate ? row.endDate.toISOString() : null,
  }));
}

// --- Admin CRUD (docs/architecture/03 §5) -----------------------------------

type EducationRow = NonNullable<Awaited<ReturnType<typeof educationRepository.findById>>>;

export const educationAdminService = createAdminCrudService<
  EducationRow,
  Parameters<typeof educationRepository.create>[0],
  Parameters<typeof educationRepository.update>[1],
  educationRepository.EducationListParams
>({
  entityName: 'EDUCATION',
  repository: educationRepository,
  getRowId: (row) => row.id,
});
