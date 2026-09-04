'use client';

import {
  ASSESSMENT_STATUSES,
  ASSESSMENT_TEST_RESULTS,
  ASSESSMENT_TEST_TYPES,
  FINDING_SEVERITIES,
  FINDING_STATUSES,
} from '@portfolio/shared';
import type {
  SecurityAssessmentRow,
  SecurityAssessmentTestsUpsertInput,
  SecurityFindingRow,
} from '@portfolio/shared';
import { useState } from 'react';
import { useToast } from '@/features/admin/components/ToastProvider';
import {
  toDatetimeLocalInputValue,
  parseOptionalDatetimeLocal,
} from '@/features/admin/lib/formValues';
import {
  useCreateFinding,
  useRemoveAssessment,
  useRemoveFinding,
  useUpdateAssessment,
  useUpdateFinding,
  useUpsertAssessmentTests,
} from './client';

/**
 * A single assessment's full management surface — fields, the 15-test
 * checklist, and findings — deliberately plain controlled state, not
 * react-hook-form + zod: this is a deeply nested, one-off editor (unlike
 * the primary resource forms), and standing up a whole
 * schema/override/wire-payload trio here (`formSchema.ts`'s own pattern)
 * for four datetime fields across two small nested entities would cost
 * more than it returns. `toDatetimeLocalInputValue`/`parseOptionalDatetimeLocal`
 * (`formValues.ts`) are reused directly since they're plain functions,
 * not tied to a resolver.
 */

interface AssessmentDraft {
  title: string;
  scope: string;
  methodology: string;
  summary: string;
  status: string;
  isPublic: boolean;
  assessedAt: string;
  retestedAt: string;
}

function toAssessmentDraft(row: SecurityAssessmentRow): AssessmentDraft {
  return {
    title: row.title,
    scope: row.scope ?? '',
    methodology: row.methodology ?? '',
    summary: row.summary ?? '',
    status: row.status,
    isPublic: row.isPublic,
    assessedAt: toDatetimeLocalInputValue(row.assessedAt),
    retestedAt: toDatetimeLocalInputValue(row.retestedAt),
  };
}

interface FindingDraft {
  title: string;
  severity: string;
  description: string;
  impact: string;
  affectedComponent: string;
  remediation: string;
  status: string;
  cweId: string;
  isPublic: boolean;
  discoveredAt: string;
  resolvedAt: string;
}

const EMPTY_FINDING_DRAFT: FindingDraft = {
  title: '',
  severity: 'MEDIUM',
  description: '',
  impact: '',
  affectedComponent: '',
  remediation: '',
  status: 'OPEN',
  cweId: '',
  isPublic: false,
  discoveredAt: '',
  resolvedAt: '',
};

function toFindingDraft(row: SecurityFindingRow): FindingDraft {
  return {
    title: row.title,
    severity: row.severity,
    description: row.description ?? '',
    impact: row.impact ?? '',
    affectedComponent: row.affectedComponent ?? '',
    remediation: row.remediation ?? '',
    status: row.status,
    cweId: row.cweId ?? '',
    isPublic: row.isPublic,
    discoveredAt: toDatetimeLocalInputValue(row.discoveredAt),
    resolvedAt: toDatetimeLocalInputValue(row.resolvedAt),
  };
}

function findingPayload(draft: FindingDraft) {
  return {
    title: draft.title,
    severity: draft.severity as (typeof FINDING_SEVERITIES)[number],
    description: draft.description || undefined,
    impact: draft.impact || undefined,
    affectedComponent: draft.affectedComponent || undefined,
    remediation: draft.remediation || undefined,
    status: draft.status as (typeof FINDING_STATUSES)[number],
    cweId: draft.cweId || undefined,
    isPublic: draft.isPublic,
    discoveredAt: parseOptionalDatetimeLocal(draft.discoveredAt),
    resolvedAt: parseOptionalDatetimeLocal(draft.resolvedAt),
  };
}

