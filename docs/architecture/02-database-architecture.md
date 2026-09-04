# 02 — Database Architecture

**Engine:** SQLite (WAL) · **ORM:** Prisma · **Migrations:** `prisma migrate` (+ hand-written raw SQL
for `CHECK` constraints and FTS5).

---

## 1. Conventions

| Rule | Decision |
|---|---|
| Primary key | `id INTEGER PRIMARY KEY AUTOINCREMENT` (SQLite rowid — fastest, smallest). Public URLs use `slug`, never `id`, so ids are not enumerable in the public surface. |
| Naming | tables `snake_case` plural; columns `snake_case`; Prisma models `PascalCase` singular via `@@map` |
| Timestamps | `created_at`, `updated_at` on every mutable table (`DATETIME`, UTC, ISO-8601) |
| Soft delete | **Not used.** `status = ARCHIVED` covers the requirement (§52). Deletes are real deletes + an audit log entry. |
| Enums | `TEXT` + SQLite `CHECK` constraint + Zod union + TS union (Prisma/SQLite has no enums) |
| Booleans | `INTEGER` 0/1 (Prisma `Boolean`) |
| Money/decimals | none in this schema |
| Foreign keys | `PRAGMA foreign_keys = ON` set at every connection. Explicit `ON DELETE` on every FK. |
| Slugs | lowercase, `[a-z0-9-]+`, unique per entity, generated server-side, editable, immutable after first publish unless forced (creates a redirect row → future) |
| Ordering | `display_order INTEGER NOT NULL DEFAULT 0`, sorted `ORDER BY display_order ASC, id ASC` |
| Publishing | `status TEXT CHECK (status IN ('DRAFT','PUBLISHED','ARCHIVED'))` + `published_at DATETIME NULL` |

### Startup pragmas (non-negotiable)

```sql
PRAGMA journal_mode = WAL;      -- concurrent readers during a write
PRAGMA foreign_keys = ON;       -- OFF by default in SQLite!
PRAGMA busy_timeout = 5000;     -- wait instead of throwing SQLITE_BUSY
PRAGMA synchronous = NORMAL;    -- safe with WAL, much faster
-- foreign_keys is PER-CONNECTION in SQLite; it is applied in the Prisma client bootstrap.
```

---

## 2. ERD — Identity, Media, Audit

```mermaid
erDiagram
    users ||--o{ refresh_tokens : "issues"
    users ||--o{ audit_logs : "performs"
    users ||--o{ media : "uploads"
    users ||--o{ articles : "authors"
    media ||--o| profiles : "avatar"

    users {
        int id PK
        string email UK "lowercased"
        string password_hash
        string name
        string role "CHECK: ADMIN|SUPER_ADMIN|EDITOR"
        bool is_active
        datetime last_login_at
        int failed_login_count
        datetime locked_until
        datetime created_at
        datetime updated_at
    }
    refresh_tokens {
        int id PK
        int user_id FK
        string token_hash UK "sha256, never plaintext"
        string family_id "reuse detection"
        datetime expires_at
        datetime revoked_at
        string replaced_by_hash
        string user_agent
        string ip_hash
        datetime created_at
    }
    media {
        int id PK
        string filename UK "content-hashed, server-generated"
        string original_name "sanitised, display only"
        string mime_type "allow-list"
        int size_bytes
        int width
        int height
        string checksum_sha256
        string storage_path
        string alt_text
        string kind "AVATAR|PROJECT_COVER|SCREENSHOT|CERTIFICATE|ARTICLE_COVER|OTHER"
        int uploaded_by FK
        datetime created_at
    }
    audit_logs {
        int id PK
        int user_id FK "nullable: system actions"
        string action "PROJECT_PUBLISH, LOGIN_SUCCESS, ..."
        string entity_type
        int entity_id
        string metadata_json "redacted, no secrets"
        string ip_hash
        string user_agent
        datetime created_at
    }
```

## 3. ERD — Projects & Security Assessments

