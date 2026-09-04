# Phase 4 Report — Authentication + Authorization

**Status: complete.** Report format per brief §56.

---

## 1. What was implemented

Everything docs/architecture/11's Phase 4 deliverable list asks for, following docs 04
(Authentication) and 05 (Authorization) directly:

| Area | Delivered |
|---|---|
| Password hashing | Already existed since Phase 2 (`lib/password.ts`) — reused as-is, plus its `DUMMY_PASSWORD_HASH` for constant-time login |
| Access token | `lib/jwt.ts` — HS256 JWT, 15 min default, `sub`/`role`/`tokenVersion`/`jti` claims, never throws (tagged `valid`/`expired`/`invalid` result) |
| Refresh token | `repositories/refreshTokenRepository.ts` — opaque 32-byte base64url token, SHA-256-hashed at rest, family-based rotation + revocation |
| CSRF | `lib/csrf.ts` (signed double-submit token, HMAC + TTL) + `middleware/csrf.ts` (Origin allow-list check + pair verification) |
| Cookies | `lib/cookies.ts` — `__Secure-at`/`__Secure-rt`/`__Secure-csrf` set/clear/read, the one place cookie attributes are decided |
| RBAC | `packages/shared/src/constants/rbac.ts` — `PERMISSIONS`, `ROLE_PERMISSIONS`, `roleHasPermission()` |
| Auth schemas | `packages/shared/src/schemas/auth.ts` — `loginSchema`, `changePasswordSchema`, `newPasswordSchema` (+ common-password blocklist), `authUserSchema` |
| Repositories | `userRepository.ts` (passwordHash excluded from every default select), `refreshTokenRepository.ts`, `auditLogRepository.ts` (append-only) |
| Business logic | `services/authService.ts` — login, refresh, logout, logoutAll, changePassword, getCurrentUser; every mutation audited inside the same `prisma.$transaction` (doc 05 §7) |
| Enforcement point #1 | `middleware/authenticate.ts` — verifies the JWT, re-checks `isActive`/`tokenVersion` against the DB on every request |
| Enforcement point #2 | `middleware/authorize.ts` — checks the role's static permission set |
| HTTP wiring | `controllers/authController.ts` + `routes/auth.routes.ts` — `/api/v1/auth/{csrf,login,refresh,logout,logout-all,me,change-password}` |
| Rate limiting | `middleware/rateLimit.ts` extended with `authLoginByIpLimiter`, `authLoginByEmailLimiter` (dual bucket, doc 09 §4), `authRefreshLimiter`, plus audited `429`s on the login buckets |
| Privacy hashing | `utils/hashIp.ts` — `sha256(ip + userAgent + dailySalt)`, salt rotating every UTC day, keyed by the (already-planned, now actually wired) `IP_HASH_SALT` secret |
| Recovery CLI (D7) | `scripts/admin-reset-password.ts`, `scripts/admin-unlock.ts` — the only way to recover a locked or password-lost single admin account |
| Wiring | `cookie-parser` mounted globally in `app.ts`; `authRouter` mounted at `/api/v1/auth` |

## 2. Files created / modified

