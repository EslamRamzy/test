'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useParams, useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { EntityForm } from '@/features/admin/components/EntityForm';
import { PublishControls } from '@/features/admin/components/PublishControls';
import type { ContentStatus } from '@/features/admin/components/StatusBadge';
import { StatusBadge } from '@/features/admin/components/StatusBadge';
import { useToast } from '@/features/admin/components/ToastProvider';
import { applyApiErrors } from '@/features/admin/lib/applyApiErrors';
import { toDatetimeLocalInputValue } from '@/features/admin/lib/formValues';
import { useEditResourceForm } from '@/features/admin/lib/useEditResourceForm';
import { useResourceFormSubmit } from '@/features/admin/lib/useResourceFormSubmit';
import {
  securityResearchHooks,
  securityResearchPublishHooks,
} from '@/features/admin/securityResearch/client';
import { SecurityResearchFields } from '@/features/admin/securityResearch/SecurityResearchFields';
import {
  securityResearchFormSchema,
  toSecurityResearchWirePayload,
  type SecurityResearchFormValues,
} from '@/features/admin/securityResearch/formSchema';
import { ApiError } from '@/lib/api/ApiError';

export default function EditSecurityResearchPage(): React.JSX.Element {
  const params = useParams<{ id: string }>();
  const id = Number(params.id);
  const router = useRouter();
  const { show } = useToast();

  const itemQuery = securityResearchHooks.useItem(id);
  const updateMutation = securityResearchHooks.useUpdate();
  const publishMutation = securityResearchPublishHooks.usePublish();
  const unpublishMutation = securityResearchPublishHooks.useUnpublish();
  const archiveMutation = securityResearchPublishHooks.useArchive();
  const duplicateMutation = securityResearchPublishHooks.useDuplicate();

  const methods = useForm<SecurityResearchFormValues>({
    resolver: zodResolver(securityResearchFormSchema),
    defaultValues: {
      title: '',
      slug: '',
      description: '',
      content: '',
      category: 'RESEARCH',
      coverMediaId: '',
      publishedAt: '',
      tagIds: [],
      references: [],
    },
  });

  useEditResourceForm({
    itemQuery,
    methods,
    toFormValues: (row) => ({
      title: row.title,
      slug: row.slug,
      description: row.description ?? '',
      content: row.content,
      category: row.category as SecurityResearchFormValues['category'],
      coverMediaId: row.coverMediaId ? String(row.coverMediaId) : '',
      publishedAt: toDatetimeLocalInputValue(row.publishedAt),
      tagIds: row.tags.map((entry) => entry.tag),
      references: row.references.map((reference) => ({
        label: reference.label,
        url: reference.url,
      })),
    }),
  });

  const { onSubmit, busy } = useResourceFormSubmit({
    methods,
    mutateAsync: (payload: SecurityResearchFormValues) =>
      updateMutation.mutateAsync({ id, data: toSecurityResearchWirePayload(payload) }),
    toPayload: (values) => values,
    successMessage: 'Research entry updated.',
    redirectTo: '/admin/security-research',
  });

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
        show({ message: 'Entry duplicated.', variant: 'success' });
        router.push(`/admin/security-research/${row.id}`);
      },
      onError: () => show({ message: 'Couldn’t duplicate this entry.', variant: 'danger' }),
    });
  }

  if (itemQuery.isPending) return <p className="text-body-secondary">Loading…</p>;
  if (itemQuery.isError) return <div className="alert alert-danger">Couldn’t load this entry.</div>;

  const publishBusy =
    publishMutation.isPending ||
    unpublishMutation.isPending ||
    archiveMutation.isPending ||
    duplicateMutation.isPending;

  return (
    <div className="admin-resource-page">
      <div className="admin-resource-page__header">
        <h1 className="h4 mb-0">Edit security research entry</h1>
        <StatusBadge status={itemQuery.data.status as ContentStatus} />
        <PublishControls
          status={itemQuery.data.status as ContentStatus}
          onPublish={() => handlePublishAction(publishMutation.mutate, 'Entry published.')}
          onUnpublish={() => handlePublishAction(unpublishMutation.mutate, 'Entry unpublished.')}
          onArchive={() => handlePublishAction(archiveMutation.mutate, 'Entry archived.')}
          onDuplicate={handleDuplicate}
          busy={publishBusy}
        />
      </div>
      <EntityForm
        methods={methods}
        onSubmit={onSubmit}
        busy={busy}
        onCancel={() => router.push('/admin/security-research')}
      >
        <SecurityResearchFields />
      </EntityForm>
    </div>
  );
}