```mermaid
erDiagram
    projects ||--o{ project_images : "has"
    projects ||--o{ project_features : "has"
    projects ||--o{ project_sections : "has"
    projects ||--o{ project_technologies : "uses"
    technologies ||--o{ project_technologies : "used by"
    projects ||--o{ security_assessments : "assessed by"
    security_assessments ||--o{ security_assessment_tests : "covers"
    security_assessments ||--o{ security_findings : "reports"
    media ||--o{ project_images : "file"
    media ||--o{ projects : "cover"

    projects {
        int id PK
        string title
        string slug UK
        string short_description
        string full_description "markdown"
        string category "CHECK enum"
        string status "DRAFT|PUBLISHED|ARCHIVED"
        bool featured
        int cover_media_id FK
        string problem "markdown, nullable"
        string solution "markdown, nullable"
        string architecture "markdown, nullable"
        string challenges "markdown, nullable"
        string solutions_detail "markdown, nullable"
        string lessons_learned "markdown, nullable"
        string deployment_notes "markdown, nullable"
        string github_url
        string live_url
        bool security_tested
        string security_summary
        string testing_summary
        string visible_sections_json "ordered section keys"
        int display_order
        int view_count
        datetime published_at
        datetime created_at
        datetime updated_at
    }
    project_sections {
        int id PK
        int project_id FK
        string section_key "built-in key or custom"
        string title
        string body "markdown, nullable for built-ins"
        int display_order
        bool visible
    }
    project_images {
        int id PK
        int project_id FK
        int media_id FK
        string caption
        int display_order
    }
    project_features {
        int id PK
        int project_id FK
        string title
        string description
        int display_order
    }
    technologies {
        int id PK
        string name UK
        string slug UK
        string icon
        string category
        string website_url
        int display_order
        datetime created_at
    }
    project_technologies {
        int project_id FK
        int technology_id FK
    }
    security_assessments {
        int id PK
        int project_id FK
        string title
        string scope
        string methodology "markdown"
        string summary "markdown"
        string status "PLANNED|IN_PROGRESS|COMPLETED|RETESTED"
        bool is_public "gates public rendering"
        date assessed_at
        date retested_at
        datetime created_at
        datetime updated_at
    }
    security_assessment_tests {
        int id PK
        int assessment_id FK
        string test_type "AUTHENTICATION|AUTHORIZATION|IDOR|XSS|SQLI|CSRF|SSRF|FILE_UPLOAD|API|JWT|SESSION|RATE_LIMIT|DEPENDENCY|HEADERS|BUSINESS_LOGIC"
        string result "PASS|ISSUES_FOUND|NOT_APPLICABLE|NOT_TESTED"
        string notes
        int display_order
    }
    security_findings {
        int id PK
        int assessment_id FK
        string title
        string severity "CRITICAL|HIGH|MEDIUM|LOW|INFORMATIONAL"
        string description "markdown"
        string impact
        string affected_component
        string remediation
        string status "OPEN|FIXED|ACCEPTED_RISK|FALSE_POSITIVE|RETESTED"
        string cwe_id
        bool is_public
        date discovered_at
        date resolved_at
        int display_order
    }
```

> **Public-safety rule:** a finding is rendered publicly only when
> `assessment.is_public AND finding.is_public AND project.status = 'PUBLISHED'`.
> Enforced in `securityRepository`, not in the view. Findings with `status='OPEN'` and
> `severity IN ('CRITICAL','HIGH')` are **never** exposed publicly, regardless of flags —
> publishing an unfixed critical vulnerability in your own live project is a real-world risk.

## 4. ERD — Articles & Security Research

```mermaid
erDiagram
    article_categories ||--o{ articles : "groups"
    users ||--o{ articles : "writes"
    articles ||--o{ article_tags : "tagged"
    tags ||--o{ article_tags : "tags"
    tags ||--o{ research_tags : "tags"
    security_research ||--o{ research_tags : "tagged"
    security_research ||--o{ research_references : "cites"

    articles {
        int id PK
        string title
        string slug UK
        string excerpt
        string content "markdown"
        int cover_media_id FK
        int author_id FK
        int category_id FK
        string status "DRAFT|PUBLISHED|ARCHIVED"
        int reading_time_minutes "computed on save"
        int view_count
        datetime published_at
        datetime created_at
        datetime updated_at
    }
    article_categories {
        int id PK
        string name UK
        string slug UK
        string description
        int display_order
    }
    tags {
        int id PK
        string name UK
        string slug UK
    }
    article_tags {
        int article_id FK
        int tag_id FK
    }
    security_research {
        int id PK
        string title
        string slug UK
        string description
        string content "markdown"
        string category "RESEARCH|WRITEUP|METHODOLOGY|NOTES|TOOL"
        string status "DRAFT|PUBLISHED|ARCHIVED"
        int cover_media_id FK
        int view_count
        datetime published_at
        datetime created_at
        datetime updated_at
    }
    research_tags {
        int research_id FK
        int tag_id FK
    }
    research_references {
        int id PK
        int research_id FK
        string label
        string url
        int display_order
    }
```

