-- CreateTable
CREATE TABLE "users" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "email" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'ADMIN' CHECK ("role" IN ('ADMIN', 'SUPER_ADMIN', 'EDITOR')),
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "must_change_password" BOOLEAN NOT NULL DEFAULT false,
    "token_version" INTEGER NOT NULL DEFAULT 0,
    "failed_login_count" INTEGER NOT NULL DEFAULT 0,
    "locked_until" DATETIME,
    "last_login_at" DATETIME,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "refresh_tokens" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "user_id" INTEGER NOT NULL,
    "token_hash" TEXT NOT NULL,
    "family_id" TEXT NOT NULL,
    "expires_at" DATETIME NOT NULL,
    "revoked_at" DATETIME,
    "replaced_by_hash" TEXT,
    "user_agent" TEXT,
    "ip_hash" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "refresh_tokens_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "media" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "filename" TEXT NOT NULL,
    "original_name" TEXT NOT NULL,
    "mime_type" TEXT NOT NULL,
    "size_bytes" INTEGER NOT NULL,
    "width" INTEGER,
    "height" INTEGER,
    "checksum_sha256" TEXT NOT NULL,
    "storage_path" TEXT NOT NULL,
    "alt_text" TEXT,
    "kind" TEXT NOT NULL CHECK ("kind" IN ('AVATAR', 'PROJECT_COVER', 'SCREENSHOT', 'CERTIFICATE', 'ARTICLE_COVER', 'RESUME', 'OTHER')),
    "uploaded_by" INTEGER,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "media_uploaded_by_fkey" FOREIGN KEY ("uploaded_by") REFERENCES "users" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "user_id" INTEGER,
    "action" TEXT NOT NULL,
    "entity_type" TEXT,
    "entity_id" INTEGER,
    "metadata_json" TEXT,
    "ip_hash" TEXT,
    "user_agent" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "audit_logs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "projects" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "title" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "short_description" TEXT NOT NULL,
    "full_description" TEXT,
    "category" TEXT NOT NULL CHECK ("category" IN ('WEB_APP', 'API', 'SECURITY_TOOL', 'LIBRARY', 'CLI', 'MOBILE', 'OTHER')),
    "status" TEXT NOT NULL DEFAULT 'DRAFT' CHECK ("status" IN ('DRAFT', 'PUBLISHED', 'ARCHIVED')),
    "featured" BOOLEAN NOT NULL DEFAULT false,
    "cover_media_id" INTEGER,
    "problem" TEXT,
    "solution" TEXT,
    "architecture" TEXT,
    "challenges" TEXT,
    "solutions_detail" TEXT,
    "lessons_learned" TEXT,
    "deployment_notes" TEXT,
    "github_url" TEXT,
    "live_url" TEXT,
    "security_tested" BOOLEAN NOT NULL DEFAULT false,
    "security_summary" TEXT,
    "testing_summary" TEXT,
    "visible_sections_json" TEXT NOT NULL DEFAULT '[]',
    "display_order" INTEGER NOT NULL DEFAULT 0,
    "view_count" INTEGER NOT NULL DEFAULT 0,
    "published_at" DATETIME,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "projects_cover_media_id_fkey" FOREIGN KEY ("cover_media_id") REFERENCES "media" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "project_sections" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "project_id" INTEGER NOT NULL,
    "section_key" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT,
    "display_order" INTEGER NOT NULL DEFAULT 0,
    "visible" BOOLEAN NOT NULL DEFAULT true,
    CONSTRAINT "project_sections_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "project_images" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "project_id" INTEGER NOT NULL,
    "media_id" INTEGER NOT NULL,
    "caption" TEXT,
    "display_order" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "project_images_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "project_images_media_id_fkey" FOREIGN KEY ("media_id") REFERENCES "media" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "project_features" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "project_id" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "display_order" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "project_features_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "technologies" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "icon" TEXT,
    "category" TEXT,
    "website_url" TEXT,
    "display_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "project_technologies" (
    "project_id" INTEGER NOT NULL,
    "technology_id" INTEGER NOT NULL,

    PRIMARY KEY ("project_id", "technology_id"),
    CONSTRAINT "project_technologies_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "project_technologies_technology_id_fkey" FOREIGN KEY ("technology_id") REFERENCES "technologies" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "security_assessments" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "project_id" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "scope" TEXT,
    "methodology" TEXT,
    "summary" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PLANNED' CHECK ("status" IN ('PLANNED', 'IN_PROGRESS', 'COMPLETED', 'RETESTED')),
    "is_public" BOOLEAN NOT NULL DEFAULT false,
    "assessed_at" DATETIME,
    "retested_at" DATETIME,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "security_assessments_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "security_assessment_tests" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "assessment_id" INTEGER NOT NULL,
    "test_type" TEXT NOT NULL CHECK ("test_type" IN ('AUTHENTICATION', 'AUTHORIZATION', 'IDOR', 'XSS', 'SQL_INJECTION', 'CSRF', 'SSRF', 'FILE_UPLOAD', 'API_SECURITY', 'JWT_SECURITY', 'SESSION_MANAGEMENT', 'RATE_LIMITING', 'DEPENDENCY_SECURITY', 'SECURITY_HEADERS', 'BUSINESS_LOGIC')),
    "result" TEXT NOT NULL DEFAULT 'NOT_TESTED' CHECK ("result" IN ('PASS', 'ISSUES_FOUND', 'NOT_APPLICABLE', 'NOT_TESTED')),
    "notes" TEXT,
    "display_order" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "security_assessment_tests_assessment_id_fkey" FOREIGN KEY ("assessment_id") REFERENCES "security_assessments" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "security_findings" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "assessment_id" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "severity" TEXT NOT NULL CHECK ("severity" IN ('CRITICAL', 'HIGH', 'MEDIUM', 'LOW', 'INFORMATIONAL')),
    "description" TEXT,
    "impact" TEXT,
    "affected_component" TEXT,
    "remediation" TEXT,
    "status" TEXT NOT NULL DEFAULT 'OPEN' CHECK ("status" IN ('OPEN', 'FIXED', 'ACCEPTED_RISK', 'FALSE_POSITIVE', 'RETESTED')),
    "cwe_id" TEXT,
    "is_public" BOOLEAN NOT NULL DEFAULT false,
    "discovered_at" DATETIME,
    "resolved_at" DATETIME,
    "display_order" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "security_findings_assessment_id_fkey" FOREIGN KEY ("assessment_id") REFERENCES "security_assessments" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "article_categories" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "display_order" INTEGER NOT NULL DEFAULT 0
);

