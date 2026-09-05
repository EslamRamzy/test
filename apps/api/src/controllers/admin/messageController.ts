import type { MessageAdminListQuery, MessageStatusUpdateInput } from '@portfolio/shared';
import type { NextFunction, Request, Response } from 'express';
import { UnauthenticatedError } from '../../errors/AppError.js';
import { buildPaginationMeta, sendPaginatedSuccess, sendSuccess } from '../../lib/httpResponse.js';
import * as messageService from '../../services/messageService.js';

/** Hand-written, not `crudFactory.ts` — there is no `create` at all (messages only ever arrive via the public contact form) and no free-form `update` (only a fixed status-transition endpoint), so the generic CRUD shape doesn't fit. */

function requireActorId(req: Request): number {
  if (!req.user) throw new UnauthenticatedError();
  return req.user.id;
}

async function list(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const query = req.query as unknown as MessageAdminListQuery;
    const { items, total } = await messageService.list({
      page: query.page,
      pageSize: query.pageSize,
      q: query.q,
      status: query.status,
    });
    sendPaginatedSuccess(res, items, buildPaginationMeta(query.page, query.pageSize, total));
  } catch (error) {
    next(error);
  }
}

async function updateStatus(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const body = req.body as MessageStatusUpdateInput;
    const row = await messageService.updateStatus(
      Number(req.params['id']),
      body.status,
      requireActorId(req),
    );
    sendSuccess(res, row);
  } catch (error) {
    next(error);
  }
}

async function remove(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    await messageService.remove(Number(req.params['id']), requireActorId(req));
    sendSuccess(res, { deleted: true });
  } catch (error) {
    next(error);
  }
}

export const messageController = { list, updateStatus, remove };
