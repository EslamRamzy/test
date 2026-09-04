import { articleListQuerySchema, slugParamSchema } from '@portfolio/shared';
import { Router } from 'express';
import * as articleController from '../../controllers/public/articleController.js';
import * as contentController from '../../controllers/public/contentController.js';
import { publicReadLimiter } from '../../middleware/rateLimit.js';
import { validate } from '../../middleware/validate.js';

export const articlesRouter: Router = Router();

// Registered before `/:slug` so "categories" is never captured as a slug.
articlesRouter.get('/categories', publicReadLimiter, contentController.articleCategories);

articlesRouter.get(
  '/',
  publicReadLimiter,
  validate({ query: articleListQuerySchema }),
  articleController.list,
);
articlesRouter.get(
  '/:slug',
  publicReadLimiter,
  validate({ params: slugParamSchema }),
  articleController.detail,
);
