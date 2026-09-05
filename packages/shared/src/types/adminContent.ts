/**
 * Admin API response shapes (docs/architecture/03 §3, docs/architecture/07).
 * Counterpart to `publicContent.ts` — see that file's header for why these
 * are plain interfaces, not Zod schemas: they describe trusted,
 * server-authoritative OUTPUT the service layer already built correctly,
 * not untrusted input needing runtime validation.
 *
 * This file starts small on purpose — only the shapes Phase 7 (Admin
 * shell) actually needs. The full admin CRUD DTOs (one per module) arrive
 * with Phase 8, alongside the endpoints that return them.
 */

/**
 * `GET /admin/overview`'s counter cards (docs/architecture/07 §3: "Counter
 * cards (§21)") — every count is a real `COUNT(*)` over ALL statuses
 * (unlike the public `/stats` endpoint, which only counts published rows),
 * computed fresh on every call.
 */
export interface AdminOverviewDto {
  projectsCount: number;
  articlesCount: number;
  unreadMessagesCount: number;
  openFindingsCount: number;
  recentActivity: AuditLogEntryDto[];
}

export interface AuditLogEntryDto {
  id: number;
  action: string;
  entityType: string | null;
  entityId: number | null;
  /** Null when the acting user has since been deleted (`onDelete: SetNull`) or the action had no actor (e.g. a failed login attempt). */
  actorName: string | null;
  createdAt: string;
}

/**
 * Phase 8's "simple" admin CRUD modules (doc07 §3) — every admin CRUD
 * endpoint here returns the Prisma row as-is (`createAdminCrudController`'s
 * own doc), so these interfaces describe exactly that JSON shape: a
 * `DateTime` column serialises as an ISO string, never a `Date` (it crossed
 * `JSON.stringify` on the way over the wire), and a field the repository's
 * own `ADMIN_INCLUDE` doesn't select simply isn't here at all.
 */
export interface TechnologyRow {
  id: number;
  name: string;
  slug: string;
  icon: string | null;
  category: string | null;
  websiteUrl: string | null;
  displayOrder: number;
  createdAt: string;
}

export interface SkillCategoryRow {
  id: number;
  name: string;
  slug: string;
  icon: string | null;
  displayOrder: number;
  visible: boolean;
}

export interface SkillRow {
  id: number;
  categoryId: number;
  name: string;
  icon: string | null;
  description: string | null;
  level: string;
  displayOrder: number;
  visible: boolean;
}

export interface CertificationRow {
  id: number;
  name: string;
  issuer: string;
  description: string | null;
  certificateMediaId: number | null;
  credentialUrl: string | null;
  issueDate: string | null;
  expirationDate: string | null;
  displayOrder: number;
  visible: boolean;
}

export interface ExperienceAchievementRow {
  id: number;
  experienceId: number;
  text: string;
  displayOrder: number;
}

export interface ExperienceTechnologyRow {
  experienceId: number;
  technologyId: number;
  technology: TechnologyRow;
}

export interface ExperienceRow {
  id: number;
  position: string;
  organization: string;
  location: string | null;
  description: string | null;
  startDate: string;
  endDate: string | null;
  isCurrent: boolean;
  displayOrder: number;
  visible: boolean;
  achievements: ExperienceAchievementRow[];
  technologies: ExperienceTechnologyRow[];
}

export interface EducationRow {
  id: number;
  institution: string;
  degree: string;
  field: string | null;
  description: string | null;
  startDate: string;
  endDate: string | null;
  displayOrder: number;
  visible: boolean;
}

export interface TimelineEntryRow {
  id: number;
  entryDate: string;
  yearLabel: string | null;
  title: string;
  description: string | null;
  category: string | null;
  displayOrder: number;
  visible: boolean;
}

export interface SocialLinkRow {
  id: number;
  platform: string;
  label: string | null;
  url: string;
  icon: string | null;
  displayOrder: number;
  enabled: boolean;
}

export interface TagRow {
  id: number;
  name: string;
  slug: string;
}

export interface ArticleCategoryRow {
  id: number;
  name: string;
  slug: string;
  description: string | null;
  displayOrder: number;
}

