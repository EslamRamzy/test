import type { ProfileAdminRow } from '@portfolio/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { mutate, request } from '@/lib/api/adminClient';
import type { ProfileWirePayload } from './formSchema';

const QUERY_KEY = ['admin-profile'];
const BASE_PATH = '/api/v1/admin/profile';

/** Singleton — no `:id` (`profile.routes.ts`'s own comment). One query key, no list. */
export function useProfile() {
  return useQuery({
    queryKey: QUERY_KEY,
    queryFn: () => request<ProfileAdminRow>(BASE_PATH),
  });
}

export function useUpdateProfile() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: ProfileWirePayload) =>
      mutate<ProfileAdminRow>(BASE_PATH, { method: 'PATCH', body: data }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: QUERY_KEY });
    },
  });
}
