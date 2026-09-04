/**
 * Public API response shapes (docs/architecture/03 §3, docs/architecture/06
 * §6). These are the shared contract between the API's services (which map
 * Prisma's query results onto exactly these shapes before a controller ever
 * sees them) and the Next.js frontend that consumes them from Phase 6
 * onward.
 *
 * Deliberately NOT Zod schemas: doc 03 §7's Zod schemas validate untrusted
 * INPUT at the API boundary — these describe trusted, server-authoritative
 * OUTPUT the service layer already built correctly. Runtime-validating a
 * shape the server itself just constructed would guard against nothing a
 * type error wouldn't already catch at compile time.
 *
 * Every date is a serialized ISO-8601 string (docs/architecture/03 §2), not
 * a `Date` — the service layer is responsible for calling `.toISOString()`
 * before a value ever reaches one of these types, so what ships over HTTP
 * and what this type promises never drift apart.
 */

export interface PublicMediaRef {
  id: number;
  url: string;
  altText: string | null;
  width: number | null;
  height: number | null;
}

export interface SocialLinkDto {
  id: number;
  platform: string;
  label: string | null;
  url: string;
  icon: string | null;
}

export interface PublicSiteSettingDto {
  key: string;
  value: string | null;
  valueType: 'STRING' | 'NUMBER' | 'BOOLEAN' | 'JSON';
  groupName: string | null;
}

export interface ProfileDto {
  fullName: string;
  headline: string | null;
  shortBio: string | null;
  fullBio: string | null;
  location: string | null;
  publicEmail: string | null;
  availableForWork: boolean;
  avatar: PublicMediaRef | null;
  resume: PublicMediaRef | null;
  socialLinks: SocialLinkDto[];
  /** `GET /profile` bundles the public-flagged site settings alongside the profile row (doc 03 §3) — one call for everything the public footer/about-page chrome needs. */
  settings: PublicSiteSettingDto[];
}

/**
 * Homepage QuickStats counters (docs/architecture/06 §6: "No hardcoded
 * numbers anywhere"). Computed with COUNT(*)/MIN(startDate) over published
 * or visible rows only — see `services/statsService.ts` for exactly what
 * each one counts.
 */
export interface StatsDto {
  projectsCount: number;
  articlesCount: number;
  technologiesCount: number;
  yearsOfExperience: number;
}

export interface TechnologyDto {
  id: number;
  name: string;
  slug: string;
  icon: string | null;
  category: string | null;
  websiteUrl: string | null;
}

export interface SkillDto {
  id: number;
  name: string;
  icon: string | null;
  description: string | null;
  level: 'BEGINNER' | 'INTERMEDIATE' | 'ADVANCED';
}

export interface SkillCategoryDto {
  id: number;
  name: string;
  slug: string;
  icon: string | null;
  skills: SkillDto[];
}

export interface ProjectListItemDto {
  id: number;
  title: string;
  slug: string;
  shortDescription: string;
  category: string;
  featured: boolean;
  securityTested: boolean;
  coverMedia: PublicMediaRef | null;
  technologies: TechnologyDto[];
  publishedAt: string | null;
}

export interface ProjectSectionDto {
  key: string;
  title: string;
  body: string | null;
}

export interface PublicSecurityFindingDto {
  id: number;
  title: string;
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' | 'INFORMATIONAL';
  description: string | null;
  impact: string | null;
  affectedComponent: string | null;
  remediation: string | null;
  status: 'OPEN' | 'FIXED' | 'ACCEPTED_RISK' | 'FALSE_POSITIVE' | 'RETESTED';
  cweId: string | null;
  discoveredAt: string | null;
  resolvedAt: string | null;
}

export interface PublicSecurityAssessmentDto {
  id: number;
  title: string;
  scope: string | null;
  methodology: string | null;
  summary: string | null;
  status: 'PLANNED' | 'IN_PROGRESS' | 'COMPLETED' | 'RETESTED';
  assessedAt: string | null;
  retestedAt: string | null;
  tests: Array<{ testType: string; result: string; notes: string | null }>;
  findings: PublicSecurityFindingDto[];
}

export interface ProjectDetailDto extends ProjectListItemDto {
  fullDescription: string | null;
  problem: string | null;
  solution: string | null;
  architecture: string | null;
  challenges: string | null;
  solutionsDetail: string | null;
  lessonsLearned: string | null;
  deploymentNotes: string | null;
  githubUrl: string | null;
  liveUrl: string | null;
  securitySummary: string | null;
  testingSummary: string | null;
  visibleSections: string[];
  images: Array<{ media: PublicMediaRef; caption: string | null }>;
  features: Array<{ title: string; description: string | null }>;
  sections: ProjectSectionDto[];
  assessments: PublicSecurityAssessmentDto[];
}

export interface TagDto {
  id: number;
  name: string;
  slug: string;
}

export interface TagWithCountDto extends TagDto {
  count: number;
}

export interface ArticleCategoryDto {
  id: number;
  name: string;
  slug: string;
  description: string | null;
}

export interface ArticleListItemDto {
  id: number;
  title: string;
  slug: string;
  excerpt: string | null;
  coverMedia: PublicMediaRef | null;
  category: ArticleCategoryDto | null;
  tags: TagDto[];
  readingTimeMinutes: number;
  publishedAt: string | null;
}

export interface ArticleDetailDto extends ArticleListItemDto {
  content: string;
}

export interface SecurityResearchListItemDto {
  id: number;
  title: string;
  slug: string;
  description: string | null;
  category: 'RESEARCH' | 'WRITEUP' | 'METHODOLOGY' | 'NOTES' | 'TOOL';
  coverMedia: PublicMediaRef | null;
  tags: TagDto[];
  publishedAt: string | null;
}

export interface SecurityResearchDetailDto extends SecurityResearchListItemDto {
  content: string;
  references: Array<{ label: string; url: string }>;
}

export interface CertificationDto {
  id: number;
  name: string;
  issuer: string;
  description: string | null;
  certificateMedia: PublicMediaRef | null;
  credentialUrl: string | null;
  issueDate: string | null;
  expirationDate: string | null;
}

export interface ExperienceDto {
  id: number;
  position: string;
  organization: string;
  location: string | null;
  description: string | null;
  startDate: string;
  endDate: string | null;
  isCurrent: boolean;
  achievements: string[];
  technologies: TechnologyDto[];
}

export interface EducationDto {
  id: number;
  institution: string;
  degree: string;
  field: string | null;
  description: string | null;
  startDate: string;
  endDate: string | null;
}

export interface TimelineEntryDto {
  id: number;
  entryDate: string;
  yearLabel: string | null;
  title: string;
  description: string | null;
  category: string | null;
}

export interface SearchResultDto {
  entityType: 'PROJECT' | 'ARTICLE' | 'RESEARCH' | 'TECHNOLOGY';
  entityId: number;
  slug: string;
  title: string;
  snippet: string;
}

/** `GET /api/v1/home` — doc 06 §6's single aggregate call feeding all ten homepage sections. */
export interface HomeDto {
  profile: ProfileDto;
  stats: StatsDto;
  featuredProjects: ProjectListItemDto[];
  skillCategories: SkillCategoryDto[];
  latestArticles: ArticleListItemDto[];
  latestResearch: SecurityResearchListItemDto[];
  timeline: TimelineEntryDto[];
  socialLinks: SocialLinkDto[];
}

export interface SitemapEntryDto {
  entityType: 'PROJECT' | 'ARTICLE' | 'RESEARCH';
  slug: string;
  updatedAt: string;
}
