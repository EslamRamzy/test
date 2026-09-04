import type { TagWithCountDto } from '@portfolio/shared';
import * as tagRepository from '../repositories/tagRepository.js';
import { findUsedWithCounts } from '../repositories/tagRepository.js';
import { createAdminCrudService } from './adminCrudFactory.js';

export function listTags(): Promise<TagWithCountDto[]> {
  return findUsedWithCounts();
}

// --- Admin CRUD (docs/architecture/03 §5) -----------------------------------

type TagRow = NonNullable<Awaited<ReturnType<typeof tagRepository.findById>>>;

export const tagAdminService = createAdminCrudService<
  TagRow,
  Parameters<typeof tagRepository.create>[0],
  Parameters<typeof tagRepository.update>[1],
  tagRepository.TagListParams
>({
  entityName: 'TAG',
  repository: tagRepository,
  getRowId: (row) => row.id,
});