```
packages/shared/src/constants/rbac.ts (+test)              new
packages/shared/src/constants/commonPasswords.ts           new
packages/shared/src/schemas/auth.ts (+test)                new
apps/api/src/config/env.ts (+test)                          + JWT_SECRET, CSRF_SECRET, IP_HASH_SALT,
                                                              JWT_ACCESS_TTL, JWT_REFRESH_TTL, COOKIE_DOMAIN
apps/api/src/config/prisma.ts                                + PrismaClientOrTx type (tx-capable repos)
apps/api/src/lib/jwt.ts (+test)                             new
apps/api/src/lib/csrf.ts (+test)                            new
apps/api/src/lib/cookies.ts (+test)                         new
apps/api/src/lib/duration.ts (+test)                        new — tiny TTL-string parser
apps/api/src/utils/hashIp.ts (+test)                        new
apps/api/src/repositories/userRepository.ts                new
apps/api/src/repositories/refreshTokenRepository.ts        new
apps/api/src/repositories/auditLogRepository.ts            new
apps/api/src/services/authService.ts (+test)                new
apps/api/src/middleware/authenticate.ts (+test)             new
apps/api/src/middleware/authorize.ts (+test)                new
apps/api/src/middleware/csrf.ts (+test)                     new
apps/api/src/middleware/rateLimit.ts                        + auth:login (dual), auth:refresh buckets
apps/api/src/controllers/authController.ts                  new
apps/api/src/routes/auth.routes.ts                           new
apps/api/src/types/express.d.ts                              + req.user
apps/api/src/app.ts                                          + cookie-parser, authRouter
apps/api/scripts/admin-reset-password.ts                    new — D7 recovery CLI
apps/api/scripts/admin-unlock.ts                             new — D7 recovery CLI
apps/api/tests/auth.test.ts                                  new — HTTP-layer integration
apps/api/tests/globalSetup.ts                                new — see §4.2
apps/api/tsconfig.scripts.json                               + scripts/**/*.ts
apps/api/package.json                                        + jsonwebtoken, cookie-parser (+@types);
                                                              admin:reset-password, admin:unlock scripts
.env.example, apps/api/.env.example, docker-compose.yml     JWT_REFRESH_SECRET removed (never used —
                                                              the refresh token is opaque, not a JWT);
                                                              IP_HASH_SALT moved into the Auth block,
                                                              now actually required
eslint.config.mjs                                             + apps/api/scripts/*.ts to the
                                                              console-allowed / non-null-allowed set
```

## 3. Testing performed

| Gate | Result |
|---|---|
| `format:check` / `lint` / `lint:rules` | pass |
| `typecheck` (both `tsconfig.json` and `tsconfig.scripts.json`) | pass |
| `test` | pass — **248 tests** in the API workspace (was 140 after Phase 3; **+108 new**), 315 across the monorepo |
| `build` | pass |
| `audit:deps` | pass — 0 vulnerabilities (two earlier attempts hit a transient `503`/`400` from npm's advisory endpoint itself, not a finding — a clean retry confirmed it) |

What the new tests actually exercise, split by why each layer is tested where it is:

- **`src/services/authService.test.ts`** (22 tests) — the business-logic layer, called directly
  against the real migrated test database, deliberately bypassing HTTP and the login rate limiter so
  the actual security properties can be driven to their real boundaries: 10 real wrong-password
  attempts to prove the lockout threshold, 20 to prove the **second** lockout is longer than the
  first (exponential, doc 04 §2); refresh rotation revoking the old token and pointing it at its
  replacement; replaying a rotated token killing the **entire family**, including the client's own
  live rotated token, not just the replayed one; logout/logout-all/changePassword all revoking the
  right scope of sessions and writing the right audit action; the unknown-email and wrong-password
  paths throwing the byte-for-byte identical error.
- **`tests/auth.test.ts`** (13 tests) — the HTTP wiring, through a real Express app + supertest:
  missing/wrong/foreign `Origin`, missing CSRF cookie, mismatched cookie/header pair (the cookie-
  tossing scenario D1 explicitly accepts as a residual risk and doc 04 §5's signed pair defends
  against), the login rate limiter's dual IP/email buckets driven to their actual `429`, and a full
  login → `/me` → refresh (rotate) → replay (reuse detected, 401) → logout → `/me` (401) run against
  the real app.
- **`src/lib/jwt.test.ts`** — round-trip, per-token unique `jti`, expiry, wrong secret, wrong
  issuer/audience, a malformed token, and a hand-assembled `alg: none` token (the classic algorithm-
  confusion forgery) — all correctly rejected by the explicit `algorithms: ['HS256']` allow-list.
- **`src/lib/csrf.test.ts`** — signature tampering, nonce tampering, malformed input, a non-numeric
  timestamp, TTL expiry on both sides (just-under and just-over 24h), a future-dated token, and the
  double-submit pair logic (matching-valid accepted; independently-valid-but-mismatched rejected).
- **`src/lib/cookies.test.ts`** — every cookie's exact attributes (`HttpOnly`, `path`, `sameSite`)
  against a mocked `res.cookie`/`res.clearCookie`, and reader behaviour with `req.cookies` absent
  entirely (cookie-parser not mounted).
- **`src/middleware/authenticate.test.ts`** — valid token, no cookie, expired token (→
  `TokenExpiredError` specifically), malformed token, deactivated user, stale `tokenVersion`
  (simulating "password changed since this token was issued"), and a non-numeric `sub` claim — all
  with the repository mocked so this is a pure middleware-logic test.
- **`src/middleware/authorize.test.ts`** and **`src/middleware/csrf.test.ts`** — direct middleware
  unit tests with mocked `req`/`res`/`next`, including the specific RBAC boundary
  (`ADMIN` cannot `user:create`/`user:delete`; `EDITOR` has no permissions at all).
- **`src/utils/hashIp.test.ts`** — determinism, a real sha256-shaped digest, sensitivity to IP and
  user-agent changes, and the daily salt rotation boundary (same hash within a UTC day, different
  hash across midnight UTC) using `vi.setSystemTime`.
- **`src/config/env.test.ts`** — extended with `IP_HASH_SALT` (missing, placeholder-in-production,
  accepted-in-development) alongside the existing `JWT_SECRET`/`CSRF_SECRET` cases.

## 4. Problems found and fixed

1. **`IP_HASH_SALT` already existed in `.env.example`/`docker-compose.yml` since Phase 1, planned for
   exactly this use, and my first draft of `hashIp.ts` never used it** — it derived the daily salt
   from `CSRF_SECRET` instead, reusing an unrelated secret rather than the dedicated one the project
   had already planned for. Caught by re-reading the env template files while wiring the audit-log
   `ipHash` field, not by a test (no test would have caught a *design* mismatch like this — both
   approaches "work"). Fixed by adding `IP_HASH_SALT` to `env.ts`'s required-secret schema (same
   `superRefine` placeholder check as `JWT_SECRET`/`CSRF_SECRET`) and pointing `hashIp.ts` at it.

