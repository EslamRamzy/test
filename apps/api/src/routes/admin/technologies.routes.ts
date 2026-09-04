import {
  adminListQuerySchema,
  idParamSchema,
  reorderSchema,
  technologyCreateSchema,
  technologyUpdateSchema,
} from '@portfolio/shared';
import { Router } from 'express';
import { technologyController } from '../../controllers/admin/technologyController.js';
import { authenticate } from '../../middleware/authenticate.js';
import { authorize } from '../../middleware/authorize.js';
import { adminLimiter } from '../../middleware/rateLimit.js';
import { validate } from '../../middleware/validate.js';

/**
 * `/api/v1/admin/technologies` (doc 03 §5's generic CRUD+reorder shape).
 * `authenticate` then `adminLimiter` on every route here (per-user keying
 * needs `req.user` populated first — same reasoning as `overview.routes.ts`),
 * then `authorize('technology:*')`, then `validate`, matching doc 03 §6's
 * order for everything after the auth/rate-limit pair.
 *
 * `PATCH /reorder` is registered BEFORE `PATCH /:id` — Express matches
 * routes in registration order, and `idParamSchema`'s `z.coerce.number()`
 * would otherwise silently swallow a misrouted `/reorder` request as
 * `id: NaN` before this file's own logic ever ran, turning a routing
 * mistake into a confusing 400 instead of the reorder handler.
 */
export const technologiesRouter: Router = Router();

technologiesRouter.use(authenticate, adminLimiter);

technologiesRouter.get(
  '/',
  authorize('technology:read'),
  validate({ query: adminListQuerySchema }),
  technologyController.list,
);

technologiesRouter.post(
  '/',
  authorize('technology:create'),
  validate({ body: technologyCreateSchema }),
  technologyController.create,
);

// `reorder` is only ever defined when the repository config supplies one
// (`createAdminCrudController`'s own doc) — every simple resource in this
// phase does, so the non-null assertion holds; a resource without one
// (e.g. security-research) simply never registers this route at all.
technologiesRouter.patch(
  '/reorder',
  authorize('technology:reorder'),
  validate({ body: reorderSchema }),
  technologyController.reorder!,
);

technologiesRouter.get(
  '/:id',
  authorize('technology:read'),
  validate({ params: idParamSchema }),
  technologyController.read,
);

technologiesRouter.patch(
  '/:id',
  authorize('technology:update'),
  validate({ params: idParamSchema, body: technologyUpdateSchema }),
  technologyController.update,
);

technologiesRouter.delete(
  '/:id',
  authorize('technology:delete'),
  validate({ params: idParamSchema }),
  technologyController.remove,
);
