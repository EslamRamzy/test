# Phase 3 Report — Backend Foundation

**Status: complete.** Report format per brief §56.

---

## 1. What was implemented

Everything docs/architecture/11's Phase 3 deliverable list asks for, on top of what Phases 1–2
already shipped (the `app.ts`/`server.ts` split, fail-fast `env.ts`, the Prisma singleton with
pragmas, and `/health`/`/health/ready` all predate this phase and needed no rework):

| Area | Delivered |
|---|---|
| Error classes | `src/errors/AppError.ts` — an abstract base plus 11 typed subclasses, one per documented error code (docs/architecture/03 §1) |
| Error handler | `src/middleware/errorHandler.ts` — the one place a caught error becomes a response; production masking, `requestId` correlation, `Retry-After` for rate limits |
| Request id | `src/middleware/requestId.ts` — generates or validates an incoming `X-Request-Id`, rejecting anything outside a safe character set |
| Structured logging | `src/lib/logger.ts` (pino, with a real, tested redaction list) + `src/middleware/requestLogger.ts` (pino-http, reusing the request id) |
| Rate limiting | `src/middleware/rateLimit.ts` — a configurable factory plus the `public:read` bucket from docs/architecture/09 §4 |
| Validation | `src/middleware/validate.ts` — Zod-based `params`/`query`/`body` validation that replaces `req.*` with coerced output |
| Response envelope | `src/lib/httpResponse.ts` — `sendSuccess`/`sendPaginatedSuccess`/`buildPaginationMeta`, typed against the shared `ApiSuccess`/`ApiPaginatedSuccess` contract |
| Security headers | `src/middleware/securityHeaders.ts` (`Permissions-Policy`, which helmet does not set) + an expanded `helmet()` config (HSTS 2yr+preload, `Referrer-Policy`) in `app.ts` |
| Wiring | `app.ts` rebuilt to the exact middleware order in docs/architecture/03 §6 |

## 2. Files created / modified

```
apps/api/src/errors/AppError.ts (+test)          new — 11 typed error classes
apps/api/src/lib/logger.ts (+test)               new — pino, redaction, tested against real output
apps/api/src/lib/httpResponse.ts (+test)         new — envelope helpers
apps/api/src/middleware/requestId.ts (+test)     new
apps/api/src/middleware/requestLogger.ts         new — pino-http wiring
apps/api/src/middleware/rateLimit.ts (+test)     new
apps/api/src/middleware/validate.ts (+test)      new
apps/api/src/middleware/errorHandler.ts (+test)  new
apps/api/src/middleware/notFoundHandler.ts       new
apps/api/src/middleware/securityHeaders.ts       new — Permissions-Policy
apps/api/src/types/express.d.ts                  new — see the pino-http `req.id` conflict, §4
apps/api/src/app.ts                              rewritten — full middleware chain
apps/api/src/routes/health.routes.ts             updated — uses sendSuccess
apps/api/package.json                            + pino, pino-http, express-rate-limit, pino-pretty (dev)
```

## 3. Testing performed

| Gate | Result |
|---|---|
| `format:check` / `lint` / `lint:rules` | pass |
| `typecheck` (both `tsconfig.json` and `tsconfig.scripts.json`) | pass |
| `test` | pass — **122 tests** in the API workspace (was 58 after Phase 2; +64 new) |
| `build` | pass |
| `audit:deps` | pass — 0 vulnerabilities |

What the new tests actually exercise, beyond "does it run":

- **Every error class** maps to its documented status code and error code (`AppError.test.ts`).
- **The full envelope contract**, end to end through a real Express app + supertest, for every
  error type, the 404 catch-all, `Retry-After`, and `X-Request-Id` propagation
  (`errorHandler.test.ts`).
- **Production masking is proven both ways**: a masked 500 in production leaks no message detail
  (asserted by searching the JSON body for a fake leaked connection string) and still carries
  `requestId`; outside production the real message and a stack appear; a non-internal `AppError` is
  **never** masked in either mode.
- **`requestId`**: realistic HTTP-deliverable attack payloads (empty, oversized, wrong character
  set) via supertest, and control-character payloads (newline, CR, NUL, tab) that no conforming
  HTTP client can actually transmit — proven instead by calling the middleware function directly.
- **`validate`**: coercion, defaults, multi-field error reporting, nested field paths, and a
  `.strict()` schema rejecting an unexpected field (the mass-assignment defence).
- **`rateLimit`**: under/over the limit, the exact envelope on `429`, a real `Retry-After` header,
  and — because docs/architecture/09 §4 is explicit that `trust proxy` is what makes IP-keying safe
  — both the safe default (unset trust proxy: distinct `X-Forwarded-For` values share one bucket)
  and the configured behaviour (they get independent buckets).
- **`logger`**: redaction verified against real captured JSON output — a top-level field, a
  `req.headers.authorization` and `res.headers['set-cookie']` in the exact nested shape pino-http
  actually produces, one level of application-level nesting, and a negative case (a
  similarly-named-but-different field is *not* redacted).

## 4. Problems