-- CreateTable
CREATE TABLE "articles" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "title" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "excerpt" TEXT,
    "content" TEXT NOT NULL,
    "cover_media_id" INTEGER,
    "author_id" INTEGER NOT NULL,
    "category_id" INTEGER,
    "status" TEXT NOT NULL DEFAULT 'DRAFT' CHECK ("status" IN ('DRAFT', 'PUBLISHED', 'ARCHIVED')),
    "reading_time_minutes" INTEGER NOT NULL DEFAULT 1,
    "view_count" INTEGER NOT NULL DEFAULT 0,
    "published_at" DATETIME,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "articles_cover_media_id_fkey" FOREIGN KEY ("cover_media_id") REFERENCES "media" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "articles_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "users" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "articles_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "article_categories" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "tags" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL
);

-- CreateTable
CREATE TABLE "article_tags" (
    "article_id" INTEGER NOT NULL,
    "tag_id" INTEGER NOT NULL,

    PRIMARY KEY ("article_id", "tag_id"),
    CONSTRAINT "article_tags_article_id_fkey" FOREIGN KEY ("article_id") REFERENCES "articles" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "article_tags_tag_id_fkey" FOREIGN KEY ("tag_id") REFERENCES "tags" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "security_research" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "title" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "content" TEXT NOT NULL,
    "category" TEXT NOT NULL CHECK ("category" IN ('RESEARCH', 'WRITEUP', 'METHODOLOGY', 'NOTES', 'TOOL')),
    "status" TEXT NOT NULL DEFAULT 'DRAFT' CHECK ("status" IN ('DRAFT', 'PUBLISHED', 'ARCHIVED')),
    "cover_media_id" INTEGER,
    "view_count" INTEGER NOT NULL DEFAULT 0,
    "published_at" DATETIME,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "security_research_cover_media_id_fkey" FOREIGN KEY ("cover_media_id") REFERENCES "media" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "research_tags" (
    "research_id" INTEGER NOT NULL,
    "tag_id" INTEGER NOT NULL,

    PRIMARY KEY ("research_id", "tag_id"),
    CONSTRAINT "research_tags_research_id_fkey" FOREIGN KEY ("research_id") REFERENCES "security_research" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "research_tags_tag_id_fkey" FOREIGN KEY ("tag_id") REFERENCES "tags" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "research_references" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "research_id" INTEGER NOT NULL,
    "label" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "display_order" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "research_references_research_id_fkey" FOREIGN KEY ("research_id") REFERENCES "security_research" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "profiles" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "full_name" TEXT NOT NULL,
    "headline" TEXT,
    "short_bio" TEXT,
    "full_bio" TEXT,
    "location" TEXT,
    "public_email" TEXT,
    "avatar_media_id" INTEGER,
    "resume_media_id" INTEGER,
    "available_for_work" BOOLEAN NOT NULL DEFAULT false,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "profiles_avatar_media_id_fkey" FOREIGN KEY ("avatar_media_id") REFERENCES "media" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "profiles_resume_media_id_fkey" FOREIGN KEY ("resume_media_id") REFERENCES "media" ("id") ON DELETE SET NULL ON UPDATE CASCADE

    -- Singleton table: exactly one row may ever exist (docs/architecture/02 §7).
    CONSTRAINT "profiles_singleton_check" CHECK ("id" = 1)
);

-- CreateTable
CREATE TABLE "skill_categories" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "icon" TEXT,
    "display_order" INTEGER NOT NULL DEFAULT 0,
    "visible" BOOLEAN NOT NULL DEFAULT true
);

