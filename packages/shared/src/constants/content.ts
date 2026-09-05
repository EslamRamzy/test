/**
 * Domain constants shared by the API and the web app.
 *
 * SQLite has no native enums, so these values are stored as TEXT and enforced
 * by three independent layers (docs/architecture/02 §1):
 *   1. a SQLite CHECK constraint,
 *   2. the Zod schema at the API boundary,
 *   3. the TypeScript union derived here.
 *
 * Adding a value therefore always requires a migration, not just an edit here.
 */

export const CONTENT_STATUSES = ['DRAFT', 'PUBLISHED', 'ARCHIVED'] as const;
export type ContentStatus = (typeof CONTENT_STATUSES)[number];

export const USER_ROLES = ['ADMIN', 'SUPER_ADMIN', 'EDITOR'] as const;
export type UserRole = (typeof USER_ROLES)[number];

export const PROJECT_CATEGORIES = [
  'WEB_APP',
  'API',
  'SECURITY_TOOL',
  'LIBRARY',
  'CLI',
  'MOBILE',
  'OTHER',
] as const;
export type ProjectCategory = (typeof PROJECT_CATEGORIES)[number];

export const SKILL_LEVELS = ['BEGINNER', 'INTERMEDIATE', 'ADVANCED'] as const;
export type SkillLevel = (typeof SKILL_LEVELS)[number];

export const RESEARCH_CATEGORIES = ['RESEARCH', 'WRITEUP', 'METHODOLOGY', 'NOTES', 'TOOL'] as const;
export type ResearchCategory = (typeof RESEARCH_CATEGORIES)[number];

export const MESSAGE_STATUSES = ['UNREAD', 'READ', 'ARCHIVED'] as const;
export type MessageStatus = (typeof MESSAGE_STATUSES)[number];

export const MEDIA_KINDS = [
  'AVATAR',
  'PROJECT_COVER',
  'SCREENSHOT',
  'CERTIFICATE',
  'ARTICLE_COVER',
  'RESEARCH_COVER',
  'RESUME',
  'OTHER',
] as const;
export type MediaKind = (typeof MEDIA_KINDS)[number];
