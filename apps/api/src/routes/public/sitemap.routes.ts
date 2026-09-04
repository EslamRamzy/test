import { Router } from 'express';
import * as sitemapController from '../../controllers/public/sitemapController.js';
import { publicReadLimiter } from '../../middleware/rateLimit.js';

export const sitemapRouter: Router = Router();

sitemapRouter.get('/', publicReadLimiter, sitemapController.show);