-- CreateTable
CREATE TABLE "skills" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "category_id" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "icon" TEXT,
    "description" TEXT,
    "level" TEXT NOT NULL DEFAULT 'INTERMEDIATE' CHECK ("level" IN ('BEGINNER', 'INTERMEDIATE', 'ADVANCED')),
    "display_order" INTEGER NOT NULL DEFAULT 0,
    "visible" BOOLEAN NOT NULL DEFAULT true,
    CONSTRAINT "skills_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "skill_categories" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "certifications" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT NOT NULL,
    "issuer" TEXT NOT NULL,
    "description" TEXT,
    "certificate_media_id" INTEGER,
    "credential_url" TEXT,
    "issue_date" DATETIME,
    "expiration_date" DATETIME,
    "display_order" INTEGER NOT NULL DEFAULT 0,
    "visible" BOOLEAN NOT NULL DEFAULT true,
    CONSTRAINT "certifications_certificate_media_id_fkey" FOREIGN KEY ("certificate_media_id") REFERENCES "media" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "experiences" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "position" TEXT NOT NULL,
    "organization" TEXT NOT NULL,
    "location" TEXT,
    "description" TEXT,
    "start_date" DATETIME NOT NULL,
    "end_date" DATETIME,
    "is_current" BOOLEAN NOT NULL DEFAULT false,
    "display_order" INTEGER NOT NULL DEFAULT 0,
    "visible" BOOLEAN NOT NULL DEFAULT true
);

-- CreateTable
CREATE TABLE "experience_achievements" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "experience_id" INTEGER NOT NULL,
    "text" TEXT NOT NULL,
    "display_order" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "experience_achievements_experience_id_fkey" FOREIGN KEY ("experience_id") REFERENCES "experiences" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "experience_technologies" (
    "experience_id" INTEGER NOT NULL,
    "technology_id" INTEGER NOT NULL,

    PRIMARY KEY ("experience_id", "technology_id"),
    CONSTRAINT "experience_technologies_experience_id_fkey" FOREIGN KEY ("experience_id") REFERENCES "experiences" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "experience_technologies_technology_id_fkey" FOREIGN KEY ("technology_id") REFERENCES "technologies" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "education" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "institution" TEXT NOT NULL,
    "degree" TEXT NOT NULL,
    "field" TEXT,
    "description" TEXT,
    "start_date" DATETIME NOT NULL,
    "end_date" DATETIME,
    "display_order" INTEGER NOT NULL DEFAULT 0,
    "visible" BOOLEAN NOT NULL DEFAULT true
);

-- CreateTable
CREATE TABLE "timeline_entries" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "entry_date" DATETIME NOT NULL,
    "year_label" TEXT,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "category" TEXT,
    "display_order" INTEGER NOT NULL DEFAULT 0,
    "visible" BOOLEAN NOT NULL DEFAULT true
);

-- CreateTable
CREATE TABLE "social_links" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "platform" TEXT NOT NULL,
    "label" TEXT,
    "url" TEXT NOT NULL,
    "icon" TEXT,
    "display_order" INTEGER NOT NULL DEFAULT 0,
    "enabled" BOOLEAN NOT NULL DEFAULT true
);

