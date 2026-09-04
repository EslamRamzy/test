'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { EntityForm } from '@/features/admin/components/EntityForm';
import { useResourceFormSubmit } from '@/features/admin/lib/useResourceFormSubmit';
import { securityResearchHooks } from '@/features/admin/securityResearch/client';
import { SecurityResearchFields } from '@/features/admin/securityResearch/SecurityResearchFields';
import {
  securityResearchFormSchema,
  toSecurityResearchWirePayload,
  type SecurityResearchFormValues,
} from '@/features/admin/securityResearch/formSchema';

export default function NewSecurityResearchPage(): React.JSX.Element {
  const router = useRouter();
  const methods = useForm<SecurityResearchFormValues>({
    resolver: zodResolver(securityResearchFormSchema),
    defaultValues: {
      title: '',
      slug: '',
      description: '',
      content: '',
      category: 'RESEARCH',
      coverMediaId: '',
      publishedAt: '',
      tagIds: [],
      references: [],
    },
  });
  const createMutation = securityResearchHooks.useCreate();
  const { onSubmit, busy } = useResourceFormSubmit({
    methods,
    mutateAsync: (payload: SecurityResearchFormValues) =>
      createMutation.mutateAsync(toSecurityResearchWirePayload(payload)),
    toPayload: (values) => values,
    successMessage: 'Research entry created.',
    redirectTo: '/admin/security-research',
  });

  return (
    <div className="admin-resource-page">
      <h1 className="h4 mb-4">New security research entry</h1>
      <EntityForm
        methods={methods}
        onSubmit={onSubmit}
        busy={busy}
        submitLabel="Create"
        onCancel={() => router.push('/admin/security-research')}
      >
        <SecurityResearchFields />
      </EntityForm>
    </div>
  );
}
