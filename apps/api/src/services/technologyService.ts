import type { TechnologyDto } from '@portfolio/shared';
import * as technologyRepository from '../repositories/technologyRepository.js';
import { createAdminCrudService } from './adminCrudFactory.js';

export function listTechnologies(category: string | undefined): Promise<TechnologyDto[]> {
  return technologyRepository.findAllPublic(category);
}

// --- Admin CRUD (docs/architecture/03 §5) -----------------------------------

type TechnologyRow = NonNullable<Awaited<ReturnType<typeof technologyRepository.findById>>>;

export const technologyAdminService = createAdminCrudService<
  TechnologyRow,
  Parameters<typeof technologyRepository.create>[0],
  Parameters<typeof technologyRepository.update>[1],
  technologyRepository.TechnologyListParams
>({
  entityName: 'TECHNOLOGY',
  repository: technologyRepository,
  getRowId: (row) => row.id,
});
