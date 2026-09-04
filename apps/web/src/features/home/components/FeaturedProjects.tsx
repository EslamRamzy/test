import type { ProjectListItemDto } from '@portfolio/shared';
import Link from 'next/link';
import { ProjectCard } from '@/features/projects/components/ProjectCard';

export function FeaturedProjects({
  projects,
}: {
  projects: ProjectListItemDto[];
}): React.JSX.Element | null {
  if (projects.length === 0) return null;

  return (
    <section className="py-5 border-bottom">
      <div className="container">
        <div className="d-flex justify-content-between align-items-center mb-4">
          <h2 className="h3 mb-0">Featured Projects</h2>
          <Link href="/projects" className="link-primary">
            View all <span className="bi bi-arrow-right" aria-hidden="true" />
          </Link>
        </div>
        <div className="row g-4">
          {projects.map((project) => (
            <div className="col-md-6 col-lg-4" key={project.id}>
              <ProjectCard project={project} />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
