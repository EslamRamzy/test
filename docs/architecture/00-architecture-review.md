# 00 — Architecture Review

Review of the requirements brief for the **Eslam Ramzy Portfolio Platform**, before any code is written.

---

## 1. Summary of what was asked

A personal portfolio **platform** (not a static site) with:

- A public marketing/portfolio website (Next.js).
- A separate Admin Dashboard for full content management.
- A REST API backend (Express + TypeScript) over SQLite.
- JWT auth with refresh tokens, RBAC, audit logging.
- 16 content domains: Profile, Projects (+ case studies + security assessments + findings),
  Articles, Security Research, Skills, Technologies, Certifications, Experience, Education,
  Timeline, Social Links, Media, Contact Messages, Site Settings, Audit Logs, Analytics.
- Draft → Published → Archived workflow, enforced server-side.
- Global search, command palette, SEO, accessibility, performance, testing, security testing.

**The core non-negotiable goal:** never edit source code to add content. Everything content-shaped
must be a database row managed from `/admin`.

I have treated that goal as the primary architectural driver. Every design decision below is
tested against it.

---

## 2. Requirements review — verdict per area

| Area | Verdict | Note |
|---|---|---|
| Layered architecture (routes → controllers → services → repositories) | ✅ Sound | Adopted as-is |
| Next.js + React + TypeScript | ✅ Sound | App Router |
| Express + TypeScript backend, separate from Next.js | ⚠️ Sound but has consequences | See conflict **C1** |
| Bootstrap as the UI framework | ⚠️ Conflicts with the stated visual direction | See conflict **C2** |
| SQLite + Prisma | ⚠️ Mostly fine, several real limitations | See conflict **C3** |
| JWT + refresh token + secure cookies | ✅ Sound | Design in doc 04 |
| RBAC with a single `ADMIN` role | ✅ Sound | Design in doc 05 |
| Draft/Publish enforced server-side | ✅ Sound | Non-negotiable, enforced in repository layer |
| Media uploads to local disk | ⚠️ Constrains deployment | See conflict **C4** |
| Global search | ⚠️ Prisma cannot express it | See conflict **C5** |
| Analytics | ⚠️ Privacy + missing tables | See gap **G4** |
| Testing at 4 levels | ✅ Sound | Design in doc 10 |
| "No overengineering" (§50) | ✅ Adopted as a hard rule | See §6 below |

---

## 3. Conflicts found

### C1 — Two servers, one browser: cookie + CORS topology is undefined

The brief asks for a Next.js frontend **and** a separate Express API, with JWT in **secure cookies**
and `CORS_ORIGIN` in `.env`. Those two facts fight each other:

- If Next.js runs on `:3000` and Express on `:4000`, they are **cross-origin**. Auth cookies then
  require `SameSite=None; Secure`, which weakens CSRF posture and breaks entirely over plain HTTP
  in local dev on some browsers.
- Next.js Server Components fetching from `http://localhost:4000` do **not** automatically forward
  the browser's cookies — every authenticated server-side fetch must forward them explicitly.

**Proposed resolution:** keep the two processes (the brief wants a real, independently testable API
surface — and that is genuinely valuable for the security-testing goal in §45), but put them behind
**one public origin** in every environment. Next.js `rewrites()` proxies `/api/*` → Express.

Result: cookies are first-party (`SameSite=Strict`), no CORS preflight in normal operation, CORS
stays configured as defence-in-depth for direct API access. The API remains directly reachable on
its own port for testing tools (Burp, Postman, `supertest`).

→ **Decision D1** in doc 12.

### C2 — "Bootstrap" vs "Premium / minimal / elegant / not a gaming site"

Bootstrap 5 is requested. Bootstrap's default look is instantly recognisable and reads as
"admin template", which is the opposite of the requested premium, minimal, developer-oriented feel.

This is solvable, not blocking, but it must be done deliberately:

- Use **Bootstrap 5 SCSS source**, not the prebuilt CSS — override `$` variables (spacing scale,
  radii, font stack, greys, `$primary`) before importing, and import only the modules used.
- Add a thin token layer on top (CSS custom properties) for the light/dark themes so theming is
  runtime-switchable without a second stylesheet.
- Use `react-bootstrap` for interactive components (Modal, Dropdown, Offcanvas, Toast) instead of
  `bootstrap.bundle.js`. The bundled JS manipulates the DOM directly and fights React's reconciler;
  it also cannot run in a Server Component.

Without this, the site will look like every other Bootstrap portfolio.
→ **Decision D2** in doc 12 (Bootstrap-themed vs. Tailwind alternative).

### C3 — SQLite + Prisma limitations that affect the schema

These are real and shape the design:

1. **No native enums.** `status`, `severity`, `role` become `TEXT` columns. Integrity is enforced by
   (a) Zod schemas at the boundary, (b) TypeScript union types, (c) `CHECK` constraints added via
   raw SQL migrations. Prisma will not generate the `CHECK`s — I add them manually.
