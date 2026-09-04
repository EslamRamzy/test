'use client';

import type { SecurityResearchAdminRow } from '@portfolio/shared';
import type { DataTableColumn } from '@/features/admin/components/DataTable';
import { AdminResourceListPage } from '@/features/admin/components/AdminResourceListPage';
import { StatusBadge, type ContentStatus } from '@/features/admin/components/StatusBadge';
import { securityResearchHooks } from '@/features/admin/securityResearch/client';

const columns: Array<DataTableColumn<SecurityResearchAdminRow>> = [
  { key: 'title', label: 'Title', render: (row) => row.title, sortKey: 'title' },
  {
    key: 'status',
    label: 'Status',
    render: (row) => <StatusBadge status={row.status as ContentStatus} />,
  },
  { key: 'category', label: 'Category', render: (row) => row.category },
  {
    key: 'publishedAt',
    label: 'Published',
    render: (row) => (row.publishedAt ? new Date(row.publishedAt).toLocaleDateString() : '—'),
    sortKey: 'publishedAt',
  },
];

export default function SecurityResearchListPage(): React.JSX.Element {
  return (
    <AdminResourceListPage
      title="Security Research"
      hooks={securityResearchHooks}
      columns={columns}
      searchPlaceholder="Search research…"
      newHref="/admin/security-research/new"
      newLabel="New entry"
      getEditHref={(row) => `/admin/security-research/${row.id}`}
      getEntityLabel={(row) => row.title}
      resourceNameSingular="research entry"
      emptyMessage="No security research yet."
      statusFilter
      defaultSort="updatedAt"
      defaultOrder="desc"
      pageSize={20}
    />
  );
}
