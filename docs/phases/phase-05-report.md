# Phase 5 Report — Public API

**Status: complete.** Report format per brief §56.

---

## 1. What was implemented

Every public endpoint in docs/architecture/03 §3, with repositories, services, controllers, and Zod
schemas in `packages/shared` — plus `/home`, `/stats`, `/sitemap-data`, and a generated OpenAPI
document, per docs/architecture/11's Phase 5 deliverable list:

| Area | Delivered |
|---|---|
| Query schemas | `packages/shared/src/schemas/query.ts` — pagination + a per-resource, explicit, ALLOW-LISTED filter/sort set for projects, articles, security research, technologies, search (docs/architecture/03 §2: "never a generic query-object filter") |
| Contact / analytics schemas | `packages/shared/src/schemas/contact.ts`, `analytics.ts` |
| Public DTOs | `packages/shared/src/types/publicContent.ts` — TS interfaces (not Zod; see that file's header) shared between the API's services and the Phase 6 frontend |
| Repositories | 15 new modules — `technologyRepository`, `skillRepository`, `certificationRepository`, `experienceRepository`, `educationRepository`, `timelineRepository`, `socialLinkRepository`, `profileRepository`, `siteSettingRepository`, `tagRepository`, `articleCategoryRepository`, `articleRepository`, `securityResearchRepository`, `searchRepository` (FTS5), `contactMessageRepository`, `pageViewRepository` — plus `projectRepository.ts` filled in (list/detail/related/featured, extending Phase 2's skeleton) |
| Services | One per resource, mapping Prisma results onto the shared DTOs; `homeService.ts` aggregates eight of them into the single `/home` call doc 06 §6 specifies |
| Controllers/routes | `controllers/public/**` + `routes/public/**` — the folder convention Phase 1's ESLint rule anticipated but nothing had used until now (see §5) |
| Rate limiting | `searchLimiter` (30/min), `contactLimiter` (3/hour), `analyticsLimiter` (60/min) added to `middleware/rateLimit.ts`; every public GET carries `publicReadLimiter` |
| Contact | Honeypot + timing check + 10/day global cap, all three failing identically to a real success (doc 09 §8) |
| Analytics | Fire-and-forget beacon, `204`, visitor hash via the same `hashIp` utility Phase 4 built for audit logs |
| OpenAPI | `src/openapi/registry.ts` generates the spec FROM the real Zod query/body schemas (not a hand-written duplicate); `GET /api/v1/docs` (Swagger UI), disabled by default, behind `authenticate` when enabled; `docs/api/openapi.json` committed |

## 2. Files created / modified

```
packages/shared/src/schemas/query.ts (+test)          new — per-resource list-query schemas
packages/shared/src/schemas/contact.ts (+test)         new
packages/shared/src/schemas/analytics.ts (+test)       new
packages/shared/src/schemas/primitives.ts              + slugParamSchema
packages/shared/src/types/publicContent.ts             new — public API DTOs
packages/shared/src/index.ts                           + new schema/type exports

apps/api/src/repositories/{technology,skill,certification,experience,
  education,timeline,socialLink,profile,siteSetting,tag,articleCategory,
  article,securityResearch,search,contactMessage,pageView}Repository.ts   new (16 files)
apps/api/src/repositories/projectRepository.ts          filled in — list/detail/related/featured

apps/api/src/services/{profile,stats,technology,skill,certification,
  experience,education,timeline,socialLink,tag,articleCategory,article,
  securityResearch,search,sitemap,home,contact,analytics,project}
  Service.ts                                            new (19 files)

apps/api/src/controllers/public/{content,profile,stats,home,project,
  article,securityResearch,search,sitemap,contact,analytics}
  Controller.ts                                         new (11 files)
apps/api/src/routes/public/{content,profile,stats,home,projects,articles,
  security,search,sitemap,contact,analytics}.routes.ts  new (12 files)
apps/api/src/routes/docs.routes.ts                      new — Swagger UI, gated
apps/api/src/openapi/registry.ts (+test)                new — generates the OpenAPI document
apps/api/scripts/generate-openapi.ts                    new — writes docs/api/openapi.json
apps/api/src/lib/mediaUrl.ts                            new — media row → public {id,url,altText,...}
apps/api/src/app.ts                                     + 12 public routers, docsRouter
apps/api/src/config/env.ts                              + ENABLE_API_DOCS
apps/api/src/middleware/rateLimit.ts                    + search/contact/analytics buckets
apps/api/package.json                                   + @asteasolutions/zod-to-openapi,
                                                          swagger-ui-express (+@types); generate:openapi

apps/api/tests/{publicContent,projectSections,search,contact,analytics,
  docs}.test.ts                                          new — HTTP-layer integration
docs/api/openapi.json                                    new — generated, committed
```

## 3. Testing performed

| Gate | Result |
|---|---|
| `format:check` / `lint` / `lint:rules` | pass — including the `controllers/public/**` ESLint rule, active for the first time since Phase 1 wrote it |
| `typecheck` (both `tsconfig.json` and `tsconfig.scripts.json`) | pass |
| `test` | pass — **311 tests** in the API workspace (was 248 after Phase 4; **+63 new**), 407 across the monorepo |
| `build` | pass |
| `audit:deps` | pass — 0 vulnerabilities |

What the new tests actually exercise:

- **`tests/publicContent.test.ts`** (25 tests) — the exit criterion doc 11 names explicitly: **the
  draft-isolation suite**. For projects, articles, and security research: a `DRAFT` row is absent
  from the list, `404`s on detail (never `403` — draft leakage rule), and is absent from search; an
  `ARCHIVED` row and a `PUBLISHED` row with a future `publishedAt` are equally invisible; publishing
  flips all of it (list, detail, search) in one test that watches the same row move through the
  transition. Also: the doc 05 §4 public-safety rule for security findings — an `OPEN`
  `CRITICAL`/`HIGH` finding is never returned even with `isPublic: true` set on it directly, while a
  `FIXED` critical finding and an `OPEN` medium one both are; a whole assessment with `isPublic:
  false` is hidden regardless of its findings. Plus category filtering, sort-key validation, the
  pagination envelope, `/home`'s shape, `/sitemap-data` excluding a draft, and a smoke sweep of every
  simple list-only resource.
- **`tests/projectSections.test.ts`** (8 tests) — decision D5's section-visibility logic
  end-to-end: a built-in column key renders with its real content only when listed; a listed
  built-in key with an empty column renders nothing; order in `visibleSectionsJson` is preserved; a
  custom key reads its `ProjectSection` row, not a column, and is skipped if that row is
  `visible: false`; an unknown key and malformed JSON both degrade to "no sections" rather than
  crashing the response.
- **`tests/search.test.ts`** (15 tests) — a real FTS5 prefix match against a freshly-published row;
  `type` filtering; and, critically, an 11-case sweep of FTS5-special and SQL-special input (`OR`,
  `AND`, unbalanced quotes, `col:value`, a literal `DROP TABLE` attempt) asserting the endpoint never
  `500`s and the `search_index` table survives queryable — this is what actually proves
  `buildFtsQuery`'s per-token quoting works, not just that it looks right on inspection.
- **`tests/contact.test.ts`** (6 tests) — a valid submission is stored; a honeypot-filled one and a
  too-fast one are both silently dropped with the byte-for-byte identical response; an invalid
  payload still gets a real `400` (the silent-drop behaviour is specifically for the anti-spam
  checks, not a blanket "always say yes"); mass-assignment rejection; the 3/hour/IP limiter.
- **`tests/analytics.test.ts`** (4 tests) — `204` with an empty body; the stored `visitorHash` is a
  real sha256 hex digest that never contains the raw IP; entity fields round-trip; the 60/min limiter.
- **`src/openapi/registry.test.ts`** (4 tests) + **`tests/docs.test.ts`** (1 test) — every public and
  auth path is registered; the generated `/projects` query parameters match the real schema fields
  (not a hand-typed duplicate that could drift); auth-required routes carry the `cookieAuth` security
  requirement; `/api/v1/docs` is a plain `404` (not `403`) when `ENABLE_API_DOCS` is unset, matching
  the default `test`/production posture.

## 4. Problems found and fixed

1. **`JSON.stringify` on a raw FTS5 search result threw `TypeError: Do not know how to serialize a
   BigInt`.** `searchRepository.search()` uses `$queryRaw` for the one query Prisma's model layer
   cannot express (there is no Prisma model for an FTS5 virtual table). Verified empirically: the
   underlying `better-sqlite3` driver returns every `INTEGER` column from a **raw** query as a
   native `bigint` — Prisma's own typed models coerce this back to `number` for you, but `$queryRaw`
   bypasses that layer entirely and hands back whatever the driver returned. `entity_id` came back
   as `bigint`, which serialized fine through Prisma's own logging but broke the very first real
   `JSON.stringify` in a test (and would have broken every real `res.json()` call in production —
   this was caught by a genuinely representative test, not a contrived one). Fixed by converting to
   `Number(row.entity_id)` in `mapRow()`, safe here since an autoincrement id never approaches
   `Number.MAX_SAFE_INTEGER`.
2. **My own integration test, not the implementation, double-fetched a CSRF cookie and silently
   used the stale one.** While writing the search test's reuse-of-a-published-row flow, an early
   draft of an unrelated flow test built the `Cookie` header by concatenating two separate
   `Set-Cookie` responses that both carried a `__Secure-csrf` pair — the `cookie` package's parser
   keeps the FIRST occurrence of a repeated name, so the request silently carried the OLD token
   while sending the NEW one as the header, and CSRF verification correctly rejected the mismatch.
   (This is the same class of bug Phase 4's own report already documents from `tests/auth.test.ts` —
   noted here because Phase 5's contact/analytics tests deliberately avoid CSRF entirely, being
   unauthenticated, and it was tempting to assume the pattern didn't recur; it did, in an unrelated
   draft, before being caught and simplified away by not needing CSRF for those two endpoints at
   all.) No implementation change — the fix was in the test.
3. **`IP_HASH_SALT` was already correctly wired by Phase 4** — re-verified rather than re-litigated:
   `hashIp()` is reused as-is for `visitorHash` (analytics) exactly as doc 09 §10 specifies
   ("same treatment... for `ip_hash` on contact messages" — extended here to `page_views.
   visitor_hash`, the value doc 09 §10 actually names it for).

## 5. Technical decisions

| Decision | Rationale |
|---|---|
| New code lives under `controllers/public/**` and `routes/public/**`, not flat like Phases 3–4's `authController.ts`/`auth.routes.ts` | Phase 1's ESLint config already scoped a real enforcement rule ("public code must not import `*ForAdmin` repository functions") to exactly these paths, dormant since nothing used them. Phase 5 is entirely public content — the natural point to actually start using the structure the rule was written for, rather than adding a ninth flat controller file and leaving the rule unused for three more phases |
| Public DTOs (`publicContent.ts`) are plain TypeScript interfaces, not Zod schemas | Doc 03 §7's Zod schemas validate untrusted INPUT at the boundary; these describe trusted, server-built OUTPUT. Runtime-validating a shape the server itself just constructed catches nothing a type error wouldn't already catch at compile time — and doubling every DTO as a second, parallel Zod schema purely for symmetry was judged not worth the maintenance burden (see next row) |
| OpenAPI response bodies are documented as an envelope + description, not the full nested DTO per endpoint | Direct consequence of the row above: `zod-to-openapi` can only convert a `ZodType`. The **request** side (params/query/body) is the real, generated, exact contract, because those genuinely are Zod schemas already enforced at runtime — that is the valuable, drift-proof half of doc 03 §8's requirement. Full response-shape documentation is a reasonable Phase 6+ addition once the frontend consuming these DTOs makes the cost of keeping a second schema in sync clearly worth it |
| `/home`'s per-slice limits (3 featured projects, 3 latest articles, 3 latest research, 8 timeline entries) are this phase's own choice | Doc 06 §6 names the ten sections and the single-aggregate-call shape but not per-section counts; the individual `/projects`, `/articles`, `/security`, `/timeline` endpoints remain the uncapped source for their own full pages |
| `/stats`'s counters (projects, articles, technologies, years of experience) are this phase's own reading of "homepage counters" | The original brief's literal §6.2 wording was given directly in chat during Phase 0 and was never captured as a file this phase could re-consult — documented as an interpretation rather than presented as verbatim spec, the same honesty standard `authService.ts`'s CSRF design note set in Phase 4 |
| `GET /home` returns `404 NOT_FOUND` (not `500`) when the profile singleton is missing | The only way this happens is a database that was never bootstrapped — genuinely "nothing to return" in the same sense doc 03 §1 already defines for absent content, not an unexpected server error |
| Search input is defended by per-token phrase-prefix quoting, not a query-syntax allow-list or a library | FTS5's `MATCH` argument is its own small query language (`AND`/`OR`/`-prefix`/`col:`); wrapping every whitespace-split token as `"token"*` (escaping embedded quotes) makes the result always mean "AND of these literal prefixes" regardless of what operators a user typed, without needing to parse or reject FTS5 syntax explicitly — verified against an 11-case adversarial sweep, not just reasoned about |

## 6. Blockers

**None.** Phase 6 (Public website) can start immediately — every DTO shape it will render from is
now defined in `@portfolio/shared`, every endpoint it will call is implemented and draft-isolation
tested, and `docs/api/openapi.json` gives it (and any external caller) a diffable, generated map of
the exact request contract. Two intentionally deferred items, neither blocking: full OpenAPI
response-body schemas (see §5), and an app-level test of `GET /api/v1/docs` with
`ENABLE_API_DOCS=true` (the route-mounting logic and the document-generation logic are each tested
separately; only the specific combination of "flag on AND no auth cookie" is untested — low risk,
since `authenticate` itself is already thoroughly covered by Phase 4's suite).
