'use client';

import type { SkillCategoryRow } from '@portfolio/shared';
import Link from 'next/link';
import type { DataTableColumn } from '@/features/admin/components/DataTable';
import { AdminResourceListPage } from '@/features/admin/components/AdminResourceListPage';
import { skillCategoriesHooks } from '@/features/admin/skillCategories/client';

const columns: Array<DataTableColumn<SkillCategoryRow>> = [
  { key: 'name', label: 'Name', render: (row) => row.name },
  { key: 'slug', label: 'Slug', render: (row) => row.slug },
  {
    key: 'visible',
    label: 'Visible',
    render: (row) => (row.visible ? 'Yes' : 'No'),
  },
];

/** `/admin/skill-categories` — reached from `/admin/skills`'s "Manage categories" link (`skillCategoriesRouter`'s own comment: no dedicated Sidebar entry). */
export default function SkillCategoriesListPage(): React.JSX.Element {
  return (
    <AdminResourceListPage
      title="Skill categories"
      hooks={skillCategoriesHooks}
      columns={columns}
      searchPlaceholder="Search categories…"
      newHref="/admin/skill-categories/new"
      newLabel="New category"
      getEditHref={(row) => `/admin/skill-categories/${row.id}`}
      getEntityLabel={(row) => row.name}
      resourceNameSingular="skill category"
      emptyMessage="No skill categories yet."
      reorderable
      pageSize={50}
      titleExtra={
        <Link href="/admin/skills" className="btn btn-outline-secondary btn-sm ms-auto">
          <span className="bi bi-arrow-left" aria-hidden="true" /> Back to Skills
        </Link>
      }
    />
  );
}
