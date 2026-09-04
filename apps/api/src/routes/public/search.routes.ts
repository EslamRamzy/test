import { searchQuerySchema } from '@portfolio/shared';
import { Router } from 'express';
import * as searchController from '../../controllers/public/searchController.js';
import { searchLimiter } from '../../middleware/rateLimit.js';
import { validate } from '../../middleware/validate.js';

export const searchRouter: Router = Router();

searchRouter.get(
  '/',
  searchLimiter,
  validate({ query: searchQuerySchema }),
  searchController.results,
);
