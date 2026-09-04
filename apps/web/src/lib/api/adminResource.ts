import type { PaginationMeta } from '@portfolio/shared';
import { mutate, request, requestPaginated } from './adminClient';

/**
 * Generic admin CRUD client (Phase 8) — the browser-side mirror of
 * `apps/api/src/services/adminCrudFactory.ts`: every simple admin module
 * follows the identical list/create/read/update/delete(+reorder) shape
 * (doc03 §5), so this is the "don't write it 13 times" factory for the
 * fetch layer, the same way that file is for the service layer.
 *
 * Deliberately loose about `TListParams` (`Record<string, unknown>`, not a
 * generic constrained further) — each resource's own list-query type
 * already comes from the shared Zod schema; this file's only job is
 * turning it into a query string, not re-validating it.
 */

function buildQueryString(params: Record<string, unknown>): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === '') continue;
    search.set(key, String(value));
  }
  const qs = search.toString();
  return qs ? `?${qs}` : '';
}

export interface AdminResourceClient<TRow, TCreate, TUpdate, TListParams> {
  list(params: TListParams): Promise<{ items: TRow[]; meta: PaginationMeta }>;
  read(id: number): Promise<TRow>;
  create(data: TCreate): Promise<TRow>;
  update(id: number, data: TUpdate): Promise<TRow>;
  remove(id: number): Promise<void>;
  /** Present only when `{ reorder: true }` is passed — mirrors `AdminCrudService.reorder`'s own optionality on the server. */
  reorder?(items: Array<{ id: number; displayOrder: number }>): Promise<void>;
}

export function createAdminResourceClient<
  TRow,
  TCreate = Partial<TRow>,
  TUpdate = Partial<TCreate>,
  TListParams extends Record<string, unknown> = Record<string, unknown>,
>(
  basePath: string,
  options: { reorder?: boolean } = {},
): AdminResourceClient<TRow, TCreate, TUpdate, TListParams> {
  const client: AdminResourceClient<TRow, TCreate, TUpdate, TListParams> = {
    list: (params) => requestPaginated<TRow>(`${basePath}${buildQueryString(params)}`),
    read: (id) => request<TRow>(`${basePath}/${id}`),
    create: (data) => mutate<TRow>(basePath, { method: 'POST', body: data }),
    update: (id, data) => mutate<TRow>(`${basePath}/${id}`, { method: 'PATCH', body: data }),
    remove: async (id) => {
      await mutate<{ deleted: boolean }>(`${basePath}/${id}`, { method: 'DELETE' });
    },
  };

  if (options.reorder) {
    client.reorder = async (items) => {
      await mutate<{ reordered: boolean }>(`${basePath}/reorder`, { method: 'PATCH', body: items });
    };
  }

  return client;
}

/**
 * The publish-workflow group (doc03 §5's "Publishing (content resources
 * only)") — Articles, Security Research, and Projects each add these four
 * on top of their own `createAdminResourceClient`, rather than folding
 * them into the generic factory above (most resources have no publish
 * workflow at all).
 */
export interface PublishActions<TRow> {
  publish(id: number): Promise<TRow>;
  unpublish(id: number): Promise<TRow>;
  archive(id: number): Promise<TRow>;
  duplicate(id: number): Promise<TRow>;
}

export function createPublishActions<TRow>(basePath: string): PublishActions<TRow> {
  const action =
    (name: string) =>
    (id: number): Promise<TRow> =>
      mutate<TRow>(`${basePath}/${id}/${name}`, { method: 'POST' });

  return {
    publish: action('publish'),
    unpublish: action('unpublish'),
    archive: action('archive'),
    duplicate: action('duplicate'),
  };
}