function FindingRow({
  projectId,
  finding,
}: {
  projectId: number;
  finding: SecurityFindingRow;
}): React.JSX.Element {
  const { show } = useToast();
  const [draft, setDraft] = useState<FindingDraft>(() => toFindingDraft(finding));
  const [editing, setEditing] = useState(false);
  const updateFinding = useUpdateFinding();
  const removeFinding = useRemoveFinding();

  function handleSave(): void {
    updateFinding.mutate(
      { id: projectId, findingId: finding.id, data: findingPayload(draft) },
      {
        onSuccess: () => {
          show({ message: 'Finding updated.', variant: 'success' });
          setEditing(false);
        },
        onError: () => show({ message: 'Couldn’t update this finding.', variant: 'danger' }),
      },
    );
  }

  function handleRemove(): void {
    removeFinding.mutate(
      { id: projectId, findingId: finding.id },
      {
        onSuccess: () => show({ message: 'Finding removed.', variant: 'success' }),
        onError: () => show({ message: 'Couldn’t remove this finding.', variant: 'danger' }),
      },
    );
  }

  if (!editing) {
    return (
      <li className="list-group-item d-flex justify-content-between align-items-start gap-2">
        <div>
          <strong>{finding.title}</strong>{' '}
          <span className="badge text-bg-secondary">{finding.severity}</span>{' '}
          <span className="badge text-bg-light text-body">{finding.status}</span>
          {finding.isPublic && <span className="badge text-bg-info ms-1">Public</span>}
        </div>
        <div className="d-flex gap-2">
          <button
            type="button"
            className="btn btn-sm btn-outline-secondary"
            onClick={() => setEditing(true)}
          >
            Edit
          </button>
          <button type="button" className="btn btn-sm btn-outline-danger" onClick={handleRemove}>
            Remove
          </button>
        </div>
      </li>
    );
  }

  return (
    <li className="list-group-item">
      <div className="row g-2">
        <div className="col-sm-6">
          <input
            className="form-control form-control-sm"
            placeholder="Title"
            value={draft.title}
            onChange={(e) => setDraft({ ...draft, title: e.target.value })}
          />
        </div>
        <div className="col-sm-3">
          <select
            className="form-select form-select-sm"
            value={draft.severity}
            onChange={(e) => setDraft({ ...draft, severity: e.target.value })}
          >
            {FINDING_SEVERITIES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>
        <div className="col-sm-3">
          <select
            className="form-select form-select-sm"
            value={draft.status}
            onChange={(e) => setDraft({ ...draft, status: e.target.value })}
          >
            {FINDING_STATUSES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>
        <div className="col-12">
          <textarea
            className="form-control form-control-sm"
            placeholder="Description"
            rows={2}
            value={draft.description}
            onChange={(e) => setDraft({ ...draft, description: e.target.value })}
          />
        </div>
        <div className="col-sm-6">
          <input
            className="form-control form-control-sm"
            placeholder="Impact"
            value={draft.impact}
            onChange={(e) => setDraft({ ...draft, impact: e.target.value })}
          />
        </div>
        <div className="col-sm-6">
          <input
            className="form-control form-control-sm"
            placeholder="Affected component"
            value={draft.affectedComponent}
            onChange={(e) => setDraft({ ...draft, affectedComponent: e.target.value })}
          />
        </div>
        <div className="col-12">
          <textarea
            className="form-control form-control-sm"
            placeholder="Remediation"
            rows={2}
            value={draft.remediation}
            onChange={(e) => setDraft({ ...draft, remediation: e.target.value })}
          />
        </div>
        <div className="col-sm-3">
          <input
            className="form-control form-control-sm"
            placeholder="CWE id"
            value={draft.cweId}
            onChange={(e) => setDraft({ ...draft, cweId: e.target.value })}
          />
        </div>
        <div className="col-sm-4">
          <label className="form-label form-label-sm mb-0 small">Discovered</label>
          <input
            type="datetime-local"
            className="form-control form-control-sm"
            value={draft.discoveredAt}
            onChange={(e) => setDraft({ ...draft, discoveredAt: e.target.value })}
          />
        </div>
        <div className="col-sm-4">
          <label className="form-label form-label-sm mb-0 small">Resolved</label>
          <input
            type="datetime-local"
            className="form-control form-control-sm"
            value={draft.resolvedAt}
            onChange={(e) => setDraft({ ...draft, resolvedAt: e.target.value })}
          />
        </div>
        <div className="col-sm-1 d-flex align-items-end">
          <div className="form-check">
            <input
              type="checkbox"
              className="form-check-input"
              id={`finding-public-${finding.id}`}
              checked={draft.isPublic}
              onChange={(e) => setDraft({ ...draft, isPublic: e.target.checked })}
            />
            <label className="form-check-label small" htmlFor={`finding-public-${finding.id}`}>
              Public
            </label>
          </div>
        </div>
      </div>
      <div className="mt-2 d-flex gap-2">
        <button
          type="button"
          className="btn btn-sm btn-primary"
          onClick={handleSave}
          disabled={updateFinding.isPending}
        >
          Save finding
        </button>
        <button
          type="button"
          className="btn btn-sm btn-outline-secondary"
          onClick={() => setEditing(false)}
        >
          Cancel
        </button>
      </div>
    </li>
  );
}

export function ProjectAssessmentEditor({
  projectId,
  assessment,
}: {
  projectId: number;
  assessment: SecurityAssessmentRow;
}): React.JSX.Element {
  const { show } = useToast();
  const [draft, setDraft] = useState<AssessmentDraft>(() => toAssessmentDraft(assessment));
  const [testResults, setTestResults] = useState<Record<string, { result: string; notes: string }>>(
    () =>
      Object.fromEntries(
        ASSESSMENT_TEST_TYPES.map((type) => {
          const existing = assessment.tests.find((t) => t.testType === type);
          return [type, { result: existing?.result ?? 'NOT_TESTED', notes: existing?.notes ?? '' }];
        }),
      ),
  );
  const [newFinding, setNewFinding] = useState<FindingDraft>(EMPTY_FINDING_DRAFT);

  const updateAssessment = useUpdateAssessment();
  const removeAssessment = useRemoveAssessment();
  const upsertTests = useUpsertAssessmentTests();
  const createFinding = useCreateFinding();

  function handleSaveAssessment(): void {
    updateAssessment.mutate(
      {
        id: projectId,
        assessmentId: assessment.id,
        data: {
          title: draft.title,
          scope: draft.scope || undefined,
          methodology: draft.methodology || undefined,
          summary: draft.summary || undefined,
          status: draft.status as (typeof ASSESSMENT_STATUSES)[number],
          isPublic: draft.isPublic,
          assessedAt: parseOptionalDatetimeLocal(draft.assessedAt),
          retestedAt: parseOptionalDatetimeLocal(draft.retestedAt),
        },
      },
      {
        onSuccess: () => show({ message: 'Assessment saved.', variant: 'success' }),
        onError: () => show({ message: 'Couldn’t save this assessment.', variant: 'danger' }),
      },
    );
  }

  function handleDeleteAssessment(): void {
    removeAssessment.mutate(
      { id: projectId, assessmentId: assessment.id },
      {
        onSuccess: () => show({ message: 'Assessment deleted.', variant: 'success' }),
        onError: () => show({ message: 'Couldn’t delete this assessment.', variant: 'danger' }),
      },
    );
  }

  function handleSaveTests(): void {
    const payload: SecurityAssessmentTestsUpsertInput = ASSESSMENT_TEST_TYPES.map(
      (type, index) => ({
        testType: type,
        result: testResults[type]?.result as (typeof ASSESSMENT_TEST_RESULTS)[number],
        notes: testResults[type]?.notes || undefined,
        displayOrder: index,
      }),
    );
    upsertTests.mutate(
      { id: projectId, assessmentId: assessment.id, tests: payload },
      {
        onSuccess: () => show({ message: 'Tests checklist saved.', variant: 'success' }),
        onError: () => show({ message: 'Couldn’t save the tests checklist.', variant: 'danger' }),
      },
    );
  }

  function handleCreateFinding(): void {
    if (!newFinding.title.trim()) {
      show({ message: 'A finding needs a title.', variant: 'danger' });
      return;
    }
    createFinding.mutate(
      { id: projectId, assessmentId: assessment.id, data: findingPayload(newFinding) },
      {
        onSuccess: () => {
          show({ message: 'Finding added.', variant: 'success' });
          setNewFinding(EMPTY_FINDING_DRAFT);
        },
        onError: () => show({ message: 'Couldn’t add this finding.', variant: 'danger' }),
      },
    );
  }

  return (
    <div className="admin-assessment-editor border rounded p-3 mt-2">
      <div className="row g-2 mb-2">
        <div className="col-sm-6">
          <label className="form-label form-label-sm mb-0 small">Title</label>
          <input
            className="form-control form-control-sm"
            value={draft.title}
            onChange={(e) => setDraft({ ...draft, title: e.target.value })}
          />
        </div>
        <div className="col-sm-3">
          <label className="form-label form-label-sm mb-0 small">Status</label>
          <select
            className="form-select form-select-sm"
            value={draft.status}
            onChange={(e) => setDraft({ ...draft, status: e.target.value })}
          >
            {ASSESSMENT_STATUSES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>
        <div className="col-sm-3 d-flex align-items-end">
          <div className="form-check">
            <input
              type="checkbox"
              className="form-check-input"
              id={`assessment-public-${assessment.id}`}
              checked={draft.isPublic}
              onChange={(e) => setDraft({ ...draft, isPublic: e.target.checked })}
            />
            <label
              className="form-check-label small"
              htmlFor={`assessment-public-${assessment.id}`}
            >
              Public
            </label>
          </div>
        </div>
        <div className="col-12">
          <textarea
            className="form-control form-control-sm"
            placeholder="Scope"
            rows={2}
            value={draft.scope}
            onChange={(e) => setDraft({ ...draft, scope: e.target.value })}
          />
        </div>
        <div className="col-12">
          <textarea
            className="form-control form-control-sm"
            placeholder="Methodology"
            rows={2}
            value={draft.methodology}
            onChange={(e) => setDraft({ ...draft, methodology: e.target.value })}
          />
        </div>
        <div className="col-12">
          <textarea
            className="form-control form-control-sm"
            placeholder="Summary"
            rows={2}
            value={draft.summary}
            onChange={(e) => setDraft({ ...draft, summary: e.target.value })}
          />
        </div>
        <div className="col-sm-6">
          <label className="form-label form-label-sm mb-0 small">Assessed at</label>
          <input
            type="datetime-local"
            className="form-control form-control-sm"
            value={draft.assessedAt}
            onChange={(e) => setDraft({ ...draft, assessedAt: e.target.value })}
          />
        </div>
        <div className="col-sm-6">
          <label className="form-label form-label-sm mb-0 small">Retested at</label>
          <input
            type="datetime-local"
            className="form-control form-control-sm"
            value={draft.retestedAt}
            onChange={(e) => setDraft({ ...draft, retestedAt: e.target.value })}
          />
        </div>
      </div>
      <div className="d-flex gap-2 mb-3">
        <button
          type="button"
          className="btn btn-sm btn-primary"
          onClick={handleSaveAssessment}
          disabled={updateAssessment.isPending}
        >
          Save assessment
        </button>
        <button
          type="button"
          className="btn btn-sm btn-outline-danger"
          onClick={handleDeleteAssessment}
          disabled={removeAssessment.isPending}
        >
          Delete assessment
        </button>
      </div>

      <h3 className="h6">Tests checklist</h3>
      <div className="table-responsive mb-3">
        <table className="table table-sm">
          <thead>
            <tr>
              <th scope="col">Test</th>
              <th scope="col">Result</th>
              <th scope="col">Notes</th>
            </tr>
          </thead>
          <tbody>
            {ASSESSMENT_TEST_TYPES.map((type) => (
              <tr key={type}>
                <td>{type.replaceAll('_', ' ')}</td>
                <td style={{ minWidth: '10rem' }}>
                  <select
                    className="form-select form-select-sm"
                    value={testResults[type]?.result ?? 'NOT_TESTED'}
                    onChange={(e) =>
                      setTestResults((current) => ({
                        ...current,
                        [type]: {
                          ...current[type],
                          result: e.target.value,
                          notes: current[type]?.notes ?? '',
                        },
                      }))
                    }
                  >
                    {ASSESSMENT_TEST_RESULTS.map((result) => (
                      <option key={result} value={result}>
                        {result.replaceAll('_', ' ')}
                      </option>
                    ))}
                  </select>
                </td>
                <td>
                  <input
                    className="form-control form-control-sm"
                    value={testResults[type]?.notes ?? ''}
                    onChange={(e) =>
                      setTestResults((current) => ({
                        ...current,
                        [type]: {
                          result: current[type]?.result ?? 'NOT_TESTED',
                          notes: e.target.value,
                        },
                      }))
                    }
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <button
        type="button"
        className="btn btn-sm btn-primary mb-3"
        onClick={handleSaveTests}
        disabled={upsertTests.isPending}
      >
        Save tests checklist
      </button>

      <h3 className="h6">Findings</h3>
      {assessment.findings.length === 0 ? (
        <p className="text-body-secondary small">No findings recorded.</p>
      ) : (
        <ul className="list-group mb-3">
          {assessment.findings.map((finding) => (
            <FindingRow key={finding.id} projectId={projectId} finding={finding} />
          ))}
        </ul>
      )}

      <div className="border rounded p-2">
        <h4 className="h6 small text-uppercase text-body-secondary">New finding</h4>
        <div className="row g-2">
          <div className="col-sm-6">
            <input
              className="form-control form-control-sm"
              placeholder="Title"
              value={newFinding.title}
              onChange={(e) => setNewFinding({ ...newFinding, title: e.target.value })}
            />
          </div>
          <div className="col-sm-3">
            <select
              className="form-select form-select-sm"
              value={newFinding.severity}
              onChange={(e) => setNewFinding({ ...newFinding, severity: e.target.value })}
            >
              {FINDING_SEVERITIES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>
          <div className="col-sm-3">
            <button
              type="button"
              className="btn btn-sm btn-outline-secondary w-100"
              onClick={handleCreateFinding}
              disabled={createFinding.isPending}
            >
              Add finding
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
