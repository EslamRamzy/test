'use client';

import type { TagRow } from '@portfolio/shared';
import type { DataTableColumn } from '@/features/admin/components/DataTable';
import { AdminResourceListPage } from '@/features/admin/components/AdminResourceListPage';
import { tagsHooks } from '@/features/admin/tags/client';

const columns: Array<DataTableColumn<TagRow>> = [
  { key: 'name', label: 'Name', render: (row) => row.name },
  { key: 'slug', label: 'Slug', render: (row) => row.slug },
];

/**
 * `/admin/tags` — `<TagInput>` (used by Articles and Security Research) is
 * the everyday create-or-select path for this resource (doc07 §2); this
 * page exists for the housekeeping a combobox can't do — renaming a tag or
 * deleting one that's accumulated typos. No `sortKey` on either column:
 * `tagRepository.ts`'s own admin `list()` always orders by name (no
 * per-resource `sort` allow-list the way `technologies` has one), so a
 * clickable sort header here would be an affordance with nothing behind it
 * (doc07 §6: "No fake data").
 */
export default function TagsListPage(): React.JSX.Element {
  return (
    <AdminResourceListPage
      title="Tags"
      hooks={tagsHooks}
      columns={columns}
      searchPlaceholder="Search tags…"
      newHref="/admin/tags/new"
      newLabel="New tag"
      getEditHref={(row) => `/admin/tags/${row.id}`}
      getEntityLabel={(row) => row.name}
      resourceNameSingular="tag"
      emptyMessage="No tags yet."
      pageSize={20}
    />
  );
}
