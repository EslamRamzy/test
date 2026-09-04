'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { skillCategoryCreateSchema, type SkillCategoryCreateInput } from '@portfolio/shared';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { EntityForm } from '@/features/admin/components/EntityForm';
import { emptyStringsToUndefined } from '@/features/admin/lib/formValues';
import { useResourceFormSubmit } from '@/features/admin/lib/useResourceFormSubmit';
import { SkillCategoryFields } from '@/features/admin/skillCategories/SkillCategoryFields';
import { skillCategoriesHooks } from '@/features/admin/skillCategories/client';

export default function NewSkillCategoryPage(): React.JSX.Element {
  const router = useRouter();
  const methods = useForm<SkillCategoryCreateInput>({
    resolver: zodResolver(emptyStringsToUndefined(skillCategoryCreateSchema)),
    defaultValues: { name: '', slug: '', icon: '', visible: true },
  });
  const createMutation = skillCategoriesHooks.useCreate();
  const { onSubmit, busy } = useResourceFormSubmit({
    methods,
    mutateAsync: (payload: SkillCategoryCreateInput) => createMutation.mutateAsync(payload),
    toPayload: (values) => values,
    successMessage: 'Skill category created.',
    redirectTo: '/admin/skill-categories',
  });

  return (
    <div className="admin-resource-page">
      <h1 className="h4 mb-4">New skill category</h1>
      <EntityForm
        methods={methods}
        onSubmit={onSubmit}
        busy={busy}
        submitLabel="Create"
        onCancel={() => router.push('/admin/skill-categories')}
      >
        <SkillCategoryFields />
      </EntityForm>
    </div>
  );
}
