'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { skillCreateSchema, type SkillCreateInput } from '@portfolio/shared';
import { useRouter, useSearchParams } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { EntityForm } from '@/features/admin/components/EntityForm';
import { emptyStringsToUndefined } from '@/features/admin/lib/formValues';
import { useResourceFormSubmit } from '@/features/admin/lib/useResourceFormSubmit';
import { SkillFields } from '@/features/admin/skills/SkillFields';
import { skillsHooks } from '@/features/admin/skills/client';

export default function NewSkillPage(): React.JSX.Element {
  const router = useRouter();
  const searchParams = useSearchParams();
  // Prefills from the Skills list page's currently-selected category filter
  // (`/admin/skills/new?categoryId=…`) — a plain create-time default, not a
  // constraint; the select below still lets the admin pick any category.
  const initialCategoryId = Number(searchParams.get('categoryId') ?? 0) || undefined;

  const methods = useForm<SkillCreateInput>({
    resolver: zodResolver(emptyStringsToUndefined(skillCreateSchema)),
    defaultValues: {
      categoryId: initialCategoryId ?? 0,
      name: '',
      icon: '',
      description: '',
      level: 'INTERMEDIATE',
      visible: true,
    },
  });
  const createMutation = skillsHooks.useCreate();
  const backHref = initialCategoryId
    ? `/admin/skills?categoryId=${initialCategoryId}`
    : '/admin/skills';
  const { onSubmit, busy } = useResourceFormSubmit({
    methods,
    mutateAsync: (payload: SkillCreateInput) => createMutation.mutateAsync(payload),
    toPayload: (values) => values,
    successMessage: 'Skill created.',
    redirectTo: '/admin/skills',
  });

  return (
    <div className="admin-resource-page">
      <h1 className="h4 mb-4">New skill</h1>
      <EntityForm
        methods={methods}
        onSubmit={onSubmit}
        busy={busy}
        submitLabel="Create"
        onCancel={() => router.push(backHref)}
      >
        <SkillFields />
      </EntityForm>
    </div>
  );
}
