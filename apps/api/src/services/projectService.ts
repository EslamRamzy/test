import type {
  ApiFieldError,
  ProjectCreateInput,
  ProjectDetailDto,
  ProjectFeaturedInput,
  ProjectImageCreateInput,
  ProjectListItemDto,
  ProjectListQuery,
  ProjectSectionsUpdateInput,
  ProjectTechnologiesInput,
  ProjectUpdateInput,
  ReorderInput,
} from '@portfolio/shared';
import { prisma } from '../config/prisma.js';
import { ConflictError, NotFoundError, ValidationError } from '../errors/AppError.js';
import { buildPaginationMeta } from '../lib/httpResponse.js';
import { toPublicMediaRef, toPublicMediaRefOrNull } from '../lib/mediaUrl.js';
import { revalidateTags } from '../lib/revalidate.js';
import { generateDuplicateSlug } from '../lib/slug.js';
import * as projectRepository from '../repositories/projectRepository.js';
import type { ProjectAdminListParams, ProjectAdminRow } from '../repositories/projectRepository.js';
import * as auditLogRepository from '../repositories/auditLogRepository.js';
import type { AdminCrudActor } from './adminCrudFactory.js';

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

// --- Admin CRUD + tabbed-editor endpoints + publish workflow ---------------
//
// Hand-written, same reasoning as articleService.ts/securityResearchService.ts
// — the delete guard, revalidation calls, and (here) the project-specific
// endpoints below don't fit `createAdminCrudService`'s shape.

export async function listProjectsForAdmin(params: ProjectAdminListParams) {
  const { items, total } = await projectRepository.list(params);
  return { items, meta: buildPaginationMeta(params.page, params.pageSize, total) };
}

export async function getProjectForAdmin(id: number): Promise<ProjectAdminRow> {
  const row = await projectRepository.findByIdForAdmin(id);
  if (!row) throw new NotFoundError('Project not found');
  return row;
}

export async function createProject(
  data: ProjectCreateInput,
  actor: AdminCrudActor,
): Promise<ProjectAdminRow> {
  return prisma.$transaction(async (tx) => {
    const row = await projectRepository.create(data, tx);
    await auditLogRepository.record(
      { userId: actor.id, action: 'PROJECT_CREATE', entityType: 'PROJECT', entityId: row.id },
      tx,
    );
    return row;
  });
}

export async function updateProject(
  id: number,
  data: ProjectUpdateInput,
  actor: AdminCrudActor,
): Promise<ProjectAdminRow> {
  const row = await prisma.$transaction(async (tx) => {
    const existing = await projectRepository.findByIdForAdmin(id, tx);
    if (!existing) throw new NotFoundError('Project not found');
    const updated = await projectRepository.update(id, data, tx);
    await auditLogRepository.record(
      { userId: actor.id, action: 'PROJECT_UPDATE', entityType: 'PROJECT', entityId: id },
      tx,
    );
    return updated;
  });

  if (row.status === 'PUBLISHED') {
    await revalidateTags(['projects', `project:${row.slug}`]);
  }
  return row;
}

export async function removeProject(id: number, actor: AdminCrudActor): Promise<void> {
  await prisma.$transaction(async (tx) => {
    const existing = await projectRepository.findByIdForAdmin(id, tx);
    if (!existing) throw new NotFoundError('Project not found');
    if (existing.status === 'PUBLISHED') {
      throw new ConflictError(
        'A published project must be unpublished or archived before it can be deleted',
      );
    }
    await projectRepository.remove(id, tx);
    await auditLogRepository.record(
      { userId: actor.id, action: 'PROJECT_DELETE', entityType: 'PROJECT', entityId: id },
      tx,
    );
  });
}

export async function reorderProjects(items: ReorderInput, actor: AdminCrudActor): Promise<void> {
  await prisma.$transaction(async (tx) => {
    await projectRepository.reorder(items, tx);
    await auditLogRepository.record(
      { userId: actor.id, action: 'PROJECT_REORDER', entityType: 'PROJECT' },
      tx,
    );
  });
}

const BUILT_IN_SECTION_COLUMNS = [
  'fullDescription',
  'problem',
  'solution',
  'architecture',
  'challenges',
  'solutionsDetail',
  'lessonsLearned',
  'deploymentNotes',
] as const;

/**
 * Doc07 §4's readiness check, verbatim for once — "missing cover image,
 * missing short description, missing slug, no technologies, empty
 * case-study body" is written for Projects specifically (unlike Article/
 * SecurityResearch, which needed adaptation). `shortDescription`/`slug` are
 * already required at create time (never optional in
 * `projectCreateSchema`), so — same reasoning as those two services — only
 * the genuinely-optional-until-now fields are checked here: cover image,
 * at least one technology, and a non-empty case-study body (every
 * `fullDescription`/case-study column empty counts as "empty").
 */
