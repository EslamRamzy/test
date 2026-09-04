'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useParams, useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { ArticleFields } from '@/features/admin/articles/ArticleFields';
import { articlePublishHooks, articlesHooks } from '@/features/admin/articles/client';
import {
  articleFormSchema,
  toArticleWirePayload,
  type ArticleFormValues,
} from '@/features/admin/articles/formSchema';
import { EntityForm } from '@/features/admin/components/EntityForm';
import { PublishControls } from '@/features/admin/components/PublishControls';
import type { ContentStatus } from '@/features/admin/components/StatusBadge';
import { StatusBadge } from '@/features/admin/components/StatusBadge';
import { useToast } from '@/features/admin/components/ToastProvider';
import { toDatetimeLocalInputValue } from '@/features/admin/lib/formValues';
import { useEditResourceForm } from '@/features/admin/lib/useEditResourceForm';
import { useResourceFormSubmit } from '@/features/admin/lib/useResourceFormSubmit';
import { applyApiErrors } from '@/features/admin/lib/applyApiErrors';
import { ApiError } from '@/lib/api/ApiError';

export default function EditArticlePage(): React.JSX.Element {
  const params = useParams<{ id: string }>();
  const id = Number(params.id);
  const router = useRouter();
  const { show } = useToast();

  const itemQuery = articlesHooks.useItem(id);
  const updateMutation = articlesHooks.useUpdate();
  const publishMutation = articlePublishHooks.usePublish();
  const unpublishMutation = articlePublishHooks.useUnpublish();
  const archiveMutation = articlePublishHooks.useArchive();
  const duplicateMutation = articlePublishHooks.useDuplicate();

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

  useEditResourceForm({
    itemQuery,
    methods,
    toFormValues: (row) => ({
      title: row.title,
      slug: row.slug,
      excerpt: row.excerpt ?? '',
      content: row.content,
      coverMediaId: row.coverMediaId ? String(row.coverMediaId) : '',
      categoryId: row.categoryId ? String(row.categoryId) : '',
      publishedAt: toDatetimeLocalInputValue(row.publishedAt),
      tagIds: row.tags.map((entry) => entry.tag),
    }),
  });

  const { onSubmit, busy } = useResourceFormSubmit({
    methods,
    mutateAsync: (payload: ArticleFormValues) =>
      updateMutation.mutateAsync({ id, data: toArticleWirePayload(payload) }),
    toPayload: (values) => values,
    successMessage: 'Article updated.',
    redirectTo: '/admin/articles',
  });

  /** Shared by publish/unpublish/archive: a `VALIDATION_ERROR` (the readiness check) maps onto the SAME form fields the Edit form already shows, so an admin sees exactly what's missing without leaving the page. */
  function handlePublishAction(
    mutate: (
      id: number,
      opts: { onSuccess: () => void; onError: (error: unknown) => void },
    ) => void,
    successMessage: string,
  ): void {
    mutate(id, {
      onSuccess: () => show({ message: successMessage, variant: 'success' }),
      onError: (error) => {
        const appliedToFields = applyApiErrors(methods, error);
        show({
          message: appliedToFields
            ? 'Fix the highlighted fields before publishing.'
            : error instanceof ApiError
              ? error.message
              : 'Something went wrong. Please try again.',
          variant: appliedToFields ? 'warning' : 'danger',
          autohideMs: null,
        });
      },
    });
  }

  function handleDuplicate(): void {
    duplicateMutation.mutate(id, {
      onSuccess: (row) => {
        show({ message: 'Article duplicated.', variant: 'success' });
        router.push(`/admin/articles/${row.id}`);
      },
      onError: () => show({ message: 'Couldn’t duplicate this article.', variant: 'danger' }),
    });
  }

  if (itemQuery.isPending) return <p className="text-body-secondary">Loading…</p>;
  if (itemQuery.isError)
    return <div className="alert alert-danger">Couldn’t load this article.</div>;

  const publishBusy =
    publishMutation.isPending ||
    unpublishMutation.isPending ||
    archiveMutation.isPending ||
    duplicateMutation.isPending;

  return (
    <div className="admin-resource-page">
      <div className="admin-resource-page__header">
        <h1 className="h4 mb-0">Edit article</h1>
        <StatusBadge status={itemQuery.data.status as ContentStatus} />
        <PublishControls
          status={itemQuery.data.status as ContentStatus}
          onPublish={() => handlePublishAction(publishMutation.mutate, 'Article published.')}
          onUnpublish={() => handlePublishAction(unpublishMutation.mutate, 'Article unpublished.')}
          onArchive={() => handlePublishAction(archiveMutation.mutate, 'Article archived.')}
          onDuplicate={handleDuplicate}
          busy={publishBusy}
        />
      </div>
      <EntityForm
        methods={methods}
        onSubmit={onSubmit}
        busy={busy}
        onCancel={() => router.push('/admin/articles')}
      >
        <ArticleFields />
      </EntityForm>
    </div>
  );
}
