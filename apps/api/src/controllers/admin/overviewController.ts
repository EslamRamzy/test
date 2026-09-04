import type { NextFunction, Request, Response } from 'express';
import { sendSuccess } from '../../lib/httpResponse.js';
import { getOverview } from '../../services/overviewService.js';

export async function show(_req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const overview = await getOverview();
    sendSuccess(res, overview);
  } catch (error) {
    next(error);
  }
}
