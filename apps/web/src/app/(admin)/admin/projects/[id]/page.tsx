'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useParams, useRouter } from 'next/navigation';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { EntityForm } from '@/features/admin/components/EntityForm';
import { PublishControls } from '@/features/admin/components/PublishControls';
import type { ContentStatus } from '@/features/admin/components/StatusBadge';
import { StatusBadge } from '@/features/admin/components/StatusBadge';
import { useToast } from '@/features/admin/components/ToastProvider';
import { applyApiErrors } from '@/features/admin/lib/applyApiErrors';
import { useEditResourceForm } from '@/features/admin/lib/useEditResourceForm';
import { useResourceFormSubmit } from '@/features/admin/lib/useResourceFormSubmit';
import { toDatetimeLocalInputValue } from '@/features/admin/lib/formValues';
import { projectPublishHooks, projectsHooks } from '@/features/admin/projects/client';
import { ProjectCaseStudyFields } from '@/features/admin/projects/ProjectCaseStudyFields';
import { ProjectMediaPanel } from '@/features/admin/projects/ProjectMediaPanel';
import { ProjectOverviewFields } from '@/features/admin/projects/ProjectOverviewFields';
import { ProjectSecurityPanel } from '@/features/admin/projects/ProjectSecurityPanel';
import { ProjectSectionsManager } from '@/features/admin/projects/ProjectSectionsManager';
import { ProjectSeoPanel } from '@/features/admin/projects/ProjectSeoPanel';
import { ProjectTechnologiesPanel } from '@/features/admin/projects/ProjectTechnologiesPanel';
import {
  projectFormSchema,
  toProjectWirePayload,
  type ProjectFormValues,
} from '@/features/admin/projects/formSchema';
import { ApiError } from '@/lib/api/ApiError';

const TABS = [
  { key: 'overview', label: 'Overview' },
  { key: 'caseStudy', label: 'Case Study' },
  { key: 'technologies', label: 'Technologies' },
  { key: 'media', label: 'Media' },
  { key: 'security', label: 'Security' },
  { key: 'seo', label: 'SEO' },
] as const;
type TabKey = (typeof TABS)[number]['key'];

