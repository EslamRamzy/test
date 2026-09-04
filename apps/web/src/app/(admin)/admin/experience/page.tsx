'use client';

import type { ExperienceRow } from '@portfolio/shared';
import type { DataTableColumn } from '@/features/admin/components/DataTable';
import { AdminResourceListPage } from '@/features/admin/components/AdminResourceListPage';
import { experienceHooks } from '@/features/admin/experience/client';
import { toDateInputValue } from '@/features/admin/lib/formValues';

const columns: Array<DataTableColumn<ExperienceRow>> = [
  { key: 'position', label: 'Position', render: (row) => row.position },
  { key: 'organization', label: 'Organization', render: (row) => row.organization },
  {
    key: 'dates',
    label: 'Dates',
    render: (row) =>
      `${toDateInputValue(row.startDate)} – ${row.isCurrent ? 'present' : toDateInputValue(row.endDate) || '—'}`,
  },
  { key: 'visible', label: 'Visible', render: (row) => (row.visible ? 'Yes' : 'No') },
];

export default function ExperienceListPage(): React.JSX.Element {
  return (
    <AdminResourceListPage
      title="Experience"
      hooks={experienceHooks}
      columns={columns}
      searchPlaceholder="Search experience…"
      newHref="/admin/experience/new"
      newLabel="New experience"
      getEditHref={(row) => `/admin/experience/${row.id}`}
      getEntityLabel={(row) => `${row.position} — ${row.organization}`}
      resourceNameSingular="experience entry"
      emptyMessage="No experience entries yet."
      reorderable
      pageSize={50}
    />
  );
}
