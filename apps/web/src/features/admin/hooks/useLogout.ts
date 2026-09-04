import { useMutation, type UseMutationResult } from '@tanstack/react-query';
import * as adminApi from '@/lib/api/adminClient';

/**
 * A full `window.location` navigation on success, not `router.push` — same
 * reasoning as `LoginForm`'s own comment: logout's `clearAuthCookies`
 * happens server-side via a plain `fetch`, and only a full navigation
 * guarantees `proxy.ts` (which reads the now-cleared access-token cookie)
 * sees the change on the very next request.
 *
 * Deliberately NOT `onSettled` — only `onSuccess` navigates. A genuine
 * network failure (the request never reached the server at all) leaves the
 * browser's cookies exactly as they were; redirecting anyway would just
 * bounce the visitor to a login page whose middleware then lets them back
 * into `/admin` on the very next click, with the caller's error toast
 * already wiped out by that navigation before anyone could read it. Staying
 * on the page on error is what makes the toast (and a retry) possible.
 */
export function useLogout(): UseMutationResult<void, unknown, void> {
  return useMutation({
    mutationFn: adminApi.logout,
    onSuccess: () => {
      window.location.href = '/admin/login';
    },
  });
}
