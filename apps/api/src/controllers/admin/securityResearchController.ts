import type {
  ResearchAdminListQuery,
  SecurityResearchCreateInput,
  SecurityResearchUpdateInput,
} from '@portfolio/shared';
import type { NextFunction, Request, RequestHandler, Response } from 'express';
import { UnauthenticatedError } from '../../errors/AppError.js';
import { sendPaginatedSuccess, sendSuccess } from '../../lib/httpResponse.js';
import type { AdminCrudActor } from '../../services/adminCrudFactory.js';
import * as securityResearchService from '../../services/securityResearchService.js';

/** Hand-written, mirroring `articleController.ts` — see `securityResearchService.ts`'s own header for why it isn't the generic factory. */

function requireActor(req: Request): AdminCrudActor {
  if (!req.user) throw new UnauthenticatedError();
  return { id: req.user.id };
}

async function list(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const q = req.query as unknown as ResearchAdminListQuery;
    const { items, meta } = await securityResearchService.listResearchForAdmin({
      page: q.page,
      pageSize: q.pageSize,
      q: q.q,
      status: q.status,
      category: q.category,
      sort: q.sort,
      order: q.order,
    });
    sendPaginatedSuccess(res, items, meta);
  } catch (error) {
    next(error);
  }
}

async function create(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const row = await securityResearchService.createResearch(
      req.body as SecurityResearchCreateInput,
      requireActor(req),
    );
    sendSuccess(res, row, 201);
  } catch (error) {
    next(error);
  }
}

async function read(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const row = await securityResearchService.getResearchForAdmin(Number(req.params['id']));
    sendSuccess(res, row);
  } catch (error) {
    next(error);
  }
}

async function update(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const row = await securityResearchService.updateResearch(
      Number(req.params['id']),
      req.body as SecurityResearchUpdateInput,
      requireActor(req),
    );
    sendSuccess(res, row);
  } catch (error) {
    next(error);
  }
}

async function remove(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    await securityResearchService.removeResearch(Number(req.params['id']), requireActor(req));
    sendSuccess(res, { deleted: true });
  } catch (error) {
    next(error);
  }
}

/** Builds one `POST .../:id/{action}` handler — publish/unpublish/archive/duplicate all share this shape (doc03 §5). */
function publishAction(
  action: (
    id: number,
    actor: AdminCrudActor,
  ) => ReturnType<typeof securityResearchService.publishResearch>,
): RequestHandler {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const row = await action(Number(req.params['id']), requireActor(req));
      sendSuccess(res, row);
    } catch (error) {
      next(error);
    }
  };
}

export const securityResearchController = {
  list,
  create,
  read,
  update,
  remove,
  publish: publishAction(securityResearchService.publishResearch),
  unpublish: publishAction(securityResearchService.unpublishResearch),
  archive: publishAction(securityResearchService.archiveResearch),
  duplicate: publishAction(securityResearchService.duplicateResearch),
};
