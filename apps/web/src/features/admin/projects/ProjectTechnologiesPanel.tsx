'use client';

import type { ProjectAdminRow } from '@portfolio/shared';
import { useEffect, useState } from 'react';
import { useToast } from '@/features/admin/components/ToastProvider';
import { technologiesHooks } from '@/features/admin/technologies/client';
import { useSetProjectTechnologies } from './client';

/** `PUT /admin/projects/:id/technologies` (doc07 §3's own tab) — the whole assignment set, its own mutation entirely separate from the main form's `PATCH /:id` (`project.ts`'s own schema doc). */
export function ProjectTechnologiesPanel({
  project,
}: {
  project: ProjectAdminRow;
}): React.JSX.Element {
  const { show } = useToast();
  const technologiesQuery = technologiesHooks.useList({ page: 1, pageSize: 50 });
  const technologies = technologiesQuery.data?.items ?? [];
  const [selected, setSelected] = useState<number[]>(() =>
    project.technologies.map((entry) => entry.technologyId),
  );
  const setTechnologiesMutation = useSetProjectTechnologies();

  useEffect(() => {
    setSelected(project.technologies.map((entry) => entry.technologyId));
  }, [project]);

  function toggle(id: number): void {
    setSelected((current) =>
      current.includes(id) ? current.filter((entry) => entry !== id) : [...current, id],
    );
  }

  function handleSave(): void {
    setTechnologiesMutation.mutate(
      { id: project.id, technologyIds: selected },
      {
        onSuccess: () => show({ message: 'Technologies saved.', variant: 'success' }),
        onError: () => show({ message: 'Couldn’t save technologies.', variant: 'danger' }),
      },
    );
  }

  return (
    <div>
      <h2 className="h6 text-uppercase text-body-secondary mb-3">Technologies used</h2>
      {technologies.length === 0 ? (
        <p className="text-body-secondary">
          No technologies yet — add some under Technologies first.
        </p>
      ) : (
        <div className="d-flex flex-wrap gap-3 mb-3">
          {technologies.map((technology) => (
            <div className="form-check" key={technology.id}>
              <input
                type="checkbox"
                className="form-check-input"
                id={`project-technology-${technology.id}`}
                checked={selected.includes(technology.id)}
                onChange={() => toggle(technology.id)}
              />
              <label className="form-check-label" htmlFor={`project-technology-${technology.id}`}>
                {technology.name}
              </label>
            </div>
          ))}
        </div>
      )}
      <button
        type="button"
        className="btn btn-primary"
        onClick={handleSave}
        disabled={setTechnologiesMutation.isPending}
      >
        {setTechnologiesMutation.isPending ? 'Saving…' : 'Save technologies'}
      </button>
    </div>
  );
}
