'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { EntityForm } from '@/features/admin/components/EntityForm';
import { experienceHooks } from '@/features/admin/experience/client';
import { ExperienceFields } from '@/features/admin/experience/ExperienceFields';
import {
  experienceFormSchema,
  toExperienceWirePayload,
  type ExperienceFormValues,
} from '@/features/admin/experience/formSchema';
import { useResourceFormSubmit } from '@/features/admin/lib/useResourceFormSubmit';

export default function NewExperiencePage(): React.JSX.Element {
  const router = useRouter();
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
  const createMutation = experienceHooks.useCreate();
  const { onSubmit, busy } = useResourceFormSubmit({
    methods,
    mutateAsync: (payload: ExperienceFormValues) =>
      createMutation.mutateAsync(toExperienceWirePayload(payload)),
    toPayload: (values) => values,
    successMessage: 'Experience entry created.',
    redirectTo: '/admin/experience',
  });

  return (
    <div className="admin-resource-page">
      <h1 className="h4 mb-4">New experience entry</h1>
      <EntityForm
        methods={methods}
        onSubmit={onSubmit}
        busy={busy}
        submitLabel="Create"
        onCancel={() => router.push('/admin/experience')}
      >
        <ExperienceFields />
      </EntityForm>
    </div>
  );
}
