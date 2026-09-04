import type { EducationDto } from '@portfolio/shared';
import { findVisible } from '../repositories/educationRepository.js';

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