Five real bugs, all caught by writing and running the tests rather than by reading the code:

1. **`errorHandler`'s message-masking logic never worked — for either environment.** When wrapping
   a plain `Error` into an `InternalError`, the original message was never forwarded, so
   `appError.message` was always `InternalError`'s own generic default. The masking branch
   (`isProduction ? generic : appError.message`) was therefore comparing the generic string against
   itself regardless of environment — "shows the real message outside production" was never
   actually true until a test asserted the real text and failed. Fixed by forwarding the original
   error's message into the constructed `InternalError`.

2. **`vi.resetModules()` + a dynamic re-import is not a reliable way to test an environment-
   dependent singleton in this project's real-ESM setup.** The first version of the masking test
   stubbed `NODE_ENV` and dynamically re-imported `errorHandler.js` per test. It produced two
   distinct, confusing failures: the freshly re-imported module read a stale `process.env.NODE_ENV`
   (module-level state that `resetModules()` did not actually reset), and an `AppError` constructed
   from the *statically*-imported class failed `instanceof` against the *dynamically* re-imported
   one — a different class object despite identical source, because the dynamic import produced a
   genuinely separate module instance. Both are known rough edges of `vi.resetModules()` against
   native ESM rather than a bug in the application code, but they are exactly the kind of thing that
   makes a test suite quietly untrustworthy. Fixed by redesigning `errorHandler` as
   `createErrorHandler(options)`, an explicit factory the test calls twice with `{isProduction: true}`
   and `{isProduction: false}` — no environment stubbing or module cache reset anywhere.

3. **Express 5 made `req.query` a getter-only accessor.** `validate.ts`'s first version did
   `req.query = result.data`, exactly as it does for `req.params` and `req.body` — and that silently
   did nothing: no error, no warning, and the coerced value never reached the route handler. In
   Express 4, `req.query` was a plain property; in Express 5 it is recomputed from the raw URL on
   every read via a getter with no setter, confirmed by a direct, isolated reproduction outside the
   test suite. Fixed with `Object.defineProperty(req, 'query', { value, writable: true,
   configurable: true, enumerable: true })`, which replaces the accessor with a real own property —
   verified to persist, then covered by a permanent test (`validate.test.ts`).

4. **A third, independent type conflict**: `pino-http` globally augments Node's
   `http.IncomingMessage` with `id: ReqId` (`ReqId = string | number | object`). This project's own
   `types/express.d.ts` had also declared `Request.id: string`, and the two together produced
   inconsistent, context-dependent typing of `req.id` (sometimes the wider `ReqId`, sometimes the
   narrower `string`, depending on which file and import order) rather than a clean override.
   Resolved by *not* fighting pino-http's ambient type: `id` was removed from the project's own
   `express.d.ts`, and `middleware/requestId.ts` exports a small `getRequestId(req): string` helper
   that narrows `ReqId` down to the guaranteed-string value this app actually ever assigns, used
   everywhere a caller needs that guarantee back.

5. **A literal NUL byte ended up embedded in a test file's source**, rather than the intended
   two-character `\0` escape sequence, while first drafting `requestId.test.ts` — caught immediately
   by the test itself failing to run cleanly, confirmed with a byte-level check
   (`b'\x00' in data`), and fixed by constructing the character at runtime
   (`String.fromCharCode(0)`) instead of embedding it in source, which removes any ambiguity in how
   a control character reaches a source file through this tool chain going forward.

## 5. Technical decisions

| Decision | Rationale |
|---|---|
| `createErrorHandler(options)` factory, not a module-level singleton reading `env` directly | Directly caused by problem #2 above — explicit configuration is both more testable and, arguably, better design than a hidden dependency on a module singleton |
| CSP left at helmet's built-in default, not disabled | doc09 §2's real nonce-based policy is an explicit Phase 11 rollout (report-only, then enforced); helmet's default self-only policy is a reasonable interim baseline for the months between now and then, and turning CSP off entirely in the meantime would be strictly worse than what helmet already provides for free |
| `Permissions-Policy` set by a small dedicated middleware, not assumed to be part of `helmet()` | Verified directly against the installed helmet version's exports: it is not one of the headers helmet sets, in any configuration |
| `publicReadLimiter` exported but **not yet globally mounted** | The only route that exists is `/health`, which should explicitly *not* be rate-limited (monitoring hits it frequently) — mounting the limiter now would protect nothing real. It is fully tested in isolation and ready for Phase 5's routes to use |
| `validate` is a per-route middleware, not global | Matches docs/architecture/03 §6: different routes need different schemas; there is nothing to validate globally yet with no business routes |
| Logger redaction tested against **real captured pino output**, not just configuration presence | A redact path with a typo silently redacts nothing — the only way to know the paths are actually correct for the shape pino-http produces is to log a fake secret and check it does not appear in the output |

## 6. Blockers

**None.** Phase 4 (Authentication + Authorization) can start immediately. It is the highest-risk
phase in the project (docs/architecture/11: "This phase does not pass without a security review")
and now has a tested error-handling, logging, validation and rate-limiting foundation to build on.