-- CreateTable
CREATE TABLE "contact_messages" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "subject" TEXT,
    "message" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'UNREAD' CHECK ("status" IN ('UNREAD', 'READ', 'ARCHIVED')),
    "ip_hash" TEXT,
    "user_agent" TEXT,
    "spam_score" INTEGER NOT NULL DEFAULT 0,
    "read_at" DATETIME,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "site_settings" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "key" TEXT NOT NULL,
    "value" TEXT,
    "value_type" TEXT NOT NULL DEFAULT 'STRING' CHECK ("value_type" IN ('STRING', 'NUMBER', 'BOOLEAN', 'JSON')),
    "group_name" TEXT,
    "is_public" BOOLEAN NOT NULL DEFAULT false,
    "updated_at" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "page_views" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "path" TEXT NOT NULL,
    "entity_type" TEXT CHECK ("entity_type" IN ('PROJECT', 'ARTICLE', 'RESEARCH', 'PAGE')),
    "entity_id" INTEGER,
    "referrer_host" TEXT,
    "visitor_hash" TEXT NOT NULL,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "analytics_daily" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "day" DATETIME NOT NULL,
    "path" TEXT NOT NULL,
    "entity_type" TEXT,
    "entity_id" INTEGER,
    "views" INTEGER NOT NULL DEFAULT 0,
    "unique_visitors" INTEGER NOT NULL DEFAULT 0
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "refresh_tokens_token_hash_key" ON "refresh_tokens"("token_hash");

-- CreateIndex
CREATE INDEX "refresh_tokens_user_id_revoked_at_idx" ON "refresh_tokens"("user_id", "revoked_at");

-- CreateIndex
CREATE INDEX "refresh_tokens_family_id_idx" ON "refresh_tokens"("family_id");

-- CreateIndex
CREATE UNIQUE INDEX "media_filename_key" ON "media"("filename");

-- CreateIndex
CREATE INDEX "media_uploaded_by_idx" ON "media"("uploaded_by");

-- CreateIndex
CREATE INDEX "media_kind_idx" ON "media"("kind");

-- CreateIndex
CREATE INDEX "audit_logs_created_at_idx" ON "audit_logs"("created_at");

-- CreateIndex
CREATE INDEX "audit_logs_entity_type_entity_id_idx" ON "audit_logs"("entity_type", "entity_id");

-- CreateIndex
CREATE INDEX "audit_logs_user_id_idx" ON "audit_logs"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "projects_slug_key" ON "projects"("slug");

-- CreateIndex
CREATE INDEX "projects_cover_media_id_idx" ON "projects"("cover_media_id");

-- CreateIndex
CREATE INDEX "projects_status_published_at_idx" ON "projects"("status", "published_at");

-- CreateIndex
CREATE INDEX "project_sections_project_id_idx" ON "project_sections"("project_id");

-- CreateIndex
CREATE UNIQUE INDEX "project_sections_project_id_section_key_key" ON "project_sections"("project_id", "section_key");

-- CreateIndex
CREATE INDEX "project_images_project_id_idx" ON "project_images"("project_id");

-- CreateIndex
CREATE INDEX "project_images_media_id_idx" ON "project_images"("media_id");

-- CreateIndex
CREATE INDEX "project_features_project_id_idx" ON "project_features"("project_id");

-- CreateIndex
CREATE UNIQUE INDEX "technologies_name_key" ON "technologies"("name");

-- CreateIndex
CREATE UNIQUE INDEX "technologies_slug_key" ON "technologies"("slug");

-- CreateIndex
CREATE INDEX "project_technologies_technology_id_idx" ON "project_technologies"("technology_id");

-- CreateIndex
CREATE INDEX "security_assessments_project_id_idx" ON "security_assessments"("project_id");

-- CreateIndex
CREATE INDEX "security_assessment_tests_assessment_id_idx" ON "security_assessment_tests"("assessment_id");

-- CreateIndex
CREATE UNIQUE INDEX "security_assessment_tests_assessment_id_test_type_key" ON "security_assessment_tests"("assessment_id", "test_type");

-- CreateIndex
CREATE INDEX "security_findings_assessment_id_idx" ON "security_findings"("assessment_id");

-- CreateIndex
CREATE UNIQUE INDEX "article_categories_name_key" ON "article_categories"("name");

-- CreateIndex
CREATE UNIQUE INDEX "article_categories_slug_key" ON "article_categories"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "articles_slug_key" ON "articles"("slug");

-- CreateIndex
CREATE INDEX "articles_cover_media_id_idx" ON "articles"("cover_media_id");

