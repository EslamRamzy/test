import type { AuditLogQuery } from '@portfolio/shared';
import { buildPaginationMeta } from '../lib/httpResponse.js';
import * as auditLogRepository from '../repositories/auditLogRepository.js';

/** `GET /admin/audit-logs` (doc03 §5) — read-only, no create/update/delete anywhere (doc07 §3: "No create/edit/delete anywhere in the UI"). */
export async function listAuditLogs(query: AuditLogQuery) {
  const { items, total } = await auditLogRepository.list({
    action: query.action,
    entityType: query.entityType,
    userId: query.userId,
    from: query.from,
    to: query.to,
    page: query.page,
    pageSize: query.pageSize,
  });
  return { items, meta: buildPaginationMeta(query.page, query.pageSize, total) };
}
