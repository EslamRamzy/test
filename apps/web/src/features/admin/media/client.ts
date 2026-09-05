import type {
  AdminMediaFullRow,
  MediaKind,
  MediaUsageRef,
  PaginationMeta,
} from '@portfolio/shared';
import {
  useMutation,
  useQuery,
  useQueryClient,
  type UseMutationResult,
  type UseQueryResult,
} from '@tanstack/react-query';
import { mutate, mutateFormData, request, requestPaginated } from '@/lib/api/adminClient';
import { buildQueryString } from '@/lib/api/adminResource';

/**
 * The media library's own client — not `createAdminResourceClient`, unlike
 * every other module (doc07 §3's "Media"). `create` here is a real file
 * upload (`FormData`, via `mutateFormData`) with its own fields (`kind`,
 * `altText`) rather than a JSON body of the row's own shape, and `read`
 * returns `{media, usage}` rather than a bare row — both differ from the
 * generic factory's contract in ways that don't collapse cleanly into it
 * (same reasoning as the API side's `mediaService.ts`, which isn't built on
 * `adminCrudFactory.ts` either).
 */

const BASE_PATH = '/api/v1/admin/media';
const RESOURCE_KEY = 'admin-media';

export interface MediaListParams {
  page: number;
  pageSize: number;
  q?: string | undefined;
  kind?: MediaKind | undefined;
}

export interface MediaReadResult {
  media: AdminMediaFullRow;
  usage: MediaUsageRef[];
}

export interface UploadMediaInput {
  file: File;
  kind: MediaKind;
  altText?: string | undefined;
}

function list(
  params: MediaListParams,
): Promise<{ items: AdminMediaFullRow[]; meta: PaginationMeta }> {
  // `MediaListParams` has no index signature of its own (it is a plain,
  // fully-named shape, not a generic `TListParams` some factory threads
  // through) — `buildQueryString` only ever reads known-safe values off it
  // via `Object.entries`, so widening the type here is sound.
  return requestPaginated<AdminMediaFullRow>(
    `${BASE_PATH}${buildQueryString(params as unknown as Record<string, unknown>)}`,
  );
}

function read(id: number): Promise<MediaReadResult> {
  return request<MediaReadResult>(`${BASE_PATH}/${String(id)}`);
}

function upload(input: UploadMediaInput): Promise<AdminMediaFullRow> {
  const formData = new FormData();
  formData.set('file', input.file);
  formData.set('kind', input.kind);
  if (input.altText !== undefined && input.altText !== '') {
    formData.set('altText', input.altText);
  }
  return mutateFormData<AdminMediaFullRow>(BASE_PATH, formData);
}

export interface UpdateMediaPatch {
  altText?: string | null;
  kind?: MediaKind;
}

/** `PATCH /admin/media/:id` — doc03 §5's documented shape: alt text and/or kind, either independently revisable. */
function update(id: number, patch: UpdateMediaPatch): Promise<AdminMediaFullRow> {
  return mutate<AdminMediaFullRow>(`${BASE_PATH}/${String(id)}`, {
    method: 'PATCH',
    body: patch,
  });
}

/** `GET /admin/media/:id/usages` — the dedicated endpoint doc03 §5 documents; `read()`'s own `{media, usage}` shape already covers the admin UI's needs, so this is mostly for API-contract completeness. */
function usages(id: number): Promise<MediaUsageRef[]> {
  return request(`${BASE_PATH}/${String(id)}/usages`);
}

async function remove(id: number): Promise<void> {
  await mutate<{ deleted: boolean }>(`${BASE_PATH}/${String(id)}`, { method: 'DELETE' });
}

export const mediaClient = { list, read, upload, update, usages, remove };

export function useMediaList(
  params: MediaListParams,
): UseQueryResult<{ items: AdminMediaFullRow[]; meta: PaginationMeta }> {
  return useQuery({ queryKey: [RESOURCE_KEY, 'list', params], queryFn: () => list(params) });
}

export function useMediaItem(id: number | undefined): UseQueryResult<MediaReadResult> {
  return useQuery({
    queryKey: [RESOURCE_KEY, 'item', id],
    queryFn: () => read(id as number),
    enabled: id !== undefined,
  });
}

export function useUploadMedia(): UseMutationResult<AdminMediaFullRow, unknown, UploadMediaInput> {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: upload,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: [RESOURCE_KEY, 'list'] });
    },
  });
}

export function useUpdateMedia(): UseMutationResult<
  AdminMediaFullRow,
  unknown,
  { id: number } & UpdateMediaPatch
> {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...patch }) => update(id, patch),
    onSuccess: (_row, variables) => {
      void queryClient.invalidateQueries({ queryKey: [RESOURCE_KEY, 'list'] });
      void queryClient.invalidateQueries({ queryKey: [RESOURCE_KEY, 'item', variables.id] });
    },
  });
}

export function useRemoveMedia(): UseMutationResult<void, unknown, number> {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: remove,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: [RESOURCE_KEY, 'list'] });
    },
  });
}
