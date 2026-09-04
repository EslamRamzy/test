'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { EntityForm } from '@/features/admin/components/EntityForm';
import { useResourceFormSubmit } from '@/features/admin/lib/useResourceFormSubmit';
import { projectsHooks } from '@/features/admin/projects/client';
import { ProjectCaseStudyFields } from '@/features/admin/projects/ProjectCaseStudyFields';
import { ProjectOverviewFields } from '@/features/admin/projects/ProjectOverviewFields';
import {
  projectFormSchema,
  toProjectWirePayload,
  type ProjectFormValues,
} from '@/features/admin/projects/formSchema';

/**
 * Technologies, gallery images, the sections manager, and security
 * assessments all need an existing project id (each is its own nested
 * endpoint under `/admin/projects/:id/...`) — this page only ever collects
 * the main-form fields (`toProjectWirePayload`'s own shape); every other
 * tab becomes available once the project exists, on the Edit page.
 */
export default function NewProjectPage(): React.JSX.Element {
  const router = useRouter();
  const methods = useForm<ProjectFormValues>({
    resolver: zodResolver(projectFormSchema),
    defaultValues: {
      title: '',
      slug: '',
      shortDescription: '',
      fullDescription: '',
      category: 'WEB_APP',
      coverMediaId: '',
      problem: '',
      solution: '',
      architecture: '',
      challenges: '',
      solutionsDetail: '',
      lessonsLearned: '',
      deploymentNotes: '',
      githubUrl: '',
      liveUrl: '',
      securityTested: false,
      securitySummary: '',
      testingSummary: '',
      publishedAt: '',
      features: [],
    },
  });
  const createMutation = projectsHooks.useCreate();
  const { onSubmit, busy } = useResourceFormSubmit({
    methods,
    mutateAsync: (payload: ProjectFormValues) =>
      createMutation.mutateAsync(toProjectWirePayload(payload)),
    toPayload: (values) => values,
    successMessage: 'Project created.',
    redirectTo: '/admin/projects',
  });

  return (
    <div className="admin-resource-page">
      <h1 className="h4 mb-4">New project</h1>
      <EntityForm
        methods={methods}
        onSubmit={onSubmit}
        busy={busy}
        submitLabel="Create"
        onCancel={() => router.push('/admin/projects')}
      >
        <h2 className="h6 text-uppercase text-body-secondary mb-3">Overview</h2>
        <ProjectOverviewFields />
        <h2 className="h6 text-uppercase text-body-secondary mb-3 mt-4">Case study</h2>
        <ProjectCaseStudyFields />
      </EntityForm>
      <p className="text-body-secondary mt-3">
        Technologies, gallery images, section ordering, and security assessments become available
        once the project is created.
      </p>
    </div>
  );
}
