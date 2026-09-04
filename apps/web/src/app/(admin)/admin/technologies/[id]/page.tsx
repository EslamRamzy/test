'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { technologyCreateSchema, type TechnologyCreateInput } from '@portfolio/shared';
import { useParams, useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { EntityForm } from '@/features/admin/components/EntityForm';
import { emptyStringsToUndefined } from '@/features/admin/lib/formValues';
import { useEditResourceForm } from '@/features/admin/lib/useEditResourceForm';
import { useResourceFormSubmit } from '@/features/admin/lib/useResourceFormSubmit';
import { technologiesHooks } from '@/features/admin/technologies/client';
import { TechnologyFields } from '@/features/admin/technologies/TechnologyFields';

export default function EditTechnologyPage(): React.JSX.Element {
  const params = useParams<{ id: string }>();
  const id = Number(params.id);
  const router = useRouter();

  const itemQuery = technologiesHooks.useItem(id);
  const updateMutation = technologiesHooks.useUpdate();
  const methods = useForm<TechnologyCreateInput>({
    resolver: zodResolver(emptyStringsToUndefined(technologyCreateSchema)),
    defaultValues: { name: '', slug: '', icon: '', category: '', websiteUrl: '' },
  });

  useEditResourceForm({
    itemQuery,
    methods,
    toFormValues: (row) => ({
      name: row.name,
      slug: row.slug,
      icon: row.icon ?? '',
      category: row.category ?? '',
      websiteUrl: row.websiteUrl ?? '',
    }),
  });

  const { onSubmit, busy } = useResourceFormSubmit({
    methods,
    mutateAsync: (payload: TechnologyCreateInput) =>
      updateMutation.mutateAsync({ id, data: payload }),
    toPayload: (values) => values,
    successMessage: 'Technology updated.',
    redirectTo: '/admin/technologies',
  });

  if (itemQuery.isPending) {
    return <p className="text-body-secondary">Loading…</p>;
  }
  if (itemQuery.isError) {
    return <div className="alert alert-danger">Couldn’t load this technology.</div>;
  }

  return (
    <div className="admin-resource-page">
      <h1 className="h4 mb-4">Edit technology</h1>
      <EntityForm
        methods={methods}
        onSubmit={onSubmit}
        busy={busy}
        onCancel={() => router.push('/admin/technologies')}
      >
        <TechnologyFields />
      </EntityForm>
    </div>
  );
}
