import {
  idParamSchema,
  researchAdminListQuerySchema,
  securityResearchCreateSchema,
  securityResearchUpdateSchema,
} from '@portfolio/shared';
import { Router } from 'express';
import { securityResearchController } from '../../controllers/admin/securityResearchController.js';
import { authenticate } from '../../middleware/authenticate.js';
import { authorize } from '../../middleware/authorize.js';
import { csrfProtection } from '../../middleware/csrf.js';
import { adminLimiter } from '../../middleware/rateLimit.js';
import { validate } from '../../middleware/validate.js';

/**
 * `/api/v1/admin/security-research` (doc03 §5's generic CRUD shape + the
 * publish/unpublish/archive/duplicate group). No `/reorder` — same
 * reasoning as `articles.routes.ts`: no `displayOrder` column, ordered by
 * `publishedAt`/`title` instead.
 *
 * `research:publish` gates all four editorial-state actions (mirrors
 * `articles.routes.ts`'s own `article:publish` reasoning) — `PERMISSIONS`
 * (rbac.ts) defines `research: ['read','create','update','delete','publish']`,
 * with no reorder entry either, matching the schema.
 */
export const securityResearchRouter: Router = Router();

securityResearchRouter.use(authenticate, adminLimiter);

securityResearchRouter.get(
  '/',
  authorize('research:read'),
  validate({ query: researchAdminListQuerySchema }),
  securityResearchController.list,
);

securityResearchRouter.post(
  '/',
  csrfProtection,
  authorize('research:create'),
  validate({ body: securityResearchCreateSchema }),
  securityResearchController.create,
);

securityResearchRouter.get(
  '/:id',
  authorize('research:read'),
  validate({ params: idParamSchema }),
  securityResearchController.read,
);

securityResearchRouter.patch(
  '/:id',
  csrfProtection,
  authorize('research:update'),
  validate({ params: idParamSchema, body: securityResearchUpdateSchema }),
  securityResearchController.update,
);

securityResearchRouter.delete(
  '/:id',
  csrfProtection,
  authorize('research:delete'),
  validate({ params: idParamSchema }),
  securityResearchController.remove,
);

securityResearchRouter.post(
  '/:id/publish',
  csrfProtection,
  authorize('research:publish'),
  validate({ params: idParamSchema }),
  securityResearchController.publish,
);

securityResearchRouter.post(
  '/:id/unpublish',
  csrfProtection,
  authorize('research:publish'),
  validate({ params: idParamSchema }),
  securityResearchController.unpublish,
);

securityResearchRouter.post(
  '/:id/archive',
  csrfProtection,
  authorize('research:publish'),
  validate({ params: idParamSchema }),
  securityResearchController.archive,
);

securityResearchRouter.post(
  '/:id/duplicate',
  csrfProtection,
  authorize('research:publish'),
  validate({ params: idParamSchema }),
  securityResearchController.duplicate,
);
