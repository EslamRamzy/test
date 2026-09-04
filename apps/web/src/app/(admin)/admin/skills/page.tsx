'use client';

import type { SkillRow } from '@portfolio/shared';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import type { DataTableColumn } from '@/features/admin/components/DataTable';
import { AdminResourceListPage } from '@/features/admin/components/AdminResourceListPage';
import { skillCategoriesHooks } from '@/features/admin/skillCategories/client';
import { skillsHooks } from '@/features/admin/skills/client';

const columns: Array<DataTableColumn<SkillRow>> = [
  { key: 'name', label: 'Name', render: (row) => row.name },
  { key: 'level', label: 'Level', render: (row) => row.level },
  { key: 'visible', label: 'Visible', render: (row) => (row.visible ? 'Yes' : 'No') },
];

/**
 * `/admin/skills` (doc07 §3: "Grouped by category, drag-reorder within a
 * category"). One category viewed at a time via the selector below, rather
 * than every category's skills in one flat list — `displayOrder` is
 * meaningful only WITHIN a category (`skillRepository.ts`'s own
 * `orderBy: [{categoryId}, {displayOrder}]`), and `<AdminResourceListPage>`'s
 * up/down reorder recomputes `displayOrder` from the CURRENT page's row
 * order, which is only correct when that page holds one category's rows,
 * not a mix. `key={categoryId}` below remounts the list (fresh page/search/
 * sort state) on every category switch, rather than teaching
 * `<AdminResourceListPage>` to reset its own state for an externally
 * changed filter.
 */
export default function SkillsListPage(): React.JSX.Element {
  const categoriesQuery = skillCategoriesHooks.useList({ page: 1, pageSize: 50 });
  const categories = categoriesQuery.data?.items ?? [];
  const [categoryId, setCategoryId] = useState<number | undefined>(undefined);

  useEffect(() => {
    if (categoryId === undefined && categories.length > 0) {
      setCategoryId(categories[0]?.id);
    }
  }, [categories, categoryId]);

  return (
    <div className="admin-resource-page">
      <div className="admin-resource-page__header">
        <h1 className="h4 mb-0">Skills</h1>
        <Link href="/admin/skill-categories" className="btn btn-outline-secondary btn-sm ms-auto">
          Manage categories
        </Link>
      </div>

      {categories.length === 0 ? (
        <p className="text-body-secondary">
          No skill categories yet. <Link href="/admin/skill-categories/new">Create one first</Link>{' '}
          to add skills.
        </p>
      ) : (
        <>
          <div className="mb-3 d-flex align-items-center gap-2">
            <label htmlFor="skills-category-filter" className="form-label mb-0">
              Category
            </label>
            <select
              id="skills-category-filter"
              className="form-select w-auto"
              value={categoryId ?? ''}
              onChange={(event) => setCategoryId(Number(event.target.value))}
            >
              {categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </select>
          </div>

          {categoryId !== undefined && (
            <AdminResourceListPage
              key={categoryId}
              title=""
              hooks={skillsHooks}
              columns={columns}
              searchPlaceholder="Search skills…"
              newHref={`/admin/skills/new?categoryId=${categoryId}`}
              newLabel="New skill"
              getEditHref={(row) => `/admin/skills/${row.id}`}
              getEntityLabel={(row) => row.name}
              resourceNameSingular="skill"
              emptyMessage="No skills in this category yet."
              extraParams={{ categoryId }}
              reorderable
              pageSize={50}
            />
          )}
        </>
      )}
    </div>
  );
}
