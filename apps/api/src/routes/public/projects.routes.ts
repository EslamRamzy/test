import { projectListQuerySchema, slugParamSchema } from '@portfolio/shared';
import { Router } from 'express';
import * as projectController from '../../controllers/public/projectController.js';
import { publicReadLimiter } from '../../middleware/rateLimit.js';
import { validate } from '../../middleware/validate.js';

export const projectsRouter: Router = Router();

projectsRouter.get(
  '/',
  publicReadLimiter,
  validate({ query: projectListQuerySchema }),
  projectController.list,
);
projectsRouter.get(
  '/:slug',
  publicReadLimiter,
  validate({ params: slugParamSchema }),
  projectController.detail,
);
projectsRouter.get(
  '/:slug/related',
  publicReadLimiter,
  validate({ params: slugParamSchema }),
  projectController.related,
);
