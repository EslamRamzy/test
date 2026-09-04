import type { ProjectListItemDto } from '@portfolio/shared';
import Link from 'next/link';
import { PublicMediaImage } from '@/components/ui/PublicMediaImage';
import { ProjectCard } from '@/features/projects/components/ProjectCard';

/**
 * One large featured project, then a smaller grid (design concept §13) —
 * `home.featuredProjects` is already the admin's `featured: true` set
 * (docs/architecture, `homeService.ts`), ordered newest first; the first
 * entry gets the large treatment, the rest reuse the plain grid card.
 */
export function FeaturedProjects({
  projects,
}: {
  projects: ProjectListItemDto[];
}): React.JSX.Element | null {
  if (projects.length === 0) return null;

  const [lead, ...rest] = projects;

  return (
    <section className="projects-preview">
      <div className="container">
        <div className="d-flex justify-content-between align-items-center">
          <h2 className="section-heading mb-0">Featured Projects</h2>
          <Link href="/projects" className="section-link">
            View all
            <span className="bi bi-arrow-right ms-2" aria-hidden="true" />
          </Link>
        </div>

        {lead && (
          <Link href={`/projects/${lead.slug}`} className="project-lead" data-cursor="View">
            <div className="project-lead__media">
              {lead.coverMedia ? (
                <PublicMediaImage
                  media={lead.coverMedia}
                  fill
                  sizes="(max-width: 992px) 100vw, 60vw"
                  className="project-lead__img"
                />
              ) : (
                <div className="project-lead__placeholder" aria-hidden="true" />
              )}
            </div>
            <div className="project-lead__body">
              <div className="d-flex align-items-center gap-2 flex-wrap">
                <span className="project-lead__tag">Featured</span>
                {lead.securityTested && (
                  <span className="project-lead__tag project-lead__tag--security">
                    <span className="bi bi-shield-check me-1" aria-hidden="true" />
                    Security Tested
                  </span>
                )}
              </div>
              <h3 className="project-lead__title">{lead.title}</h3>
              <p className="project-lead__desc">{lead.shortDescription}</p>
              {lead.technologies.length > 0 && (
                <ul className="list-unstyled d-flex flex-wrap gap-2 mb-0">
                  {lead.technologies.slice(0, 5).map((tech) => (
                    <li key={tech.id} className="badge text-bg-secondary fw-normal">
                      {tech.name}
                    </li>
                  ))}
                </ul>
              )}
              <span className="project-lead__cta">
                View Case Study
                <span className="bi bi-arrow-up-right ms-2" aria-hidden="true" />
              </span>
            </div>
          </Link>
        )}

        {rest.length > 0 && (
          <div className="row g-4 mt-1">
            {rest.map((project) => (
              <div className="col-md-6 col-lg-4" key={project.id}>
                <ProjectCard project={project} />
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
