import type {
  ProjectAdminListQuery,
  ProjectCreateInput,
  ProjectFeaturedInput,
  ProjectImageCreateInput,
  ProjectSectionsUpdateInput,
  ProjectTechnologiesInput,
  ProjectUpdateInput,
  ReorderInput,
} from '@portfolio/shared';
import type { NextFunction, Request, RequestHandler, Response } from 'express';
import { UnauthenticatedError } from '../../errors/AppError.js';
import { sendPaginatedSuccess, sendSuccess } from '../../lib/httpResponse.js';
import type { AdminCrudActor } from '../../services/adminCrudFactory.js';
import * as projectService from '../../services/projectService.js';

/** Hand-written, mirroring `articleController.ts` — see `projectService.ts`'s own header for why it isn't the generic factory. The most endpoints of any admin controller (doc07 §3's tabbed editor), so grouped by section below. */

function requireActor(req: Request): AdminCrudActor {
  if (!req.user) throw new UnauthenticatedError();
  return { id: req.user.id };
}

function idParam(req: Request): number {
  return Number(req.params['id']);
}

// --- Plain CRUD + reorder ----------------------------------------------------

async function list(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const q = req.query as unknown as ProjectAdminListQuery;
    const { items, meta } = await projectService.listProjectsForAdmin({
      page: q.page,
      pageSize: q.pageSize,
      q: q.q,
      status: q.status,
      category: q.category,
      featured: q.featured,
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
    const row = await projectService.createProject(
      req.body as ProjectCreateInput,
      requireActor(req),
    );
    sendSuccess(res, row, 201);
  } catch (error) {
    next(error);
  }
}

async function read(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    sendSuccess(res, await projectService.getProjectForAdmin(idParam(req)));
  } catch (error) {
    next(error);
  }
}

async function update(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const row = await projectService.updateProject(
      idParam(req),
      req.body as ProjectUpdateInput,
      requireActor(req),
    );
    sendSuccess(res, row);
  } catch (error) {
    next(error);
  }
}

async function remove(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    await projectService.removeProject(idParam(req), requireActor(req));
    sendSuccess(res, { deleted: true });
  } catch (error) {
    next(error);
  }
}

async function reorder(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    await projectService.reorderProjects(req.body as ReorderInput, requireActor(req));
    sendSuccess(res, { reordered: true });
  } catch (error) {
    next(error);
  }
}

// --- Publish workflow --------------------------------------------------------

function publishAction(
  action: (id: number, actor: AdminCrudActor) => ReturnType<typeof projectService.publishProject>,
): RequestHandler {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      sendSuccess(res, await action(idParam(req), requireActor(req)));
    } catch (error) {
      next(error);
    }
  };
}

// --- Tabbed-editor endpoints (doc03 §5 "Project-specific") -------------------

async function setTechnologies(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const row = await projectService.setProjectTechnologies(
      idParam(req),
      req.body as ProjectTechnologiesInput,
      requireActor(req),
    );
    sendSuccess(res, row);
  } catch (error) {
    next(error);
  }
}

async function addImage(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const row = await projectService.addProjectImage(
      idParam(req),
      req.body as ProjectImageCreateInput,
      requireActor(req),
    );
    sendSuccess(res, row, 201);
  } catch (error) {
    next(error);
  }
}

async function reorderImages(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const row = await projectService.reorderProjectImages(
      idParam(req),
      req.body as ReorderInput,
      requireActor(req),
    );
    sendSuccess(res, row);
  } catch (error) {
    next(error);
  }
}

async function removeImage(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    await projectService.removeProjectImage(
      idParam(req),
      Number(req.params['imageId']),
      requireActor(req),
    );
    sendSuccess(res, { deleted: true });
  } catch (error) {
    next(error);
  }
}

async function updateSections(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const row = await projectService.replaceProjectSections(
      idParam(req),
      req.body as ProjectSectionsUpdateInput,
      requireActor(req),
    );
    sendSuccess(res, row);
  } catch (error) {
    next(error);
  }
}

async function setFeatured(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const row = await projectService.setProjectFeatured(
      idParam(req),
      req.body as ProjectFeaturedInput,
      requireActor(req),
    );
    sendSuccess(res, row);
  } catch (error) {
    next(error);
  }
}

export const projectController = {
  list,
  create,
  read,
  update,
  remove,
  reorder,
  publish: publishAction(projectService.publishProject),
  unpublish: publishAction(projectService.unpublishProject),
  archive: publishAction(projectService.archiveProject),
  duplicate: publishAction(projectService.duplicateProject),
  setTechnologies,
  addImage,
  reorderImages,
  removeImage,
  updateSections,
  setFeatured,
};
