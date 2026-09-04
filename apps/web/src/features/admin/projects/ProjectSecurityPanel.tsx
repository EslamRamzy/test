'use client';

import type { ProjectAdminRow } from '@portfolio/shared';
import { useState } from 'react';
import { useFormContext } from 'react-hook-form';
import { useToast } from '@/features/admin/components/ToastProvider';
import { useCreateAssessment } from './client';
import { ProjectAssessmentEditor } from './ProjectAssessmentEditor';
import type { ProjectFormValues } from './formSchema';

/**
 * `securityTested`/`securitySummary`/`testingSummary` are part of the MAIN
 * form (same `<FormProvider>` this panel renders under, doc07 §3's own
 * grouping of them under "Security" is a tab, not a different mutation) —
 * everything below them (assessments, the 15-test checklist, findings) is
 * a separate nested-resource tree with its own endpoints entirely, per
 * `ProjectAssessmentEditor`'s own doc.
 */
export function ProjectSecurityPanel({ project }: { project: ProjectAdminRow }): React.JSX.Element {
  const { show } = useToast();
  const { register } = useFormContext<ProjectFormValues>();
  const [newTitle, setNewTitle] = useState('');
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const createAssessment = useCreateAssessment();

  function handleCreate(): void {
    if (!newTitle.trim()) {
      show({ message: 'An assessment needs a title.', variant: 'danger' });
      return;
    }
    createAssessment.mutate(
      { id: project.id, data: { title: newTitle.trim() } },
      {
        onSuccess: () => {
          show({ message: 'Assessment created.', variant: 'success' });
          setNewTitle('');
        },
        onError: () => show({ message: 'Couldn’t create this assessment.', variant: 'danger' }),
      },
    );
  }

  return (
    <>
      <div className="form-check form-switch mb-3">
        <input
          type="checkbox"
          className="form-check-input"
          id="field-securityTested"
          {...register('securityTested')}
        />
        <label className="form-check-label" htmlFor="field-securityTested">
          Security tested
        </label>
      </div>

      <div className="mb-3">
        <label htmlFor="field-securitySummary" className="form-label">
          Security summary
        </label>
        <textarea
          id="field-securitySummary"
          className="form-control"
          rows={3}
          {...register('securitySummary')}
        />
      </div>

      <div className="mb-4">
        <label htmlFor="field-testingSummary" className="form-label">
          Testing summary
        </label>
        <textarea
          id="field-testingSummary"
          className="form-control"
          rows={3}
          {...register('testingSummary')}
        />
      </div>

      <h2 className="h6 text-uppercase text-body-secondary mb-3">Security assessments</h2>
      {project.assessments.length === 0 ? (
        <p className="text-body-secondary">No assessments yet.</p>
      ) : (
        <ul className="list-group mb-3">
          {project.assessments.map((assessment) => (
            <li className="list-group-item" key={assessment.id}>
              <div className="d-flex justify-content-between align-items-center">
                <div>
                  <strong>{assessment.title}</strong>{' '}
                  <span className="badge text-bg-secondary">{assessment.status}</span>{' '}
                  <span className="text-body-secondary small">
                    {assessment.findings.length} finding
                    {assessment.findings.length === 1 ? '' : 's'}
                  </span>
                </div>
                <button
                  type="button"
                  className="btn btn-sm btn-outline-secondary"
                  onClick={() => setExpandedId(expandedId === assessment.id ? null : assessment.id)}
                >
                  {expandedId === assessment.id ? 'Collapse' : 'Manage'}
                </button>
              </div>
              {expandedId === assessment.id && (
                <ProjectAssessmentEditor projectId={project.id} assessment={assessment} />
              )}
            </li>
          ))}
        </ul>
      )}

      <div className="input-group" style={{ maxWidth: '28rem' }}>
        <input
          className="form-control"
          placeholder="New assessment title"
          value={newTitle}
          onChange={(event) => setNewTitle(event.target.value)}
          aria-label="New assessment title"
        />
        <button type="button" className="btn btn-outline-secondary" onClick={handleCreate}>
          <span className="bi bi-plus-lg" aria-hidden="true" /> New assessment
        </button>
      </div>
    </>
  );
}
