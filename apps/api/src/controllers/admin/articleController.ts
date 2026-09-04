import type { AdminListQuery, ArticleCreateInput, ArticleUpdateInput } from '@portfolio/shared';
import type { NextFunction, Request, RequestHandler, Response } from 'express';
import { UnauthenticatedError } from '../../errors/AppError.js';
import { sendPaginatedSuccess, sendSuccess } from '../../lib/httpResponse.js';
import type { AdminCrudActor } from '../../services/adminCrudFactory.js';
import * as articleService from '../../services/articleService.js';

/**
 * Hand-written, not `createAdminCrudController` — `articleService.ts`'s own
 * header explains why the service side isn't the generic factory either.
 * The shape (unwrap already-`validate`d req.*, call the service, shape the
 * response) still matches every other admin controller (`crudFactory.ts`).
 */

function requireActor(req: Request): AdminCrudActor {
  if (!req.user) throw new UnauthenticatedError();
  return { id: req.user.id };
}

async function list(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const q = req.query as unknown as AdminListQuery;
    const { items, meta } = await articleService.listArticlesForAdmin({
      page: q.page,
      pageSize: q.pageSize,
      q: q.q,
      status: q.status,
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
    const row = await articleService.createArticle(
      req.body as ArticleCreateInput,
      requireActor(req),
    );
    sendSuccess(res, row, 201);
  } catch (error) {
    next(error);
  }
}

async function read(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const row = await articleService.getArticleForAdmin(Number(req.params['id']));
    sendSuccess(res, row);
  } catch (error) {
    next(error);
  }
}

async function update(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const row = await articleService.updateArticle(
      Number(req.params['id']),
      req.body as ArticleUpdateInput,
      requireActor(req),
    );
    sendSuccess(res, row);
  } catch (error) {
    next(error);
  }
}

async function remove(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    await articleService.removeArticle(Number(req.params['id']), requireActor(req));
    sendSuccess(res, { deleted: true });
  } catch (error) {
    next(error);
  }
}

/** Builds one `POST .../:id/{action}` handler — publish/unpublish/archive/duplicate all share this exact request/response shape (doc03 §5). */
function publishAction(
  action: (id: number, actor: AdminCrudActor) => ReturnType<typeof articleService.publishArticle>,
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

export const articleController = {
  list,
  create,
  read,
  update,
  remove,
  publish: publishAction(articleService.publishArticle),
  unpublish: publishAction(articleService.unpublishArticle),
  archive: publishAction(articleService.archiveArticle),
  duplicate: publishAction(articleService.duplicateArticle),
};
