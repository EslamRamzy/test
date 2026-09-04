import {
  adminListQuerySchema,
  certificationCreateSchema,
  certificationUpdateSchema,
  idParamSchema,
  reorderSchema,
} from '@portfolio/shared';
import { Router } from 'express';
import { certificationController } from '../../controllers/admin/certificationController.js';
import { authenticate } from '../../middleware/authenticate.js';
import { authorize } from '../../middleware/authorize.js';
import { adminLimiter } from '../../middleware/rateLimit.js';
import { validate } from '../../middleware/validate.js';

export const certificationsRouter: Router = Router();

certificationsRouter.use(authenticate, adminLimiter);

certificationsRouter.get(
  '/',
  authorize('certification:read'),
  validate({ query: adminListQuerySchema }),
  certificationController.list,
);
certificationsRouter.post(
  '/',
  authorize('certification:create'),
  validate({ body: certificationCreateSchema }),
  certificationController.create,
);
certificationsRouter.patch(
  '/reorder',
  authorize('certification:reorder'),
  validate({ body: reorderSchema }),
  certificationController.reorder!,
);
certificationsRouter.get(
  '/:id',
  authorize('certification:read'),
  validate({ params: idParamSchema }),
  certificationController.read,
);
certificationsRouter.patch(
  '/:id',
  authorize('certification:update'),
  validate({ params: idParamSchema, body: certificationUpdateSchema }),
  certificationController.update,
);
certificationsRouter.delete(
  '/:id',
  authorize('certification:delete'),
  validate({ params: idParamSchema }),
  certificationController.remove,
);
