'use client';

import type { EducationRow } from '@portfolio/shared';
import type { DataTableColumn } from '@/features/admin/components/DataTable';
import { AdminResourceListPage } from '@/features/admin/components/AdminResourceListPage';
import { educationHooks } from '@/features/admin/education/client';
import { toDateInputValue } from '@/features/admin/lib/formValues';

const columns: Array<DataTableColumn<EducationRow>> = [
  { key: 'institution', label: 'Institution', render: (row) => row.institution },
  { key: 'degree', label: 'Degree', render: (row) => row.degree },
  { key: 'startDate', label: 'Started', render: (row) => toDateInputValue(row.startDate) },
  { key: 'visible', label: 'Visible', render: (row) => (row.visible ? 'Yes' : 'No') },
];

export default function EducationListPage(): React.JSX.Element {
  return (
    <AdminResourceListPage
      title="Education"
      hooks={educationHooks}
      columns={columns}
      searchPlaceholder="Search education…"
      newHref="/admin/education/new"
      newLabel="New entry"
      getEditHref={(row) => `/admin/education/${row.id}`}
      getEntityLabel={(row) => `${row.degree} — ${row.institution}`}
      resourceNameSingular="education entry"
      emptyMessage="No education entries yet."
      reorderable
      pageSize={50}
    />
  );
}