/**
 * The `coverMedia`/`author`/`category`/`tags` shapes below all come from
 * `articleRepository.ts`'s own `ADMIN_INCLUDE` — a `select` of raw columns
 * (`filename`, not a resolved `url`; that resolution is
 * `toPublicMediaRefOrNull`'s job, which only the PUBLIC read path calls),
 * so `AdminMediaRefRow` is deliberately its own type, not a reuse of
 * `PublicMediaRef` from `publicContent.ts`.
 */
export interface AdminMediaRefRow {
  id: number;
  filename: string;
  altText: string | null;
  width: number | null;
  height: number | null;
}

export interface ArticleTagRow {
  articleId: number;
  tagId: number;
  tag: TagRow;
}

export interface ArticleAdminRow {
  id: number;
  title: string;
  slug: string;
  excerpt: string | null;
  content: string;
  coverMediaId: number | null;
  authorId: number;
  categoryId: number | null;
  status: string;
  readingTimeMinutes: number;
  viewCount: number;
  publishedAt: string | null;
  createdAt: string;
  updatedAt: string;
  coverMedia: AdminMediaRefRow | null;
  author: { id: number; name: string };
  category: ArticleCategoryRow | null;
  tags: ArticleTagRow[];
}

export interface ResearchTagRow {
  researchId: number;
  tagId: number;
  tag: TagRow;
}

export interface ResearchReferenceRow {
  id: number;
  researchId: number;
  label: string;
  url: string;
  displayOrder: number;
}

/** `securityResearchRepository.ts`'s own `ADMIN_INCLUDE` — no `author` (unlike Article) and `category` is a plain enum string, not a relation. */
export interface SecurityResearchAdminRow {
  id: number;
  title: string;
  slug: string;
  description: string | null;
  content: string;
  category: string;
  status: string;
  coverMediaId: number | null;
  viewCount: number;
  publishedAt: string | null;
  createdAt: string;
  updatedAt: string;
  coverMedia: AdminMediaRefRow | null;
  tags: ResearchTagRow[];
  references: ResearchReferenceRow[];
}

/** The full `Media` row shape (`Project.coverMedia: true` in `projectRepository.ts`'s `ADMIN_INCLUDE` — a plain `true`, not a `select`, unlike Article/Certification/SecurityResearch's narrower `coverMedia` shape). Phase 9's media library is what actually populates these beyond the id an admin can type in today. */
export interface AdminMediaFullRow {
  id: number;
  filename: string;
  originalName: string;
  mimeType: string;
  sizeBytes: number;
  width: number | null;
  height: number | null;
  checksumSha256: string;
  storagePath: string;
  altText: string | null;
  kind: string;
  uploadedBy: number | null;
  createdAt: string;
}

/**
 * One place a `Media` row is referenced from — the media library's "usage
 * list" (doc07 §3) and the reference-blocked-deletion check (doc09 §7) both
 * walk the same set of relations, so this is the shape both return. `label`
 * is the referencing entity's own title/name, resolved server-side so the
 * UI never has to fetch each one separately just to show what it's looking
 * at.
 */
export interface MediaUsageRef {
  entityType:
    | 'PROFILE_AVATAR'
    | 'PROFILE_RESUME'
    | 'PROJECT_COVER'
    | 'PROJECT_IMAGE'
    | 'ARTICLE_COVER'
    | 'SECURITY_RESEARCH_COVER'
    | 'CERTIFICATION';
  entityId: number;
  label: string;
}

export interface ProjectImageRow {
  id: number;
  projectId: number;
  mediaId: number;
  caption: string | null;
  displayOrder: number;
  media: AdminMediaFullRow;
}

export interface ProjectFeatureRow {
  id: number;
  projectId: number;
  title: string;
  description: string | null;
  displayOrder: number;
}

export interface ProjectSectionRow {
  id: number;
  projectId: number;
  sectionKey: string;
  title: string;
  body: string | null;
  displayOrder: number;
  visible: boolean;
}

export interface ProjectTechnologyRow {
  projectId: number;
  technologyId: number;
  technology: TechnologyRow;
}

export interface SecurityAssessmentTestRow {
  id: number;
  assessmentId: number;
  testType: string;
  result: string;
  notes: string | null;
  displayOrder: number;
}

export interface SecurityFindingRow {
  id: number;
  assessmentId: number;
  title: string;
  severity: string;
  description: string | null;
  impact: string | null;
  affectedComponent: string | null;
  remediation: string | null;
  status: string;
  cweId: string | null;
  isPublic: boolean;
  discoveredAt: string | null;
  resolvedAt: string | null;
  displayOrder: number;
}

