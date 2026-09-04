'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { EntityForm } from '@/features/admin/components/EntityForm';
import { EducationFields } from '@/features/admin/education/EducationFields';
import { educationHooks } from '@/features/admin/education/client';
import {
  educationFormSchema,
  type EducationFormValues,
} from '@/features/admin/education/formSchema';
import { useResourceFormSubmit } from '@/features/admin/lib/useResourceFormSubmit';

export default function NewEducationPage(): React.JSX.Element {
  const router = useRouter();
  const methods = useForm<EducationFormValues>({
    resolver: zodResolver(educationFormSchema),
    defaultValues: {
      institution: '',
      degree: '',
      field: '',
      description: '',
      startDate: '',
      endDate: '',
      visible: true,
    },
  });
  const createMutation = educationHooks.useCreate();
  const { onSubmit, busy } = useResourceFormSubmit({
    methods,
    mutateAsync: (payload: EducationFormValues) => createMutation.mutateAsync(payload),
    toPayload: (values) => values,
    successMessage: 'Education entry created.',
    redirectTo: '/admin/education',
  });

  return (
    <div className="admin-resource-page">
      <h1 className="h4 mb-4">New education entry</h1>
      <EntityForm
        methods={methods}
        onSubmit={onSubmit}
        busy={busy}
        submitLabel="Create"
        onCancel={() => router.push('/admin/education')}
      >
        <EducationFields />
      </EntityForm>
    </div>
  );
}
