import {
  adminListQuerySchema,
  articleCategoryCreateSchema,
  articleCategoryUpdateSchema,
  idParamSchema,
  reorderSchema,
} from '@portfolio/shared';
import { Router } from 'express';
import { articleCategoryController } from '../../controllers/admin/articleCategoryController.js';
import { authenticate } from '../../middleware/authenticate.js';
import { authorize } from '../../middleware/authorize.js';
import { csrfProtection } from '../../middleware/csrf.js';
import { adminLimiter } from '../../middleware/rateLimit.js';
import { validate } from '../../middleware/validate.js';

/** `/api/v1/admin/article-categories` — authorized under `article:*`, same reasoning as `tags.routes.ts`. Unlike tags, this resource DOES reorder (`ArticleCategory.displayOrder`). */
export const articleCategoriesRouter: Router = Router();

articleCategoriesRouter.use(authenticate, adminLimiter);

articleCategoriesRouter.get(
  '/',
  authorize('article:read'),
  validate({ query: adminListQuerySchema }),
  articleCategoryController.list,
);
articleCategoriesRouter.post(
  '/',
  csrfProtection,
  authorize('article:create'),
  validate({ body: articleCategoryCreateSchema }),
  articleCategoryController.create,
);
articleCategoriesRouter.patch(
  '/reorder',
  csrfProtection,
  authorize('article:reorder'),
  validate({ body: reorderSchema }),
  articleCategoryController.reorder!,
);
articleCategoriesRouter.get(
  '/:id',
  authorize('article:read'),
  validate({ params: idParamSchema }),
  articleCategoryController.read,
);
articleCategoriesRouter.patch(
  '/:id',
  csrfProtection,
  authorize('article:update'),
  validate({ params: idParamSchema, body: articleCategoryUpdateSchema }),
  articleCategoryController.update,
);
articleCategoriesRouter.delete(
  '/:id',
  csrfProtection,
  authorize('article:delete'),
  validate({ params: idParamSchema }),
  articleCategoryController.remove,
);
