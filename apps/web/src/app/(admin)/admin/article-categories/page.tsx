'use client';

import type { ArticleCategoryRow } from '@portfolio/shared';
import type { DataTableColumn } from '@/features/admin/components/DataTable';
import { AdminResourceListPage } from '@/features/admin/components/AdminResourceListPage';
import { articleCategoriesHooks } from '@/features/admin/articleCategories/client';

const columns: Array<DataTableColumn<ArticleCategoryRow>> = [
  { key: 'name', label: 'Name', render: (row) => row.name },
  { key: 'slug', label: 'Slug', render: (row) => row.slug },
];

/** `/admin/article-categories` — reached from the Articles module's category field (task: Articles module), same relationship as `/admin/skill-categories` has with `/admin/skills`. */
export default function ArticleCategoriesListPage(): React.JSX.Element {
  return (
    <AdminResourceListPage
      title="Article categories"
      hooks={articleCategoriesHooks}
      columns={columns}
      searchPlaceholder="Search categories…"
      newHref="/admin/article-categories/new"
      newLabel="New category"
      getEditHref={(row) => `/admin/article-categories/${row.id}`}
      getEntityLabel={(row) => row.name}
      resourceNameSingular="article category"
      emptyMessage="No article categories yet."
      reorderable
      pageSize={50}
    />
  );
}
