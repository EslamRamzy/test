'use client';

import type { TimelineEntryRow } from '@portfolio/shared';
import type { DataTableColumn } from '@/features/admin/components/DataTable';
import { AdminResourceListPage } from '@/features/admin/components/AdminResourceListPage';
import { timelineHooks } from '@/features/admin/timeline/client';
import { toDateInputValue } from '@/features/admin/lib/formValues';

const columns: Array<DataTableColumn<TimelineEntryRow>> = [
  { key: 'title', label: 'Title', render: (row) => row.title },
  {
    key: 'entryDate',
    label: 'Date',
    render: (row) => row.yearLabel ?? toDateInputValue(row.entryDate),
  },
  { key: 'category', label: 'Category', render: (row) => row.category ?? '—' },
  { key: 'visible', label: 'Visible', render: (row) => (row.visible ? 'Yes' : 'No') },
];

export default function TimelineListPage(): React.JSX.Element {
  return (
    <AdminResourceListPage
      title="Timeline"
      hooks={timelineHooks}
      columns={columns}
      searchPlaceholder="Search timeline…"
      newHref="/admin/timeline/new"
      newLabel="New entry"
      getEditHref={(row) => `/admin/timeline/${row.id}`}
      getEntityLabel={(row) => row.title}
      resourceNameSingular="timeline entry"
      emptyMessage="No timeline entries yet."
      reorderable
      pageSize={50}
    />
  );
}