## 5. ERD — Profile, CV, Site

```mermaid
erDiagram
    skill_categories ||--o{ skills : "groups"
    experiences ||--o{ experience_achievements : "lists"
    experiences ||--o{ experience_technologies : "uses"
    technologies ||--o{ experience_technologies : "used in"
    media ||--o{ certifications : "certificate image"

    profiles {
        int id PK "singleton, id=1"
        string full_name
        string headline
        string short_bio
        string full_bio "markdown"
        string location
        string public_email
        int avatar_media_id FK
        int resume_media_id FK
        bool available_for_work
        datetime updated_at
    }
    skill_categories {
        int id PK
        string name UK
        string slug UK
        string icon
        int display_order
        bool visible
    }
    skills {
        int id PK
        int category_id FK
        string name
        string icon
        string description
        string level "BEGINNER|INTERMEDIATE|ADVANCED"
        int display_order
        bool visible
    }
    certifications {
        int id PK
        string name
        string issuer
        string description
        int certificate_media_id FK
        string credential_url
        date issue_date
        date expiration_date
        int display_order
        bool visible
    }
    experiences {
        int id PK
        string position
        string organization
        string location
        string description "markdown"
        date start_date
        date end_date
        bool is_current
        int display_order
        bool visible
    }
    experience_achievements {
        int id PK
        int experience_id FK
        string text
        int display_order
    }
    experience_technologies {
        int experience_id FK
        int technology_id FK
    }
    education {
        int id PK
        string institution
        string degree
        string field
        string description
        date start_date
        date end_date
        int display_order
        bool visible
    }
    timeline_entries {
        int id PK
        date entry_date
        string year_label
        string title
        string description
        string category
        int display_order
        bool visible
    }
    social_links {
        int id PK
        string platform
        string label
        string url
        string icon
        int display_order
        bool enabled
    }
```

## 6. ERD — Operations

```mermaid
erDiagram
    contact_messages {
        int id PK
        string name
        string email
        string subject
        string message
        string status "UNREAD|READ|ARCHIVED"
        string ip_hash "salted, not raw IP"
        string user_agent
        int spam_score
        datetime read_at
        datetime created_at
    }
    site_settings {
        int id PK
        string key UK "site.title, seo.default_description, ..."
        string value
        string value_type "STRING|NUMBER|BOOLEAN|JSON"
        string group_name
        bool is_public "gates exposure via public API"
        datetime updated_at
    }
    page_views {
        int id PK
        string path
        string entity_type "PROJECT|ARTICLE|RESEARCH|PAGE"
        int entity_id
        string referrer_host "host only, no query string"
        string visitor_hash "sha256(ip + ua + daily_salt)"
        datetime created_at
    }
    analytics_daily {
        int id PK
        date day
        string path
        string entity_type
        int entity_id
        int views
        int unique_visitors
    }
```

`search_index` is an **FTS5 virtual table**, created by raw SQL migration (Prisma cannot model it):

```sql
CREATE VIRTUAL TABLE search_index USING fts5(
  entity_type UNINDEXED,   -- PROJECT | ARTICLE | RESEARCH | TECHNOLOGY
  entity_id   UNINDEXED,
  slug        UNINDEXED,
  title,
  summary,
  body,
  tokenize = 'porter unicode61'
);
```

Only **published** rows are indexed; unpublishing deletes the row. Search therefore cannot leak
drafts even if the query layer had a bug.

---

## 7. Key relationship decisions

