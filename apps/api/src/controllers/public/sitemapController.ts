import type { NextFunction, Request, Response } from 'express';
import { sendSuccess } from '../../lib/httpResponse.js';
import { getSitemapData } from '../../services/sitemapService.js';

export async function show(_req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    sendSuccess(res, await getSitemapData());
  } catch (error) {
    next(error);
  }
}
