'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useParams, useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { EntityForm } from '@/features/admin/components/EntityForm';
import { EducationFields } from '@/features/admin/education/EducationFields';
import { educationHooks } from '@/features/admin/education/client';
import {
  educationFormSchema,
  type EducationFormValues,
} from '@/features/admin/education/formSchema';
import { toDateInputValue } from '@/features/admin/lib/formValues';
import { useEditResourceForm } from '@/features/admin/lib/useEditResourceForm';
import { useResourceFormSubmit } from '@/features/admin/lib/useResourceFormSubmit';

export default function EditEducationPage(): React.JSX.Element {
  const params = useParams<{ id: string }>();
  const id = Number(params.id);
  const router = useRouter();

  const itemQuery = educationHooks.useItem(id);
  const updateMutation = educationHooks.useUpdate();
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

  useEditResourceForm({
    itemQuery,
    methods,
    toFormValues: (row) => ({
      institution: row.institution,
      degree: row.degree,
      field: row.field ?? '',
      description: row.description ?? '',
      startDate: toDateInputValue(row.startDate),
      endDate: toDateInputValue(row.endDate),
      visible: row.visible,
    }),
  });

  const { onSubmit, busy } = useResourceFormSubmit({
    methods,
    mutateAsync: (payload: EducationFormValues) =>
      updateMutation.mutateAsync({ id, data: payload }),
    toPayload: (values) => values,
    successMessage: 'Education entry updated.',
    redirectTo: '/admin/education',
  });

  if (itemQuery.isPending) return <p className="text-body-secondary">Loading…</p>;
  if (itemQuery.isError) return <div className="alert alert-danger">Couldn’t load this entry.</div>;

  return (
    <div className="admin-resource-page">
      <h1 className="h4 mb-4">Edit education entry</h1>
      <EntityForm
        methods={methods}
        onSubmit={onSubmit}
        busy={busy}
        onCancel={() => router.push('/admin/education')}
      >
        <EducationFields />
      </EntityForm>
    </div>
  );
}
