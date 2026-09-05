import type { ContactMessageAdminRow, MessageStatus, PaginationMeta } from '@portfolio/shared';
import {
  useMutation,
  useQuery,
  useQueryClient,
  type UseMutationResult,
  type UseQueryResult,
} from '@tanstack/react-query';
import { mutate, requestPaginated } from '@/lib/api/adminClient';
import { buildQueryString } from '@/lib/api/adminResource';

/**
 * The contact-message inbox client (doc03 §5, doc07 §3) — bespoke, not
 * `createAdminResourceClient`: there is no `create` at all (a row only ever
 * arrives via the public contact form) and the only mutation is a fixed
 * status transition, not a free-form update — the generic factory's shape
 * doesn't fit either, same reasoning as `features/admin/media/client.ts`.
 */

const BASE_PATH = '/api/v1/admin/messages';
const RESOURCE_KEY = 'admin-messages';

export interface MessageListParams {
  page: number;
  pageSize: number;
  q?: string | undefined;
  status?: MessageStatus | undefined;
}

function list(
  params: MessageListParams,
): Promise<{ items: ContactMessageAdminRow[]; meta: PaginationMeta }> {
  return requestPaginated<ContactMessageAdminRow>(
    `${BASE_PATH}${buildQueryString(params as unknown as Record<string, unknown>)}`,
  );
}

function updateStatus(id: number, status: MessageStatus): Promise<ContactMessageAdminRow> {
  return mutate<ContactMessageAdminRow>(`${BASE_PATH}/${String(id)}/status`, {
    method: 'PATCH',
    body: { status },
  });
}

async function remove(id: number): Promise<void> {
  await mutate<{ deleted: boolean }>(`${BASE_PATH}/${String(id)}`, { method: 'DELETE' });
}

export const messagesClient = { list, updateStatus, remove };

export function useMessagesList(
  params: MessageListParams,
): UseQueryResult<{ items: ContactMessageAdminRow[]; meta: PaginationMeta }> {
  return useQuery({ queryKey: [RESOURCE_KEY, 'list', params], queryFn: () => list(params) });
}

/**
 * Every mutation invalidates `['admin', 'overview']` alongside its own list
 * query — that shared query is what both the Dashboard's counter and the
 * Sidebar's unread badge already read from (`useOverview.ts`'s own
 * comment), so a status change here needs to invalidate it too or the
 * badge would go stale until some unrelated navigation happened to
 * refetch it.
 */
export function useUpdateMessageStatus(): UseMutationResult<
  ContactMessageAdminRow,
  unknown,
  { id: number; status: MessageStatus }
> {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, status }) => updateStatus(id, status),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: [RESOURCE_KEY, 'list'] });
      void queryClient.invalidateQueries({ queryKey: ['admin', 'overview'] });
    },
  });
}

export function useRemoveMessage(): UseMutationResult<void, unknown, number> {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: remove,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: [RESOURCE_KEY, 'list'] });
      void queryClient.invalidateQueries({ queryKey: ['admin', 'overview'] });
    },
  });
}
