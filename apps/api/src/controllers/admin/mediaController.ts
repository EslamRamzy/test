import type { MediaAdminListQuery, MediaUpdateInput, MediaUploadFields } from '@portfolio/shared';
import type { NextFunction, Request, Response } from 'express';
import { UnauthenticatedError, ValidationError } from '../../errors/AppError.js';
import { buildPaginationMeta, sendPaginatedSuccess, sendSuccess } from '../../lib/httpResponse.js';
import * as mediaService from '../../services/mediaService.js';

/**
 * Hand-written, not built on `crudFactory.ts` — `mediaService.ts`'s own
 * shape differs from the generic `AdminCrudService` contract in every
 * direction that matters here (upload instead of create, `read` returning
 * `{media, usage}` instead of a bare row, `update` taking a bare `altText`
 * instead of a whole update object) — see that service's own header comment.
 */

function requireActorId(req: Request): number {
  if (!req.user) throw new UnauthenticatedError();
  return req.user.id;
}

async function upload(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    // `mediaUploadMiddleware` (mounted before `validate` on this route)
    // guarantees `req.file` is present by the time this runs — see that
    // middleware's own comment.
    if (!req.file) throw new ValidationError([{ field: 'file', message: 'A file is required' }]);
    const fields = req.body as MediaUploadFields;

    const row = await mediaService.upload({
      buffer: req.file.buffer,
      originalNameRaw: req.file.originalname,
      kind: fields.kind,
      altText: fields.altText ?? null,
      actorId: requireActorId(req),
    });
    sendSuccess(res, row, 201);
  } catch (error) {
    next(error);
  }
}

async function list(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const query = req.query as unknown as MediaAdminListQuery;
    const { items, total } = await mediaService.list({
      page: query.page,
      pageSize: query.pageSize,
      q: query.q,
      kind: query.kind,
    });
    sendPaginatedSuccess(res, items, buildPaginationMeta(query.page, query.pageSize, total));
  } catch (error) {
    next(error);
  }
}

async function read(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const result = await mediaService.read(Number(req.params['id']));
    sendSuccess(res, result);
  } catch (error) {
    next(error);
  }
}

async function update(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const body = req.body as MediaUpdateInput;
    const row = await mediaService.update(Number(req.params['id']), body, requireActorId(req));
    sendSuccess(res, row);
  } catch (error) {
    next(error);
  }
}

async function usage(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const rows = await mediaService.usage(Number(req.params['id']));
    sendSuccess(res, rows);
  } catch (error) {
    next(error);
  }
}

async function remove(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    await mediaService.remove(Number(req.params['id']), requireActorId(req));
    sendSuccess(res, { deleted: true });
  } catch (error) {
    next(error);
  }
}

export const mediaController = { upload, list, read, update, remove, usage };
