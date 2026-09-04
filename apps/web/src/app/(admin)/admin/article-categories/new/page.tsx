'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { articleCategoryCreateSchema, type ArticleCategoryCreateInput } from '@portfolio/shared';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { ArticleCategoryFields } from '@/features/admin/articleCategories/ArticleCategoryFields';
import { articleCategoriesHooks } from '@/features/admin/articleCategories/client';
import { EntityForm } from '@/features/admin/components/EntityForm';
import { emptyStringsToUndefined } from '@/features/admin/lib/formValues';
import { useResourceFormSubmit } from '@/features/admin/lib/useResourceFormSubmit';

export default function NewArticleCategoryPage(): React.JSX.Element {
  const router = useRouter();
  const methods = useForm<ArticleCategoryCreateInput>({
    resolver: zodResolver(emptyStringsToUndefined(articleCategoryCreateSchema)),
    defaultValues: { name: '', slug: '', description: '' },
  });
  const createMutation = articleCategoriesHooks.useCreate();
  const { onSubmit, busy } = useResourceFormSubmit({
    methods,
    mutateAsync: (payload: ArticleCategoryCreateInput) => createMutation.mutateAsync(payload),
    toPayload: (values) => values,
    successMessage: 'Article category created.',
    redirectTo: '/admin/article-categories',
  });

  return (
    <div className="admin-resource-page">
      <h1 className="h4 mb-4">New article category</h1>
      <EntityForm
        methods={methods}
        onSubmit={onSubmit}
        busy={busy}
        submitLabel="Create"
        onCancel={() => router.push('/admin/article-categories')}
      >
        <ArticleCategoryFields />
      </EntityForm>
    </div>
  );
}
