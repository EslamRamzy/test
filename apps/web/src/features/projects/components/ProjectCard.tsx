import type { ProjectListItemDto } from '@portfolio/shared';
import Link from 'next/link';
import { PublicMediaImage } from '@/components/ui/PublicMediaImage';

interface ProjectCardProps {
  project: ProjectListItemDto;
  /**
   * The list pages (`/projects`) put this card directly under the page's
   * own `<h1>` with no `<h2>` in between, so the card title needs to BE
   * the `<h2>` there — everywhere else (homepage sections, "Related
   * Projects") already has an `<h2>` section heading right above the grid,
   * so `h3` (the default) is correct. A real axe/Lighthouse run caught the
   * `/projects` list page skipping straight from `h1` to `h3`.
   */
  headingLevel?: 'h2' | 'h3' | undefined;
}

export function ProjectCard({ project, headingLevel = 'h3' }: ProjectCardProps): React.JSX.Element {
  const Heading = headingLevel;
  return (
    <Link
      href={`/projects/${project.slug}`}
      className="card project-card h-100 text-decoration-none text-reset"
      data-cursor="View"
    >
      {project.coverMedia && (
        <div className="ratio ratio-16x9 project-card__media">
          <PublicMediaImage
            media={project.coverMedia}
            fill
            sizes="(max-width: 768px) 100vw, 33vw"
            className="card-img-top object-fit-cover project-card__img"
          />
        </div>
      )}
      <div className="card-body d-flex flex-column">
        <div className="d-flex align-items-center gap-2 mb-2">
          <Heading className="h5 mb-0 project-card__title">{project.title}</Heading>
          {project.securityTested && (
            <span className="badge text-bg-success" title="Security tested">
              <span className="bi bi-shield-check" aria-hidden="true" />
            </span>
          )}
          <span className="bi bi-arrow-up-right project-card__arrow ms-auto" aria-hidden="true" />
        </div>
        <p className="mb-3 flex-grow-1" style={{ color: 'var(--color-text-muted)' }}>
          {project.shortDescription}
        </p>
        {project.technologies.length > 0 && (
          <ul className="list-unstyled d-flex flex-wrap gap-2 mb-0">
            {project.technologies.slice(0, 4).map((technology) => (
              <li key={technology.id} className="badge text-bg-secondary fw-normal">
                {technology.name}
              </li>
            ))}
          </ul>
        )}
      </div>
    </Link>
  );
}
