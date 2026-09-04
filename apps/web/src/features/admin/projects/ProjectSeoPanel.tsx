'use client';

import type { ProjectAdminRow } from '@portfolio/shared';

/**
 * Read-only preview, not an editable form — `Project` has no dedicated
 * meta-title/meta-description columns (confirmed against `schema.prisma`);
 * the public site's own SEO for a project derives from `title`,
 * `shortDescription`, and `coverMedia`. Rendering those as a preview here
 * is honest about what actually drives SEO today rather than inventing
 * fields the schema doesn't have (doc07 §6: "No fake data").
 */
export function ProjectSeoPanel({ project }: { project: ProjectAdminRow }): React.JSX.Element {
  return (
    <div>
      <h2 className="h6 text-uppercase text-body-secondary mb-3">SEO preview</h2>
      <p className="text-body-secondary">
        No dedicated SEO fields exist for projects — the public site derives these from the Overview
        tab's own fields. Edit title, short description, or cover media there to change what appears
        below.
      </p>
      <dl className="row">
        <dt className="col-sm-3">Page title</dt>
        <dd className="col-sm-9">{project.title}</dd>
        <dt className="col-sm-3">Meta description</dt>
        <dd className="col-sm-9">{project.shortDescription}</dd>
        <dt className="col-sm-3">Canonical URL</dt>
        <dd className="col-sm-9">
          <code>/projects/{project.slug}</code>
        </dd>
        <dt className="col-sm-3">OG image</dt>
        <dd className="col-sm-9">
          {project.coverMediaId ? `Media #${project.coverMediaId}` : 'None set'}
        </dd>
      </dl>
    </div>
  );
}
