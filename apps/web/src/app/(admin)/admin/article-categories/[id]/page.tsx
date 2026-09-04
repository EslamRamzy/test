'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { articleCategoryCreateSchema, type ArticleCategoryCreateInput } from '@portfolio/shared';
import { useParams, useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { ArticleCategoryFields } from '@/features/admin/articleCategories/ArticleCategoryFields';
import { articleCategoriesHooks } from '@/features/admin/articleCategories/client';
import { EntityForm } from '@/features/admin/components/EntityForm';
import { emptyStringsToUndefined } from '@/features/admin/lib/formValues';
import { useEditResourceForm } from '@/features/admin/lib/useEditResourceForm';
import { useResourceFormSubmit } from '@/features/admin/lib/useResourceFormSubmit';

export default function EditArticleCategoryPage(): React.JSX.Element {
  const params = useParams<{ id: string }>();
  const id = Number(params.id);
  const router = useRouter();

  const itemQuery = articleCategoriesHooks.useItem(id);
  const updateMutation = articleCategoriesHooks.useUpdate();
  const methods = useForm<ArticleCategoryCreateInput>({
    resolver: zodResolver(emptyStringsToUndefined(articleCategoryCreateSchema)),
    defaultValues: { name: '', slug: '', description: '' },
  });

  useEditResourceForm({
    itemQuery,
    methods,
    toFormValues: (row) => ({
      name: row.name,
      slug: row.slug,
      description: row.description ?? '',
    }),
  });

  const { onSubmit, busy } = useResourceFormSubmit({
    methods,
    mutateAsync: (payload: ArticleCategoryCreateInput) =>
      updateMutation.mutateAsync({ id, data: payload }),
    toPayload: (values) => values,
    successMessage: 'Article category updated.',
    redirectTo: '/admin/article-categories',
  });

  if (itemQuery.isPending) return <p className="text-body-secondary">Loading…</p>;
  if (itemQuery.isError) {
    return <div className="alert alert-danger">Couldn’t load this category.</div>;
  }

  return (
    <div className="admin-resource-page">
      <h1 className="h4 mb-4">Edit article category</h1>
      <EntityForm
        methods={methods}
        onSubmit={onSubmit}
        busy={busy}
        onCancel={() => router.push('/admin/article-categories')}
      >
        <ArticleCategoryFields />
      </EntityForm>
    </div>
  );
}
