'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useParams, useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { EntityForm } from '@/features/admin/components/EntityForm';
import { experienceHooks } from '@/features/admin/experience/client';
import { ExperienceFields } from '@/features/admin/experience/ExperienceFields';
import {
  experienceFormSchema,
  toExperienceWirePayload,
  type ExperienceFormValues,
} from '@/features/admin/experience/formSchema';
import { toDateInputValue } from '@/features/admin/lib/formValues';
import { useEditResourceForm } from '@/features/admin/lib/useEditResourceForm';
import { useResourceFormSubmit } from '@/features/admin/lib/useResourceFormSubmit';

export default function EditExperiencePage(): React.JSX.Element {
  const params = useParams<{ id: string }>();
  const id = Number(params.id);
  const router = useRouter();

  const itemQuery = experienceHooks.useItem(id);
  const updateMutation = experienceHooks.useUpdate();
  const methods = useForm<ExperienceFormValues>({
    resolver: zodResolver(experienceFormSchema),
    defaultValues: {
      position: '',
      organization: '',
      location: '',
      description: '',
      startDate: '',
      endDate: '',
      isCurrent: false,
      visible: true,
      achievements: [],
      technologyIds: [],
    },
  });

  useEditResourceForm({
    itemQuery,
    methods,
    toFormValues: (row) => ({
      position: row.position,
      organization: row.organization,
      location: row.location ?? '',
      description: row.description ?? '',
      startDate: toDateInputValue(row.startDate),
      endDate: toDateInputValue(row.endDate),
      isCurrent: row.isCurrent,
      visible: row.visible,
      achievements: row.achievements.map((achievement) => ({ text: achievement.text })),
      technologyIds: row.technologies.map((entry) => entry.technologyId),
    }),
  });

  const { onSubmit, busy } = useResourceFormSubmit({
    methods,
    mutateAsync: (payload: ExperienceFormValues) =>
      updateMutation.mutateAsync({ id, data: toExperienceWirePayload(payload) }),
    toPayload: (values) => values,
    successMessage: 'Experience entry updated.',
    redirectTo: '/admin/experience',
  });

  if (itemQuery.isPending) return <p className="text-body-secondary">Loading…</p>;
  if (itemQuery.isError) return <div className="alert alert-danger">Couldn’t load this entry.</div>;

  return (
    <div className="admin-resource-page">
      <h1 className="h4 mb-4">Edit experience entry</h1>
      <EntityForm
        methods={methods}
        onSubmit={onSubmit}
        busy={busy}
        onCancel={() => router.push('/admin/experience')}
      >
        <ExperienceFields />
      </EntityForm>
    </div>
  );
}
