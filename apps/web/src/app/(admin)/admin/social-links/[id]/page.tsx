'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { socialLinkCreateSchema, type SocialLinkCreateInput } from '@portfolio/shared';
import { useParams, useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { EntityForm } from '@/features/admin/components/EntityForm';
import { emptyStringsToUndefined } from '@/features/admin/lib/formValues';
import { useEditResourceForm } from '@/features/admin/lib/useEditResourceForm';
import { useResourceFormSubmit } from '@/features/admin/lib/useResourceFormSubmit';
import { SocialLinkFields } from '@/features/admin/socialLinks/SocialLinkFields';
import { socialLinksHooks } from '@/features/admin/socialLinks/client';

export default function EditSocialLinkPage(): React.JSX.Element {
  const params = useParams<{ id: string }>();
  const id = Number(params.id);
  const router = useRouter();

  const itemQuery = socialLinksHooks.useItem(id);
  const updateMutation = socialLinksHooks.useUpdate();
  const methods = useForm<SocialLinkCreateInput>({
    resolver: zodResolver(emptyStringsToUndefined(socialLinkCreateSchema)),
    defaultValues: { platform: '', label: '', url: '', icon: '', enabled: true },
  });

  useEditResourceForm({
    itemQuery,
    methods,
    toFormValues: (row) => ({
      platform: row.platform,
      label: row.label ?? '',
      url: row.url,
      icon: row.icon ?? '',
      enabled: row.enabled,
    }),
  });

  const { onSubmit, busy } = useResourceFormSubmit({
    methods,
    mutateAsync: (payload: SocialLinkCreateInput) =>
      updateMutation.mutateAsync({ id, data: payload }),
    toPayload: (values) => values,
    successMessage: 'Social link updated.',
    redirectTo: '/admin/social-links',
  });

  if (itemQuery.isPending) return <p className="text-body-secondary">Loading…</p>;
  if (itemQuery.isError) return <div className="alert alert-danger">Couldn’t load this link.</div>;

  return (
    <div className="admin-resource-page">
      <h1 className="h4 mb-4">Edit social link</h1>
      <EntityForm
        methods={methods}
        onSubmit={onSubmit}
        busy={busy}
        onCancel={() => router.push('/admin/social-links')}
      >
        <SocialLinkFields />
      </EntityForm>
    </div>
  );
}
