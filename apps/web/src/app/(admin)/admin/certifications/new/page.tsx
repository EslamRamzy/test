'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { EntityForm } from '@/features/admin/components/EntityForm';
import { CertificationFields } from '@/features/admin/certifications/CertificationFields';
import { certificationsHooks } from '@/features/admin/certifications/client';
import {
  certificationFormSchema,
  type CertificationFormValues,
} from '@/features/admin/certifications/formSchema';
import { useResourceFormSubmit } from '@/features/admin/lib/useResourceFormSubmit';

export default function NewCertificationPage(): React.JSX.Element {
  const router = useRouter();
  const methods = useForm<CertificationFormValues>({
    resolver: zodResolver(certificationFormSchema),
    defaultValues: {
      name: '',
      issuer: '',
      description: '',
      credentialUrl: '',
      issueDate: '',
      expirationDate: '',
      visible: true,
    },
  });
  const createMutation = certificationsHooks.useCreate();
  const { onSubmit, busy } = useResourceFormSubmit({
    methods,
    mutateAsync: (payload: CertificationFormValues) => createMutation.mutateAsync(payload),
    toPayload: (values) => values,
    successMessage: 'Certification created.',
    redirectTo: '/admin/certifications',
  });

  return (
    <div className="admin-resource-page">
      <h1 className="h4 mb-4">New certification</h1>
      <EntityForm
        methods={methods}
        onSubmit={onSubmit}
        busy={busy}
        submitLabel="Create"
        onCancel={() => router.push('/admin/certifications')}
      >
        <CertificationFields />
      </EntityForm>
    </div>
  );
}
