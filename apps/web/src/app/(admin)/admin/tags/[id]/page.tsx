'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { tagCreateSchema, type TagCreateInput } from '@portfolio/shared';
import { useParams, useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { EntityForm } from '@/features/admin/components/EntityForm';
import { useEditResourceForm } from '@/features/admin/lib/useEditResourceForm';
import { useResourceFormSubmit } from '@/features/admin/lib/useResourceFormSubmit';
import { TagFields } from '@/features/admin/tags/TagFields';
import { tagsHooks } from '@/features/admin/tags/client';

export default function EditTagPage(): React.JSX.Element {
  const params = useParams<{ id: string }>();
  const id = Number(params.id);
  const router = useRouter();

  const itemQuery = tagsHooks.useItem(id);
  const updateMutation = tagsHooks.useUpdate();
  const methods = useForm<TagCreateInput>({
    resolver: zodResolver(tagCreateSchema),
    defaultValues: { name: '', slug: '' },
  });

  useEditResourceForm({
    itemQuery,
    methods,
    toFormValues: (row) => ({ name: row.name, slug: row.slug }),
  });

  const { onSubmit, busy } = useResourceFormSubmit({
    methods,
    mutateAsync: (payload: TagCreateInput) => updateMutation.mutateAsync({ id, data: payload }),
    toPayload: (values) => values,
    successMessage: 'Tag updated.',
    redirectTo: '/admin/tags',
  });

  if (itemQuery.isPending) return <p className="text-body-secondary">Loading…</p>;
  if (itemQuery.isError) return <div className="alert alert-danger">Couldn’t load this tag.</div>;

  return (
    <div className="admin-resource-page">
      <h1 className="h4 mb-4">Edit tag</h1>
      <EntityForm
        methods={methods}
        onSubmit={onSubmit}
        busy={busy}
        onCancel={() => router.push('/admin/tags')}
      >
        <TagFields />
      </EntityForm>
    </div>
  );
}
