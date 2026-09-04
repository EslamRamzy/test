'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { socialLinkCreateSchema, type SocialLinkCreateInput } from '@portfolio/shared';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { EntityForm } from '@/features/admin/components/EntityForm';
import { emptyStringsToUndefined } from '@/features/admin/lib/formValues';
import { useResourceFormSubmit } from '@/features/admin/lib/useResourceFormSubmit';
import { SocialLinkFields } from '@/features/admin/socialLinks/SocialLinkFields';
import { socialLinksHooks } from '@/features/admin/socialLinks/client';

export default function NewSocialLinkPage(): React.JSX.Element {
  const router = useRouter();
  const methods = useForm<SocialLinkCreateInput>({
    resolver: zodResolver(emptyStringsToUndefined(socialLinkCreateSchema)),
    defaultValues: { platform: '', label: '', url: '', icon: '', enabled: true },
  });
  const createMutation = socialLinksHooks.useCreate();
  const { onSubmit, busy } = useResourceFormSubmit({
    methods,
    mutateAsync: (payload: SocialLinkCreateInput) => createMutation.mutateAsync(payload),
    toPayload: (values) => values,
    successMessage: 'Social link created.',
    redirectTo: '/admin/social-links',
  });

  return (
    <div className="admin-resource-page">
      <h1 className="h4 mb-4">New social link</h1>
      <EntityForm
        methods={methods}
        onSubmit={onSubmit}
        busy={busy}
        submitLabel="Create"
        onCancel={() => router.push('/admin/social-links')}
      >
        <SocialLinkFields />
      </EntityForm>
    </div>
  );
}
