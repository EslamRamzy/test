'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { skillCreateSchema, type SkillCreateInput, type SkillUpdateInput } from '@portfolio/shared';
import { useParams, useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { EntityForm } from '@/features/admin/components/EntityForm';
import { emptyStringsToUndefined } from '@/features/admin/lib/formValues';
import { useEditResourceForm } from '@/features/admin/lib/useEditResourceForm';
import { useResourceFormSubmit } from '@/features/admin/lib/useResourceFormSubmit';
import { SkillFields } from '@/features/admin/skills/SkillFields';
import { skillsHooks } from '@/features/admin/skills/client';

export default function EditSkillPage(): React.JSX.Element {
  const params = useParams<{ id: string }>();
  const id = Number(params.id);
  const router = useRouter();

  const itemQuery = skillsHooks.useItem(id);
  const updateMutation = skillsHooks.useUpdate();
  const methods = useForm<SkillCreateInput>({
    resolver: zodResolver(emptyStringsToUndefined(skillCreateSchema)),
    defaultValues: {
      categoryId: 0,
      name: '',
      icon: '',
      description: '',
      level: 'INTERMEDIATE',
      visible: true,
    },
  });

  useEditResourceForm({
    itemQuery,
    methods,
    toFormValues: (row) => ({
      categoryId: row.categoryId,
      name: row.name,
      icon: row.icon ?? '',
      description: row.description ?? '',
      level: row.level as SkillCreateInput['level'],
      visible: row.visible,
    }),
  });

  const { onSubmit, busy } = useResourceFormSubmit({
    methods,
    // `categoryId` is intentionally dropped — `skillUpdateSchema` omits it
    // (`skill.ts`'s own comment), and the field is rendered disabled anyway.
    mutateAsync: (payload: SkillUpdateInput) => updateMutation.mutateAsync({ id, data: payload }),
    toPayload: ({ categoryId: _categoryId, ...rest }) => rest,
    successMessage: 'Skill updated.',
    redirectTo: '/admin/skills',
  });

  if (itemQuery.isPending) return <p className="text-body-secondary">Loading…</p>;
  if (itemQuery.isError) return <div className="alert alert-danger">Couldn’t load this skill.</div>;

  return (
    <div className="admin-resource-page">
      <h1 className="h4 mb-4">Edit skill</h1>
      <EntityForm
        methods={methods}
        onSubmit={onSubmit}
        busy={busy}
        onCancel={() => router.push('/admin/skills')}
      >
        <SkillFields disableCategory />
      </EntityForm>
    </div>
  );
}
