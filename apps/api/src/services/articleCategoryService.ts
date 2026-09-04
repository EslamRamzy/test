import type { ArticleCategoryDto } from '@portfolio/shared';
import * as articleCategoryRepository from '../repositories/articleCategoryRepository.js';
import { findAll } from '../repositories/articleCategoryRepository.js';
import { createAdminCrudService } from './adminCrudFactory.js';

export function listArticleCategories(): Promise<ArticleCategoryDto[]> {
  return findAll();
}

// --- Admin CRUD (docs/architecture/03 §5) -----------------------------------

type ArticleCategoryRow = NonNullable<
  Awaited<ReturnType<typeof articleCategoryRepository.findById>>
>;

export const articleCategoryAdminService = createAdminCrudService<
  ArticleCategoryRow,
  Parameters<typeof articleCategoryRepository.create>[0],
  Parameters<typeof articleCategoryRepository.update>[1],
  articleCategoryRepository.ArticleCategoryListParams
>({
  entityName: 'ARTICLE_CATEGORY',
  repository: articleCategoryRepository,
  getRowId: (row) => row.id,
});
