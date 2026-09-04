import type { NextFunction, Request, Response } from 'express';
import { sendSuccess } from '../../lib/httpResponse.js';
import { getHome } from '../../services/homeService.js';

export async function show(_req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    sendSuccess(res, await getHome());
  } catch (error) {
    next(error);
  }
}
