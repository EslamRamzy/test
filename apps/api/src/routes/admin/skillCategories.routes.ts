import {
  adminListQuerySchema,
  idParamSchema,
  reorderSchema,
  skillCategoryCreateSchema,
  skillCategoryUpdateSchema,
} from '@portfolio/shared';
import { Router } from 'express';
import { skillCategoryController } from '../../controllers/admin/skillCategoryController.js';
import { authenticate } from '../../middleware/authenticate.js';
import { authorize } from '../../middleware/authorize.js';
import { csrfProtection } from '../../middleware/csrf.js';
import { adminLimiter } from '../../middleware/rateLimit.js';
import { validate } from '../../middleware/validate.js';

/**
 * `/api/v1/admin/skill-categories` — authorized under `skill:*`
 * (`PERMISSIONS` in `packages/shared/src/constants/rbac.ts` has no
 * dedicated `skillCategory` key; doc 07 §51 doesn't list "Skill
 * Categories" as its own sidebar module either — it is the grouping
 * `Skills` (the actual sidebar module) manages skills within, so it
 * shares that module's permission rather than inventing a new one).
 */
export const skillCategoriesRouter: Router = Router();

skillCategoriesRouter.use(authenticate, adminLimiter);

skillCategoriesRouter.get(
  '/',
  authorize('skill:read'),
  validate({ query: adminListQuerySchema }),
  skillCategoryController.list,
);
skillCategoriesRouter.post(
  '/',
  csrfProtection,
  authorize('skill:create'),
  validate({ body: skillCategoryCreateSchema }),
  skillCategoryController.create,
);
skillCategoriesRouter.patch(
  '/reorder',
  csrfProtection,
  authorize('skill:reorder'),
  validate({ body: reorderSchema }),
  skillCategoryController.reorder!,
);
skillCategoriesRouter.get(
  '/:id',
  authorize('skill:read'),
  validate({ params: idParamSchema }),
  skillCategoryController.read,
);
skillCategoriesRouter.patch(
  '/:id',
  csrfProtection,
  authorize('skill:update'),
  validate({ params: idParamSchema, body: skillCategoryUpdateSchema }),
  skillCategoryController.update,
);
skillCategoriesRouter.delete(
  '/:id',
  csrfProtection,
  authorize('skill:delete'),
  validate({ params: idParamSchema }),
  skillCategoryController.remove,
);