-- CreateIndex
CREATE INDEX "articles_author_id_idx" ON "articles"("author_id");

-- CreateIndex
CREATE INDEX "articles_category_id_status_idx" ON "articles"("category_id", "status");

-- CreateIndex
CREATE INDEX "articles_status_published_at_idx" ON "articles"("status", "published_at");

-- CreateIndex
CREATE UNIQUE INDEX "tags_name_key" ON "tags"("name");

-- CreateIndex
CREATE UNIQUE INDEX "tags_slug_key" ON "tags"("slug");

-- CreateIndex
CREATE INDEX "article_tags_tag_id_idx" ON "article_tags"("tag_id");

-- CreateIndex
CREATE UNIQUE INDEX "security_research_slug_key" ON "security_research"("slug");

-- CreateIndex
CREATE INDEX "security_research_cover_media_id_idx" ON "security_research"("cover_media_id");

-- CreateIndex
CREATE INDEX "security_research_status_published_at_idx" ON "security_research"("status", "published_at");

-- CreateIndex
CREATE INDEX "research_tags_tag_id_idx" ON "research_tags"("tag_id");

-- CreateIndex
CREATE INDEX "research_references_research_id_idx" ON "research_references"("research_id");

-- CreateIndex
CREATE INDEX "profiles_avatar_media_id_idx" ON "profiles"("avatar_media_id");

-- CreateIndex
CREATE INDEX "profiles_resume_media_id_idx" ON "profiles"("resume_media_id");

-- CreateIndex
CREATE UNIQUE INDEX "skill_categories_name_key" ON "skill_categories"("name");

-- CreateIndex
CREATE UNIQUE INDEX "skill_categories_slug_key" ON "skill_categories"("slug");

-- CreateIndex
CREATE INDEX "skills_category_id_idx" ON "skills"("category_id");

-- CreateIndex
CREATE INDEX "certifications_certificate_media_id_idx" ON "certifications"("certificate_media_id");

-- CreateIndex
CREATE INDEX "experience_achievements_experience_id_idx" ON "experience_achievements"("experience_id");

-- CreateIndex
CREATE INDEX "experience_technologies_technology_id_idx" ON "experience_technologies"("technology_id");