export interface SecurityAssessmentRow {
  id: number;
  projectId: number;
  title: string;
  scope: string | null;
  methodology: string | null;
  summary: string | null;
  status: string;
  isPublic: boolean;
  assessedAt: string | null;
  retestedAt: string | null;
  createdAt: string;
  updatedAt: string;
  tests: SecurityAssessmentTestRow[];
  findings: SecurityFindingRow[];
}

/**
 * `projectRepository.ts`'s own `ADMIN_INCLUDE` — every one of doc07 §3's
 * tabbed-editor tabs (Overview · Case Study · Technologies · Media ·
 * Security · SEO) reads from this ONE row; `assessments` already carries
 * its own `tests`/`findings` nested, so the Security tab needs no separate
 * fetch to render them, only its own endpoints to mutate them.
 */
export interface ProjectAdminRow {
  id: number;
  title: string;
  slug: string;
  shortDescription: string;
  fullDescription: string | null;
  category: string;
  status: string;
  featured: boolean;
  coverMediaId: number | null;
  problem: string | null;
  solution: string | null;
  architecture: string | null;
  challenges: string | null;
  solutionsDetail: string | null;
  lessonsLearned: string | null;
  deploymentNotes: string | null;
  githubUrl: string | null;
  liveUrl: string | null;
  securityTested: boolean;
  securitySummary: string | null;
  testingSummary: string | null;
  visibleSectionsJson: string;
  displayOrder: number;
  viewCount: number;
  publishedAt: string | null;
  createdAt: string;
  updatedAt: string;
  coverMedia: AdminMediaFullRow | null;
  images: ProjectImageRow[];
  features: ProjectFeatureRow[];
  sections: ProjectSectionRow[];
  technologies: ProjectTechnologyRow[];
  assessments: SecurityAssessmentRow[];
}

export interface SiteSettingRow {
  id: number;
  key: string;
  value: string | null;
  valueType: string;
  groupName: string | null;
  isPublic: boolean;
  updatedAt: string;
}

/** `siteSettingService.ts`'s `listSettingsForAdmin` — already grouped server-side by `groupName` (an ungrouped row's `groupName` becomes `'general'`). */
export interface SettingsGroupDto {
  groupName: string;
  settings: SiteSettingRow[];
}

export interface ProfileAdminRow {
  id: number;
  fullName: string;
  headline: string | null;
  shortBio: string | null;
  fullBio: string | null;
  location: string | null;
  publicEmail: string | null;
  avatarMediaId: number | null;
  resumeMediaId: number | null;
  availableForWork: boolean;
  updatedAt: string;
  avatarMedia: AdminMediaFullRow | null;
  resumeMedia: AdminMediaFullRow | null;
}

/** `GET /admin/audit-logs` (doc07 §3: "read-only table... no create/edit/delete anywhere in the UI") — the FULL row, unlike `AuditLogEntryDto` above (the Dashboard's own trimmed shape for its "Recent Activity" list). */
export interface AuditLogRow {
  id: number;
  userId: number | null;
  action: string;
  entityType: string | null;
  entityId: number | null;
  metadataJson: string | null;
  ipHash: string | null;
  userAgent: string | null;
  createdAt: string;
  user: { name: string; email: string } | null;
}

export interface AnalyticsSeriesPoint {
  bucket: string;
  views: number;
  uniqueVisitors: number;
}

export interface AnalyticsTopContentEntry {
  entityId: number;
  slug: string;
  title: string;
  views: number;
}

export interface AnalyticsReferrerHostRow {
  referrerHost: string;
  views: number;
}

/** `GET /admin/analytics` (doc07 §3: "Views over time, top projects, top articles, referrer hosts, date-range picker") — `analyticsService.ts`'s own `AnalyticsOverview`. */
export interface AnalyticsOverviewDto {
  from: string;
  to: string;
  totalViews: number;
  uniqueVisitors: number;
  series: AnalyticsSeriesPoint[];
  topProjects: AnalyticsTopContentEntry[];
  topArticles: AnalyticsTopContentEntry[];
  topReferrerHosts: AnalyticsReferrerHostRow[];
}