2. **No scalar list / array columns.** `Tags`, `Technologies`, `Achievements`, `Features`,
   `References` all become junction or child tables. Already reflected in the ERD.
3. **No case-insensitive filter mode** (`mode: 'insensitive'` is Postgres-only). Slug/email lookups
   therefore store a normalised lowercase value; free-text search goes through FTS5 (see C5).
4. **Single writer.** SQLite serialises writes. For a personal portfolio this is a non-issue, but
   WAL mode + `busy_timeout` must be set explicitly or concurrent admin saves + analytics writes
   will throw `SQLITE_BUSY`.
5. **Migrations are destructive-prone.** SQLite `ALTER TABLE` is limited; Prisma emulates changes by
   table rebuild. Every migration gets reviewed by hand before commit.

None of these justify changing the database. SQLite stays. The schema is written so that a future
PostgreSQL move is a provider swap plus enum promotion — no application-layer rewrite.

### C4 — Local file uploads constrain the deployment target

SQLite (a file) + uploaded media (files) means the application **requires a persistent writable
volume**. That rules out Vercel/Netlify/Cloudflare-style serverless hosting for the API, where the
filesystem is ephemeral and read-only.

Viable targets: a VPS (Docker Compose + volume), Fly.io (volume), Railway (volume), or a Raspberry
Pi/home server. → **Decision D3** in doc 12.

The storage layer is defined behind a small `StorageAdapter` interface (`put`, `get`, `delete`,
`url`) with one `LocalDiskStorage` implementation, so S3/R2 can be added later without touching
services. This is the one abstraction I am deliberately keeping despite §50 — the cost is ~40 lines
and it removes a future rewrite.

### C5 — "Global search" is not expressible in Prisma over SQLite

`contains` on SQLite is a `LIKE '%term%'` scan — no ranking, no stemming, no multi-column relevance,
and it cannot search across Projects + Articles + Research + Technologies in one ordered result set.

**Proposed resolution:** an **FTS5 virtual table** (`search_index`) maintained by the service layer
on every publish/update/unpublish, queried through `prisma.$queryRaw` with `bm25()` ranking.
FTS5 ships with SQLite by default and needs no extra dependency.

