import type { ArticleAdminRow } from '@portfolio/shared';
import { createAdminResourceClient, createPublishActions } from '@/lib/api/adminResource';
import {
  createAdminResourceHooks,
  createPublishActionHooks,
} from '@/features/admin/lib/adminResourceHooks';
import type { ArticleWirePayload } from './formSchema';

const RESOURCE_KEY = 'admin-articles';

/** No `{ reorder: true }` — `Article` has no `displayOrder` (ordered by `publishedAt`/`title` instead, `articleRepository.ts`'s own `resolveOrderBy`). */
export const articlesClient = createAdminResourceClient<
  ArticleAdminRow,
  ArticleWirePayload,
  ArticleWirePayload
>('/api/v1/admin/articles');

export const articlesHooks = createAdminResourceHooks(articlesClient, RESOURCE_KEY);

const articlePublishActions = createPublishActions<ArticleAdminRow>('/api/v1/admin/articles');
export const articlePublishHooks = createPublishActionHooks(articlePublishActions, RESOURCE_KEY);
