# Phase 7 Report — Admin Shell

**Status: complete.** Report format per brief §56.

---

## 1. What was implemented

Every deliverable in docs/architecture/11's Phase 7 list:

| Area | Delivered |
|---|---|
| Backend | `GET /api/v1/admin/overview` (docs/architecture/03 §5, docs/architecture/07 §3) — the one backend dependency Phase 7's exit criteria need. `authenticate` + a new per-user-keyed `adminReadLimiter` (600/15min); no `authorize()` (matches `GET /auth/me` — no single resource permission fits a dashboard); `Cache-Control: no-store, private` via a new `noStore` middleware mounted on the `/api/v1/admin` prefix. Four new/extended repository functions (`countAllForAdmin` × 2, `countUnreadForAdmin`, a new minimal `securityFindingRepository.countOpenForAdmin`, `auditLogRepository.findRecent`), aggregated in `overviewService.ts`. Covered by a real HTTP integration test against real fixture rows (a project, an article, a security assessment + open/fixed findings, a contact message), asserting the returned counts against the database's actual state, not just a 200 |
| Admin API client | `apps/web/src/lib/api/adminClient.ts` — deliberately separate from the public `client.ts`. Implements doc 04 §6 exactly: single-flight token refresh (concurrent 401s share one `/auth/refresh` call), one retry, redirect to `/admin/login?reason=expired` on refresh failure, CSRF header echoed on every mutation. Covered by a real test with mocked `fetch` (refresh + retry, three concurrent callers producing exactly one refresh call, the expired-redirect path, a plain `UNAUTHENTICATED` 401 skipping refresh entirely) |
| Route protection | `apps/web/src/proxy.ts` (Next 16 renamed `middleware.ts` → `proxy.ts` mid-phase; this repo already builds against 16.3.4) — redirect-only, cookie-presence-only, exactly matching doc 04 §7's "not a security control." Sets `Cache-Control: no-store, private` on every response it touches |
| Login / forced password change | `(admin)/admin/login` (react-hook-form + `zodResolver(loginSchema)`) and `(admin)/admin/change-password`, closing doc 04 §8's loop for the `ADMIN_INITIAL_PASSWORD` bootstrap account ("forces a change before anything else is reachable") |
| Admin shell | `Sidebar` (13-module order, doc 07 §51, exactly one module enabled today — the rest correctly disabled with a "Soon" badge rather than linking to a 404), `Topbar` (breadcrumb, theme toggle, user menu + sign-out), `(protected)` route group giving only session-having pages this shell |
| Client data layer | `@tanstack/react-query`, wired per doc 07 §5 (retries network/5xx, never 4xx; mutations never auto-retry) |
| Shared primitives | `ToastProvider`/`useToast()`, `ConfirmDialog` (one component covering both a plain Yes/Cancel confirmation and Phase 8's typed-match entity-delete confirmation) |
| Dashboard | `(admin)/admin/(protected)/page.tsx` — four real stat cards and a real Recent Activity feed from the audit log, loading/error states, "No activity yet" rather than a placeholder row |

## 2. Files created / modified

```
apps/api/src/app.ts                                        + noStore, overviewRouter mounts
apps/api/src/controllers/admin/overviewController.ts        new
apps/api/src/lib/cookies.ts                                 secure: isProduction → secure: true (real bug, §4.1)
apps/api/src/middleware/noStore.ts                          new
apps/api/src/middleware/rateLimit.ts                         + adminReadLimiter
apps/api/src/repositories/{project,article,contactMessage,
  auditLog}Repository.ts                                    + countAllForAdmin / countUnreadForAdmin / findRecent
apps/api/src/repositories/securityFindingRepository.ts       new (minimal — one counter only, see §5)
apps/api/src/routes/admin/overview.routes.ts                 new
apps/api/src/services/overviewService.ts                     new
apps/api/tests/adminOverview.test.ts                         new — real HTTP integration test

apps/web/package.json                                        + @tanstack/react-query, react-hook-form,
                                                                @hookform/resolvers, zod (direct dep)
apps/web/src/lib/api/adminClient.ts (+test)                   new — CSRF + single-flight refresh
apps/web/src/lib/queryClient.ts                               new — QueryClient factory
apps/web/src/proxy.ts                                         new — route protection + no-store header
apps/web/src/app/(admin)/admin/layout.tsx                     new — force-dynamic, noindex, providers
apps/web/src/app/(admin)/admin/login/page.tsx                 new
apps/web/src/app/(admin)/admin/change-password/page.tsx       new
apps/web/src/app/(admin)/admin/(protected)/layout.tsx         new — Sidebar + Topbar shell
apps/web/src/app/(admin)/admin/(protected)/page.tsx           new — dashboard
apps/web/src/features/admin-auth/components/{Login,
  ChangePassword}Form.tsx                                     new
apps/web/src/features/admin/components/{Sidebar,Topbar,
  QueryProvider,ToastProvider,ConfirmDialog(+test)}.tsx        new
apps/web/src/features/admin/hooks/{useOverview,useCurrentUser,
  useLogout}.ts                                                new
apps/web/src/features/admin/lib/formatAuditEntry.ts (+test)    new
apps/web/src/styles/_components.scss                           + admin-auth/sidebar/topbar/toast/
                                                                  stat-card/activity-list rules

packages/shared/src/types/adminContent.ts                     new — AdminOverviewDto, AuditLogEntryDto
packages/shared/src/index.ts                                  + export

docs/architecture/04-authentication-architecture.md            middleware.ts → proxy.ts (§7 quote), and
                                                                 the real cookie-bug fix reasoning (§6)
docs/architecture/08-folder-structure.md                       middleware.ts → proxy.ts (folder tree)
docs/architecture/09-security-architecture.md                  middleware.ts → proxy.ts (CSP-nonce note)
```

## 3. Testing performed

- **Unit/integration** (automated, part of the gate): `apps/api/tests/adminOverview.test.ts` (real
  fixture rows against real counts, 401 unauthenticated, `Cache-Control` on both 401 and 200,
  recent activity from a real `LOGIN_SUCCESS` row); `apps/web/src/lib/api/adminClient.test.ts` (6
  cases, mocked `fetch`); `apps/web/src/features/admin/components/ConfirmDialog.test.tsx` (5 cases
  — the first React component test in this repo); `apps/web/src/features/admin/lib/
  formatAuditEntry.test.ts`. Full suite: **93 shared / 314 api / 34 web, all passing.**
- **Real stack, real browser** (Chromium via Playwright, not simulated): a disposable local API +
  Next dev server, a real seeded database, real fixture users.
  - Unauthenticated `/admin` → redirects to `/admin/login?from=%2Fadmin`.
  - Wrong credentials → inline error, stays on the login page.
  - Correct credentials → all three cookies set (`secure=true` confirmed), lands on `/admin`.
  - An authenticated visit to `/admin/login` bounces to `/admin`.
  - The `ADMIN_INITIAL_PASSWORD` bootstrap account's `mustChangePassword=true` login → lands on
    `/admin/change-password`, stays reachable on direct navigation, a real password change →
    `/admin/login?reason=password-changed`.
  - Dashboard: real counts (`1/1/0/0` against real fixture rows) and 7 real activity rows;
    Sidebar's Dashboard link active, every other module disabled with "Soon"; breadcrumb; theme
    toggle (light → dark, persisted); user menu; full sign-out loop (`ConfirmDialog` appears,
    Cancel leaves the session intact, confirming signs out, a follow-up visit to `/admin`
    redirects to login).
  - **Real token expiry**, not simulated: `JWT_ACCESS_TTL` temporarily set to `3s` in a disposable
    `.env` (reverted after), logged in, waited the real 4 seconds, then reloaded — two concurrent
    authenticated requests (`/admin/overview` + `/auth/me`, exactly what Topbar + dashboard fire on
    mount) both hit a real 401 `TOKEN_EXPIRED`; exactly **one** real `/auth/refresh` call happened
    (single-flight, confirmed against the live API, not asserted against a mock); both original
    requests retried and succeeded; the access-token cookie's value changed (rotation); the page
    never left `/admin`.
  - **Real refresh failure**: corrupted the `__Secure-rt` cookie's value (simulating a dead/revoked
    session), waited for the real access-token expiry, navigated to `/admin` → redirected to
    `/admin/login?reason=expired`, all cookies cleared, the expected banner shown.
  - Mobile viewport (375px): 2-column stat grid, off-canvas sidebar drawer with backdrop, hamburger
    toggle.
  - Real **axe** run (not eyeballed) on the login and dashboard pages, both themes: caught two real
    issues (§4.3), fixed, re-ran clean — **0 violations, all four checks.**

