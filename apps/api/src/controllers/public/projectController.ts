import type { ProjectListQuery } from '@portfolio/shared';
import type { NextFunction, Request, Response } from 'express';
import { NotFoundError } from '../../errors/AppError.js';
import { sendPaginatedSuccess, sendSuccess } from '../../lib/httpResponse.js';
import * as projectService from '../../services/projectService.js';

export async function list(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const query = req.query as unknown as ProjectListQuery;
    const { items, meta } = await projectService.listProjects(query);
    sendPaginatedSuccess(res, items, meta);
  } catch (error) {
    next(error);
  }
}

export async function detail(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { slug } = req.params as { slug: string };
    const project = await projectService.getProjectBySlug(slug);
    // Draft leakage rule (doc 03 §1): absent OR not visible → the identical 404.
    if (!project) throw new NotFoundError('Project not found');
    sendSuccess(res, project);
  } catch (error) {
    next(error);
  }
}

export async function related(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { slug } = req.params as { slug: string };
    const projects = await projectService.getRelatedProjects(slug);
    if (!projects) throw new NotFoundError('Project not found');
    sendSuccess(res, projects);
  } catch (error) {
    next(error);
  }
}
