import { technologyListQuerySchema } from '@portfolio/shared';
import { Router } from 'express';
import * as contentController from '../../controllers/public/contentController.js';
import { publicReadLimiter } from '../../middleware/rateLimit.js';
import { validate } from '../../middleware/validate.js';

export const contentRouter: Router = Router();

contentRouter.get(
  '/technologies',
  publicReadLimiter,
  validate({ query: technologyListQuerySchema }),
  contentController.technologies,
);
contentRouter.get('/skills', publicReadLimiter, contentController.skills);
contentRouter.get('/certifications', publicReadLimiter, contentController.certifications);
contentRouter.get('/experience', publicReadLimiter, contentController.experience);
contentRouter.get('/education', publicReadLimiter, contentController.education);
contentRouter.get('/timeline', publicReadLimiter, contentController.timeline);
contentRouter.get('/social-links', publicReadLimiter, contentController.socialLinks);
contentRouter.get('/tags', publicReadLimiter, contentController.tags);
