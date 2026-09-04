import { contactSchema } from '@portfolio/shared';
import { Router } from 'express';
import * as contactController from '../../controllers/public/contactController.js';
import { contactLimiter } from '../../middleware/rateLimit.js';
import { validate } from '../../middleware/validate.js';

export const contactRouter: Router = Router();

contactRouter.post(
  '/',
  contactLimiter,
  validate({ body: contactSchema }),
  contactController.submit,
);
