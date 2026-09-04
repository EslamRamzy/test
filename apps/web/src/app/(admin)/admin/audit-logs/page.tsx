'use client';

import type { AuditLogRow } from '@portfolio/shared';
import { useState } from 'react';
import { DataTable, type DataTableColumn } from '@/features/admin/components/DataTable';
import { useAuditLogs } from '@/features/admin/auditLogs/client';
import { formatAuditTimestamp, humanizeAuditAction } from '@/features/admin/lib/formatAuditEntry';

const PAGE_SIZE = 25;

const columns: Array<DataTableColumn<AuditLogRow>> = [
  { key: 'createdAt', label: 'When', render: (row) => formatAuditTimestamp(row.createdAt) },
  { key: 'actor', label: 'Actor', render: (row) => row.user?.name ?? 'System' },
  { key: 'action', label: 'Action', render: (row) => humanizeAuditAction(row.action) },
  {
    key: 'entity',
    label: 'Entity',
    render: (row) =>
      row.entityType ? `${row.entityType}${row.entityId ? ` #${row.entityId}` : ''}` : '—',
  },
];

/** `/admin/audit-logs` (doc07 §3: "Read-only table with filters (action, entity, date range). No create/edit/delete anywhere in the UI") — no `<ResourceToolbar>`/`<AdminResourceListPage>` reuse here: this resource's filters (action/entityType/date range) don't match those components' `q`/`status` shape, and there is nothing to create, edit, or delete. */
export default function AuditLogsPage(): React.JSX.Element {
  const [page, setPage] = useState(1);
  const [action, setAction] = useState('');
  const [entityType, setEntityType] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');

  const logsQuery = useAuditLogs({
    page,
    pageSize: PAGE_SIZE,
    action: action || undefined,
    entityType: entityType || undefined,
    from: from || undefined,
    to: to || undefined,
  });

  function resetPage(): void {
    setPage(1);
  }

  return (
    <div className="admin-resource-page">
      <h1 className="h4 mb-4">Audit logs</h1>

      <div className="row g-2 mb-3">
        <div className="col-sm-3">
          <input
            className="form-control"
            placeholder="Action, e.g. ARTICLE_PUBLISH"
            value={action}
            onChange={(event) => {
              setAction(event.target.value);
              resetPage();
            }}
            aria-label="Filter by action"
          />
        </div>
        <div className="col-sm-3">
          <input
            className="form-control"
            placeholder="Entity type, e.g. ARTICLE"
            value={entityType}
            onChange={(event) => {
              setEntityType(event.target.value);
              resetPage();
            }}
            aria-label="Filter by entity type"
          />
        </div>
        <div className="col-sm-3">
          <input
            type="date"
            className="form-control"
            value={from}
            onChange={(event) => {
              setFrom(event.target.value);
              resetPage();
            }}
            aria-label="From date"
          />
        </div>
        <div className="col-sm-3">
          <input
            type="date"
            className="form-control"
            value={to}
            onChange={(event) => {
              setTo(event.target.value);
              resetPage();
            }}
            aria-label="To date"
          />
        </div>
      </div>

      <DataTable
        columns={columns}
        rows={logsQuery.data?.items ?? []}
        getRowKey={(row) => row.id}
        loading={logsQuery.isPending}
        emptyMessage="No audit entries match these filters."
        page={page}
        pageSize={PAGE_SIZE}
        total={logsQuery.data?.meta.total ?? 0}
        onPageChange={setPage}
      />
    </div>
  );
}
