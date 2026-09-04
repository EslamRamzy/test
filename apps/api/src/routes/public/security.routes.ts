import { securityResearchListQuerySchema, slugParamSchema } from '@portfolio/shared';
import { Router } from 'express';
import * as securityResearchController from '../../controllers/public/securityResearchController.js';
import { publicReadLimiter } from '../../middleware/rateLimit.js';
import { validate } from '../../middleware/validate.js';

/** `GET /api/v1/security` — Security **Research** (doc 03 §3's review note C6: not the assessment data, which lives nested under `/projects/:slug`). */
export const securityRouter: Router = Router();

securityRouter.get(
  '/',
  publicReadLimiter,
  validate({ query: securityResearchListQuerySchema }),
  securityResearchController.list,
);
securityRouter.get(
  '/:slug',
  publicReadLimiter,
  validate({ params: slugParamSchema }),
  securityResearchController.detail,
);
