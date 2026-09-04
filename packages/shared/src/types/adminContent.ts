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
