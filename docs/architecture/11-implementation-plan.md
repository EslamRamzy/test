# 11 — Phased Implementation Plan

16 phases (§55). Each has explicit deliverables and **exit criteria**. At the end of every phase I
report: what was built, files added/changed, tests run and their results, problems, and technical
decisions taken (§56). **I do not start the next phase if a blocker is open, and I do not change the
core architecture without your approval.**

Estimates assume focused sessions and are for sequencing, not commitments.

---

| Phase | Name | Est. | Depends on |
|---|---|---|---|
| 0 | Requirements + Architecture | — | **done — awaiting your approval** |
| 1 | Project setup | 1 d | Phase 0 approved |
| 2 | Database + migrations | 2 d | 1 |
| 3 | Backend foundation | 2 d | 2 |
| 4 | Authentication + Authorization | 2 d | 3 |
| 5 | Public API | 3 d | 4 |
| 6 | Public website | 5 d | 5 |
| 7 | Admin dashboard shell | 3 d | 4 |
| 8 | Content management (13 modules) | 6 d | 7 |
| 9 | Media management | 2 d | 8 |
| 10 | Contact + messages | 1 d | 8 |
| 11 | Search + command palette | 2 d | 5, 6 |
| 12 | SEO + performance + a11y | 2 d | 6 |
| 13 | Analytics + audit log UI | 2 d | 8 |
| 14 | Testing hardening | 3 d | all |
| 15 | Security testing + fixes | 3 d | 14 |
| 16 | Documentation + deployment | 2 d | 15 |

> Note: §55 lists Testing as Phase 12 and Security Testing as 13. Tests are **not** deferred to a
> phase — every phase ships its own tests as part of its exit criteria. Phases 14–15 are the
> *hardening and formal assessment* passes on top of that, not the first time tests appear.
> Search/palette (§38–39) and Analytics (§40) were unnumbered in the brief; I placed them at 11 and 13.

---

