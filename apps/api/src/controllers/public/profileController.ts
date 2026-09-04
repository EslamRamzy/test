import type { NextFunction, Request, Response } from 'express';
import { NotFoundError } from '../../errors/AppError.js';
import { sendSuccess } from '../../lib/httpResponse.js';
import { getProfile } from '../../services/profileService.js';

export async function show(_req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const profile = await getProfile();
    if (!profile) {
      // Only possible if the database was never bootstrapped — the profile
      // row is a singleton created once by `db:bootstrap` and never deleted.
      throw new NotFoundError('Profile is not configured');
    }
    sendSuccess(res, profile);
  } catch (error) {
    next(error);
  }
}
