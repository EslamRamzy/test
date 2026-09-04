import type { PaginationMeta, ReorderInput } from '@portfolio/shared';
import { prisma } from '../config/prisma.js';
import type { PrismaClientOrTx } from '../config/prisma.js';
import { NotFoundError } from '../errors/AppError.js';
import { buildPaginationMeta } from '../lib/httpResponse.js';
import * as auditLogRepository from '../repositories/auditLogRepository.js';

/**
 * Generic admin CRUD service (docs/architecture/07 §2: "A new module is
 * then: a Zod schema, a column definition, a field definition, and a route
 * file"). Every simple admin resource follows the identical list/create/
 * read/update/delete(+reorder) shape (doc 03 §5) — this factory is the
 * "service" half of not re-writing that shape 13 times.
 *
 * Deliberately NOT also a repository factory: Prisma's own delegate types
 * differ per model in ways that don't collapse into one clean generic
 * without either fighting the type system or dropping to `any` at the
 * seams. Repositories stay thin, explicit, per-entity files (2-4 lines per
 * function, naturally fully typed against their own model) — this factory
 * takes a small repository-shaped object as config and supplies the
 * genuinely-shared behaviour: pagination math, the transaction+audit-log
 * coupling every mutation needs (doc 05 §7), and 404 handling.
 */

export interface AdminCrudListParams {
  page: number;
  pageSize: number;
}

export interface AdminCrudActor {
  id: number;
}

export interface AdminCrudRepository<
  TRow,
  TCreateInput,
  TUpdateInput,
  TListParams extends AdminCrudListParams,
> {
  list(params: TListParams): Promise<{ items: TRow[]; total: number }>;
  findById(id: number, client?: PrismaClientOrTx): Promise<TRow | null>;
  create(data: TCreateInput, client?: PrismaClientOrTx): Promise<TRow>;
  update(id: number, data: TUpdateInput, client?: PrismaClientOrTx): Promise<TRow>;
  remove(id: number, client?: PrismaClientOrTx): Promise<void>;
  /** Present only for reorderable resources (doc 03 §5's `PATCH .../reorder`) — omitted entirely for e.g. security-research, which has no `displayOrder` column. */
  reorder?(items: ReorderInput, client?: PrismaClientOrTx): Promise<void>;
}

export interface AdminCrudConfig<
  TRow,
  TCreateInput,
  TUpdateInput,
  TListParams extends AdminCrudListParams,
> {
  /** Upper-snake-case, e.g. 'TECHNOLOGY' — becomes both the audit `entityType` and the `{ENTITY}_CREATE`/`_UPDATE`/`_DELETE`/`_REORDER` action names. */
  entityName: string;
  repository: AdminCrudRepository<TRow, TCreateInput, TUpdateInput, TListParams>;
  getRowId: (row: TRow) => number;
}

export interface AdminCrudService<TRow, TCreateInput, TUpdateInput, TListParams> {
  list(params: TListParams): Promise<{ items: TRow[]; meta: PaginationMeta }>;
  read(id: number): Promise<TRow>;
  create(data: TCreateInput, actor: AdminCrudActor): Promise<TRow>;
  update(id: number, data: TUpdateInput, actor: AdminCrudActor): Promise<TRow>;
  remove(id: number, actor: AdminCrudActor): Promise<void>;
  /** `undefined` when the underlying repository has no `reorder` — matches `AdminCrudRepository.reorder`'s own optionality rather than throwing at call time for a resource that was never reorderable. */
  reorder: ((items: ReorderInput, actor: AdminCrudActor) => Promise<void>) | undefined;
}

export function createAdminCrudService<
  TRow,
  TCreateInput,
  TUpdateInput,
  TListParams extends AdminCrudListParams,
>(
  config: AdminCrudConfig<TRow, TCreateInput, TUpdateInput, TListParams>,
): AdminCrudService<TRow, TCreateInput, TUpdateInput, TListParams> {
  const { repository, entityName, getRowId } = config;
  const notFoundMessage = `${entityName.charAt(0)}${entityName.slice(1).toLowerCase()} not found`;

  async function list(params: TListParams) {
    const { items, total } = await repository.list(params);
    return { items, meta: buildPaginationMeta(params.page, params.pageSize, total) };
  }

  async function read(id: number): Promise<TRow> {
    const row = await repository.findById(id);
    if (!row) throw new NotFoundError(notFoundMessage);
    return row;
  }

  async function create(data: TCreateInput, actor: AdminCrudActor): Promise<TRow> {
    return prisma.$transaction(async (tx) => {
      const row = await repository.create(data, tx);
      await auditLogRepository.record(
        {
          userId: actor.id,
          action: `${entityName}_CREATE`,
          entityType: entityName,
          entityId: getRowId(row),
        },
        tx,
      );
      return row;
    });
  }

  async function update(id: number, data: TUpdateInput, actor: AdminCrudActor): Promise<TRow> {
    return prisma.$transaction(async (tx) => {
      const existing = await repository.findById(id, tx);
      if (!existing) throw new NotFoundError(notFoundMessage);
      const row = await repository.update(id, data, tx);
      await auditLogRepository.record(
        { userId: actor.id, action: `${entityName}_UPDATE`, entityType: entityName, entityId: id },
        tx,
      );
      return row;
    });
  }

  async function remove(id: number, actor: AdminCrudActor): Promise<void> {
    await prisma.$transaction(async (tx) => {
      const existing = await repository.findById(id, tx);
      if (!existing) throw new NotFoundError(notFoundMessage);
      await repository.remove(id, tx);
      await auditLogRepository.record(
        { userId: actor.id, action: `${entityName}_DELETE`, entityType: entityName, entityId: id },
        tx,
      );
    });
  }

  const reorderFn = repository.reorder;
  const reorder = reorderFn
    ? async (items: ReorderInput, actor: AdminCrudActor): Promise<void> => {
        await prisma.$transaction(async (tx) => {
          await reorderFn(items, tx);
          await auditLogRepository.record(
            { userId: actor.id, action: `${entityName}_REORDER`, entityType: entityName },
            tx,
          );
        });
      }
    : undefined;

  return { list, read, create, update, remove, reorder };
}
