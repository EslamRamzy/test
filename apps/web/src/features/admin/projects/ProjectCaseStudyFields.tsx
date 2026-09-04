'use client';

import { useFormContext } from 'react-hook-form';
import type { ProjectFormValues } from './formSchema';

/**
 * The seven D5 "hybrid case-study body" columns (doc02's own comment,
 * `schema.prisma`) — plain textareas, not `<MarkdownEditor>`: that
 * component's split live-preview pane earns its keep for the ONE long-form
 * content field a resource has (Articles/Security Research); seven of them
 * stacked on one tab would be mostly wasted vertical space for content
 * that's already rendered through the same sanitising pipeline wherever it
 * appears publicly. Order and visibility of these sections is a SEPARATE
 * concern — see `ProjectSectionsManager`, saved through its own
 * `PATCH .../sections` endpoint, not this form.
 */
const CASE_STUDY_FIELDS = [
  { name: 'problem', label: 'The Problem' },
  { name: 'solution', label: 'The Solution' },
  { name: 'architecture', label: 'Architecture' },
  { name: 'challenges', label: 'Challenges' },
  { name: 'solutionsDetail', label: 'How It Was Solved' },
  { name: 'lessonsLearned', label: 'Lessons Learned' },
  { name: 'deploymentNotes', label: 'Deployment Notes' },
] as const;

export function ProjectCaseStudyFields(): React.JSX.Element {
  const { register } = useFormContext<ProjectFormValues>();

  return (
    <>
      {CASE_STUDY_FIELDS.map(({ name, label }) => (
        <div className="mb-3" key={name}>
          <label htmlFor={`field-${name}`} className="form-label">
            {label}
          </label>
          <textarea id={`field-${name}`} className="form-control" rows={5} {...register(name)} />
        </div>
      ))}
    </>
  );
}
