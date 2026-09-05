# Phase 13 Report — Analytics + Audit UI

**Status: complete.** Report format per brief §56.

---

## 1. What was implemented

"Research first" (the same principle every prior phase has applied) found that MOST of doc11
Phase 13's own deliverable list was already shipped, ahead of schedule, as part of Phase 8's
"Settings, Profile, Audit Logs, Analytics endpoints/pages": the `page_views`/`audit_logs`/
`analytics_daily` schema, the `POST /analytics/view` beacon endpoint, the `GET /admin/analytics`
and `GET /admin/audit-logs` read endpoints, the daily-rotating salted-hash IP scheme
(`utils/hashIp.ts`), and both admin UI pages (`/admin/analytics`, `/admin/audit-logs`) — filters,
date-range picker, top content, referrer hosts, all of it — already existed and already matched
doc07 §3's spec exactly. What did NOT exist, confirmed by reading every relevant file before writing
anything new: nothing in the public site ever called the beacon endpoint (the browser-side fetcher,
`recordAnalyticsView()`, was dead code — built, never wired to a single page); nothing populated
`analytics_daily` at all (the raw `page_views` table's OWN header comment said so explicitly: "no
cron/job infrastructure exists for it"); and `ENABLE_ANALYTICS`, documented in `.env.example` since
Phase 1, was read nowhere in the codebase. Phase 13's real, new scope was exactly these three gaps.

| Area | Delivered |
|---|---|
| `ENABLE_ANALYTICS` | Wired into `env.ts` (enum, default `true`) and `analyticsService.recordView()` — a site owner can disable all visitor tracking with one env var; the beacon still returns its normal `204` either way |
| Nightly rollup + 90-day purge | `analyticsRollupService.ts`: `rollupDay()` aggregates one UTC day's `page_views` into `analytics_daily` (idempotent — re-running upserts, never duplicates); `purgeOldPageViews()` deletes rows older than 90 days; `runNightlyRollup()` runs both, rolling up "yesterday" specifically so a still-growing day is never rolled up partial |
| Scheduler | `jobs/scheduler.ts` — a plain `setInterval` (no cron library; a single daily task needs neither cron-expression parsing nor persistence across restarts), wired into `server.ts` ALONE, never `app.ts`, so it never fires during any test run |
| The view beacon, actually wired in | `<AnalyticsBeacon>` — rendered explicitly on all 12 public pages (the same per-page pattern `<JsonLd>` already establishes), reading `entityType`/`entityId` as props so the 3 detail pages attach their real numeric id and the other 9 send `entityType: 'PAGE'`; extracts `referrerHost` from `document.referrer` (host only, and only when it's a genuinely external origin) |
| Audit read-only, now asserted by test | A new integration test drives every one of POST/PUT/PATCH/DELETE against `/admin/audit-logs` and asserts `404` — the router genuinely has no write path, not just by inspection |
| No raw IP, now asserted by test | A new dedicated test file drives a real request through all four tables doc09 §10 names (`page_views`, `contact_messages`, `audit_logs`, `refresh_tokens`) with a known fake IP and asserts each stored hash is a 64-char sha256 digest that never contains it |
| A real, pre-existing bug found and fixed | `pageViewRepository.ts`'s raw-SQL date comparisons (`findSeries`/`findTotals`/`findTopContent`/`findTopReferrerHosts`, all shipped in Phase 8, plus the new `aggregateForDay`) silently mis-included/excluded rows landing exactly on a range boundary — see §4 |

## 2. Files created / modified

```
apps/api/src/config/env.ts                          + ENABLE_ANALYTICS
apps/api/.env.example                                comment updated to match
apps/api/src/services/analyticsService.ts            recordView() checks ENABLE_ANALYTICS
apps/api/src/services/analyticsService.test.ts        new
apps/api/src/repositories/pageViewRepository.ts       + aggregateForDay, deleteOlderThan; datetime() bug fix (§4)
apps/api/src/repositories/analyticsDailyRepository.ts new — findFirst+create/update upsert
apps/api/src/services/analyticsRollupService.ts       new — rollupDay/purgeOldPageViews/runNightlyRollup
apps/api/src/jobs/scheduler.ts                        new
apps/api/src/server.ts                                starts/stops the scheduler
apps/api/tests/analyticsRollup.test.ts                new — 6 tests
apps/api/tests/noRawIp.test.ts                        new — 3 tests
apps/api/tests/adminSettingsProfileAuditAnalytics.test.ts  + audit-logs "no write path" test
apps/web/src/features/analytics/AnalyticsBeacon.tsx        new
apps/web/src/features/analytics/AnalyticsBeacon.test.tsx   new — 9 tests
apps/web/src/app/(public)/{page.tsx,about,articles,certifications,contact,
  experience,projects,search,security}/page.tsx      + <AnalyticsBeacon entityType="PAGE" />
apps/web/src/app/(public)/{projects,articles,security}/[slug]/page.tsx
                                                       + <AnalyticsBeacon entityType="..." entityId={...} />
```

## 3. Testing performed

- **Unit/integration (automated, part of the gate).** 801 tests passing at the end of the phase
  (170 `@portfolio/shared`, unchanged; 449 `@portfolio/api`, up from Phase 12's 437: 2 new
  `analyticsService.test.ts` tests for the `ENABLE_ANALYTICS` no-op path, 6 new
  `analyticsRollup.test.ts` tests, 3 new `noRawIp.test.ts` tests, 1 new audit-logs read-only test;
  182 `@portfolio/web`, up from 173: 9 new `AnalyticsBeacon.test.tsx` tests).
- **Rollup correctness, proven with real boundary cases.** Seeded page views at the exact start of
  a day, the exact start of the NEXT day, and one second before the day starts; asserted the rollup
  includes the first, excludes the other two, and computes `views`/`uniqueVisitors` correctly across
  a repeated visitor. Also asserted re-running the same day twice updates the existing row in place
  rather than duplicating it.
- **Purge correctness.** A row 200 days old is deleted; one 5 days old survives; the default
  90-day window is exercised with no argument.
- **No raw IP, real HTTP request, real database read-back.** `tests/noRawIp.test.ts` drives
  `POST /analytics/view`, `POST /contact`, and a real login with a known TEST-NET-3 fake IP
  (`203.0.113.77`), then reads `page_views.visitor_hash`, `contact_messages.ip_hash`,
  `refresh_tokens.ip_hash`, and `audit_logs.ip_hash` directly and asserts each is a 64-char hex
  digest that never contains that IP as a substring.
- **Audit read-only, real HTTP request.** POST/PUT/PATCH/DELETE against `/admin/audit-logs`, all
  asserted `404` (Express's own behaviour for a path with no route registered for that method).
- **Real stack, real browser, real database (Chromium via Playwright, not simulated).** Built and
  started the production web server against the real API + a seeded dev database; navigated `/about`,
  a real project detail page, and a real article detail page, and confirmed via network interception
  that the beacon fired exactly once per page with the correct `path`/`entityType`/`entityId` (`PAGE`
  for `/about`, `PROJECT`+the real numeric id for the project, `ARTICLE`+id for the article) and zero
  CSP console violations. Logged into the real seeded admin account and confirmed `GET
  /admin/analytics` reflected those exact views (`totalViews: 4` including one earlier manual check,
  `topProjects`/`topArticles` correctly attributing the entity-tagged views). Separately, seeded real
  `page_views` rows at 200 days old, 5 days old, and three "yesterday" views (two from one visitor,
  one from another) directly against the real dev database, ran `runNightlyRollup()` for real, and
  confirmed: `analytics_daily` gained exactly one row for yesterday with `views: 3, uniqueVisitors:
  2`; the 200-day-old row was purged; the 5-day-old row survived. Confirmed live (`curl`) that
  `POST`/`DELETE /admin/audit-logs` both return `404` against the real running server. Confirmed the
  scheduler itself runs for real at server boot (`Analytics rollup: 0 group(s)...` in the real
  `npm run dev` log line, not just a unit-tested function).
- **Full gate**: `format:check`, `lint`, `lint:rules`, `typecheck`, `test`, `build`, `audit:deps` (0
  vulnerabilities) all pass. `check:bundle-budget` still fails for the same pre-existing, documented
  reason as Phase 12 (156.8–162.7 KB vs. the 120 KB budget — the beacon component itself added under
  1 KB per route; the gap is unchanged in kind, see `docs/phases/phase-12-report.md` §4/§6).

## 4. Problems found and fixed

Ordered as found.

1. **`ENABLE_ANALYTICS` had shipped in `.env.example` since Phase 1 and was read nowhere at all.**
   A genuinely dead config flag, not a placeholder — `grep` across the whole codebase found zero
   references outside the `.env` files. Wired into `env.ts` and `analyticsService.recordView()`.
2. **A real, pre-existing correctness bug in `pageViewRepository.ts`'s raw SQL**, present since Phase
   8 and affecting every one of its date-range queries (`findSeries`, `findTotals`, `findTopContent`,
   `findTopReferrerHosts`), found while writing this phase's OWN rollup query (which compares against
   exact day boundaries far more often than the admin dashboard's `from`/`to` ever coincide with a
   real row): SQLite stores this column as TEXT ending in `+00:00` (confirmed directly —
   `SELECT typeof(created_at), CAST(created_at AS TEXT) ...`), but `Date.prototype.toISOString()`
   produces a `Z`-suffixed string. Lexicographically `'+00:00'` sorts BEFORE `'Z'`, so a plain
   `created_at >= '...Z'` silently EXCLUDED a row exactly equal to the lower bound, and `created_at
   <= '...Z'` silently INCLUDED a row exactly at the start of the NEXT interval — confirmed
   empirically: a rollup test seeding a view at exactly a day's own start showed it vanish from the
   count, and a view at exactly the next day's start showed up a day early. Root-caused via a
   `typeof(created_at)`/`CAST(... AS TEXT)` probe query, not guessed at. Fixed by wrapping BOTH
   sides of every comparison in SQLite's own `datetime()`, which normalises the format before
   comparing — applied to all five affected queries, not just the new one, since all five share the
   identical pattern. Re-verified: the existing `tests/analytics.test.ts` and
   `tests/adminSettingsProfileAuditAnalytics.test.ts` suites (which exercise the SAME four functions
   at the HTTP layer) still pass unchanged after the fix.
3. **The beacon fetcher (`recordAnalyticsView()`) was dead code** — built in an earlier phase,
   never called by a single page. Wired in via `<AnalyticsBeacon>`, rendered explicitly per page
   (matching `<JsonLd>`'s own established per-page pattern) rather than a single layout-level mount,
   because only the page itself knows its own `entityType`/`entityId` at render time and a
   layout-level generic beacon would either double-record a detail page's view (one generic, one
   entity-specific) or have no channel to receive the entity id at all (`children: ReactNode` carries
   no data back up to a layout).

## 5. Technical decisions

| Decision | Rationale |
|---|---|
| `<AnalyticsBeacon>` is rendered explicitly per page, not mounted once in `(public)/layout.tsx` | See problem 3 above — a layout-level mount cannot receive a specific page's `entityType`/`entityId` without either double-firing or a context/registration mechanism more complex than 12 one-line call sites |
| The scheduler is a plain `setInterval` in `jobs/scheduler.ts`, wired into `server.ts` only | One task, once a day, on a single-instance deployment (doc01's own topology, no worker pool) needs neither a cron-expression parser nor persistence across restarts; keeping it out of `app.ts`/`createApp()` means every test in the repo — which imports `createApp()` directly — never races a real background job against its own seeded data |
| `analyticsDailyRepository.upsert()` uses `findFirst` + `create`/`update`, not Prisma's generated compound-unique shorthand | Verified directly against the generated client: `AnalyticsDailyDayPathEntityTypeEntityIdCompoundUniqueInput` types `entityType`/`entityId` as non-nullable, even though the actual columns are nullable — a real Prisma limitation for compound unique constraints with nullable members, not a design choice available to bypass more simply |
| `rollupDay()` rolls up "yesterday" specifically, not "today so far" | A job that could run at any hour must never aggregate a day that is still receiving new views — "yesterday" is always guaranteed complete regardless of when the job actually fires |
| The `datetime()` fix was applied to all five affected queries, not just the new one | The bug is identical in all five (same interpolation pattern, same root cause); fixing only the new code and leaving four known-affected, already-shipped queries broken would be inconsistent and dishonest about the actual state of the codebase |

## 6. Known gaps

- **Bundle budget** (doc06 §9): unchanged in kind from Phase 12's own documented, accepted gap —
  156.8–162.7 KB gzipped vs. 120 KB, the beacon component itself adding under 1 KB per route. See
  `docs/phases/phase-12-report.md` §4/§6 for the full accounting; not re-litigated here.
- **The scheduler's own timing is boot-relative, not calendar-aligned** — "once at boot, then every
  24h from boot time," not "at local midnight." Acceptable for this site's traffic volume (doc09 §10
  asks for "nightly," not a specific hour), and documented in `jobs/scheduler.ts`'s own header
  comment; a future deploy that wants calendar-aligned timing would need a real cron trigger (Phase
  16's own "backup cron" territory) calling `runNightlyRollup()` instead of this in-process interval.
- **`GET /admin/analytics` still reads directly from raw `page_views`, not the now-populated
  `analytics_daily`** — a deliberate, unchanged decision from before this phase (see
  `pageViewRepository.ts`'s own header comment): `page_views` stays complete for the full 90-day
  retention window the rollup honours, so there is no query the rollup table alone could answer
  before "don't build a second query path ahead of need" becomes worth revisiting.

## 7. Blockers

**None.** The beacon is wired into every public page and verified firing correctly against a real
server; the rollup + 90-day purge runs correctly (verified against real seeded data spanning the
retention boundary, not just mocked); `ENABLE_ANALYTICS` closes a real, previously dead config flag;
the audit viewer's read-only guarantee and the "no raw IP" exit criterion are both now asserted by
test, not just inspected by reading the code; and one real, pre-existing bug (the `datetime()`
boundary issue) was found and fixed across every query it affected, not just the new one. Phase 14
(Testing hardening) can start immediately.
