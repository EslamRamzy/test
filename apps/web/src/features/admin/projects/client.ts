import type { ProjectAdminRow, SecurityAssessmentRow, SecurityFindingRow } from '@portfolio/shared';
import type {
  securityAssessmentCreateSchema,
  securityAssessmentTestsUpsertSchema,
  securityAssessmentUpdateSchema,
  securityFindingCreateSchema,
  securityFindingUpdateSchema,
} from '@portfolio/shared';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { z } from 'zod';
import { mutate } from '@/lib/api/adminClient';
import { createAdminResourceClient, createPublishActions } from '@/lib/api/adminResource';
import {
  createAdminResourceHooks,
  createPublishActionHooks,
} from '@/features/admin/lib/adminResourceHooks';
import type { ProjectWirePayload } from './formSchema';

const RESOURCE_KEY = 'admin-projects';
const BASE_PATH = '/api/v1/admin/projects';

export const projectsClient = createAdminResourceClient<
  ProjectAdminRow,
  ProjectWirePayload,
  ProjectWirePayload
>(BASE_PATH, { reorder: true });

export const projectsHooks = createAdminResourceHooks(projectsClient, RESOURCE_KEY);

const projectPublishActions = createPublishActions<ProjectAdminRow>(BASE_PATH);
export const projectPublishHooks = createPublishActionHooks(projectPublishActions, RESOURCE_KEY);

/**
 * Every tabbed-editor action beyond the main form and the publish group has
 * its OWN endpoint (`project.ts`'s own schema doc: "toggling `featured`
 * doesn't require resending the entire case-study body") — `TabActions`
 * groups the raw fetch calls, `useProjectTabMutation` is the one shared
 * react-query wrapper all of them use, since every one of them changes the
 * SAME project row and should invalidate the SAME query.
 */
function useProjectTabMutation<TVariables, TData>(
  mutationFn: (variables: TVariables) => Promise<TData>,
) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn,
    onSuccess: (_data, variables) => {
      const id = (variables as { id?: number }).id;
      void queryClient.invalidateQueries({ queryKey: [RESOURCE_KEY, 'list'] });
      if (id !== undefined) {
        void queryClient.invalidateQueries({ queryKey: [RESOURCE_KEY, 'item', id] });
      }
    },
  });
}

export function useSetFeatured() {
  return useProjectTabMutation((vars: { id: number; featured: boolean }) =>
    mutate<ProjectAdminRow>(`${BASE_PATH}/${vars.id}/featured`, {
      method: 'POST',
      body: { featured: vars.featured },
    }),
  );
}

export function useSetProjectTechnologies() {
  return useProjectTabMutation((vars: { id: number; technologyIds: number[] }) =>
    mutate<ProjectAdminRow>(`${BASE_PATH}/${vars.id}/technologies`, {
      method: 'PUT',
      body: { technologyIds: vars.technologyIds },
    }),
  );
}

export function useAddProjectImage() {
  return useProjectTabMutation((vars: { id: number; mediaId: number; caption?: string }) =>
    mutate<ProjectAdminRow>(`${BASE_PATH}/${vars.id}/images`, {
      method: 'POST',
      body: { mediaId: vars.mediaId, ...(vars.caption ? { caption: vars.caption } : {}) },
    }),
  );
}

export function useReorderProjectImages() {
  return useProjectTabMutation(
    (vars: { id: number; items: Array<{ id: number; displayOrder: number }> }) =>
      mutate<ProjectAdminRow>(`${BASE_PATH}/${vars.id}/images/reorder`, {
        method: 'PATCH',
        body: vars.items,
      }),
  );
}

export function useRemoveProjectImage() {
  return useProjectTabMutation((vars: { id: number; imageId: number }) =>
    mutate<{ deleted: boolean }>(`${BASE_PATH}/${vars.id}/images/${vars.imageId}`, {
      method: 'DELETE',
    }),
  );
}