export default function EditProjectPage(): React.JSX.Element {
  const params = useParams<{ id: string }>();
  const id = Number(params.id);
  const router = useRouter();
  const { show } = useToast();
  const [activeTab, setActiveTab] = useState<TabKey>('overview');

  const itemQuery = projectsHooks.useItem(id);
  const updateMutation = projectsHooks.useUpdate();
  const publishMutation = projectPublishHooks.usePublish();
  const unpublishMutation = projectPublishHooks.useUnpublish();
  const archiveMutation = projectPublishHooks.useArchive();
  const duplicateMutation = projectPublishHooks.useDuplicate();

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

  useEditResourceForm({
    itemQuery,
    methods,
    toFormValues: (row) => ({
      title: row.title,
      slug: row.slug,
      shortDescription: row.shortDescription,
      fullDescription: row.fullDescription ?? '',
      category: row.category as ProjectFormValues['category'],
      coverMediaId: row.coverMediaId ? String(row.coverMediaId) : '',
      problem: row.problem ?? '',
      solution: row.solution ?? '',
      architecture: row.architecture ?? '',
      challenges: row.challenges ?? '',
      solutionsDetail: row.solutionsDetail ?? '',
      lessonsLearned: row.lessonsLearned ?? '',
      deploymentNotes: row.deploymentNotes ?? '',
      githubUrl: row.githubUrl ?? '',
      liveUrl: row.liveUrl ?? '',
      securityTested: row.securityTested,
      securitySummary: row.securitySummary ?? '',
      testingSummary: row.testingSummary ?? '',
      publishedAt: toDatetimeLocalInputValue(row.publishedAt),
      features: row.features.map((feature) => ({
        title: feature.title,
        description: feature.description ?? '',
      })),
    }),
  });

  const { onSubmit, busy } = useResourceFormSubmit({
    methods,
    mutateAsync: (payload: ProjectFormValues) =>
      updateMutation.mutateAsync({ id, data: toProjectWirePayload(payload) }),
    toPayload: (values) => values,
    successMessage: 'Project updated.',
    redirectTo: '/admin/projects',
  });

  function handlePublishAction(
    mutate: (
      id: number,
      opts: { onSuccess: () => void; onError: (error: unknown) => void },
    ) => void,
    successMessage: string,
  ): void {
    mutate(id, {
      onSuccess: () => show({ message: successMessage, variant: 'success' }),
      onError: (error) => {
        const appliedToFields = applyApiErrors(methods, error);
        show({
          message: appliedToFields
            ? 'Fix the highlighted fields before publishing.'
            : error instanceof ApiError
              ? error.message
              : 'Something went wrong. Please try again.',
          variant: appliedToFields ? 'warning' : 'danger',
          autohideMs: null,
        });
      },
    });
  }

  function handleDuplicate(): void {
    duplicateMutation.mutate(id, {
      onSuccess: (row) => {
        show({ message: 'Project duplicated.', variant: 'success' });
        router.push(`/admin/projects/${row.id}`);
      },
      onError: () => show({ message: 'Couldn’t duplicate this project.', variant: 'danger' }),
    });
  }

  if (itemQuery.isPending) return <p className="text-body-secondary">Loading…</p>;
  if (itemQuery.isError)
    return <div className="alert alert-danger">Couldn’t load this project.</div>;

  const project = itemQuery.data;
  const publishBusy =
    publishMutation.isPending ||
    unpublishMutation.isPending ||
    archiveMutation.isPending ||
    duplicateMutation.isPending;

  return (
    <div className="admin-resource-page">
      <div className="admin-resource-page__header">
        <h1 className="h4 mb-0">Edit project</h1>
        <StatusBadge status={project.status as ContentStatus} />
        <PublishControls
          status={project.status as ContentStatus}
          onPublish={() => handlePublishAction(publishMutation.mutate, 'Project published.')}
          onUnpublish={() => handlePublishAction(unpublishMutation.mutate, 'Project unpublished.')}
          onArchive={() => handlePublishAction(archiveMutation.mutate, 'Project archived.')}
          onDuplicate={handleDuplicate}
          busy={publishBusy}
        />
      </div>

      <ul className="nav nav-tabs mb-4" role="tablist">
        {TABS.map((tab) => (
          <li className="nav-item" key={tab.key} role="presentation">
            <button
              type="button"
              className={`nav-link${activeTab === tab.key ? ' active' : ''}`}
              onClick={() => setActiveTab(tab.key)}
              role="tab"
              aria-selected={activeTab === tab.key}
            >
              {tab.label}
            </button>
          </li>
        ))}
      </ul>

      {/*
        Every tab of the main form stays MOUNTED (hidden, not unmounted) so
        react-hook-form's state — dirty fields, in-progress edits — survives
        switching tabs; only the non-form panels (Technologies/Media/
        Security's assessments/SEO) sit outside <EntityForm> entirely, since
        they're separate mutations with their own state.
      */}
      <EntityForm
        methods={methods}
        onSubmit={onSubmit}
        busy={busy}
        onCancel={() => router.push('/admin/projects')}
      >
        <div hidden={activeTab !== 'overview'}>
          <ProjectOverviewFields />
        </div>
        <div hidden={activeTab !== 'caseStudy'}>
          <ProjectCaseStudyFields />
        </div>
        <div hidden={activeTab !== 'security'}>
          <ProjectSecurityPanel project={project} />
        </div>
      </EntityForm>

      {activeTab === 'technologies' && <ProjectTechnologiesPanel project={project} />}
      {activeTab === 'media' && <ProjectMediaPanel project={project} />}
      {activeTab === 'caseStudy' && <ProjectSectionsManager project={project} />}
      {activeTab === 'seo' && <ProjectSeoPanel project={project} />}
    </div>
  );
}
