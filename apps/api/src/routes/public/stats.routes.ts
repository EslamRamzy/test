import { Router } from 'express';
import * as statsController from '../../controllers/public/statsController.js';
import { publicReadLimiter } from '../../middleware/rateLimit.js';

export const statsRouter: Router = Router();

statsRouter.get('/', publicReadLimiter, statsController.show);
