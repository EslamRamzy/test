import type { ProfileUpdateInput } from '@portfolio/shared';
import type { NextFunction, Request, Response } from 'express';
import { UnauthenticatedError } from '../../errors/AppError.js';
import { sendSuccess } from '../../lib/httpResponse.js';
import * as profileService from '../../services/profileService.js';
import type { AdminCrudActor } from '../../services/adminCrudFactory.js';

function requireActor(req: Request): AdminCrudActor {
  if (!req.user) throw new UnauthenticatedError();
  return { id: req.user.id };
}

async function read(_req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    sendSuccess(res, await profileService.getProfileForAdmin());
  } catch (error) {
    next(error);
  }
}

async function update(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const row = await profileService.updateProfileForAdmin(
      req.body as ProfileUpdateInput,
      requireActor(req),
    );
    sendSuccess(res, row);
  } catch (error) {
    next(error);
  }
}

export const profileController = { read, update };