function checkPublishReadiness(project: ProjectAdminRow): void {
  const details: ApiFieldError[] = [];
  if (!project.coverMediaId) {
    details.push({ field: 'coverMediaId', message: 'A cover image is required to publish' });
  }
  if (project.technologies.length === 0) {
    details.push({
      field: 'technologyIds',
      message: 'At least one technology is required to publish',
    });
  }
  const hasCaseStudyContent = BUILT_IN_SECTION_COLUMNS.some((key) => Boolean(project[key]));
  if (!hasCaseStudyContent) {
    details.push({
      field: 'fullDescription',
      message:
        'Case-study content is required to publish (a full description or at least one section)',
    });
  }
  if (details.length > 0) {
    throw new ValidationError(details, 'Project is not ready to publish');
  }
}

export async function publishProject(id: number, actor: AdminCrudActor): Promise<ProjectAdminRow> {
  const existing = await projectRepository.findByIdForAdmin(id);
  if (!existing) throw new NotFoundError('Project not found');
  if (existing.status !== 'DRAFT') {
    throw new ConflictError(
      `Only a draft project can be published (current status: ${existing.status})`,
    );
  }
  checkPublishReadiness(existing);

  const row = await prisma.$transaction(async (tx) => {
    const updated = await projectRepository.setStatus(
      id,
      'PUBLISHED',
      existing.publishedAt ?? new Date(),
      tx,
    );
    await auditLogRepository.record(
      { userId: actor.id, action: 'PROJECT_PUBLISH', entityType: 'PROJECT', entityId: id },
      tx,
    );
    return updated;
  });

  await revalidateTags(['projects', `project:${row.slug}`, 'home']);
  return row;
}

/** Handles both `PUBLISHED -> DRAFT` (unpublish) and `ARCHIVED -> DRAFT` (restore) — same reasoning as `articleService.unpublishArticle`'s own comment. */
export async function unpublishProject(
  id: number,
  actor: AdminCrudActor,
): Promise<ProjectAdminRow> {
  const existing = await projectRepository.findByIdForAdmin(id);
  if (!existing) throw new NotFoundError('Project not found');
  if (existing.status === 'DRAFT') {
    throw new ConflictError('Project is already a draft');
  }

  const row = await prisma.$transaction(async (tx) => {
    const updated = await projectRepository.setStatus(id, 'DRAFT', undefined, tx);
    await auditLogRepository.record(
      { userId: actor.id, action: 'PROJECT_UNPUBLISH', entityType: 'PROJECT', entityId: id },
      tx,
    );
    return updated;
  });

  await revalidateTags(['projects', `project:${row.slug}`, 'home']);
  return row;
}

export async function archiveProject(id: number, actor: AdminCrudActor): Promise<ProjectAdminRow> {
  const existing = await projectRepository.findByIdForAdmin(id);
  if (!existing) throw new NotFoundError('Project not found');
  if (existing.status !== 'PUBLISHED') {
    throw new ConflictError('Only a published project can be archived');
  }

  const row = await prisma.$transaction(async (tx) => {
    const updated = await projectRepository.setStatus(id, 'ARCHIVED', undefined, tx);
    await auditLogRepository.record(
      { userId: actor.id, action: 'PROJECT_ARCHIVE', entityType: 'PROJECT', entityId: id },
      tx,
    );
    return updated;
  });

  await revalidateTags(['projects', `project:${row.slug}`, 'home']);
  return row;
}

/** Always creates a DRAFT — never publicly visible, so no revalidation call. Sections are never copied (see `projectRepository.duplicate`'s own comment). */
export async function duplicateProject(
  id: number,
  actor: AdminCrudActor,
): Promise<ProjectAdminRow> {
  const source = await projectRepository.findByIdForAdmin(id);
  if (!source) throw new NotFoundError('Project not found');

  const slug = await generateDuplicateSlug(source.slug, (candidate) =>
    projectRepository.existsBySlug(candidate),
  );

  return prisma.$transaction(async (tx) => {
    const created = await projectRepository.duplicate(source, slug, tx);
    await auditLogRepository.record(
      {
        userId: actor.id,
        action: 'PROJECT_DUPLICATE',
        entityType: 'PROJECT',
        entityId: created.id,
      },
      tx,
    );
    return created;
  });
}

