'use client';

import type { ArticleAdminRow } from '@portfolio/shared';
import type { DataTableColumn } from '@/features/admin/components/DataTable';
import { AdminResourceListPage } from '@/features/admin/components/AdminResourceListPage';
import { StatusBadge, type ContentStatus } from '@/features/admin/components/StatusBadge';
import { articlesHooks } from '@/features/admin/articles/client';

const columns: Array<DataTableColumn<ArticleAdminRow>> = [
  { key: 'title', label: 'Title', render: (row) => row.title, sortKey: 'title' },
  {
    key: 'status',
    label: 'Status',
    render: (row) => <StatusBadge status={row.status as ContentStatus} />,
  },
  { key: 'category', label: 'Category', render: (row) => row.category?.name ?? '—' },
  {
    key: 'publishedAt',
    label: 'Published',
    render: (row) => (row.publishedAt ? new Date(row.publishedAt).toLocaleDateString() : '—'),
    sortKey: 'publishedAt',
  },
];

/** `/admin/articles` — the first of the three publish-workflow modules. Publish/unpublish/archive/duplicate live on the Edit page (`<PublishControls>`), not here — see `AdminResourceListPage`'s own doc. */
export default function ArticlesListPage(): React.JSX.Element {
  return (
    <AdminResourceListPage
      title="Articles"
      hooks={articlesHooks}
      columns={columns}
      searchPlaceholder="Search articles…"
      newHref="/admin/articles/new"
      newLabel="New article"
      getEditHref={(row) => `/admin/articles/${row.id}`}
      getEntityLabel={(row) => row.title}
      resourceNameSingular="article"
      emptyMessage="No articles yet."
      statusFilter
      defaultSort="updatedAt"
      defaultOrder="desc"
      pageSize={20}
    />
  );
}
