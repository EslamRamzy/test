import type { ArticleCategoryDto } from '@portfolio/shared';
import { findAll } from '../repositories/articleCategoryRepository.js';

export function listArticleCategories(): Promise<ArticleCategoryDto[]> {
  return findAll();
}
