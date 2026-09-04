import type { AdminOverviewDto } from '@portfolio/shared';
import { useQuery, type UseQueryResult } from '@tanstack/react-query';
import * as adminApi from '@/lib/api/adminClient';

/**
 * `GET /admin/overview` (docs/architecture/07 §3, §5) — the single source
 * for both the dashboard page's own counters (task: overview page) and the
 * Sidebar's Messages unread badge below. One query key, one cache entry:
 * a mutation that changes any of these counts (e.g. marking a message
 * read, in a later phase) invalidates `['admin', 'overview']` once and both
 * consumers pick up the new value, rather than each polling its own copy.
 */
export function useOverview(): UseQueryResult<AdminOverviewDto> {
  return useQuery({
    queryKey: ['admin', 'overview'],
    queryFn: adminApi.getOverview,
  });
}
