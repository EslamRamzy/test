'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { skillCategoryCreateSchema, type SkillCategoryCreateInput } from '@portfolio/shared';
import { useParams, useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { EntityForm } from '@/features/admin/components/EntityForm';
import { emptyStringsToUndefined } from '@/features/admin/lib/formValues';
import { useEditResourceForm } from '@/features/admin/lib/useEditResourceForm';
import { useResourceFormSubmit } from '@/features/admin/lib/useResourceFormSubmit';
import { SkillCategoryFields } from '@/features/admin/skillCategories/SkillCategoryFields';
import { skillCategoriesHooks } from '@/features/admin/skillCategories/client';

export default function EditSkillCategoryPage(): React.JSX.Element {
  const params = useParams<{ id: string }>();
  const id = Number(params.id);
  const router = useRouter();

  const itemQuery = skillCategoriesHooks.useItem(id);
  const updateMutation = skillCategoriesHooks.useUpdate();
  const methods = useForm<SkillCategoryCreateInput>({
    resolver: zodResolver(emptyStringsToUndefined(skillCategoryCreateSchema)),
    defaultValues: { name: '', slug: '', icon: '', visible: true },
  });

  useEditResourceForm({
    itemQuery,
    methods,
    toFormValues: (row) => ({
      name: row.name,
      slug: row.slug,
      icon: row.icon ?? '',
      visible: row.visible,
    }),
  });

  const { onSubmit, busy } = useResourceFormSubmit({
    methods,
    mutateAsync: (payload: SkillCategoryCreateInput) =>
      updateMutation.mutateAsync({ id, data: payload }),
    toPayload: (values) => values,
    successMessage: 'Skill category updated.',
    redirectTo: '/admin/skill-categories',
  });

  if (itemQuery.isPending) return <p className="text-body-secondary">Loading…</p>;
  if (itemQuery.isError)
    return <div className="alert alert-danger">Couldn’t load this category.</div>;

  return (
    <div className="admin-resource-page">
      <h1 className="h4 mb-4">Edit skill category</h1>
      <EntityForm
        methods={methods}
        onSubmit={onSubmit}
        busy={busy}
        onCancel={() => router.push('/admin/skill-categories')}
      >
        <SkillCategoryFields />
      </EntityForm>
    </div>
  );
}
