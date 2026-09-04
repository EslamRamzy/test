'use client';

import type { CertificationRow } from '@portfolio/shared';
import type { DataTableColumn } from '@/features/admin/components/DataTable';
import { AdminResourceListPage } from '@/features/admin/components/AdminResourceListPage';
import { certificationsHooks } from '@/features/admin/certifications/client';
import { toDateInputValue } from '@/features/admin/lib/formValues';

const columns: Array<DataTableColumn<CertificationRow>> = [
  { key: 'name', label: 'Name', render: (row) => row.name },
  { key: 'issuer', label: 'Issuer', render: (row) => row.issuer },
  { key: 'issueDate', label: 'Issued', render: (row) => toDateInputValue(row.issueDate) || '—' },
  { key: 'visible', label: 'Visible', render: (row) => (row.visible ? 'Yes' : 'No') },
];

export default function CertificationsListPage(): React.JSX.Element {
  return (
    <AdminResourceListPage
      title="Certifications"
      hooks={certificationsHooks}
      columns={columns}
      searchPlaceholder="Search certifications…"
      newHref="/admin/certifications/new"
      newLabel="New certification"
      getEditHref={(row) => `/admin/certifications/${row.id}`}
      getEntityLabel={(row) => row.name}
      resourceNameSingular="certification"
      emptyMessage="No certifications yet."
      reorderable
      pageSize={50}
    />
  );
}
