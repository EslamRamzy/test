'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { EntityForm } from '@/features/admin/components/EntityForm';
import { useResourceFormSubmit } from '@/features/admin/lib/useResourceFormSubmit';
import { TimelineFields } from '@/features/admin/timeline/TimelineFields';
import { timelineHooks } from '@/features/admin/timeline/client';
import {
  timelineEntryFormSchema,
  type TimelineEntryFormValues,
} from '@/features/admin/timeline/formSchema';

export default function NewTimelineEntryPage(): React.JSX.Element {
  const router = useRouter();
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
  const createMutation = timelineHooks.useCreate();
  const { onSubmit, busy } = useResourceFormSubmit({
    methods,
    mutateAsync: (payload: TimelineEntryFormValues) => createMutation.mutateAsync(payload),
    toPayload: (values) => values,
    successMessage: 'Timeline entry created.',
    redirectTo: '/admin/timeline',
  });

  return (
    <div className="admin-resource-page">
      <h1 className="h4 mb-4">New timeline entry</h1>
      <EntityForm
        methods={methods}
        onSubmit={onSubmit}
        busy={busy}
        submitLabel="Create"
        onCancel={() => router.push('/admin/timeline')}
      >
        <TimelineFields />
      </EntityForm>
    </div>
  );
}
