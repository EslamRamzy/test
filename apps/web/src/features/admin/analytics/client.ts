import type { AnalyticsOverviewDto } from '@portfolio/shared';
import { useQuery } from '@tanstack/react-query';
import { request } from '@/lib/api/adminClient';

export interface AnalyticsParams {
  from?: string | undefined;
  to?: string | undefined;
  groupBy: 'day' | 'week' | 'month';
}

function buildQueryString(params: AnalyticsParams): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === '') continue;
    search.set(key, String(value));
  }
  const qs = search.toString();
  return qs ? `?${qs}` : '';
}

/** `GET /admin/analytics` — read-only (doc07 §3), same reasoning as `auditLogs/client.ts`: no mutations to export. */
export function useAnalyticsOverview(params: AnalyticsParams) {
  return useQuery({
    queryKey: ['admin-analytics', params],
    queryFn: () =>
      request<AnalyticsOverviewDto>(`/api/v1/admin/analytics${buildQueryString(params)}`),
  });
}
