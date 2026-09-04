'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { tagCreateSchema, type TagCreateInput } from '@portfolio/shared';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { EntityForm } from '@/features/admin/components/EntityForm';
import { useResourceFormSubmit } from '@/features/admin/lib/useResourceFormSubmit';
import { TagFields } from '@/features/admin/tags/TagFields';
import { tagsHooks } from '@/features/admin/tags/client';

export default function NewTagPage(): React.JSX.Element {
  const router = useRouter();
  const methods = useForm<TagCreateInput>({
    resolver: zodResolver(tagCreateSchema),
    defaultValues: { name: '', slug: '' },
  });
  const createMutation = tagsHooks.useCreate();
  const { onSubmit, busy } = useResourceFormSubmit({
    methods,
    mutateAsync: (payload: TagCreateInput) => createMutation.mutateAsync(payload),
    toPayload: (values) => values,
    successMessage: 'Tag created.',
    redirectTo: '/admin/tags',
  });

  return (
    <div className="admin-resource-page">
      <h1 className="h4 mb-4">New tag</h1>
      <EntityForm
        methods={methods}
        onSubmit={onSubmit}
        busy={busy}
        submitLabel="Create"
        onCancel={() => router.push('/admin/tags')}
      >
        <TagFields />
      </EntityForm>
    </div>
  );
}
