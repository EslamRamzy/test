import {
  adminListQuerySchema,
  idParamSchema,
  reorderSchema,
  socialLinkCreateSchema,
  socialLinkUpdateSchema,
} from '@portfolio/shared';
import { Router } from 'express';
import { socialLinkController } from '../../controllers/admin/socialLinkController.js';
import { authenticate } from '../../middleware/authenticate.js';
import { authorize } from '../../middleware/authorize.js';
import { csrfProtection } from '../../middleware/csrf.js';
import { adminLimiter } from '../../middleware/rateLimit.js';
import { validate } from '../../middleware/validate.js';

export const socialLinksRouter: Router = Router();

socialLinksRouter.use(authenticate, adminLimiter);

socialLinksRouter.get(
  '/',
  authorize('socialLink:read'),
  validate({ query: adminListQuerySchema }),
  socialLinkController.list,
);
socialLinksRouter.post(
  '/',
  csrfProtection,
  authorize('socialLink:create'),
  validate({ body: socialLinkCreateSchema }),
  socialLinkController.create,
);
socialLinksRouter.patch(
  '/reorder',
  csrfProtection,
  authorize('socialLink:reorder'),
  validate({ body: reorderSchema }),
  socialLinkController.reorder!,
);
socialLinksRouter.get(
  '/:id',
  authorize('socialLink:read'),
  validate({ params: idParamSchema }),
  socialLinkController.read,
);
socialLinksRouter.patch(
  '/:id',
  csrfProtection,
  authorize('socialLink:update'),
  validate({ params: idParamSchema, body: socialLinkUpdateSchema }),
  socialLinkController.update,
);
socialLinksRouter.delete(
  '/:id',
  csrfProtection,
  authorize('socialLink:delete'),
  validate({ params: idParamSchema }),
  socialLinkController.remove,
);
