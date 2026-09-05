import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { getProject, getRelatedProjects, listProjects } from '@/lib/api/endpoints';
import { getPublicSiteUrl } from '@/lib/config';
import { renderMarkdown } from '@/lib/markdown/render';
import { MarkdownBody } from '@/lib/markdown/MarkdownBody';
import { JsonLd } from '@/components/seo/JsonLd';
import { PublicMediaImage } from '@/components/ui/PublicMediaImage';
import { ProjectCard } from '@/features/projects/components/ProjectCard';
import { SecurityAssessmentCard } from '@/features/projects/components/SecurityAssessmentCard';

interface ProjectPageProps {
  params: Promise<{ slug: string }>;
}

/** SSG (docs/architecture/06 §1) — the known-at-build-time slugs; anything else falls back to on-demand rendering. */
export async function generateStaticParams() {
  const { items } = await listProjects({ pageSize: 50 });
  return items.map((project) => ({ slug: project.slug }));
}
export const dynamicParams = true;

export async function generateMetadata({ params }: ProjectPageProps): Promise<Metadata> {
  const { slug } = await params;
  const project = await getProject(slug);
  if (!project) return {};

  return {
    title: project.title,
    description: project.shortDescription,
    alternates: { canonical: `${getPublicSiteUrl()}/projects/${project.slug}` },
    // No `openGraph.images` here — Next resolves `opengraph-image.tsx` (this
    // same route segment) into it automatically. A hand-built URL was tried
    // first and was WRONG: verified against a real running server, Next 16 /
    // Turbopack registers the file-convention image route with a generated
    // hash suffix (`/opengraph-image-<hash>`), not the clean path a human
    // would guess, so constructing it by hand 404s.
    // `siteName` repeated here (not just set once on the root layout) because
    // defining an `openGraph` object at all REPLACES the parent layout's
    // entirely rather than merging into it (Next's metadata merge is shallow
    // per top-level key) — this route needs its own per-route `title`/
    // `description`/`type`, so it has to carry `siteName` too or lose it.
    openGraph: {
      title: project.title,
      description: project.shortDescription,
      type: 'article',
      siteName: 'Eslam Ramzy',
    },
  };
}

export default async function ProjectPage({ params }: ProjectPageProps) {
  const { slug } = await params;
  const [project, related] = await Promise.all([getProject(slug), getRelatedProjects(slug)]);
  if (!project) notFound();

  const renderedSections = await Promise.all(
    project.sections.map(async (section) => ({
      ...section,
      html: section.body ? await renderMarkdown(section.body) : null,
    })),
  );

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'SoftwareSourceCode',
    name: project.title,
    description: project.shortDescription,
    ...(project.githubUrl ? { codeRepository: project.githubUrl } : {}),
    ...(project.publishedAt ? { datePublished: project.publishedAt } : {}),
  };
  const siteUrl = getPublicSiteUrl();
  const breadcrumbJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Projects', item: `${siteUrl}/projects` },
      {
        '@type': 'ListItem',
        position: 2,
        name: project.title,
        item: `${siteUrl}/projects/${project.slug}`,
      },
    ],
  };

  return (
    <article className="container py-5">
      <JsonLd data={jsonLd} />
      <JsonLd data={breadcrumbJsonLd} />

      <nav aria-label="Breadcrumb" className="mb-3">
        <ol className="breadcrumb small">
          <li className="breadcrumb-item">
            <Link href="/projects">Projects</Link>
          </li>
          <li className="breadcrumb-item active" aria-current="page">
            {project.title}
          </li>
        </ol>
      </nav>

      <div className="d-flex align-items-center gap-2 flex-wrap mb-2">
        <h1 className="h2 mb-0">{project.title}</h1>
        {project.securityTested && (
          <span className="badge text-bg-success">
            <span className="bi bi-shield-check me-1" aria-hidden="true" />
            Security Tested
          </span>
        )}
      </div>
      <p className="fs-5 mb-3" style={{ color: 'var(--color-text-muted)' }}>
        {project.shortDescription}
      </p>

      <div className="d-flex flex-wrap gap-2 mb-4">
        {project.technologies.map((tech) => (
          <span key={tech.id} className="badge text-bg-secondary fw-normal">
            {tech.name}
          </span>
        ))}
      </div>

      <div className="d-flex flex-wrap gap-2 mb-4">
        {project.githubUrl && (
          <a
            href={project.githubUrl}
            className="btn btn-outline-secondary btn-sm"
            target="_blank"
            rel="noopener noreferrer"
          >
            <span className="bi bi-github me-1" aria-hidden="true" />
            Source
          </a>
        )}
        {project.liveUrl && (
          <a
            href={project.liveUrl}
            className="btn btn-outline-secondary btn-sm"
            target="_blank"
            rel="noopener noreferrer"
          >
            <span className="bi bi-box-arrow-up-right me-1" aria-hidden="true" />
            Live
          </a>
        )}
      </div>

      {project.coverMedia && (
        <div className="ratio ratio-16x9 mb-5">
          <PublicMediaImage
            media={project.coverMedia}
            fill
            priority
            sizes="(max-width: 992px) 100vw, 900px"
            className="rounded-3 object-fit-cover"
          />
        </div>
      )}

      {project.fullDescription && <p className="mb-5 fs-5">{project.fullDescription}</p>}

      {renderedSections.map(
        (section) =>
          section.html && (
            <section key={section.key} className="mb-5">
              <h2 className="h4 mb-3">{section.title}</h2>
              <MarkdownBody html={section.html} />
            </section>
          ),
      )}

      {project.assessments.length > 0 && (
        <section className="mb-5">
          <h2 className="h4 mb-3">Security Assessments</h2>
          {project.assessments.map((assessment) => (
            <SecurityAssessmentCard assessment={assessment} key={assessment.id} />
          ))}
        </section>
      )}

      {related && related.length > 0 && (
        <section className="mt-5 pt-4 border-top">
          <h2 className="h4 mb-4">Related Projects</h2>
          <div className="row g-4">
            {related.map((item) => (
              <div className="col-md-4" key={item.id}>
                <ProjectCard project={item} />
              </div>
            ))}
          </div>
        </section>
      )}
    </article>
  );
}
