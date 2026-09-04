import type { NextFunction, Request, Response } from 'express';
import { sendSuccess } from '../../lib/httpResponse.js';
import { getStats } from '../../services/statsService.js';

export async function show(_req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    sendSuccess(res, await getStats());
  } catch (error) {
    next(error);
  }
}
