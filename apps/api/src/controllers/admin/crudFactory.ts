import type { ReorderInput } from '@portfolio/shared';
import type { NextFunction, Request, RequestHandler, Response } from 'express';
import { UnauthenticatedError } from '../../errors/AppError.js';
import { sendPaginatedSuccess, sendSuccess } from '../../lib/httpResponse.js';
import type {
  AdminCrudActor,
  AdminCrudListParams,
  AdminCrudService,
} from '../../services/adminCrudFactory.js';

/**
 * Generic admin CRUD controller — the HTTP-mapping half of the same "don't
 * write this 13 times" factory pair as `services/adminCrudFactory.ts`.
 * Every handler assumes `validate(...)` and `authenticate` already ran
 * (doc 03 §6's middleware order), so `req.body`/`req.query`/`req.params`
 * are already the Zod-parsed shape and `req.user` is already populated —
 * this file's only job is unwrapping those into a service call and
 * shaping the response, exactly like every hand-written controller
 * elsewhere in this codebase (doc 01 §5).
 */

function requireActor(req: Request): AdminCrudActor {
  // A routing bug (this controller mounted without `authenticate` in
  // front of it), not a client error — same reasoning as
  // `authorize.ts`'s own `req.user` check.
  if (!req.user) throw new UnauthenticatedError();
  return { id: req.user.id };
}

export interface AdminCrudController {
  list: RequestHandler;
  create: RequestHandler;
  read: RequestHandler;
  update: RequestHandler;
  remove: RequestHandler;
  /** `undefined` when the resource has no `reorder` — the route file simply doesn't mount a `/reorder` route for it. */
  reorder: RequestHandler | undefined;
}

export function createAdminCrudController<
  TRow,
  TCreateInput,
  TUpdateInput,
  TListParams extends AdminCrudListParams,
>(
  service: AdminCrudService<TRow, TCreateInput, TUpdateInput, TListParams>,
  /** Maps the already-validated `req.query` into this resource's own list-params shape (adding resource-specific filters and mapping the generic `sort` string to a real allow-listed key) — one Zod query schema can't statically know 13 resources' own sortable columns (see `adminListQuerySchema`'s own comment). */
  toListParams: (query: Request['query']) => TListParams,
): AdminCrudController {
  async function list(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { items, meta } = await service.list(toListParams(req.query));
      sendPaginatedSuccess(res, items, meta);
    } catch (error) {
      next(error);
    }
  }

  async function create(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const row = await service.create(req.body as TCreateInput, requireActor(req));
      sendSuccess(res, row, 201);
    } catch (error) {
      next(error);
    }
  }

  async function read(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const row = await service.read(Number(req.params['id']));
      sendSuccess(res, row);
    } catch (error) {
      next(error);
    }
  }

  async function update(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const row = await service.update(
        Number(req.params['id']),
        req.body as TUpdateInput,
        requireActor(req),
      );
      sendSuccess(res, row);
    } catch (error) {
      next(error);
    }
  }

  async function remove(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      await service.remove(Number(req.params['id']), requireActor(req));
      sendSuccess(res, { deleted: true });
    } catch (error) {
      next(error);
    }
  }

  const serviceReorder = service.reorder;
  const reorder: RequestHandler | undefined = serviceReorder
    ? async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
          await serviceReorder(req.body as ReorderInput, requireActor(req));
          sendSuccess(res, { reordered: true });
        } catch (error) {
          next(error);
        }
      }
    : undefined;

  return { list, create, read, update, remove, reorder };
}
