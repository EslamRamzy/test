import type { AnalyticsAdminQuery } from '@portfolio/shared';
import type { NextFunction, Request, Response } from 'express';
import { sendSuccess } from '../../lib/httpResponse.js';
import * as analyticsService from '../../services/analyticsService.js';

async function overview(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const query = req.query as unknown as AnalyticsAdminQuery;
    sendSuccess(res, await analyticsService.getAnalyticsOverview(query));
  } catch (error) {
    next(error);
  }
}

export const analyticsController = { overview };
