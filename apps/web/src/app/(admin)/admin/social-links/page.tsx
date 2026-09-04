'use client';

import type { SocialLinkRow } from '@portfolio/shared';
import type { DataTableColumn } from '@/features/admin/components/DataTable';
import { AdminResourceListPage } from '@/features/admin/components/AdminResourceListPage';
import { socialLinksHooks } from '@/features/admin/socialLinks/client';

const columns: Array<DataTableColumn<SocialLinkRow>> = [
  { key: 'platform', label: 'Platform', render: (row) => row.label || row.platform },
  {
    key: 'url',
    label: 'URL',
    render: (row) => (
      <a href={row.url} target="_blank" rel="noreferrer">
        {row.url}
      </a>
    ),
  },
  { key: 'enabled', label: 'Enabled', render: (row) => (row.enabled ? 'Yes' : 'No') },
];

export default function SocialLinksListPage(): React.JSX.Element {
  return (
    <AdminResourceListPage
      title="Social links"
      hooks={socialLinksHooks}
      columns={columns}
      searchPlaceholder="Search social links…"
      newHref="/admin/social-links/new"
      newLabel="New link"
      getEditHref={(row) => `/admin/social-links/${row.id}`}
      getEntityLabel={(row) => row.label || row.platform}
      resourceNameSingular="social link"
      emptyMessage="No social links yet."
      reorderable
      pageSize={50}
    />
  );
}
