import type { AuthUser } from '@portfolio/shared';
import { useQuery, type UseQueryResult } from '@tanstack/react-query';
import * as adminApi from '@/lib/api/adminClient';

/** `GET /auth/me` — backs the Topbar's user menu (name, role) everywhere under `(protected)`. */
export function useCurrentUser(): UseQueryResult<AuthUser> {
  return useQuery({
    queryKey: ['auth', 'me'],
    queryFn: adminApi.getCurrentUser,
  });
}
