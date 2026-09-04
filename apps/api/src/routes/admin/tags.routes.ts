import {
  adminListQuerySchema,
  idParamSchema,
  tagCreateSchema,
  tagUpdateSchema,
} from '@portfolio/shared';
import { Router } from 'express';
import { tagController } from '../../controllers/admin/tagController.js';
import { authenticate } from '../../middleware/authenticate.js';
import { authorize } from '../../middleware/authorize.js';
import { adminLimiter } from '../../middleware/rateLimit.js';
import { validate } from '../../middleware/validate.js';

/**
 * `/api/v1/admin/tags` — authorized under `article:*` (`PERMISSIONS` has
 * no dedicated `tag` key; doc 07 §51 lists no standalone "Tags" sidebar
 * module either — a `<TagInput>` create-or-select control, shared by
 * Articles and Security Research, is doc07 §2's own stated shape for how
 * this resource is actually used, not a module of its own). No `/reorder`
 * — `Tag` has no `displayOrder` column.
 */
export const tagsRouter: Router = Router();

tagsRouter.use(authenticate, adminLimiter);

tagsRouter.get(
  '/',
  authorize('article:read'),
  validate({ query: adminListQuerySchema }),
  tagController.list,
);
tagsRouter.post(
  '/',
  authorize('article:create'),
  validate({ body: tagCreateSchema }),
  tagController.create,
);
tagsRouter.get(
  '/:id',
  authorize('article:read'),
  validate({ params: idParamSchema }),
  tagController.read,
);
tagsRouter.patch(
  '/:id',
  authorize('article:update'),
  validate({ params: idParamSchema, body: tagUpdateSchema }),
  tagController.update,
);
tagsRouter.delete(
  '/:id',
  authorize('article:delete'),
  validate({ params: idParamSchema }),
  tagController.remove,
);
