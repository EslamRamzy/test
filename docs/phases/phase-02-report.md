# Phase 2 Report — Database + Migrations

**Status: complete.** Report format per brief §56.

---

## 1. What was implemented

The full database schema from [doc 02](../architecture/02-database-architecture.md): all ~30
tables, every relationship and its `ON DELETE` behaviour, every index (including the one partial
index), every `CHECK` constraint, and the FTS5 search index with its maintenance triggers — applied
as a real, committed migration and verified against the real SQLite engine, not assumed correct
because the schema compiled.

| Area | Delivered |
|---|---|
| Schema | `apps/api/prisma/schema.prisma` — every model from doc 02 §2–§6 |
| Migration | One hand-edited migration: 17 inlined `CHECK` constraints, 1 partial index, the FTS5 virtual table, and 12 triggers (4 entity types × insert/update/delete) keeping it in sync with publish state |
| Prisma client | `src/config/prisma.ts` — the driver-adapter singleton (see §4) + the 4 startup `PRAGMA`s, applied once |
| Bootstrap | `prisma/bootstrap.ts` — idempotent: admin user, 7 skill categories, default site settings, the profile row with the real supplied photo stored as a `media` row |
| Seed | `prisma/seed.ts` — dev-only demo content (technologies, one project with a full security assessment, one article, one research entry, timeline), refuses `NODE_ENV=production` without `--force` |
| Password hashing | `src/lib/password.ts` — Argon2id per doc 04 §4, introduced now because bootstrap needs it; Phase 4 builds login on top of it rather than a second path |
| Storage helpers | `src/lib/storage.ts` — checksum + content-hashed filename generation, shared by bootstrap now and the real upload endpoint in Phase 9 |
| Repository pattern | `src/repositories/projectRepository.ts` — the two-function draft-isolation pattern from doc 05 §5, fixed in code (not just documentation) before more repositories are built on it |
| Readiness | `/health/ready` now genuinely checks the database, not a stub — see the two real bugs this caught, §4 |
| Tooling | Root-level `.env.example` split into three (§4); a root `postinstall` that regenerates the Prisma client on every `npm install`/`npm ci` |

## 2. Files created / modified

30 files — full list via `git status`:

```
apps/api/prisma/schema.prisma                    (new — the schema)
apps/api/prisma/migrations/20260904015904_init/  (new — migration + hand-written SQL)
apps/api/prisma.config.ts                        (new — CLI-only config)
apps/api/tsconfig.scripts.json                   (new — typechecks prisma/*.ts against src/)
apps/api/src/config/prisma.ts                    (new — client singleton + pragmas)
apps/api/src/lib/password.ts, storage.ts (+tests) (new)
apps/api/src/repositories/projectRepository.ts   (new — the pattern skeleton)
apps/api/src/repositories/healthRepository.ts    (rewritten — see the readiness bug, §4)
apps/api/src/services/healthService.ts (+test)   (new)
apps/api/prisma/bootstrap.ts, seed.ts            (new)
apps/api/tests/helpers/testDb.ts                 (new — migration-replay test fixture)
apps/api/tests/database/*.test.ts                (new — 4 files, CHECK/FK/pragma/search coverage)
apps/api/tests/health/readiness-query.test.ts    (new — regression test, §4)
apps/api/tests/health.test.ts                    (updated — real DB-backed readiness)
apps/api/src/server.ts                           (updated — startup DB check, graceful shutdown)
apps/api/src/routes/health.routes.ts             (updated — routes through the service now)
apps/api/tsconfig.json                           (rootDir fix — see §4)
apps/api/vitest.config.ts                        (dedicated test DB path)
apps/api/package.json                            (db:* scripts; deps reorganised)
apps/api/.env.example, apps/web/.env.example     (new — split from the root file, see §4)
package.json (root)                              (postinstall; npm overrides for 4 CVEs)
Dockerfile.api                                   (dist/src path fix; better-sqlite3 native rebuild)
eslint.config.mjs                                (console allowed in prisma/*.ts CLI scripts)
.gitignore                                       (apps/api/generated/)
docs/architecture/02, 08                         (three corrections recorded in place, §4)
README.md                                        (env file split, db scripts, Phase 2 status)
```

## 3. Testing performed

All from a clean state (`rm -f prisma/portfolio.db*`, no leftover generated client):