## 4. Problems found and fixed

Ordered as found. Every one below was caught by running something real (a real Chromium instance,
a real axe pass) — none were reasoned about and left unverified.

1. **`secure: isProduction` on all three auth cookies silently broke login in any real browser
   outside `NODE_ENV=production`** — this is the most significant finding of the phase. The
   cookies are named `__Secure-at`/`__Secure-rt`/`__Secure-csrf`; the `__Secure-` NAME PREFIX
   requires the literal `Secure` attribute on the `Set-Cookie` header, independent of whether the
   connection is actually HTTPS — a requirement `secure: isProduction` (false whenever
   `NODE_ENV !== 'production'`) never satisfied outside production. Confirmed empirically, not by
   reading the spec alone: hit the real running API's `GET /auth/csrf` with a real Chromium
   instance (Playwright) — `context.cookies()` came back **empty** with `secure: isProduction`; an
   identical request with `secure: true` set the cookie correctly, and a full real login flow then
   set all three. This would have silently broken the entire login flow the moment this phase's
   frontend tried to authenticate against a real browser — caught before task 18's end-to-end
   verification, not during it. Fixed to `secure: true` unconditionally in `lib/cookies.ts`: every
   topology this project supports is covered — the README's `local.eslamramzy.dev` dev setup runs
   behind a local Caddy terminating real TLS; a bare `http://localhost` dev server is covered by
   Chrome/Firefox's own "localhost is a trustworthy origin" carve-out for `Secure` cookies (also
   confirmed empirically, not assumed); production is always behind TLS. Full API test suite
   (314 tests) still passes unchanged.
