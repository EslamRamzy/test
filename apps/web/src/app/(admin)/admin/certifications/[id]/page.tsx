'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useParams, useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { EntityForm } from '@/features/admin/components/EntityForm';
import { CertificationFields } from '@/features/admin/certifications/CertificationFields';
import { certificationsHooks } from '@/features/admin/certifications/client';
import {
  certificationFormSchema,
  toCertificationWirePayload,
  type CertificationFormValues,
} from '@/features/admin/certifications/formSchema';
import { toDateInputValue } from '@/features/admin/lib/formValues';
import { useEditResourceForm } from '@/features/admin/lib/useEditResourceForm';
import { useResourceFormSubmit } from '@/features/admin/lib/useResourceFormSubmit';

export default function EditCertificationPage(): React.JSX.Element {
  const params = useParams<{ id: string }>();
  const id = Number(params.id);
  const router = useRouter();

  const itemQuery = certificationsHooks.useItem(id);
  const updateMutation = certificationsHooks.useUpdate();
  const methods = useForm<CertificationFormValues>({
    resolver: zodResolver(certificationFormSchema),
    defaultValues: {
      name: '',
      issuer: '',
      description: '',
      certificateMediaId: '',
      credentialUrl: '',
      issueDate: '',
      expirationDate: '',
      visible: true,
    },
  });

  useEditResourceForm({
    itemQuery,
    methods,
    toFormValues: (row) => ({
      name: row.name,
      issuer: row.issuer,
      description: row.description ?? '',
      certificateMediaId: row.certificateMediaId ? String(row.certificateMediaId) : '',
      credentialUrl: row.credentialUrl ?? '',
      issueDate: toDateInputValue(row.issueDate),
      expirationDate: toDateInputValue(row.expirationDate),
      visible: row.visible,
    }),
  });

  const { onSubmit, busy } = useResourceFormSubmit({
    methods,
    mutateAsync: (payload: CertificationFormValues) =>
      updateMutation.mutateAsync({ id, data: toCertificationWirePayload(payload) }),
    toPayload: (values) => values,
    successMessage: 'Certification updated.',
    redirectTo: '/admin/certifications',
  });

  if (itemQuery.isPending) return <p className="text-body-secondary">Loading…</p>;
  if (itemQuery.isError) {
    return <div className="alert alert-danger">Couldn’t load this certification.</div>;
  }

  return (
    <div className="admin-resource-page">
      <h1 className="h4 mb-4">Edit certification</h1>
      <EntityForm
        methods={methods}
        onSubmit={onSubmit}
        busy={busy}
        onCancel={() => router.push('/admin/certifications')}
      >
        <CertificationFields />
      </EntityForm>
    </div>
  );
}
