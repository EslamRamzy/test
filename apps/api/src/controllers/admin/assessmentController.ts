import type {
  SecurityAssessmentCreateInput,
  SecurityAssessmentTestsUpsertInput,
  SecurityAssessmentUpdateInput,
  SecurityFindingCreateInput,
} from '@portfolio/shared';
import type { NextFunction, Request, Response } from 'express';
import { UnauthenticatedError } from '../../errors/AppError.js';
import { sendSuccess } from '../../lib/httpResponse.js';
import type { AdminCrudActor } from '../../services/adminCrudFactory.js';
import * as assessmentService from '../../services/securityAssessmentService.js';

/**
 * Backs two mount points: the project-nested `list`/`create` (doc03 §5's
 * `GET|POST /admin/projects/:id/assessments`, wired into
 * `projects.routes.ts`) and the standalone `GET|PATCH|DELETE
 * /admin/assessments/:id` + `PUT .../tests` + `GET|POST .../findings`,
 * wired into `assessments.routes.ts`. One controller file, two routers —
 * the underlying service functions are the same either way.
 */

function requireActor(req: Request): AdminCrudActor {
  if (!req.user) throw new UnauthenticatedError();
  return { id: req.user.id };
}

// --- Mounted under /admin/projects/:id/assessments --------------------------

async function listForProject(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    sendSuccess(res, await assessmentService.listAssessments(Number(req.params['id'])));
  } catch (error) {
    next(error);
  }
}

async function createForProject(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const row = await assessmentService.createAssessment(
      Number(req.params['id']),
      req.body as SecurityAssessmentCreateInput,
      requireActor(req),
    );
    sendSuccess(res, row, 201);
  } catch (error) {
    next(error);
  }
}

// --- Mounted under /admin/assessments -----------------------------------------

async function read(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    sendSuccess(res, await assessmentService.getAssessmentForAdmin(Number(req.params['id'])));
  } catch (error) {
    next(error);
  }
}

async function update(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const row = await assessmentService.updateAssessment(
      Number(req.params['id']),
      req.body as SecurityAssessmentUpdateInput,
      requireActor(req),
    );
    sendSuccess(res, row);
  } catch (error) {
    next(error);
  }
}

async function remove(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    await assessmentService.removeAssessment(Number(req.params['id']), requireActor(req));
    sendSuccess(res, { deleted: true });
  } catch (error) {
    next(error);
  }
}

async function upsertTests(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const row = await assessmentService.upsertAssessmentTests(
      Number(req.params['id']),
      req.body as SecurityAssessmentTestsUpsertInput,
      requireActor(req),
    );
    sendSuccess(res, row);
  } catch (error) {
    next(error);
  }
}

async function listFindings(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    sendSuccess(res, await assessmentService.listFindings(Number(req.params['id'])));
  } catch (error) {
    next(error);
  }
}

async function createFinding(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const row = await assessmentService.createFinding(
      Number(req.params['id']),
      req.body as SecurityFindingCreateInput,
      requireActor(req),
    );
    sendSuccess(res, row, 201);
  } catch (error) {
    next(error);
  }
}

export const assessmentController = {
  listForProject,
  createForProject,
  read,
  update,
  remove,
  upsertTests,
  listFindings,
  createFinding,
};
