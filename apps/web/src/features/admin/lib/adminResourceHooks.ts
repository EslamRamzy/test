import {
  useMutation,
  useQuery,
  useQueryClient,
  type UseMutationResult,
  type UseQueryResult,
} from '@tanstack/react-query';
import type { AdminResourceClient, PublishActions } from '@/lib/api/adminResource';
import type { PaginationMeta } from '@portfolio/shared';

/**
 * The browser-side counterpart to `createAdminResourceClient` (doc07 §5:
 * "Cache + invalidation after mutation"). One `queryKey` prefix per
 * resource; every mutation invalidates the list (and, for update, the one
 * cached detail row) rather than hand-patching the cache — these lists are
 * small (doc07 §3's own modules are all "tens of rows"), so a refetch is
 * cheap and never stale-in-practice the way an optimistic patch could be.
 */
export interface AdminResourceHooks<TRow, TCreate, TUpdate, TListParams> {
  useList(params: TListParams): UseQueryResult<{ items: TRow[]; meta: PaginationMeta }>;
  useItem(id: number | undefined): UseQueryResult<TRow>;
  useCreate(): UseMutationResult<TRow, unknown, TCreate>;
  useUpdate(): UseMutationResult<TRow, unknown, { id: number; data: TUpdate }>;
  useRemove(): UseMutationResult<void, unknown, number>;
  /** `undefined` when the client itself has no `reorder` (the resource has no `displayOrder` to persist). */
  useReorder?(): UseMutationResult<void, unknown, Array<{ id: number; displayOrder: number }>>;
}

export function createAdminResourceHooks<
  TRow,
  TCreate,
  TUpdate,
  TListParams extends Record<string, unknown>,
>(
  client: AdminResourceClient<TRow, TCreate, TUpdate, TListParams>,
  resourceKey: string,
): AdminResourceHooks<TRow, TCreate, TUpdate, TListParams> {
  function useList(params: TListParams) {
    return useQuery({
      queryKey: [resourceKey, 'list', params],
      queryFn: () => client.list(params),
    });
  }

  function useItem(id: number | undefined) {
    return useQuery({
      queryKey: [resourceKey, 'item', id],
      queryFn: () => client.read(id as number),
      enabled: id !== undefined,
    });
  }

  function useCreate() {
    const queryClient = useQueryClient();
    return useMutation({
      mutationFn: (data: TCreate) => client.create(data),
      onSuccess: () => {
        void queryClient.invalidateQueries({ queryKey: [resourceKey, 'list'] });
      },
    });
  }

  function useUpdate() {
    const queryClient = useQueryClient();
    return useMutation({
      mutationFn: ({ id, data }: { id: number; data: TUpdate }) => client.update(id, data),
      onSuccess: (_row, variables) => {
        void queryClient.invalidateQueries({ queryKey: [resourceKey, 'list'] });
        void queryClient.invalidateQueries({ queryKey: [resourceKey, 'item', variables.id] });
      },
    });
  }

  function useRemove() {
    const queryClient = useQueryClient();
    return useMutation({
      mutationFn: (id: number) => client.remove(id),
      onSuccess: () => {
        void queryClient.invalidateQueries({ queryKey: [resourceKey, 'list'] });
      },
    });
  }

  const hooks: AdminResourceHooks<TRow, TCreate, TUpdate, TListParams> = {
    useList,
    useItem,
    useCreate,
    useUpdate,
    useRemove,
  };

  if (client.reorder) {
    const reorder = client.reorder;
    hooks.useReorder = function useReorder() {
      const queryClient = useQueryClient();
      return useMutation({
        mutationFn: (items: Array<{ id: number; displayOrder: number }>) => reorder(items),
        onSuccess: () => {
          void queryClient.invalidateQueries({ queryKey: [resourceKey, 'list'] });
        },
      });
    };
  }

  return hooks;
}

export interface PublishActionHooks<TRow> {
  usePublish(): UseMutationResult<TRow, unknown, number>;
  useUnpublish(): UseMutationResult<TRow, unknown, number>;
  useArchive(): UseMutationResult<TRow, unknown, number>;
  useDuplicate(): UseMutationResult<TRow, unknown, number>;
}

/**
 * The browser-side counterpart to `createPublishActions` (doc03 §5's
 * publish/unpublish/archive/duplicate group), same cache-invalidation
 * reasoning as `createAdminResourceHooks` above — used only by the three
 * publish-workflow resources (Articles, Security Research, Projects), so
 * it stays a separate factory rather than folded into that one.
 */
export function createPublishActionHooks<TRow>(
  actions: PublishActions<TRow>,
  resourceKey: string,
): PublishActionHooks<TRow> {
  function useAction(action: (id: number) => Promise<TRow>) {
    const queryClient = useQueryClient();
    return useMutation({
      mutationFn: (id: number) => action(id),
      onSuccess: (_row, id) => {
        void queryClient.invalidateQueries({ queryKey: [resourceKey, 'list'] });
        void queryClient.invalidateQueries({ queryKey: [resourceKey, 'item', id] });
      },
    });
  }

  return {
    usePublish: () => useAction(actions.publish),
    useUnpublish: () => useAction(actions.unpublish),
    useArchive: () => useAction(actions.archive),
    useDuplicate: () => useAction(actions.duplicate),
  };
}