Rejected alternatives: client-side search index (violates §38 "don't ship all content to the
browser"), Meilisearch/Typesense (a whole extra service — overengineering for this scale).

### C6 — `/security` is overloaded and means two different things

The brief uses "Security" for two unrelated concepts:

- **§13 Security Research** — standalone published content (writeups, methodology, notes). This is
  what `/security` and `/security/[slug]` list in §5.
- **§9 Security Assessment** — a *child of a Project*: tests performed, findings, severities.
  This has no route of its own in §5.

If both live under `/security`, slugs collide and the information architecture gets confusing.

**Proposed resolution:**
- `/security` and `/security/[slug]` → Security **Research** only (matches §5 literally).
- Project assessments render **inside** the project case study at
  `/projects/[slug]#security`, plus an index at `/projects?security=tested`.
- Admin keeps them as two separate modules: "Security Research" and (inside a project editor) a
  "Security Assessment" tab.

→ **Decision D4** in doc 12.

### C7 — Skill categories: fixed list vs. managed table

§10 gives a **fixed** category list (Frontend, Backend, Database, Security, DevOps, Tools, Other),
but §27 lists a `skill_categories` **table** and §23 says all content must be admin-managed.

**Resolution:** `skill_categories` is a real table, seeded with exactly those seven rows.
Admin can rename/reorder/hide them and add more. This satisfies both sections.

### C8 — `project_images` vs `media`: two storage concepts for one thing

§24 defines a general `media` library; §27 also lists `project_images`. If project screenshots are
stored twice, uploads get duplicated and alt-text drifts.

**Resolution:** `media` is the **single** physical file store (one row per uploaded file).
`project_images` becomes a **link table** (`project_id`, `media_id`, `caption`, `display_order`) —
it holds placement, not files. Same pattern for `cover_media_id`, `certificate_media_id`,
`avatar_media_id`. One file can be reused anywhere without re-upload.

### C9 — Timeline vs Experience/Education overlap

§17 Timeline duplicates data that already lives in Experience (§15), Education (§16) and
Certifications (§14). If both are maintained by hand, they will drift.

**Resolution:** `timeline_entries` is an **independent, manually curated** narrative table
(milestones, turning points, self-directed learning) — *not* an auto-aggregation. The Homepage
"Journey" section renders Timeline; the `/experience` page renders Experience + Education.
No automatic sync, no derived rows. Flagged so you can decide otherwise. → **D5**.

### C10 — §21 Overview vs §54 seed data

§21 says "no fake data in production"; §54 says seed initial content. These are compatible only if
the seed is environment-gated. Resolution: `prisma/seed.ts` runs **only** when `NODE_ENV !== 'production'`
or when explicitly invoked with `--force`; production gets a separate `bootstrap` script that creates
*only* the admin user and the site-settings defaults, no fake projects/articles.

### C11 — §41 GitHub integration must not become a runtime dependency

Accepted as stated. No GitHub calls in Phase 1–15. The `projects.github_url` column and a
`GithubStats` service boundary are reserved; the site renders fully with the integration absent.

---

## 4. Gaps — required by the brief but missing from its own entity list (§27)

| # | Gap | Why it is needed | Proposal |
|---|---|---|---|
| G1 | `refresh_tokens` table | §25 requires refresh tokens. Rotation + revocation + "log out everywhere" are impossible with stateless refresh tokens. | New table with hashed tokens and a family id for reuse detection (doc 04) |
| G2 | `article_categories` table | §12 lists Article "Category" but §27 has no table for it | New table (mirrors `skill_categories`) |
| G3 | `search_index` (FTS5) | §38 Global Search | Virtual table, see C5 |
| G4 | `page_views` + `analytics_daily` | §40 Analytics; no analytics table exists in §27 | Raw event table + nightly rollup, no PII (see doc 09) |
| G5 | `security_assessment_tests` | §9 lists 15 named test types with per-test results | Child table of `security_assessments` |
| G6 | `experience_achievements`, `project_features`, `research_references` | §7/§13/§15 list these as multi-valued fields; SQLite has no arrays | Child tables |
| G7 | `GET /api/search` endpoint | §38/§39 need it; §29 does not list it | Added to the API catalogue |
| G8 | Draft preview mechanism | Admin needs to view an unpublished page as it will look | Signed, short-lived preview token + Next.js Draft Mode. → **D6** |
| G9 | Password reset / recovery | Not mentioned anywhere. With a single admin and no public registration, a lockout is unrecoverable without CLI access. | A `npm run admin:reset-password` CLI script (server-side, no public endpoint). → **D7** |

---

## 5. Missing information (assumptions I made — correct me if wrong)

| # | Unknown | Assumption used in this design |
|---|---|---|
| A1 | Deployment target | A Linux VPS running Docker Compose behind Nginx/Caddy with TLS and a persistent volume |
| A2 | Domain name | `eslamramzy.dev` used as a placeholder in SEO/canonical examples; trivially configurable |
| A3 | Article/case-study authoring format | **Markdown**, sanitised and rendered server-side (see doc 09 §XSS). A WYSIWYG producing raw HTML would make the admin a stored-XSS vector. → **D8** |
| A4 | Contact email delivery | Messages are stored in the DB (required). SMTP notification is **optional** and disabled if `EMAIL_*` env vars are absent — the form must never fail because email is down. → **D9** |
| A5 | Number of admins | Exactly one, forever. RBAC is still built (as asked) but no user-management UI in v1 |
| A6 | Language / i18n | English-only public site. No i18n framework. Adding one later is a large refactor — flag now if Arabic is wanted. → **D10** |
| A7 | Existing `Program.cs` in the repo | Unrelated C# hello-world. I have **not** touched it. → **D11** |
| A8 | Profile photo | You will supply it. It is seeded as a `media` row + `profiles.avatar_media_id`, replaceable from Admin → Settings → Profile. Never hardcoded in a component. |

---

## 6. Anti-overengineering rules I am binding myself to (§50)

Explicitly **not** doing, unless you ask:

- No DI container, no CQRS, no event bus, no domain events, no hexagonal ports/adapters everywhere.
- No GraphQL, no tRPC, no microservices, no message queue, no Redis.
- No Turborepo/Nx — plain **npm workspaces** is enough for 3 packages.
- No Redux/Zustand/MobX — Server Components + URL state + React Context for theme/auth only.
- No generic "Repository<T>" base class. Repositories are thin, explicit, per-entity modules.
- No abstraction with exactly one implementation, **except** `StorageAdapter` (justified in C4).
- No custom form library — `react-hook-form` + the same Zod schemas the API validates with.

The one shared abstraction I *am* insisting on: **Zod schemas live in a shared package and are the
single source of truth** for API validation, TypeScript types, and admin form validation. This is
the highest-leverage decision in the whole design — it makes it structurally impossible for the
frontend and backend to disagree about a payload shape.

---

## 7. Risks

| Risk | Impact | Mitigation |
|---|---|---|
| SQLite write contention (analytics + admin saves) | `SQLITE_BUSY` errors | WAL mode, `busy_timeout=5000`, analytics writes batched/fire-and-forget |
| Backup of SQLite file | Total data loss | `sqlite3 .backup` on a cron + volume snapshot; documented in Phase 15 |
| Stored XSS via admin-authored content | Full site compromise | Markdown-only + `rehype-sanitize` allow-list (doc 09) |
| Scope: 16 domains × full CRUD | Never finishing | Phased plan (doc 11); a generic admin CRUD scaffold pattern (doc 07) so each module is ~1 day |
| Bootstrap look-alike design | Undermines the whole point of a portfolio | SCSS token layer + design pass in Phase 6 before content |