2. **Two test files independently managing the same shared database's lifecycle would have raced.**
   `tests/health.test.ts` already created, migrated, and deleted `./.tmp/vitest-app.db` in its own
   `beforeAll`/`afterAll` — fine when it was the only file touching that path. Adding
   `tests/auth.test.ts`, which needs the same real `app.ts` + Prisma singleton, meant a second file
   doing the identical create/migrate/delete dance against the identical physical file, and vitest
   runs test files in parallel worker processes — a real race (migrate-twice-onto-the-same-file,
   delete-while-another-file-is-still-reading). Caught by reasoning about the existing test
   infrastructure's own documented constraint *before* writing the second file, not by a flaky test
   run. Fixed by moving the migration lifecycle into a `globalSetup` (`tests/globalSetup.ts`,
   `vitest.config.ts`), which vitest runs exactly once regardless of how many files need the shared
   DB, and trimming `health.test.ts` down to just building the app.

3. **A combined `Cookie` header with two `__Secure-csrf` entries silently used the WRONG one.** The
   first draft of the login → refresh flow test fetched a *second* CSRF token via `GET /auth/csrf`
   and concatenated its cookie onto the login response's own cookies for the refresh call. The
   request failed with `403 CSRF_FAILED` even though both tokens were independently valid. Root
   cause: the `cookie` package's parser keeps the FIRST occurrence of a repeated cookie name in one
   header, silently discarding the second — so the *old* (login-response) CSRF cookie value won,
   while the `X-CSRF-Token` header carried the *new* one, and the pair mismatched. This is a genuine,
   easy-to-make integration-test bug (not a bug in the implementation) that happens to demonstrate
   the double-submit design is actually enforcing pair equality correctly. Fixed by reusing the one
   CSRF pair each response already set (reading its literal `Set-Cookie` value) instead of fetching
   and merging a second.

