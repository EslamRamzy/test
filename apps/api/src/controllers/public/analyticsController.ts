import type { AnalyticsViewInput } from '@portfolio/shared';
import type { NextFunction, Request, Response } from 'express';
import * as analyticsService from '../../services/analyticsService.js';

/**
 * `204 No Content` (doc 03 §3: "returns 204") — the one deliberate exception
 * to the `sendSuccess` envelope convention: a fire-and-forget beacon has
 * nothing to report back, and a response body would be bytes the client
 * throws away on every single page view.
 */
export async function record(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const input = req.body as AnalyticsViewInput;
    await analyticsService.recordView(input, {
      ip: req.ip ?? 'unknown',
      userAgent: req.get('user-agent') ?? undefined,
    });
    res.status(204).end();
  } catch (error) {
    next(error);
  }
}
