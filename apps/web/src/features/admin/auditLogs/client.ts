import type { AuditLogRow } from '@portfolio/shared';
import { useQuery } from '@tanstack/react-query';
import { requestPaginated } from '@/lib/api/adminClient';

export interface AuditLogListParams {
  page: number;
  pageSize: number;
  action?: string | undefined;
  entityType?: string | undefined;
  from?: string | undefined;
  to?: string | undefined;
}

function buildQueryString(params: AuditLogListParams): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === '') continue;
    search.set(key, String(value));
  }
  const qs = search.toString();
  return qs ? `?${qs}` : '';
}

/** `GET /admin/audit-logs` — read-only (doc07 §3), so this file only ever exports a list query, no mutations. */
export function useAuditLogs(params: AuditLogListParams) {
  return useQuery({
    queryKey: ['admin-audit-logs', params],
    queryFn: () =>
      requestPaginated<AuditLogRow>(`/api/v1/admin/audit-logs${buildQueryString(params)}`),
  });
}
