import {
  adminListQuerySchema,
  articleCreateSchema,
  articleUpdateSchema,
  idParamSchema,
} from '@portfolio/shared';
import { Router } from 'express';
import { articleController } from '../../controllers/admin/articleController.js';
import { authenticate } from '../../middleware/authenticate.js';
import { authorize } from '../../middleware/authorize.js';
import { csrfProtection } from '../../middleware/csrf.js';
import { adminLimiter } from '../../middleware/rateLimit.js';
import { validate } from '../../middleware/validate.js';

/**
 * `/api/v1/admin/articles` (doc03 §5's generic CRUD shape + the
 * publish/unpublish/archive/duplicate group doc03 §5 adds for content
 * resources). No `/reorder` — `Article` has no `displayOrder` column
 * (same reasoning as `tags.routes.ts`); articles are ordered by
 * `publishedAt`/`title` instead (`articleRepository.ts`'s `resolveOrderBy`).
 *
 * `article:publish` gates all four editorial-state actions, not just
 * `publish` itself — doc03 §5 lists them as one group and `PERMISSIONS`
 * (rbac.ts) defines only one permission for it, mirroring `project:publish`.
 *
 * Doc07 §4's diagram draws `PUBLISHED -> DRAFT: unpublish` and
 * `ARCHIVED -> DRAFT: restore` as two different transitions, but doc03 §5
 * names exactly one endpoint for both (`POST .../unpublish`) — no separate
 * `/restore` route exists, so `unpublish` is mounted for either source
 * status; `articleService.ts`'s own function handles both.
 */
export const articlesRouter: Router = Router();

articlesRouter.use(authenticate, adminLimiter);

articlesRouter.get(
  '/',
  authorize('article:read'),
  validate({ query: adminListQuerySchema }),
  articleController.list,
);

articlesRouter.post(
  '/',
  csrfProtection,
  authorize('article:create'),
  validate({ body: articleCreateSchema }),
  articleController.create,
);

articlesRouter.get(
  '/:id',
  authorize('article:read'),
  validate({ params: idParamSchema }),
  articleController.read,
);

articlesRouter.patch(
  '/:id',
  csrfProtection,
  authorize('article:update'),
  validate({ params: idParamSchema, body: articleUpdateSchema }),
  articleController.update,
);

articlesRouter.delete(
  '/:id',
  csrfProtection,
  authorize('article:delete'),
  validate({ params: idParamSchema }),
  articleController.remove,
);

articlesRouter.post(
  '/:id/publish',
  csrfProtection,
  authorize('article:publish'),
  validate({ params: idParamSchema }),
  articleController.publish,
);

articlesRouter.post(
  '/:id/unpublish',
  csrfProtection,
  authorize('article:publish'),
  validate({ params: idParamSchema }),
  articleController.unpublish,
);

articlesRouter.post(
  '/:id/archive',
  csrfProtection,
  authorize('article:publish'),
  validate({ params: idParamSchema }),
  articleController.archive,
);

articlesRouter.post(
  '/:id/duplicate',
  csrfProtection,
  authorize('article:publish'),
  validate({ params: idParamSchema }),
  articleController.duplicate,
);
