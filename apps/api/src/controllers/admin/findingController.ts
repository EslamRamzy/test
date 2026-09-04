import type { SecurityFindingUpdateInput } from '@portfolio/shared';
import type { NextFunction, Request, Response } from 'express';
import { UnauthenticatedError } from '../../errors/AppError.js';
import { sendSuccess } from '../../lib/httpResponse.js';
import type { AdminCrudActor } from '../../services/adminCrudFactory.js';
import * as assessmentService from '../../services/securityAssessmentService.js';

/** `/api/v1/admin/findings/:id` — `PATCH|DELETE` only (doc03 §5); create/list live under `/admin/assessments/:id/findings` instead (`assessmentController.ts`). */

function requireActor(req: Request): AdminCrudActor {
  if (!req.user) throw new UnauthenticatedError();
  return { id: req.user.id };
}

async function update(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const row = await assessmentService.updateFinding(
      Number(req.params['id']),
      req.body as SecurityFindingUpdateInput,
      requireActor(req),
    );
    sendSuccess(res, row);
  } catch (error) {
    next(error);
  }
}

async function remove(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    await assessmentService.removeFinding(Number(req.params['id']), requireActor(req));
    sendSuccess(res, { deleted: true });
  } catch (error) {
    next(error);
  }
}

export const findingController = { update, remove };
