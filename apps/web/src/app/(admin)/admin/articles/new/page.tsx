'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { ArticleFields } from '@/features/admin/articles/ArticleFields';
import { articlesHooks } from '@/features/admin/articles/client';
import {
  articleFormSchema,
  toArticleWirePayload,
  type ArticleFormValues,
} from '@/features/admin/articles/formSchema';
import { EntityForm } from '@/features/admin/components/EntityForm';
import { useResourceFormSubmit } from '@/features/admin/lib/useResourceFormSubmit';

export default function NewArticlePage(): React.JSX.Element {
  const router = useRouter();
  const methods = useForm<ArticleFormValues>({
    resolver: zodResolver(articleFormSchema),
    defaultValues: {
      title: '',
      slug: '',
      excerpt: '',
      content: '',
      coverMediaId: '',
      categoryId: '',
      publishedAt: '',
      tagIds: [],
    },
  });
  const createMutation = articlesHooks.useCreate();
  const { onSubmit, busy } = useResourceFormSubmit({
    methods,
    mutateAsync: (payload: ArticleFormValues) =>
      createMutation.mutateAsync(toArticleWirePayload(payload)),
    toPayload: (values) => values,
    successMessage: 'Article created.',
    redirectTo: '/admin/articles',
  });

  return (
    <div className="admin-resource-page">
      <h1 className="h4 mb-4">New article</h1>
      <EntityForm
        methods={methods}
        onSubmit={onSubmit}
        busy={busy}
        submitLabel="Create"
        onCancel={() => router.push('/admin/articles')}
      >
        <ArticleFields />
      </EntityForm>
    </div>
  );
}
