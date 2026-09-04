import type { NextFunction, Request, Response } from 'express';
import { sendSuccess } from '../../lib/httpResponse.js';
import { listArticleCategories } from '../../services/articleCategoryService.js';
import { listCertifications } from '../../services/certificationService.js';
import { listEducation } from '../../services/educationService.js';
import { listExperience } from '../../services/experienceService.js';
import { listSkillCategories } from '../../services/skillService.js';
import { listSocialLinks } from '../../services/socialLinkService.js';
import { listTags } from '../../services/tagService.js';
import { listTechnologies } from '../../services/technologyService.js';
import { listTimeline } from '../../services/timelineService.js';

/**
 * The small, list-only public resources (docs/architecture/03 §3) share one
 * file: each is a single `GET`, no sub-routes, no body, and the same
 * "fetch, map, return" shape as the others — one dedicated route file per
 * resource here would be seven near-identical wrappers around one call
 * each. `projects`/`articles`/`security` (paginated, filtered, with detail
 * routes) stay in their own files.
 */

export async function technologies(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const query = req.query as { category?: string };
    sendSuccess(res, await listTechnologies(query.category));
  } catch (error) {
    next(error);
  }
}

export async function skills(_req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    sendSuccess(res, await listSkillCategories());
  } catch (error) {
    next(error);
  }
}

export async function certifications(
  _req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    sendSuccess(res, await listCertifications());
  } catch (error) {
    next(error);
  }
}

export async function experience(_req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    sendSuccess(res, await listExperience());
  } catch (error) {
    next(error);
  }
}

export async function education(_req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    sendSuccess(res, await listEducation());
  } catch (error) {
    next(error);
  }
}

export async function timeline(_req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    sendSuccess(res, await listTimeline());
  } catch (error) {
    next(error);
  }
}

export async function socialLinks(_req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    sendSuccess(res, await listSocialLinks());
  } catch (error) {
    next(error);
  }
}

export async function articleCategories(
  _req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    sendSuccess(res, await listArticleCategories());
  } catch (error) {
    next(error);
  }
}

export async function tags(_req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    sendSuccess(res, await listTags());
  } catch (error) {
    next(error);
  }
}
