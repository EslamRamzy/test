import type { SecurityResearchListQuery } from '@portfolio/shared';
import type { NextFunction, Request, Response } from 'express';
import { NotFoundError } from '../../errors/AppError.js';
import { sendPaginatedSuccess, sendSuccess } from '../../lib/httpResponse.js';
import * as researchService from '../../services/securityResearchService.js';

export async function list(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const query = req.query as unknown as SecurityResearchListQuery;
    const { items, meta } = await researchService.listResearch(query);
    sendPaginatedSuccess(res, items, meta);
  } catch (error) {
    next(error);
  }
}

export async function detail(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { slug } = req.params as { slug: string };
    const research = await researchService.getResearchBySlug(slug);
    if (!research) throw new NotFoundError('Research not found');
    sendSuccess(res, research);
  } catch (error) {
    next(error);
  }
}