2. **Next.js 16 deprecated the `middleware.ts` file convention mid-phase build** — the very first
   `next build` after adding route protection printed "The 'middleware' file convention is
   deprecated. Please use 'proxy' instead," pointing at Next's own migration guide (renamed file,
   renamed exported function, same `config.matcher`). Rather than ship on a convention the
   installed framework version already flags as legacy, renamed to `proxy.ts`/`export function
   proxy`, and updated the three architecture-doc references (`04 §7`, `08`'s folder tree, `09`'s
   CSP-nonce note) that still said `middleware.ts`, so the docs match what actually ships.
3. **A real axe run against the finished shell caught two issues no earlier check had**:
   `/admin/login` and `/admin/change-password` had no `<main>` landmark (both pages rendered a bare
   `<div>`; wrapped in `<main>`); the Recent Activity timestamp's `--color-text-faint` measured
   under 4.5:1 against its background in both themes (switched to `--color-text-muted`, the same
   token every other secondary label on the page already uses and passes). Re-ran after each fix:
   0 violations, both pages, both themes.
4. **A jsdom test-tooling artifact, not an app bug, briefly looked like a broken refresh path**:
   `adminClient.test.ts`'s first draft set `document.cookie = '__Secure-csrf=...; path=/'` (no
   `Secure` attribute) to simulate an existing CSRF cookie — jsdom's cookie jar enforces the same
   `__Secure-` prefix rule real browsers do (problem 1 above) and silently dropped it, so the test
   fell through to the "no cookie yet, fetch one" branch instead of the one it meant to exercise,
   producing a confusing failure (`ApiError: Access token expired` from what looked like a refresh
   that silently failed). Fixed by adding `; Secure` to every test-cookie write — which is itself
   evidence for why problem 1 is a real, not theoretical, browser behavior.
5. **A `vi.resetModules()` + dynamic `import()` test pattern broke `instanceof ApiError` assertions
   in two `adminClient.test.ts` cases** — resetting modules gives the freshly re-imported
   `adminClient` a different instance of `ApiError.ts` than a top-level `import` in the test file
   captured before the reset, so `instanceof` failed even for a correctly-thrown error. Fixed by
   asserting on the error's shape (`code`, `status`) instead of its class identity, and documented
   the reasoning in the test file so a future reader doesn't reach for `instanceof` again.