4. **`exactOptionalPropertyTypes` rejected `jwt.sign`'s options object** — `env.JWT_ACCESS_TTL as
   jwt.SignOptions['expiresIn']` produced a type that still included `undefined` (from the cast
   target itself), which `exactOptionalPropertyTypes` refuses to assign to an optional property even
   though the value can never actually be `undefined` at runtime. Caught by `tsc`, not a test. Fixed
   with `as NonNullable<jwt.SignOptions['expiresIn']>`.
5. **`noUncheckedIndexedAccess` caught a real gap in `lib/duration.ts`'s first draft**: indexing a
   `Record<string, number>` with a regex capture group typed `string | undefined` is a compile error,
   not just a lint nit — the capture is genuinely `string | undefined` under this flag. Fixed by
   narrowing with a `keyof typeof UNIT_MS` type guard instead of trusting the regex informally.

## 5. Technical decisions

| Decision | Rationale |
|---|---|
| CSRF token is a self-contained, timestamped signed nonce, not doc 04 §5's literal `HMAC(value + sessionId, ...)` | This architecture has no session-store concept that exists *before* login (login itself needs CSRF protection, per doc 04 §2's own sequence diagram) — inventing one just to bind the HMAC to it would have been pure overhead. The actual security property (a tossed cookie cannot be forged into a valid pair without `CSRF_SECRET`) comes entirely from the HMAC secret regardless; the timestamp adds a bounded TTL doc 04 didn't originally specify, documented in `lib/csrf.ts`'s header |
| `logout` identifies the actor from the refresh-token row, not from a required `authenticate` pass | The 15-minute access token may already be expired by the time an idle admin clicks logout; making logout depend on a still-valid access token would make it fail exactly when it's most likely to be used. `logout-all` and `change-password` DO require `authenticate` — they need to prove current identity, not just "holds *a* cookie for *some* session" |
| Lockout duration is derived from `failedLoginCount` crossing multiples of 10, not a separate "lock count" column | Doc 04 §2 specifies "10 consecutive failures → 15 min, exponential on repeat" but the schema has no dedicated counter for *how many times* the account has been locked. Deriving it from `failedLoginCount / 10` gives the same exponential behaviour without a schema change, and is directly tested (`authService.test.ts`: 10 failures → 15 min, 20 → a longer lock) |
| Repository functions take an optional `client: PrismaClientOrTx = prisma` parameter | Doc 05 §7 requires a mutation and its audit-log write to commit or roll back together, inside one `prisma.$transaction`. Phases 2–3's repositories never needed this (no multi-write transactions yet); Phase 4 is the first to, so the pattern is introduced here rather than earlier, and defaults to the plain singleton so every pre-existing call site keeps working unchanged |
| `authService.test.ts` calls the service directly instead of only testing through HTTP | The login rate limiter (5/15min, per IP *and* per email) is itself under test in `tests/auth.test.ts`, and real HTTP requests from the same test process share both buckets — driving lockout to its real 10-failure threshold through HTTP in the same file would fight the very limiter also being verified. Splitting the two keeps each test suite unambiguous about which control it is proving |
| The doc 10 §3 "generated authorization matrix" (walk the router, assert 401 on every protected route) is **not** built this phase | There are exactly three `authenticate`-gated routes today (`GET /me`, `POST /logout-all`, `POST /change-password`), each individually and directly tested for the no-cookie case in `tests/auth.test.ts`, and `authenticate.test.ts` unit-tests the expired/tampered/invalid-token branches directly. A generic Express-5-router-walker is real infrastructure work best justified once Phase 8's `authorize()`-gated content routes exist in numbers — building it now, against three known routes, would be speculative rather than tested against the shape it actually needs to handle |
| **D12 (two-factor authentication) was NOT implemented** | It was proposed as a recommendation in Phase 0 and remains listed as undecided in `docs/architecture/12-decisions-pending-approval.md` — never approved by the user. Per the project's own standing rule, an unapproved feature is not built regardless of how reasonable it might be for a security-sensitive login |

## 6. Blockers

**None.** Phase 5 (Public API) can start immediately. `authenticate`/`authorize` are ready for any
route that needs them; `authLoginByIpLimiter`/`authLoginByEmailLimiter`/`authRefreshLimiter` are
mounted and tested; the audit trail is append-only and coupled to every mutation this phase added.
`npm run admin:reset-password` and `npm run admin:unlock` give the single admin a recovery path
independent of the API being reachable at all.

One open item carried forward, not a blocker: the doc 10 §3 generated authorization-matrix test
(§5 above) is deferred to whichever phase first adds `authorize()`-gated content routes in enough
number to make automatic router-walking worth building and verifying against real cases.
