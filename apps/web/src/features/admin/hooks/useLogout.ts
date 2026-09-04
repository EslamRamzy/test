import { useMutation, type UseMutationResult } from '@tanstack/react-query';
import * as adminApi from '@/lib/api/adminClient';

/**
 * A full `window.location` navigation on success/failure alike, not
 * `router.push` — same reasoning as `LoginForm`'s own comment: logout's
 * `clearAuthCookies` happens server-side via a plain `fetch`, and only a
 * full navigation guarantees `proxy.ts` (which reads the now-cleared
 * access-token cookie) sees the change on the very next request. Logout
 * "fails" from this hook's point of view only on a network error —
 * `authController.logout` always clears cookies and succeeds from the
 * client's perspective (its own comment: "an absent or already-invalid
 * refresh token has nothing left to revoke") — so both branches land on
 * the same place.
 */
export function useLogout(): UseMutationResult<void, unknown, void> {
  return useMutation({
    mutationFn: adminApi.logout,
    onSettled: () => {
      window.location.href = '/admin/login';
    },
  });
}
