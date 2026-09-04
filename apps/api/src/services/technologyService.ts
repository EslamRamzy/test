import type { TechnologyDto } from '@portfolio/shared';
import { findAllPublic } from '../repositories/technologyRepository.js';

export function listTechnologies(category: string | undefined): Promise<TechnologyDto[]> {
  return findAllPublic(category);
}
