import { analyticsViewSchema } from '@portfolio/shared';
import { Router } from 'express';
import * as analyticsController from '../../controllers/public/analyticsController.js';
import { analyticsLimiter } from '../../middleware/rateLimit.js';
import { validate } from '../../middleware/validate.js';

export const analyticsRouter: Router = Router();

analyticsRouter.post(
  '/view',
  analyticsLimiter,
  validate({ body: analyticsViewSchema }),
  analyticsController.record,
);
