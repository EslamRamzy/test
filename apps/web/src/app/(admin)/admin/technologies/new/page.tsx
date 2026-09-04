'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { technologyCreateSchema, type TechnologyCreateInput } from '@portfolio/shared';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { EntityForm } from '@/features/admin/components/EntityForm';
import { emptyStringsToUndefined } from '@/features/admin/lib/formValues';
import { useResourceFormSubmit } from '@/features/admin/lib/useResourceFormSubmit';
import { technologiesHooks } from '@/features/admin/technologies/client';
import { TechnologyFields } from '@/features/admin/technologies/TechnologyFields';

export default function NewTechnologyPage(): React.JSX.Element {
  const router = useRouter();
  const methods = useForm<TechnologyCreateInput>({
    resolver: zodResolver(emptyStringsToUndefined(technologyCreateSchema)),
    defaultValues: { name: '', slug: '', icon: '', category: '', websiteUrl: '' },
  });
  const createMutation = technologiesHooks.useCreate();
  const { onSubmit, busy } = useResourceFormSubmit({
    methods,
    mutateAsync: (payload: TechnologyCreateInput) => createMutation.mutateAsync(payload),
    toPayload: (values) => values,
    successMessage: 'Technology created.',
    redirectTo: '/admin/technologies',
  });

  return (
    <div className="admin-resource-page">
      <h1 className="h4 mb-4">New technology</h1>
      <EntityForm
        methods={methods}
        onSubmit={onSubmit}
        busy={busy}
        submitLabel="Create"
        onCancel={() => router.push('/admin/technologies')}
      >
        <TechnologyFields />
      </EntityForm>
    </div>
  );
}
