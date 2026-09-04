import type { ProjectDetailDto, ProjectListItemDto, ProjectListQuery } from '@portfolio/shared';
import { buildPaginationMeta } from '../lib/httpResponse.js';
import { toPublicMediaRef, toPublicMediaRefOrNull } from '../lib/mediaUrl.js';
import * as projectRepository from '../repositories/projectRepository.js';

/**
 * D5 ("hybrid case-study body", docs/architecture/02): a fixed set of keys
 * read from named `projects` columns; any other key in `visibleSectionsJson`
 * reads a `ProjectSection` row instead. Titles for the built-in keys live
 * here (the column itself carries no title of its own, unlike a custom
 * `ProjectSection`, which has one) — reasonable, readable defaults, not
 * verbatim brief text (the original brief is not available as a file to
 * this phase — see `statsService.ts`'s equivalent note).
 */
const BUILT_IN_SECTION_TITLES: Record<string, string> = {
  problem: 'The Problem',
  solution: 'The Solution',
  architecture: 'Architecture',
  challenges: 'Challenges',
  solutionsDetail: 'How It Was Solved',
  lessonsLearned: 'Lessons Learned',
  deploymentNotes: 'Deployment Notes',
};

interface BuiltInSectionSource {
  problem: string | null;
  solution: string | null;
  architecture: string | null;
  challenges: string | null;
  solutionsDetail: string | null;
  lessonsLearned: string | null;
  deploymentNotes: string | null;
}

function getBuiltInSectionBody(
  project: BuiltInSectionSource,
  key: string,
): string | null | undefined {
  switch (key) {
    case 'problem':
      return project.problem;
    case 'solution':
      return project.solution;
    case 'architecture':
      return project.architecture;
    case 'challenges':
      return project.challenges;
    case 'solutionsDetail':
      return project.solutionsDetail;
    case 'lessonsLearned':
      return project.lessonsLearned;
    case 'deploymentNotes':
      return project.deploymentNotes;
    default:
      return undefined; // not a built-in key — the caller checks the custom sections instead
  }
}

/**
 * `visibleSectionsJson` is the single source of truth for what renders and
 * in what order (D5). Malformed JSON (should never happen — it is only
 * ever written by admin code — but this reads untrusted-by-construction
 * data, not a value this function controls) degrades to "no sections"
 * rather than throwing and 500ing the whole project detail response.
 */
function buildVisibleSections(
  project: BuiltInSectionSource & {
    sections: Array<{ sectionKey: string; title: string; body: string | null }>;
  },
  visibleSectionsJson: string,
): { keys: string[]; sections: ProjectDetailDto['sections'] } {
  let keys: string[] = [];
  try {
    const parsed: unknown = JSON.parse(visibleSectionsJson);
    if (Array.isArray(parsed)) {
      keys = parsed.filter((key): key is string => typeof key === 'string');
    }
  } catch {
    keys = [];
  }

  const customByKey = new Map(project.sections.map((section) => [section.sectionKey, section]));

  const sections: ProjectDetailDto['sections'] = [];
  for (const key of keys) {
    const builtInBody = getBuiltInSectionBody(project, key);
    if (builtInBody !== undefined) {
      if (builtInBody)
        sections.push({ key, title: BUILT_IN_SECTION_TITLES[key] ?? key, body: builtInBody });
      continue;
    }
    const custom = customByKey.get(key);
    if (custom) sections.push({ key, title: custom.title, body: custom.body });
  }

  return { keys, sections };
}

type ListRow = Awaited<ReturnType<typeof projectRepository.findPublishedList>>['items'][number];

function toListItemDto(row: ListRow): ProjectListItemDto {
  return {
    id: row.id,
    title: row.title,
    slug: row.slug,
    shortDescription: row.shortDescription,
    category: row.category,
    featured: row.featured,
    securityTested: row.securityTested,
    coverMedia: toPublicMediaRefOrNull(row.coverMedia),
    technologies: row.technologies.map(({ technology }) => ({ ...technology })),
    publishedAt: row.publishedAt ? row.publishedAt.toISOString() : null,
  };
}

export async function listProjects(query: ProjectListQuery) {
  const { items, total } = await projectRepository.findPublishedList({
    category: query.category,
    technology: query.technology,
    featured: query.featured,
    securityTested: query.securityTested,
    page: query.page,
    pageSize: query.pageSize,
    sort: query.sort,
    order: query.order,
  });
  return {
    items: items.map(toListItemDto),
    meta: buildPaginationMeta(query.page, query.pageSize, total),
  };
}

export async function getProjectBySlug(slug: string): Promise<ProjectDetailDto | null> {
  const project = await projectRepository.findPublishedBySlug(slug);
  if (!project) return null;

  const { sections } = buildVisibleSections(project, project.visibleSectionsJson);
  const visibleSections = sections.map((section) => section.key);

  return {
    ...toListItemDto(project),
    fullDescription: project.fullDescription,
    problem: project.problem,
    solution: project.solution,
    architecture: project.architecture,
    challenges: project.challenges,
    solutionsDetail: project.solutionsDetail,
    lessonsLearned: project.lessonsLearned,
    deploymentNotes: project.deploymentNotes,
    githubUrl: project.githubUrl,
    liveUrl: project.liveUrl,
    securitySummary: project.securitySummary,
    testingSummary: project.testingSummary,
    visibleSections,
    images: project.images.map((image) => ({
      media: toPublicMediaRef(image.media),
      caption: image.caption,
    })),
    features: project.features,
    sections,
    assessments: project.assessments.map((assessment) => ({
      id: assessment.id,
      title: assessment.title,
      scope: assessment.scope,
      methodology: assessment.methodology,
      summary: assessment.summary,
      status: assessment.status as ProjectDetailDto['assessments'][number]['status'],
      assessedAt: assessment.assessedAt ? assessment.assessedAt.toISOString() : null,
      retestedAt: assessment.retestedAt ? assessment.retestedAt.toISOString() : null,
      tests: assessment.tests,
      findings: assessment.findings.map((finding) => ({
        id: finding.id,
        title: finding.title,
        severity:
          finding.severity as ProjectDetailDto['assessments'][number]['findings'][number]['severity'],
        description: finding.description,
        impact: finding.impact,
        affectedComponent: finding.affectedComponent,
        remediation: finding.remediation,
        status:
          finding.status as ProjectDetailDto['assessments'][number]['findings'][number]['status'],
        cweId: finding.cweId,
        discoveredAt: finding.discoveredAt ? finding.discoveredAt.toISOString() : null,
        resolvedAt: finding.resolvedAt ? finding.resolvedAt.toISOString() : null,
      })),
    })),
  };
}

/** Doc 03 §3: "same category / shared technologies, max 3." */
export async function getRelatedProjects(slug: string): Promise<ProjectListItemDto[] | null> {
  const project = await projectRepository.findPublishedBySlug(slug);
  if (!project) return null;

  const technologyIds = project.technologies.map(({ technology }) => technology.id);
  const related = await projectRepository.findRelated(
    project.id,
    project.category,
    technologyIds,
    3,
  );
  return related.map(toListItemDto);
}

export async function getFeaturedProjects(limit: number): Promise<ProjectListItemDto[]> {
  const rows = await projectRepository.findFeaturedPublished(limit);
  return rows.map(toListItemDto);
}