| Gate | Result |
|---|---|
| `format:check` / `lint` / `lint:rules` | pass |
| `typecheck` | pass — including `tsconfig.scripts.json` for `prisma/*.ts` |
| `test` (root, all workspaces) | pass — **100 tests** total (39 shared, 58 API, 3 web). The API workspace went from 6 tests in Phase 1 to 58: password, storage and `healthService` unit tests, plus the four database-enforcement suites and the readiness regression test |
| `build` | pass — API and web both compile |
| `audit:deps` | pass — 0 vulnerabilities (4 high-severity findings from `prisma`'s bundled multi-provider tooling resolved via targeted `overrides`, see §5) |

Schema enforcement, verified against the **real SQLite engine** (not mocked), each as a permanent
Vitest suite in `apps/api/tests/database/`:

- **All 17 `CHECK` constraints** individually — one test rejects an invalid value, a second confirms
  a valid one is accepted, per enum column.
- **The `profiles` singleton constraint** — a second row is rejected.
- **Foreign keys**: an orphan insert is rejected; `CASCADE` (deleting a project removes its
  findings), `RESTRICT` (a user who authored an article cannot be deleted), and `SET NULL` (deleting
  a media row clears `coverMediaId`) each verified against the actual relationship in the schema.
- **WAL mode and the `foreign_keys` pragma** are both confirmed active (§1's "OFF by default" warning
  is the single easiest mistake in this stack — there is now a test that fails immediately if it
  regresses).
- **The FTS5 search index**, through every state transition on a real project/article/research row:
  draft → never indexed, publish → indexed, unpublish → removed, archive → removed, edit-while-
  published → re-indexed with the new text, delete → removed. Technologies (which have no
  publish/draft concept) are indexed unconditionally and removed on delete.

End-to-end, run manually against a real file (not just the isolated test fixture):
`migrate deploy` → `bootstrap` (twice, confirming idempotency) → `seed` (twice, same) → inspected the
resulting rows directly. The compiled server was also booted twice — once against an unmigrated
database (correctly refuses to start) and once against a migrated one (boots and serves
`/health/ready` as `200`).

## 4. Problems

Sixteen real issues were found and fixed by testing rather than by inspection. The ones worth
knowing about:

1. **Prisma 7 requires a driver adapter — this is architectural, not a detail.** `PrismaClient` has
   no code path for SQLite without one; there is no bundled query engine to fall back to. Verified
   empirically before writing `config/prisma.ts`. Recorded in doc 02's header.

2. **`CHECK` constraints cannot be added with `ALTER TABLE`.** SQLite only accepts them at
   `CREATE TABLE` time, so they had to be inlined into the generated `CREATE TABLE` statements
   rather than "appended" as doc 02 originally (and inaccurately) described. Corrected in doc 02 §9.

3. **The readiness check had two separate, real bugs, both caught only by actually running it:**
   - A bare `SELECT 1` succeeds against **any** valid SQLite file, migrated or not — it never
     touches a table. The server was reporting itself "ready" against a completely empty database.
   - The fix's first version queried Prisma's own `_prisma_migrations` bookkeeping table — which
     turned out to be created *only* by the `prisma migrate` CLI itself, not by replaying the same
     SQL through any other means (which is exactly how this project's own test fixture,
     `tests/helpers/testDb.ts`, builds a database). The final version queries `users`, a real
     application table, so "ready" means "the schema this app depends on exists," not "was migrated
     by this specific tool." Both properties are now pinned down by permanent tests.
   - A third instance of the same bug was hiding in `server.ts`'s own startup check, which had
     independently duplicated the original bare `SELECT 1` — fixing the repository function alone
     did not fix the server, because the server never called it. Both now call the same
     `ping()`.

4. **`npm ci`/`npm install` does not run a workspace package's own `postinstall` script.** Verified
   directly: removing `apps/api/generated/` and running a plain root `npm ci` did **not** regenerate
   it. This would have broken every fresh clone and every CI run with a confusing "module not found"
   rather than a clear error. Fixed with a **root-level** `postinstall` that explicitly delegates to
   the workspace — root lifecycle scripts do run reliably, confirmed the same way.

5. **A single root `.env.example` cannot work for local development in this layout.**
   `npm run <script> -w @portfolio/api` runs with its CWD set to `apps/api/` (verified), and
   `process.loadEnvFile()` with no argument reads from `process.cwd()` — a `.env` at the repo root is
   silently never read locally, no matter how the process starts. Next.js has the identical
   constraint for its own directory. Split into three files: `apps/api/.env.example`,
   `apps/web/.env.example`, and a root one that is read only by `docker compose` for its own
   variable substitution. Documented prominently in the README and corrected in doc 08 §5 — this is
   exactly the kind of thing that would have quietly failed on your machine after the files move.

6. **TypeScript's `rootDir` rejected the generated Prisma client.** It lives in
   `apps/api/generated/`, a *sibling* of `src/`, not a descendant — and TS requires every file that
   ends up in the compiled program (including one pulled in only through an import, not just files
   matched by `include`) to live under `rootDir`. Fixed by widening `rootDir` to the workspace root
   and turning off `declaration` emission (nothing imports `@portfolio/api` as a library, so `.d.ts`
   output was never needed). This also moved the compiled entry point to `dist/src/server.js` —
   updated in `package.json`'s `start` script and `Dockerfile.api`'s `CMD`.

7. **Docker's `--ignore-scripts` would have shipped a broken native binding.** `better-sqlite3`
   needs its own install-time script to build or fetch its native `.node` file; skipping all
   lifecycle scripts for supply-chain safety (docs/architecture/09 §12) would skip that one too.
   Fixed with a targeted `npm rebuild better-sqlite3` immediately after the `--ignore-scripts`
   install in the production-dependencies Docker stage — every *other* package's scripts stay
   blocked. (Unverified end-to-end: this environment has no Docker daemon, per the Phase 1 report.)

8. **`npm audit` failed on 4 high-severity advisories** (`mysql2`, `deepmerge-ts`) pulled in
   transitively by `prisma`'s CLI, which bundles multi-database tooling this project never invokes
   (SQLite only). Fixed with scoped `overrides` in the root `package.json` forcing the patched minor
   versions, which `prisma`'s own semver ranges accept without a downgrade.

9. **A fabricated cryptographic value almost shipped.** The first draft of
   `DUMMY_PASSWORD_HASH` (used to keep a login-with-unknown-email attempt as slow as a real
   wrong-password check, closing a user-enumeration timing gap per doc 04 §2) was typed by hand
   rather than generated — it was not a value Argon2 actually produced, and calling `verify()`
   against it could have behaved unpredictably instead of cleanly returning `false`. Caught before
   use; replaced with a value computed with the installed `argon2` library and a test asserting
   `verify()` resolves to `false` rather than throwing.

10. **`generateStoredFilename`'s path-traversal defence didn't actually work on the first pass** —
    it stripped a leading dot but not embedded slashes, so `../../etc/passwd` as an extension would
    have produced a filename containing real path separators. The test written *for* this property
    caught it immediately; fixed to strip everything but letters and digits from the extension.

11. **`ADMIN_NAME=` (blank, as shipped in `.env.example`) failed bootstrap.** Zod's `.default()`
    only applies when a key is *absent*, not when it is present-but-empty — so an untouched copy of
    the example file would fail rather than fall back to "Admin". Fixed by treating an empty string
    as unset before the default is applied.

## 5. Technical decisions

| Decision | Rationale |
|---|---|
| **Prisma 7.10.0 / `@prisma/client` 7.10.0** — not the 8.0.0-rc pre-release also on the registry | A pre-release CLI is not a foundation to build fifteen more phases on |
| **`@prisma/adapter-better-sqlite3`** over other SQLite drivers | The one Prisma documents and ships an official adapter for |
| **Repository scope this phase: `projectRepository` + `healthRepository` only** | Doc 11 Phase 2 asks for "repository skeletons," not the full layer — that is Phase 5 (public API) and Phase 8 (admin CRUD). What exists now fixes the architecturally load-bearing draft-isolation pattern in code before more repositories copy it |
| **Seed deliberately excludes certifications, experience, and education** | Those are real biographical claims about a real person. There is no factual basis here to invent them, "demo" label or not — projects/articles/research/timeline are legitimately generic placeholder content, a fake employment history is not |
| **`npm overrides` for `mysql2`/`deepmerge-ts`** rather than downgrading Prisma or ignoring the audit finding | Both are transitive, unused (SQLite-only project), and have patched versions Prisma's own ranges accept |
| **`rootDir: "."` + `declaration: false`** for `apps/api`'s main tsconfig | The only way to include Prisma's out-of-`src` generated client in the compiled program; declarations were never needed since nothing imports this app as a library |
| **Readiness queries `users`, not `_prisma_migrations`** | Decouples "the app is ready" from a migration tool's internal bookkeeping table, which is not created by every legitimate way of applying schema (e.g. this project's own test fixture) |
| **Three `.env.example` files instead of one** | The only structure that is actually correct for how each process loads its environment locally, discovered by testing the actual `npm run -w` CWD behaviour rather than assuming it |

## 6. Blockers

**None.** Phase 3 (backend foundation — logging, structured error handling, request-scoped
validation, rate limiting) can start immediately.
