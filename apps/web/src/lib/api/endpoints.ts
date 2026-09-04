import type {
  ArticleCategoryDto,
  ArticleDetailDto,
  ArticleListItemDto,
  CertificationDto,
  EducationDto,
  ExperienceDto,
  HomeDto,
  ProfileDto,
  ProjectDetailDto,
  ProjectListItemDto,
  SearchResultDto,
  SecurityResearchDetailDto,
  SecurityResearchListItemDto,
  SitemapEntryDto,
  SkillCategoryDto,
  SocialLinkDto,
  StatsDto,
  TagWithCountDto,
  TechnologyDto,
  TimelineEntryDto,
} from '@portfolio/shared';
import { serverApi } from './serverClient';

/**
 * Typed calls into the public API (docs/architecture/06 §3, §4), one
 * function per `GET` endpoint in docs/architecture/03 §3 — this file is the
 * ONLY place a route path string like `/api/v1/projects` appears. A Server
 * Component imports a function here, never `fetch` directly (doc 06 §3).
 *
 * Cache tags follow doc 06 §1's table exactly, so a future
 * `revalidateTag('projects')` (Phase 8's admin publish action) invalidates
 * precisely the pages that actually show that data.
 */

// Accepts any of the param interfaces below by structural shape — typed as
// `object` rather than `Record<string, ...>` specifically so a concrete,
// no-index-signature interface (every params type in this file) can be
// passed directly without an unnecessary intermediate cast at each call site.
function toQueryString(params: object): string {
  const entries = (
    Object.entries(params) as Array<[string, string | number | boolean | undefined]>
  ).filter(([, value]) => value !== undefined);
  if (entries.length === 0) return '';
  const search = new URLSearchParams();
  for (const [key, value] of entries) search.set(key, String(value));
  return `?${search.toString()}`;
}

export interface ArticleDetailWithRelated extends ArticleDetailDto {
  related: ArticleListItemDto[];
}

// --- Profile / stats / home --------------------------------------------------

export function getProfile() {
  return serverApi.requestOrNull<ProfileDto>('/api/v1/profile', { tags: ['profile'] });
}

export function getStats() {
  return serverApi.request<StatsDto>('/api/v1/stats', { tags: ['stats'], revalidate: 300 });
}

export function getHome() {
  return serverApi.requestOrNull<HomeDto>('/api/v1/home', {
    tags: ['home', 'projects', 'articles', 'stats'],
  });
}

// --- Projects -----------------------------------------------------------------

// Fields are `X | undefined`, not `X?`, throughout these param interfaces —
// `exactOptionalPropertyTypes` rejects `{ category: params.category }` when
// `params.category` is `string | undefined` and the target property is the
// narrower optional `category?: string` (assigning an explicit `undefined`
// to an optional property is exactly what that flag forbids). Callers
// naturally pass values straight from `searchParams`, which are already
// `string | undefined` — the wider field type matches that without a cast
// at every call site.
export interface ProjectListParams {
  page?: number | undefined;
  pageSize?: number | undefined;
  category?: string | undefined;
  technology?: string | undefined;
  featured?: boolean | undefined;
  securityTested?: boolean | undefined;
  sort?: 'publishedAt' | 'title' | 'displayOrder' | undefined;
  order?: 'asc' | 'desc' | undefined;
}

export function listProjects(params: ProjectListParams = {}) {
  return serverApi.requestPaginated<ProjectListItemDto>(
    `/api/v1/projects${toQueryString(params)}`,
    {
      tags: ['projects'],
    },
  );
}

export function getProject(slug: string) {
  return serverApi.requestOrNull<ProjectDetailDto>(`/api/v1/projects/${slug}`, {
    tags: [`project:${slug}`],
  });
}

export function getRelatedProjects(slug: string) {
  return serverApi.requestOrNull<ProjectListItemDto[]>(`/api/v1/projects/${slug}/related`, {
    tags: [`project:${slug}`],
  });
}

// --- Technologies / skills ------------------------------------------------

export function listTechnologies(category?: string) {
  return serverApi.request<TechnologyDto[]>(`/api/v1/technologies${toQueryString({ category })}`, {
    tags: ['technologies'],
  });
}

export function listSkillCategories() {
  return serverApi.request<SkillCategoryDto[]>('/api/v1/skills', { tags: ['skills'] });
}

// --- Articles -------------------------------------------------------------

export interface ArticleListParams {
  page?: number | undefined;
  pageSize?: number | undefined;
  category?: string | undefined;
  tag?: string | undefined;
  sort?: 'publishedAt' | 'title' | undefined;
  order?: 'asc' | 'desc' | undefined;
}

export function listArticles(params: ArticleListParams = {}) {
  return serverApi.requestPaginated<ArticleListItemDto>(
    `/api/v1/articles${toQueryString(params)}`,
    {
      tags: ['articles'],
    },
  );
}

export function getArticle(slug: string) {
  return serverApi.requestOrNull<ArticleDetailWithRelated>(`/api/v1/articles/${slug}`, {
    tags: [`article:${slug}`],
  });
}

export function listArticleCategories() {
  return serverApi.request<ArticleCategoryDto[]>('/api/v1/articles/categories', {
    tags: ['articles'],
  });
}

export function listTags() {
  return serverApi.request<TagWithCountDto[]>('/api/v1/tags', { tags: ['tags'] });
}

// --- Security research ------------------------------------------------------

export interface ResearchListParams {
  page?: number | undefined;
  pageSize?: number | undefined;
  category?: string | undefined;
  tag?: string | undefined;
  sort?: 'publishedAt' | 'title' | undefined;
  order?: 'asc' | 'desc' | undefined;
}

export function listResearch(params: ResearchListParams = {}) {
  return serverApi.requestPaginated<SecurityResearchListItemDto>(
    `/api/v1/security${toQueryString(params)}`,
    {
      tags: ['research'],
    },
  );
}

export function getResearch(slug: string) {
  return serverApi.requestOrNull<SecurityResearchDetailDto>(`/api/v1/security/${slug}`, {
    tags: [`research:${slug}`],
  });
}

// --- CV: certifications / experience / education / timeline / social ------

export function listCertifications() {
  return serverApi.request<CertificationDto[]>('/api/v1/certifications', { tags: ['cv'] });
}

export function listExperience() {
  return serverApi.request<ExperienceDto[]>('/api/v1/experience', { tags: ['cv'] });
}

export function listEducation() {
  return serverApi.request<EducationDto[]>('/api/v1/education', { tags: ['cv'] });
}

export function listTimeline() {
  return serverApi.request<TimelineEntryDto[]>('/api/v1/timeline', { tags: ['cv'] });
}

export function listSocialLinks() {
  return serverApi.request<SocialLinkDto[]>('/api/v1/social-links', { tags: ['profile'] });
}

// --- Search / sitemap -------------------------------------------------------

export interface SearchParams {
  q: string;
  type?: 'projects' | 'articles' | 'research' | 'technologies' | undefined;
  limit?: number | undefined;
}

export function search(params: SearchParams) {
  return serverApi.request<SearchResultDto[]>(`/api/v1/search${toQueryString(params)}`, {
    // Search results reflect live content and are cheap to recompute; no
    // point caching a query string that will rarely repeat.
    revalidate: 0,
  });
}

export function getSitemapData() {
  return serverApi.request<SitemapEntryDto[]>('/api/v1/sitemap-data', {
    tags: ['projects', 'articles', 'research'],
  });
}
