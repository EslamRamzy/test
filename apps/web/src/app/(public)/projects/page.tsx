import type { Metadata } from 'next';
import Link from 'next/link';
import { listProjects, listTechnologies } from '@/lib/api/endpoints';
import { getPublicSiteUrl } from '@/lib/config';
import { AnalyticsBeacon } from '@/features/analytics/AnalyticsBeacon';
import { ProjectCard } from '@/features/projects/components/ProjectCard';
import { Pagination } from '@/components/ui/Pagination';

export const metadata: Metadata = {
  title: 'Projects',
  description: 'A selection of projects, filterable by category and technology.',
  alternates: { canonical: `${getPublicSiteUrl()}/projects` },
};

const PROJECT_CATEGORIES = [
  'WEB_APP',
  'API',
  'SECURITY_TOOL',
  'LIBRARY',
  'CLI',
  'MOBILE',
  'OTHER',
] as const;
const CATEGORY_LABELS: Record<(typeof PROJECT_CATEGORIES)[number], string> = {
  WEB_APP: 'Web App',
  API: 'API',
  SECURITY_TOOL: 'Security Tool',
  LIBRARY: 'Library',
  CLI: 'CLI',
  MOBILE: 'Mobile',
  OTHER: 'Other',
};

interface ProjectsPageProps {
  searchParams: Promise<Record<string, string | undefined>>;
}

/**
 * Filtering is URL state (`?category=&technology=&page=`), not React state
 * (docs/architecture/06 §1) — shareable, back-button correct, crawlable,
 * and it keeps this a Server Component with no client-side data store.
 */
export default async function ProjectsPage({ searchParams }: ProjectsPageProps) {
  const params = await searchParams;
  const page = Number(params.page ?? '1') || 1;
  const category = params.category;
  const technology = params.technology;

  const [{ items: projects, meta }, technologies] = await Promise.all([
    listProjects({ page, category, technology }),
    listTechnologies(),
  ]);

  function buildHref(overrides: Record<string, string | undefined>): string {
    const next = new URLSearchParams();
    const merged = { category, technology, ...overrides };
    for (const [key, value] of Object.entries(merged)) {
      if (value) next.set(key, value);
    }
    const query = next.toString();
    return query ? `/projects?${query}` : '/projects';
  }

  return (
    <div className="container py-5">
      <AnalyticsBeacon entityType="PAGE" />
      <h1 className="h2 mb-4">Projects</h1>

      <div className="d-flex flex-wrap gap-2 mb-4" role="group" aria-label="Filter by category">
        <Link
          href={buildHref({ category: undefined, page: undefined })}
          className={`btn btn-sm ${!category ? 'btn-primary' : 'btn-outline-secondary'}`}
        >
          All
        </Link>
        {PROJECT_CATEGORIES.map((value) => (
          <Link
            key={value}
            href={buildHref({ category: value, page: undefined })}
            className={`btn btn-sm ${category === value ? 'btn-primary' : 'btn-outline-secondary'}`}
          >
            {CATEGORY_LABELS[value]}
          </Link>
        ))}
      </div>

      {technologies.length > 0 && (
        <div className="d-flex flex-wrap gap-2 mb-4" role="group" aria-label="Filter by technology">
          <Link
            href={buildHref({ technology: undefined, page: undefined })}
            className={`badge fw-normal ${!technology ? 'text-bg-primary' : 'text-bg-secondary'}`}
          >
            All technologies
          </Link>
          {technologies.map((tech) => (
            <Link
              key={tech.id}
              href={buildHref({ technology: tech.slug, page: undefined })}
              className={`badge fw-normal ${technology === tech.slug ? 'text-bg-primary' : 'text-bg-secondary'}`}
            >
              {tech.name}
            </Link>
          ))}
        </div>
      )}

      {projects.length === 0 ? (
        <p style={{ color: 'var(--color-text-muted)' }}>No projects match these filters yet.</p>
      ) : (
        <div className="row g-4 mb-4">
          {projects.map((project) => (
            <div className="col-md-6 col-lg-4" key={project.id}>
              <ProjectCard project={project} headingLevel="h2" />
            </div>
          ))}
        </div>
      )}

      <Pagination meta={meta} buildHref={(targetPage) => buildHref({ page: String(targetPage) })} />
    </div>
  );
}
