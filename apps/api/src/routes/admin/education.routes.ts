import {
  adminListQuerySchema,
  educationCreateSchema,
  educationUpdateSchema,
  idParamSchema,
  reorderSchema,
} from '@portfolio/shared';
import { Router } from 'express';
import { educationController } from '../../controllers/admin/educationController.js';
import { authenticate } from '../../middleware/authenticate.js';
import { authorize } from '../../middleware/authorize.js';
import { adminLimiter } from '../../middleware/rateLimit.js';
import { validate } from '../../middleware/validate.js';

export const educationRouter: Router = Router();

educationRouter.use(authenticate, adminLimiter);

educationRouter.get(
  '/',
  authorize('education:read'),
  validate({ query: adminListQuerySchema }),
  educationController.list,
);
educationRouter.post(
  '/',
  authorize('education:create'),
  validate({ body: educationCreateSchema }),
  educationController.create,
);
educationRouter.patch(
  '/reorder',
  authorize('education:reorder'),
  validate({ body: reorderSchema }),
  educationController.reorder!,
);
educationRouter.get(
  '/:id',
  authorize('education:read'),
  validate({ params: idParamSchema }),
  educationController.read,
);
educationRouter.patch(
  '/:id',
  authorize('education:update'),
  validate({ params: idParamSchema, body: educationUpdateSchema }),
  educationController.update,
);
educationRouter.delete(
  '/:id',
  authorize('education:delete'),
  validate({ params: idParamSchema }),
  educationController.remove,
);
