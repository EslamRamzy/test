import type { TagWithCountDto } from '@portfolio/shared';
import { findUsedWithCounts } from '../repositories/tagRepository.js';

export function listTags(): Promise<TagWithCountDto[]> {
  return findUsedWithCounts();
}
