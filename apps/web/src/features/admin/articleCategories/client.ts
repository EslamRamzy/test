import type {
  ArticleCategoryCreateInput,
  ArticleCategoryRow,
  ArticleCategoryUpdateInput,
} from '@portfolio/shared';
import { createAdminResourceClient } from '@/lib/api/adminResource';
import { createAdminResourceHooks } from '@/features/admin/lib/adminResourceHooks';

export const articleCategoriesClient = createAdminResourceClient<
  ArticleCategoryRow,
  ArticleCategoryCreateInput,
  ArticleCategoryUpdateInput
>('/api/v1/admin/article-categories', { reorder: true });

export const articleCategoriesHooks = createAdminResourceHooks(
  articleCategoriesClient,
  'admin-article-categories',
);
