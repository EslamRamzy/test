'use client';

import type { TechnologyRow } from '@portfolio/shared';
import type { DataTableColumn } from '@/features/admin/components/DataTable';
import { AdminResourceListPage } from '@/features/admin/components/AdminResourceListPage';
import { technologiesHooks } from '@/features/admin/technologies/client';

const columns: Array<DataTableColumn<TechnologyRow>> = [
  { key: 'name', label: 'Name', render: (row) => row.name },
  { key: 'slug', label: 'Slug', render: (row) => row.slug },
  { key: 'category', label: 'Category', render: (row) => row.category ?? '—' },
  {
    key: 'websiteUrl',
    label: 'Website',
    render: (row) =>
      row.websiteUrl ? (
        <a href={row.websiteUrl} target="_blank" rel="noreferrer">
          Visit <span className="bi bi-box-arrow-up-right" aria-hidden="true" />
        </a>
      ) : (
        '—'
      ),
  },
];

/** `/admin/technologies` (doc07 §3: "Icon picker, category, website, usage count"). No usage-count column: no admin endpoint computes "used by N projects" today — a documented scope trim, not an oversight; the delete confirm still protects against an in-use row via the server's own FK constraint. */
export default function TechnologiesListPage(): React.JSX.Element {
  return (
    <AdminResourceListPage
      title="Technologies"
      hooks={technologiesHooks}
      columns={columns}
      searchPlaceholder="Search technologies…"
      newHref="/admin/technologies/new"
      newLabel="New technology"
      getEditHref={(row) => `/admin/technologies/${row.id}`}
      getEntityLabel={(row) => row.name}
      resourceNameSingular="technology"
      emptyMessage="No technologies yet."
      reorderable
      pageSize={50}
    />
  );
}
