# Phase 1 Report — Project Setup

**Status: complete.** Report format per brief §56.

---

## 1. What was implemented

An npm-workspaces monorepo with all tooling wired and verified. No feature code — the database,
API surface, public pages and admin dashboard belong to later phases. The point of this phase is to
make everything after it verifiable.

| Area | Delivered |
|---|---|
| Workspaces | `apps/api` (Express 5), `apps/web` (Next.js 16), `packages/shared`. npm workspaces, no build orchestrator |
| Shared package | Domain constants (content statuses, roles, security vocabulary), Zod primitives (slug, id, email, URL, pagination), API envelope types |
| TypeScript | `strict` + `noUncheckedIndexedAccess` + `exactOptionalPropertyTypes` + `verbatimModuleSyntax`, ESM/NodeNext |
| Linting | ESLint flat config with the architectural layering rules, Prettier |
| Testing | Vitest in all three workspaces; Supertest for the API; Testing Library + jsdom for the web |
| API | `createApp()` / `server.ts` split (testable without a socket), fail-fast env validation, health endpoints, exact-match CORS, helmet, 1 MB body cap, graceful shutdown |
| Web | App Router skeleton, Bootstrap SCSS source + design-token layer, reduced-motion and focus-visible baselines |
| CI | format · lint · **lint-rule verification** · typecheck · test · build · npm audit · gitleaks |
| Deployment | `docker-compose.yml`, `Dockerfile.api`, `Dockerfile.web` (see §4 — not verified) |
| Docs | `README.md`, this report |

## 2. Files created

50 files. The ones worth knowing about:

```
package.json  tsconfig.base.json  eslint.config.mjs  .prettierrc.json
.env.example  .gitignore  .nvmrc  .editorconfig  README.md
.github/workflows/ci.yml
docker-compose.yml  Dockerfile.api  Dockerfile.web
scripts/verify-lint-rules.mjs

packages/shared/src/
  constants/{api,content,security}.ts   schemas/primitives.ts   types/api.ts

apps/api/src/
  app.ts  server.ts  config/env.ts  routes/health.routes.ts
apps/api/tests/health.test.ts
apps/api/prisma/seed-assets/profile-photo.jpg

apps/web/
  next.config.ts  vitest.config.mts  vitest.setup.ts
  src/app/{layout,page}.tsx  src/lib/config.ts  src/styles/{_tokens,globals}.scss
```

## 3. Testing performed

All from a clean `npm ci`:

| Gate | Result |
|---|---|
| `format:check` | pass |
| `lint` | pass (0 errors, 0 warnings) |
| `lint:rules` | pass — all **8** architectural rules verified active |
| `typecheck` | pass |
| `test` | pass — **48 tests** (39 shared, 6 API, 3 web) |
| `build` | pass — shared, API and Next.js all build |
| `audit:deps` | pass — 0 vulnerabilities across 379 packages |

Manually verified beyond the automated gates:

- API boots, and `/api/v1/health` and `/health/ready` return the documented success envelope.
- An unknown route returns the documented `NOT_FOUND` error envelope.
- `x-powered-by` is absent; `X-Content-Type-Options: nosniff` and `X-Frame-Options: DENY` are present.
- A request carrying `Origin: https://evil-eslamramzy.dev` receives **no**
  `Access-Control-Allow-Origin` — the suffix-matching bypass is covered by a test, not just a comment.
- `config/env.ts` exits non-zero with a readable message on an invalid `PORT` or an empty
  `CORS_ORIGIN`, rather than booting into an undefined state.
- Next.js builds and serves; the page renders and sets no `x-powered-by`.

## 4. Problems

1. **The Prisma lint restriction was silently inactive.** Flat-config `rules` entries override
   rather than merge, so the later `services/**` block discarded the `@prisma/client` restriction
   set by the earlier `apps/api/src/**` block — and the repository still linted clean. A lint rule
   that is silently off looks like protection and is not.
   **Fixed**, and `scripts/verify-lint-rules.mjs` now writes a probe file per rule and fails if the
   expected violation is not reported. It runs in CI, so this class of bug cannot recur silently.

2. **Docker images could not be built.** This environment has the Docker CLI but no daemon, so
   `Dockerfile.api` and `Dockerfile.web` are **unverified**; `docker-compose.yml` is syntax-validated
   only. Building and running them is a Phase 16 exit criterion. Nothing in Phases 2–15 depends on it.

3. **Bootstrap 5.3 emits Dart Sass deprecation warnings** (`@import`, global built-ins, colour
   functions, `if()`). They come from a dependency, not our code, and drowned out real build output.
   Silenced by category in `next.config.ts` with a comment explaining when to remove it.

4. **`jest-dom` matcher types were not registered**, so `toHaveTextContent` failed typecheck while
   the test itself passed. Resolved by adding `@testing-library/jest-dom/vitest` to the web
   `tsconfig` `types`. Worth noting because a green test suite with a red typecheck is exactly the
   kind of gap that gets waved through.

## 5. Technical decisions taken

| Decision | Rationale |
|---|---|
| **TypeScript 5.9, not 7.x** | TypeScript 7 (the native port) is published, but `typescript-eslint` support for it is not something I could verify here. Pinning the foundation to a known-good compiler is worth more than being current. Revisit once the plugin ecosystem catches up. |
| **ESM + NodeNext everywhere** | Avoids the dual-package hazard between the ESM shared package and the API. Cost: relative imports need `.js` extensions. |
| **`.mts` for the web Vitest config** | `apps/web` is not `"type": "module"` (Next.js convention), so an ESM config file must be `.mts` or Vite warns on every run. |
| **Markdown excluded from Prettier** | Prettier's table padding and emphasis rewriting churned the architecture docs without improving them, producing a 494-line diff of pure noise. Formatting is for code. |
| **`process.loadEnvFile()` instead of `dotenv`** | Built into Node 22; one fewer dependency. Skipped in production, where the environment comes from the container and a stray `.env` on the server should not silently win. |
| **`output: 'standalone'` for Next.js** | Produces a self-contained server with only the traced `node_modules`, which is what keeps the Phase 16 image small. |
| **`npm ci --ignore-scripts` in Docker builds** | A dependency's `postinstall` should not run arbitrary code during an image build (security architecture §12). Prisma's generate will be invoked explicitly in Phase 2. |
| **Empty `NEXT_PUBLIC_API_URL` treated as unset** | An empty environment variable is a misconfiguration, not a value. |

## 6. Blockers

**None for Phase 1.**

**D5 blocks Phase 2** — the projects schema cannot be written until the case-study body structure is
settled (fixed columns, flexible sections, or the recommended hybrid). See
[decisions](../architecture/12-decisions-pending-approval.md).

Also worth settling soon, though not blocking: **D11** (the unrelated `Program.cs` still in the
repository root — I have not touched it) and **D3's** open sub-question, the real domain name and
DNS control over the `api.` subdomain.
