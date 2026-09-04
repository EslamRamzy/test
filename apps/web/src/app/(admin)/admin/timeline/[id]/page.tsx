'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useParams, useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { EntityForm } from '@/features/admin/components/EntityForm';
import { toDateInputValue } from '@/features/admin/lib/formValues';
import { useEditResourceForm } from '@/features/admin/lib/useEditResourceForm';
import { useResourceFormSubmit } from '@/features/admin/lib/useResourceFormSubmit';
import { TimelineFields } from '@/features/admin/timeline/TimelineFields';
import { timelineHooks } from '@/features/admin/timeline/client';
import {
  timelineEntryFormSchema,
  type TimelineEntryFormValues,
} from '@/features/admin/timeline/formSchema';

export default function EditTimelineEntryPage(): React.JSX.Element {
  const params = useParams<{ id: string }>();
  const id = Number(params.id);
  const router = useRouter();

  const itemQuery = timelineHooks.useItem(id);
  const updateMutation = timelineHooks.useUpdate();
  const methods = useForm<TimelineEntryFormValues>({
    resolver: zodResolver(timelineEntryFormSchema),
    defaultValues: {
      entryDate: '',
      yearLabel: '',
      title: '',
      description: '',
      category: '',
      visible: true,
    },
  });

  useEditResourceForm({
    itemQuery,
    methods,
    toFormValues: (row) => ({
      entryDate: toDateInputValue(row.entryDate),
      yearLabel: row.yearLabel ?? '',
      title: row.title,
      description: row.description ?? '',
      category: row.category ?? '',
      visible: row.visible,
    }),
  });

  const { onSubmit, busy } = useResourceFormSubmit({
    methods,
    mutateAsync: (payload: TimelineEntryFormValues) =>
      updateMutation.mutateAsync({ id, data: payload }),
    toPayload: (values) => values,
    successMessage: 'Timeline entry updated.',
    redirectTo: '/admin/timeline',
  });

  if (itemQuery.isPending) return <p className="text-body-secondary">Loading…</p>;
  if (itemQuery.isError) return <div className="alert alert-danger">Couldn’t load this entry.</div>;

  return (
    <div className="admin-resource-page">
      <h1 className="h4 mb-4">Edit timeline entry</h1>
      <EntityForm
        methods={methods}
        onSubmit={onSubmit}
        busy={busy}
        onCancel={() => router.push('/admin/timeline')}
      >
        <TimelineFields />
      </EntityForm>
    </div>
  );
}