export async function setProjectTechnologies(
  id: number,
  input: ProjectTechnologiesInput,
  actor: AdminCrudActor,
): Promise<ProjectAdminRow> {
  const row = await prisma.$transaction(async (tx) => {
    const existing = await projectRepository.findByIdForAdmin(id, tx);
    if (!existing) throw new NotFoundError('Project not found');
    const updated = await projectRepository.setTechnologies(id, input.technologyIds, tx);
    await auditLogRepository.record(
      {
        userId: actor.id,
        action: 'PROJECT_TECHNOLOGIES_UPDATE',
        entityType: 'PROJECT',
        entityId: id,
      },
      tx,
    );
    return updated;
  });

  // Never null in practice — `existing` inside the same transaction already
  // proved the row exists, and nothing else can delete it mid-transaction.
  const updated = row as ProjectAdminRow;
  if (updated.status === 'PUBLISHED') {
    await revalidateTags(['projects', `project:${updated.slug}`]);
  }
  return updated;
}

export async function addProjectImage(
  id: number,
  input: ProjectImageCreateInput,
  actor: AdminCrudActor,
): Promise<ProjectAdminRow> {
  const row = await prisma.$transaction(async (tx) => {
    const existing = await projectRepository.findByIdForAdmin(id, tx);
    if (!existing) throw new NotFoundError('Project not found');
    const updated = await projectRepository.addImage(id, input, tx);
    await auditLogRepository.record(
      { userId: actor.id, action: 'PROJECT_IMAGE_ADD', entityType: 'PROJECT', entityId: id },
      tx,
    );
    return updated;
  });

  // Never null in practice — `existing` inside the same transaction already
  // proved the row exists, and nothing else can delete it mid-transaction.
  const updated = row as ProjectAdminRow;
  if (updated.status === 'PUBLISHED') {
    await revalidateTags(['projects', `project:${updated.slug}`]);
  }
  return updated;
}

export async function reorderProjectImages(
  id: number,
  items: ReorderInput,
  actor: AdminCrudActor,
): Promise<ProjectAdminRow> {
  return prisma.$transaction(async (tx) => {
    const existing = await projectRepository.findByIdForAdmin(id, tx);
    if (!existing) throw new NotFoundError('Project not found');
    const updated = await projectRepository.reorderImages(id, items, tx);
    await auditLogRepository.record(
      { userId: actor.id, action: 'PROJECT_IMAGES_REORDER', entityType: 'PROJECT', entityId: id },
      tx,
    );
    return updated as ProjectAdminRow;
  });
}

export async function removeProjectImage(
  id: number,
  imageId: number,
  actor: AdminCrudActor,
): Promise<void> {
  await prisma.$transaction(async (tx) => {
    const existing = await projectRepository.findByIdForAdmin(id, tx);
    if (!existing) throw new NotFoundError('Project not found');
    await projectRepository.removeImage(id, imageId, tx);
    await auditLogRepository.record(
      { userId: actor.id, action: 'PROJECT_IMAGE_REMOVE', entityType: 'PROJECT', entityId: id },
      tx,
    );
  });
}

export async function replaceProjectSections(
  id: number,
  entries: ProjectSectionsUpdateInput,
  actor: AdminCrudActor,
): Promise<ProjectAdminRow> {
  const row = await prisma.$transaction(async (tx) => {
    const existing = await projectRepository.findByIdForAdmin(id, tx);
    if (!existing) throw new NotFoundError('Project not found');
    const updated = await projectRepository.replaceSections(id, entries, tx);
    await auditLogRepository.record(
      { userId: actor.id, action: 'PROJECT_SECTIONS_UPDATE', entityType: 'PROJECT', entityId: id },
      tx,
    );
    return updated;
  });

  // Never null in practice — `existing` inside the same transaction already
  // proved the row exists, and nothing else can delete it mid-transaction.
  const updated = row as ProjectAdminRow;
  if (updated.status === 'PUBLISHED') {
    await revalidateTags(['projects', `project:${updated.slug}`]);
  }
  return updated;
}

export async function setProjectFeatured(
  id: number,
  input: ProjectFeaturedInput,
  actor: AdminCrudActor,
): Promise<ProjectAdminRow> {
  const row = await prisma.$transaction(async (tx) => {
    const existing = await projectRepository.findByIdForAdmin(id, tx);
    if (!existing) throw new NotFoundError('Project not found');
    const updated = await projectRepository.setFeatured(id, input.featured, tx);
    await auditLogRepository.record(
      { userId: actor.id, action: 'PROJECT_FEATURED_UPDATE', entityType: 'PROJECT', entityId: id },
      tx,
    );
    return updated;
  });

  if (row.status === 'PUBLISHED') {
    await revalidateTags(['projects', `project:${row.slug}`, 'home']);
  }
  return row;
}