export interface ProjectSectionEntryInput {
  sectionKey: string;
  title?: string | undefined;
  body?: string | undefined;
  visible: boolean;
  displayOrder: number;
}

export function useUpdateProjectSections() {
  return useProjectTabMutation((vars: { id: number; entries: ProjectSectionEntryInput[] }) =>
    mutate<ProjectAdminRow>(`${BASE_PATH}/${vars.id}/sections`, {
      method: 'PATCH',
      body: vars.entries,
    }),
  );
}

// --- Security assessments / tests / findings (nested under a project, but
// addressed by their OWN id past creation — `assessments.routes.ts`'s own
// comment) -------------------------------------------------------------
//
// `z.input` of each shared schema, not the exported `*Input` (`z.infer`,
// i.e. `z.output`) types — those datetime fields are `isoDatetimeAsDate`
// (string in, `Date` out), and `ProjectAssessmentEditor.tsx` sends the
// plain ISO string `parseOptionalDatetimeLocal` produces, matching the
// server's own wire format directly (same reasoning as every other
// `formSchema.ts`'s wire-payload type in this module, just without a
// react-hook-form resolver in between here).

type AssessmentCreatePayload = z.input<typeof securityAssessmentCreateSchema>;
type AssessmentUpdatePayload = z.input<typeof securityAssessmentUpdateSchema>;
type AssessmentTestsPayload = z.input<typeof securityAssessmentTestsUpsertSchema>;
type FindingCreatePayload = z.input<typeof securityFindingCreateSchema>;
type FindingUpdatePayload = z.input<typeof securityFindingUpdateSchema>;

export function useCreateAssessment() {
  return useProjectTabMutation((vars: { id: number; data: AssessmentCreatePayload }) =>
    mutate<SecurityAssessmentRow>(`${BASE_PATH}/${vars.id}/assessments`, {
      method: 'POST',
      body: vars.data,
    }),
  );
}

/** `projectId` is carried alongside the assessment's own id purely so `useProjectTabMutation` knows which project's cache to invalidate — `PATCH /admin/assessments/:id` itself only ever addresses the assessment. */
export function useUpdateAssessment() {
  return useProjectTabMutation(
    (vars: { id: number; assessmentId: number; data: AssessmentUpdatePayload }) =>
      mutate<SecurityAssessmentRow>(`/api/v1/admin/assessments/${vars.assessmentId}`, {
        method: 'PATCH',
        body: vars.data,
      }),
  );
}

export function useRemoveAssessment() {
  return useProjectTabMutation((vars: { id: number; assessmentId: number }) =>
    mutate<{ deleted: boolean }>(`/api/v1/admin/assessments/${vars.assessmentId}`, {
      method: 'DELETE',
    }),
  );
}

export function useUpsertAssessmentTests() {
  return useProjectTabMutation(
    (vars: { id: number; assessmentId: number; tests: AssessmentTestsPayload }) =>
      mutate<SecurityAssessmentRow>(`/api/v1/admin/assessments/${vars.assessmentId}/tests`, {
        method: 'PUT',
        body: vars.tests,
      }),
  );
}

export function useCreateFinding() {
  return useProjectTabMutation(
    (vars: { id: number; assessmentId: number; data: FindingCreatePayload }) =>
      mutate<SecurityFindingRow>(`/api/v1/admin/assessments/${vars.assessmentId}/findings`, {
        method: 'POST',
        body: vars.data,
      }),
  );
}

export function useUpdateFinding() {
  return useProjectTabMutation(
    (vars: { id: number; findingId: number; data: FindingUpdatePayload }) =>
      mutate<SecurityFindingRow>(`/api/v1/admin/findings/${vars.findingId}`, {
        method: 'PATCH',
        body: vars.data,
      }),
  );
}

export function useRemoveFinding() {
  return useProjectTabMutation((vars: { id: number; findingId: number }) =>
    mutate<{ deleted: boolean }>(`/api/v1/admin/findings/${vars.findingId}`, { method: 'DELETE' }),
  );
}