-- CreateIndex
CREATE INDEX "contact_messages_status_created_at_idx" ON "contact_messages"("status", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "site_settings_key_key" ON "site_settings"("key");

-- CreateIndex
CREATE INDEX "page_views_created_at_idx" ON "page_views"("created_at");

-- CreateIndex
CREATE INDEX "page_views_entity_type_entity_id_created_at_idx" ON "page_views"("entity_type", "entity_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "analytics_daily_day_path_entity_type_entity_id_key" ON "analytics_daily"("day", "path", "entity_type", "entity_id");

-- =============================================================================
-- Hand-written SQL beyond this point (docs/architecture/02 §9): the partial
-- index Prisma's schema DSL cannot express on SQLite, and the FTS5 search
-- index with the triggers that keep it consistent with published content.
-- =============================================================================

-- Partial index: every public project-list query filters on status='PUBLISHED',
-- so this index only needs to cover that slice (docs/architecture/02 §8).
CREATE INDEX "projects_featured_display_order_partial_idx"
  ON "projects"("featured", "display_order")
  WHERE "status" = 'PUBLISHED';

-- FTS5 virtual table (docs/architecture/02 §2, "search_index"). Only
-- PUBLISHED content is ever present here — draft content cannot leak through
-- search even if the query layer had a bug, because it is never indexed in
-- the first place (docs/architecture/05 §5).
CREATE VIRTUAL TABLE "search_index" USING fts5(
  entity_type UNINDEXED,   -- PROJECT | ARTICLE | RESEARCH | TECHNOLOGY
  entity_id   UNINDEXED,
  slug        UNINDEXED,
  title,
  summary,
  body,
  tokenize = 'porter unicode61'
);

-- --- projects --------------------------------------------------------------

CREATE TRIGGER "trg_projects_search_insert"
AFTER INSERT ON "projects"
WHEN NEW."status" = 'PUBLISHED'
BEGIN
  INSERT INTO "search_index"(entity_type, entity_id, slug, title, summary, body)
  VALUES ('PROJECT', NEW."id", NEW."slug", NEW."title", NEW."short_description", COALESCE(NEW."full_description", ''));
END;

-- Delete-then-conditionally-reinsert covers every transition (publish,
-- unpublish, archive, and an edit to already-published content) with one rule.
CREATE TRIGGER "trg_projects_search_update"
AFTER UPDATE ON "projects"
BEGIN
  DELETE FROM "search_index" WHERE entity_type = 'PROJECT' AND entity_id = OLD."id";
  INSERT INTO "search_index"(entity_type, entity_id, slug, title, summary, body)
  SELECT 'PROJECT', NEW."id", NEW."slug", NEW."title", NEW."short_description", COALESCE(NEW."full_description", '')
  WHERE NEW."status" = 'PUBLISHED';
END;

CREATE TRIGGER "trg_projects_search_delete"
AFTER DELETE ON "projects"
BEGIN
  DELETE FROM "search_index" WHERE entity_type = 'PROJECT' AND entity_id = OLD."id";
END;

-- --- articles ----------------------------------------------------------------

CREATE TRIGGER "trg_articles_search_insert"
AFTER INSERT ON "articles"
WHEN NEW."status" = 'PUBLISHED'
BEGIN
  INSERT INTO "search_index"(entity_type, entity_id, slug, title, summary, body)
  VALUES ('ARTICLE', NEW."id", NEW."slug", NEW."title", COALESCE(NEW."excerpt", ''), NEW."content");
END;

CREATE TRIGGER "trg_articles_search_update"
AFTER UPDATE ON "articles"
BEGIN
  DELETE FROM "search_index" WHERE entity_type = 'ARTICLE' AND entity_id = OLD."id";
  INSERT INTO "search_index"(entity_type, entity_id, slug, title, summary, body)
  SELECT 'ARTICLE', NEW."id", NEW."slug", NEW."title", COALESCE(NEW."excerpt", ''), NEW."content"
  WHERE NEW."status" = 'PUBLISHED';
END;

CREATE TRIGGER "trg_articles_search_delete"
AFTER DELETE ON "articles"
BEGIN
  DELETE FROM "search_index" WHERE entity_type = 'ARTICLE' AND entity_id = OLD."id";
END;

-- --- security_research ------------------------------------------------------

CREATE TRIGGER "trg_research_search_insert"
AFTER INSERT ON "security_research"
WHEN NEW."status" = 'PUBLISHED'
BEGIN
  INSERT INTO "search_index"(entity_type, entity_id, slug, title, summary, body)
  VALUES ('RESEARCH', NEW."id", NEW."slug", NEW."title", COALESCE(NEW."description", ''), NEW."content");
END;

CREATE TRIGGER "trg_research_search_update"
AFTER UPDATE ON "security_research"
BEGIN
  DELETE FROM "search_index" WHERE entity_type = 'RESEARCH' AND entity_id = OLD."id";
  INSERT INTO "search_index"(entity_type, entity_id, slug, title, summary, body)
  SELECT 'RESEARCH', NEW."id", NEW."slug", NEW."title", COALESCE(NEW."description", ''), NEW."content"
  WHERE NEW."status" = 'PUBLISHED';
END;

CREATE TRIGGER "trg_research_search_delete"
AFTER DELETE ON "security_research"
BEGIN
  DELETE FROM "search_index" WHERE entity_type = 'RESEARCH' AND entity_id = OLD."id";
END;

-- --- technologies ------------------------------------------------------------
-- Technologies have no draft/publish workflow — they are always public, so
-- they are indexed unconditionally on create and re-indexed unconditionally
-- on edit, rather than gated on a status column that does not exist here.

CREATE TRIGGER "trg_technologies_search_insert"
AFTER INSERT ON "technologies"
BEGIN
  INSERT INTO "search_index"(entity_type, entity_id, slug, title, summary, body)
  VALUES ('TECHNOLOGY', NEW."id", NEW."slug", NEW."name", COALESCE(NEW."category", ''), '');
END;

CREATE TRIGGER "trg_technologies_search_update"
AFTER UPDATE ON "technologies"
BEGIN
  DELETE FROM "search_index" WHERE entity_type = 'TECHNOLOGY' AND entity_id = OLD."id";
  INSERT INTO "search_index"(entity_type, entity_id, slug, title, summary, body)
  VALUES ('TECHNOLOGY', NEW."id", NEW."slug", NEW."name", COALESCE(NEW."category", ''), '');
END;

CREATE TRIGGER "trg_technologies_search_delete"
AFTER DELETE ON "technologies"
BEGIN
  DELETE FROM "search_index" WHERE entity_type = 'TECHNOLOGY' AND entity_id = OLD."id";
END;
