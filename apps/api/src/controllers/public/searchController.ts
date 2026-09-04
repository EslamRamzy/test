import type { SearchQuery } from '@portfolio/shared';
import type { NextFunction, Request, Response } from 'express';
import { sendSuccess } from '../../lib/httpResponse.js';
import { search } from '../../services/searchService.js';

export async function results(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const query = req.query as unknown as SearchQuery;
    sendSuccess(res, await search(query));
  } catch (error) {
    next(error);
  }
}