## Phase 1 — Project setup
**Deliver:** npm workspaces monorepo; `apps/api`, `apps/web`, `packages/shared`; TypeScript strict
(`strict`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`); ESLint (incl. boundary rules
from doc 08 §3) + Prettier; `.env.example`; `.gitignore`; `.nvmrc`; Vitest configured in all three;
CI skeleton; `docker-compose.yml`; root scripts.
**Exit:** `npm run lint && npm run typecheck && npm test` all green on an empty suite; both apps boot;
CI passes on a PR.

## Phase 2 — Database + migrations
**Deliver:** full `schema.prisma` (doc 02); initial migration; hand-written SQL for `CHECK`
constraints, partial indexes, the FTS5 table and its triggers; WAL pragma bootstrap; `bootstrap.ts`;
`seed.ts` (dev-only guard); repository skeletons.
**Exit:** migrate from empty → schema on a clean file; bootstrap creates the admin; seed populates dev
data; FK enforcement and every `CHECK` verified by test; ERD in doc 02 matches the generated schema.

## Phase 3 — Backend foundation
**Deliver:** `app.ts`/`server.ts` split; `config/env.ts` fail-fast; Prisma singleton with pragmas;
error classes + `errorHandler`; `requestId`; pino with redaction; helmet/cors/rate-limit/body-limit;
`validate` middleware; response envelope helpers; `/health` + `/health/ready`; graceful shutdown.
**Exit:** integration tests for the envelope, 404 handling, production error masking, header presence
and a rate-limit bucket.

## Phase 4 — Authentication + Authorization
**Deliver:** everything in docs 04 and 05 — Argon2id, JWT access cookie, opaque rotating refresh
with reuse detection, lockout, CSRF double-submit, `authenticate`/`authorize`, `audit` service,
`admin:reset-password` CLI.
**Exit:** the full auth test list in doc 10 §3 passes, **including** the generated authorization
matrix; manual verification of cookie flags (`__Host-`, `HttpOnly`, `Secure`, `SameSite=Strict`) and
of reuse detection killing a family.
**This phase does not pass without a security review.** It is the highest-risk code in the project.

## Phase 5 — Public API
**Deliver:** every public endpoint in doc 03 §3 with repositories, services, controllers, Zod
schemas in `packages/shared`, pagination/filter/sort allow-lists, `/stats`, `/home` aggregate,
`/sitemap-data`. Generated OpenAPI.
**Exit:** integration tests per endpoint; **draft-isolation suite green**; `openapi.json` committed.

## Phase 6 — Public website
**Deliver:** design tokens + Bootstrap SCSS theme; light/dark with no flash; layout, header, footer;
all 12 public routes; the 10 homepage sections; case-study renderer with section visibility;
markdown pipeline with sanitisation; loading/error/404 states; responsive down to 320 px.
**Exit:** every page renders from the database with **zero hardcoded content**; Lighthouse ≥ 90 on
Performance/Accessibility/Best Practices/SEO; axe clean in both themes; visual review by you.

## Phase 7 — Admin shell
**Deliver:** admin layout, sidebar, topbar; login page + auth flow with single-flight refresh;
route protection; react-query setup; the shared module primitives from doc 07 §2; toasts;
`ConfirmDialog`; dashboard overview with real counters.
**Exit:** login/logout/expiry work end-to-end; overview shows live numbers; unauthenticated
`/admin/*` redirects; no admin response is cacheable.

## Phase 8 — Content management
**Deliver:** admin CRUD for all 13 modules; publish workflow + readiness checks; reordering;
project tabbed editor incl. security assessment, tests checklist and findings; markdown editor;
tags/categories; on-demand revalidation on publish.
**Exit:** every field of every entity is editable from the UI; **the source-code-free content goal is
demonstrated** — a new project, article and research entry created entirely through `/admin` appear
correctly on the public site; audit entries recorded for all of it.

## Phase 9 — Media management
**Deliver:** upload endpoint with the full doc 09 §7 control set; `sharp` re-encode + EXIF strip;
media library UI; picker integration; alt text; usage tracking; reference-blocked deletion; static
serving with correct headers.
**Exit:** the upload security tests pass (type, magic bytes, size, traversal, SVG rejection);
`next/image` renders uploads; profile photo replaceable from Settings.

## Phase 10 — Contact + messages
**Deliver:** public form + endpoint with validation, rate limit, honeypot, timing check; admin inbox
with read/unread/archive/delete; unread badge; optional SMTP notification behind a feature flag.
**Exit:** spam controls tested; a submission reaches the inbox; email failure does not fail the request.

## Phase 11 — Search + command palette
**Deliver:** FTS5 index maintenance on every publish/update/unpublish; `/search` endpoint with bm25
ranking; search page; command palette with navigation, dynamic social links and debounced search.
**Exit:** index consistency test (publish → findable, unpublish → not findable, edit → updated);
palette keyboard + a11y tests; drafts never appear in results.

## Phase 12 — SEO + performance + accessibility
**Deliver:** `generateMetadata` everywhere; OG image generation; JSON-LD; sitemap; robots;
canonicals; `security.txt`; image/font optimisation; bundle budget check; CSP report-only → enforce;
full a11y pass.
**Exit:** Lighthouse ≥ 95 SEO/A11y; bundle under budget; CSP enforced with no console violations;
Rich Results test passes for a project and an article.

## Phase 13 — Analytics + audit UI
**Deliver:** view beacon; `page_views` with salted-hash visitors; nightly rollup + 90-day purge;
analytics dashboard; audit log viewer with filters.
**Exit:** no raw IP anywhere in the database (asserted by test); rollup correctness test; audit
viewer is read-only with no write path in the API.

## Phase 14 — Testing hardening
**Deliver:** close coverage gaps to the doc 10 §4 targets; complete the E2E suite; a11y sweep;
`autocannon` smoke; flake elimination.
**Exit:** all gates green; the suite passes 3 consecutive runs with zero flakes.

## Phase 15 — Security testing (§45)
**Deliver:** SAST (semgrep), dependency scan, ZAP baseline, and the manual ASVS-mapped test plan
across all 15 test types; findings recorded; fixes; retest; a written assessment report in
`docs/security/`.
**Exit:** zero open CRITICAL/HIGH; MEDIUMs fixed or formally accepted; the report is published as the
site's own first Security Assessment record.

## Phase 16 — Documentation + deployment
**Deliver:** README per §46; architecture docs updated to match what was actually built;
API docs; runbook (backup/restore/rotate/migrate); Dockerfiles; compose; Caddy config; backup cron;
first production deploy.
**Exit:** a clean clone reaches a running local instance following only the README; a backup is taken
and a **restore is verified**; the production site is live with a valid certificate and A+ headers.

---

## Reporting after each phase (§56)

1. What was implemented
2. Files created/modified
3. Tests written and their results
4. Problems encountered
5. Technical decisions taken (and any that need your approval)
6. Blockers — explicitly stated; work stops here if any exist