| Relationship | Cardinality | On delete | Why |
|---|---|---|---|
| `projects → project_technologies → technologies` | M:N | `CASCADE` on the join only | Deleting a project never deletes a technology |
| `projects → security_assessments` | 1:N | `CASCADE` | An assessment has no meaning without its project; retests are separate rows |
| `security_assessments → findings` | 1:N | `CASCADE` | — |
| `media → projects.cover_media_id` | 1:N | `SET NULL` | Deleting a file must not delete the project |
| `media` deletion | — | Blocked if referenced | The service checks references first and returns `409 CONFLICT` listing usages |
| `users → articles.author_id` | 1:N | `RESTRICT` | Never orphan authorship silently |
| `users → audit_logs` | 1:N | `SET NULL` | Audit history survives user deletion |
| `articles → tags` | M:N | `CASCADE` on join | Tags are shared with research |
| `profiles` | singleton | — | Enforced with `CHECK (id = 1)` |

---

## 8. Indexes

Every FK gets an index (SQLite does **not** create them automatically). Beyond those:

```sql
CREATE UNIQUE INDEX idx_projects_slug          ON projects(slug);
CREATE        INDEX idx_projects_status_pub    ON projects(status, published_at DESC);
CREATE        INDEX idx_projects_featured      ON projects(featured, display_order) WHERE status='PUBLISHED';
CREATE UNIQUE INDEX idx_articles_slug          ON articles(slug);
CREATE        INDEX idx_articles_status_pub    ON articles(status, published_at DESC);
CREATE        INDEX idx_articles_category      ON articles(category_id, status);
CREATE UNIQUE INDEX idx_research_slug          ON security_research(slug);
CREATE        INDEX idx_research_status_pub    ON security_research(status, published_at DESC);
CREATE UNIQUE INDEX idx_users_email            ON users(email);
CREATE UNIQUE INDEX idx_refresh_token_hash     ON refresh_tokens(token_hash);
CREATE        INDEX idx_refresh_user_active    ON refresh_tokens(user_id, revoked_at);
CREATE        INDEX idx_audit_created          ON audit_logs(created_at DESC);
CREATE        INDEX idx_audit_entity           ON audit_logs(entity_type, entity_id);
CREATE        INDEX idx_messages_status        ON contact_messages(status, created_at DESC);
CREATE        INDEX idx_pageviews_day          ON page_views(created_at);
CREATE        INDEX idx_pageviews_entity       ON page_views(entity_type, entity_id, created_at);
CREATE UNIQUE INDEX idx_analytics_daily_uniq   ON analytics_daily(day, path, entity_type, entity_id);
CREATE UNIQUE INDEX idx_settings_key           ON site_settings(key);
```

Partial indexes (`WHERE status='PUBLISHED'`) are used because ~every public query filters on it and
SQLite supports them well.

---

## 9. Migration policy

- Every schema change is a **committed migration**. No `prisma db push` outside a scratch branch.
- Migration files are **read before commit** — Prisma's SQLite table-rebuild strategy can silently
  drop data on a column rename. Renames get a hand-written `-- CreateTable/INSERT SELECT/DROP` pair.
- `CHECK` constraints, partial indexes, FTS5 tables and triggers live in hand-authored SQL appended
  to the generated migration.
- `prisma migrate deploy` runs on container start, before the API accepts traffic. Never
  `migrate dev` in production.
- Rollback = restore the pre-migration backup. A `sqlite3 .backup` snapshot is taken automatically
  in the deploy script immediately before `migrate deploy`.

## 10. Seeding

| Script | Environment | Contents |
|---|---|---|
| `npm run db:bootstrap` | **all**, idempotent | Admin user (from `ADMIN_EMAIL` / `ADMIN_INITIAL_PASSWORD`, forced change on first login), the 7 skill categories, default `site_settings`, the singleton `profiles` row |
| `npm run db:seed` | dev/test only — refuses to run when `NODE_ENV=production` unless `--force` | Demo projects, articles, research, technologies, timeline. All flagged `is_demo` in the audit log so it is obvious what came from seed |

Per §21/§54: production never contains demo content.

## 11. Backups

`sqlite3 /data/portfolio.db ".backup /backups/portfolio-$(date +%F-%H%M).db"` on a daily cron,
7 daily + 4 weekly retained, plus `/data/uploads` in the same archive. `.backup` is used rather
than `cp` because it is safe against concurrent writers. Restore procedure documented in Phase 15.
