import { Router } from 'express';
import * as homeController from '../../controllers/public/homeController.js';
import { publicReadLimiter } from '../../middleware/rateLimit.js';

export const homeRouter: Router = Router();

homeRouter.get('/', publicReadLimiter, homeController.show);
