import type { SiteSettingBulkUpdateInput } from '@portfolio/shared';
import type { NextFunction, Request, Response } from 'express';
import { UnauthenticatedError } from '../../errors/AppError.js';
import { sendSuccess } from '../../lib/httpResponse.js';
import type { AdminCrudActor } from '../../services/adminCrudFactory.js';
import * as siteSettingService from '../../services/siteSettingService.js';

function requireActor(req: Request): AdminCrudActor {
  if (!req.user) throw new UnauthenticatedError();
  return { id: req.user.id };
}

async function list(_req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    sendSuccess(res, await siteSettingService.listSettingsForAdmin());
  } catch (error) {
    next(error);
  }
}

async function bulkUpdate(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const rows = await siteSettingService.bulkUpdateSettings(
      req.body as SiteSettingBulkUpdateInput,
      requireActor(req),
    );
    sendSuccess(res, rows);
  } catch (error) {
    next(error);
  }
}

export const settingsController = { list, bulkUpdate };