6. **Two TypeScript `exactOptionalPropertyTypes` errors**, both the same shape already established
   elsewhere in this codebase: `ToastProvider` passing `delay={toast.autohideMs ?? undefined}` to a
   prop typed `number` (not `number | undefined`) — fixed with the conditional-spread pattern
   (`...(condition ? { delay: value } : {})`) already used throughout `endpoints.ts`; and
   `adminClient.ts`'s `mutate()` helper conflicting with `RequestInit`'s own `body: BodyInit | null`
   when intersected with a generic `body?: unknown` — fixed by giving `mutate()` its own narrower
   parameter type instead of extending `RequestInit`.

## 5. Technical decisions

| Decision | Rationale |
|---|---|
| Backend scope narrowed to exactly one endpoint (`GET /admin/overview`) | Phase 7 per doc 11 is a frontend-focused phase; doc 03 §3 already specs this one admin endpoint as belonging here. Full CRUD for all 13 modules is Phase 8's explicit deliverable — building it now would be building ahead of need (doc 11 §50) |
| `adminClient.ts` kept separate from the public `client.ts` | The two are qualitatively different: every admin call carries a CSRF header and can trigger the module-level single-flight-refresh interceptor; folding both into one file would mean the public client's two unauthenticated, CSRF-exempt calls pay for machinery they never touch |
| `adminReadLimiter` keyed per-user, mounted after `authenticate` (not before, per doc 03 §6's general rule) | That ordering exists for anonymous IP-keyed buckets to reject cheaply before auth work; a per-user bucket's `keyGenerator` needs `req.user` populated first — a deliberate, documented deviation, not an oversight |
| Sidebar ships all 13 modules, 12 of them disabled with a "Soon" badge | Matches doc 07 §51's exact order today rather than only showing what exists yet; flipping `enabled: true` in the same commit that ships a module's route is a one-line change, not a redesign |
| `⌘K` command palette not built this phase | Doc 07 §1 lists it, but a real one needs a command registry spanning modules that don't exist until Phase 8 — noted in `Topbar.tsx`'s own comment rather than silently dropped |
| Sign-out uses `ConfirmDialog` without `requireTypedConfirmation` | Losing an active session is disruptive but reversible (sign back in), unlike deleting an entity — typed confirmation is reserved for Phase 8's actual deletes |
| `useLogout` redirects only `onSuccess`, not `onSettled` | A failed logout (network error, cookies never touched) staying on the page is what makes an error toast and a retry possible — redirecting unconditionally would wipe the toast before it could render (found while wiring the toast in, see commit history) |
| `?reason=expired`/`?reason=password-changed` are inline URL-driven alerts, not toasts | A toast lives in React context, which any full-page navigation (this app's own pattern for post-auth redirects) wipes before the destination page could render it |

## 6. Known gaps

- **No component-level tests for `Sidebar`/`Topbar`/`LoginForm`/`ChangePasswordForm`** — only
  `ConfirmDialog` (the one with real conditional logic worth testing) and the two hooks/lib files
  got dedicated component/unit tests this phase. The real-browser Playwright pass exercised all of
  them end-to-end, but there's no fast, isolated regression check for e.g. the Sidebar's active-
  link highlighting logic.
- **`⌘K`/`⌘S` keyboard shortcuts** (doc 07 §6 "Keyboard first") are not implemented — `⌘S` has
  nothing to save yet (no entity forms exist before Phase 8), and `⌘K`'s reasoning is in §5 above.
- **Autosave-to-`localStorage` and the `beforeunload` dirty-guard** (doc 07 §6 "Never lose work")
  apply to entity forms, none of which exist until Phase 8 — `LoginForm`/`ChangePasswordForm` are
  the only forms this phase ships, and neither holds unsaved work worth guarding.
- **No Lighthouse run against the admin shell** this phase — Phase 6's Lighthouse pass was about
  public-site SEO/performance targets that don't apply the same way to a `noindex`, session-gated
  admin surface; axe (accessibility) is the check that does transfer, and it ran.

## 7. Blockers

**None.** Phase 8 (Content management — CRUD for all 13 modules) can start immediately: the shared
building blocks it needs (`<ConfirmDialog>`, `<DataTable>`'s prerequisites — react-query,
`ResourceToolbar`'s CSRF-aware mutation path via `adminClient.ts`) and the shell that will host
every module's List/Create/Edit screens are all in place. `EntityForm`, `DataTable`,
`PublishControls`, `MediaPicker`, `SortableList`, `MarkdownEditor`, and `TagInput` (doc 07 §2) are
Phase 8's own deliverables, not started here — building them without a real module to prove them
against would be building ahead of need.
