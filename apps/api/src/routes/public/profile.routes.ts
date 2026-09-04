import { Router } from 'express';
import * as profileController from '../../controllers/public/profileController.js';
import { publicReadLimiter } from '../../middleware/rateLimit.js';

export const profileRouter: Router = Router();

profileRouter.get('/', publicReadLimiter, profileController.show);
