# 08 — Folder Structure

## 1. Deviation from §43 — and why

The brief proposes `frontend/`, `backend/`, `database/`, `tests/`, `docs/` at the root. I propose an
**npm-workspaces monorepo** with `apps/` + `packages/`. Three changes, each with a reason (§43
allows changes if the reason is explained):

| Change | Reason |
|---|---|
| `frontend/` → `apps/web`, `backend/` → `apps/api` | Makes room for a third workspace, and makes it unambiguous which directories are deployable applications versus shared libraries |
| **New** `packages/shared` | The highest-value decision in the design: Zod schemas + inferred types + constants live once and are imported by both apps. Without it, every enum, status string and payload shape is duplicated and will drift. This is not overengineering — it is the opposite of duplication (§49) |
| `database/` → `apps/api/prisma` | Prisma requires `schema.prisma`, `migrations/` and `seed.ts` to sit together and be resolvable from the package that owns the client. Splitting them across the root fights the tool for no benefit |
| `tests/` distributed | Unit and integration tests live beside the code they test (`*.test.ts`); only E2E is centralised in `apps/web/e2e` because it spans both apps |

Everything else in §43 is kept: `config/`, `routes/`, `controllers/`, `services/`, `repositories/`,
`middleware/`, `validators/`, `utils/`, `types/` inside the backend; `app/`, `components/`,
`features/`, `hooks/`, `services/`, `lib/`, `types/`, `utils/`, `styles/` inside the frontend;
`docs/architecture`, `docs/api`, `docs/security`; `README.md`, `.env.example`, `.gitignore`,
`docker-compose.yml`.

**No Turborepo/Nx.** Three workspaces do not need a build orchestrator (§50). npm workspaces plus
seven root scripts is enough.

## 2. Layout

```
portfolio/
├── apps/
│   ├── api/                                 Express + TypeScript backend
│   │   ├── src/
│   │   │   ├── config/                      env.ts (Zod-parsed, fail-fast) · prisma.ts · constants.ts
│   │   │   ├── routes/                      v1/index.ts · public/*.routes.ts · admin/*.routes.ts
│   │   │   ├── controllers/                 HTTP ↔ service mapping only
│   │   │   ├── services/                    business logic, transactions, audit, search index
│   │   │   ├── repositories/                Prisma access; the ONLY layer importing prisma
│   │   │   ├── middleware/                  authenticate · authorize · validate · rateLimit
│   │   │   │                                csrf · errorHandler · notFound · requestId · upload
│   │   │   ├── validators/                  thin re-exports/composition over @portfolio/shared
│   │   │   ├── lib/                         jwt.ts · password.ts · storage/ · mailer/ · markdown.ts
│   │   │   ├── errors/                      AppError + typed subclasses
│   │   │   ├── types/                       express.d.ts (req.user) · internal types
│   │   │   ├── utils/                       slugify · pagination · hashIp · readingTime
│   │   │   ├── app.ts                       builds the Express app (no listen — testable)
│   │   │   └── server.ts                    listen + graceful shutdown
│   │   ├── prisma/
│   │   │   ├── schema.prisma
│   │   │   ├── migrations/                  includes hand-written CHECK + FTS5 SQL
│   │   │   ├── seed.ts                      dev/test only
│   │   │   └── bootstrap.ts                 admin user + settings (all environments)
│   │   ├── scripts/                         admin-reset-password.ts · backup.sh · rollup-analytics.ts
│   │   ├── tests/
│   │   │   ├── integration/                 supertest against a real temp SQLite file
│   │   │   ├── security/                    authz matrix · IDOR · injection · rate limit
│   │   │   └── helpers/                     test db factory, auth helpers, fixtures
│   │   ├── uploads/                         gitignored; a volume mount in production
│   │   └── package.json · tsconfig.json · vitest.config.ts
│   │
│   └── web/                                 Next.js frontend
│       ├── src/
│       │   ├── app/                         (public)/ · (admin)/ · api/revalidate · sitemap.ts · robots.ts
│       │   ├── components/                  ui/ · layout/ · seo/
│       │   ├── features/                    projects/ · articles/ · security/ · contact/
│       │   │                                search/ · admin-projects/ · admin-media/ · …
│       │   ├── hooks/                       useTheme · useMediaQuery · useDebounce · useHotkey
│       │   ├── lib/                         api/ · markdown/ · seo/ · utils/
│       │   ├── styles/                      _tokens · _bootstrap-overrides · _themes · globals.scss
│       │   ├── types/
│       │   └── proxy.ts                     /admin redirect only (not a security control)
│       ├── e2e/                             Playwright: public/ · admin/ · a11y/ · fixtures/
│       ├── public/                          static assets only — never content
│       ├── next.config.ts · tsconfig.json · playwright.config.ts · vitest.config.ts
│       └── package.json
│
├── packages/
│   └── shared/                              @portfolio/shared — imported by BOTH apps
│       ├── src/
│       │   ├── schemas/                     project · article · research · skill · auth · contact · …
│       │   ├── types/                       z.infer exports + API envelope types
│       │   ├── constants/                   statuses · severities · categories · permissions
│       │   └── index.ts
│       └── package.json · tsconfig.json
│
├── docs/
│   ├── architecture/                        this package
│   ├── api/                                 openapi.json (generated) + guides
│   └── security/                            threat model · assessment reports · checklists
│
├── .github/workflows/ci.yml
├── docker-compose.yml · Dockerfile.api · Dockerfile.web
├── .env.example                             no real values, ever
├── .gitignore · .editorconfig · .nvmrc
├── eslint.config.mjs · .prettierrc          shared root config
├── package.json                             workspaces + root scripts
└── README.md
```

## 3. Import rules (enforced by ESLint, not convention)

`eslint-plugin-boundaries` / `import/no-restricted-paths` enforce:

| Rule | Rationale |
|---|---|
| Only `repositories/**` may import `@prisma/client` | Keeps data access in one layer; makes the ORM swappable and the query surface auditable |
| `services/**` must not import `express` | Business logic stays HTTP-agnostic and unit-testable |
| `controllers/**` must not import `repositories/**` | Forces logic into services |
| `components/**` must not import `lib/api/**` | Components render; they do not fetch |
| Public controllers must not import `*ForAdmin` repository functions | Structural protection against draft leakage (doc 05 §5) |
| Nothing imports across `features/*` boundaries; shared code moves to `components/ui` | Prevents feature spaghetti |

A rule that only lives in a document gets violated. These live in the linter and fail CI.

## 4. Root scripts

```jsonc
{
  "scripts": {
    "dev":          "npm run dev --workspaces --if-present",
    "build":        "npm run build -w @portfolio/shared && npm run build -w api && npm run build -w web",
    "lint":         "eslint . --max-warnings=0",
    "typecheck":    "tsc -b --pretty false",
    "test":         "npm run test --workspaces --if-present",
    "test:e2e":     "npm run test:e2e -w web",
    "db:migrate":   "npm run db:migrate -w api",
    "db:bootstrap": "npm run db:bootstrap -w api",
    "db:seed":      "npm run db:seed -w api",
    "audit:deps":   "npm audit --audit-level=high"
  }
}
```

## 5. `.env.example`

Committed with **empty values and comments only** (§42). `.env`, `.env.local`, `*.db`, `uploads/`
and `backups/` are gitignored. A `gitleaks` pre-commit hook and a CI secret-scan job back this up —
the `.gitignore` is not the control, it is the convenience.

> **Correction from Phase 2 (this document originally showed one root-level file — that was
> wrong):** there are **three** `.env.example` files, not one, because `.env` loading is CWD-based
> and each process has a different CWD. `npm run <script> -w @portfolio/api` runs with its CWD set
> to `apps/api/` (verified empirically), and `process.loadEnvFile()` with no argument reads `.env`
> from `process.cwd()` — a `.env` at the repo root is silently never read, no matter how the process
> is started locally. Next.js has the identical constraint: it only ever loads `.env` from its own
> app directory. So:
>
> - `apps/api/.env.example` → `apps/api/.env` — read by the Express API locally.
> - `apps/web/.env.example` → `apps/web/.env` — read by Next.js locally.
> - `.env.example` at the repo root → `.env` at the repo root — read only by `docker compose`
>   itself, to fill in the `${VAR}` references in `docker-compose.yml`. The containers then get
>   real values injected directly via that file's `environment:` blocks; they never read this file.
>
> The sample content below is what the **API's** file looks like; the web and root files carry only
> the subset each process actually needs. See each file's own header comment.

```bash
NODE_ENV=development
# --- API (two origins — decision D1) ---
PORT=4000
# Container-internal URL used by Next.js Server Components (never leaves the host)
API_INTERNAL_URL=http://api:4000
# Public API origin, baked into the browser bundle
NEXT_PUBLIC_API_URL=https://api.local.eslamramzy.dev
PUBLIC_SITE_URL=https://local.eslamramzy.dev
# Exact-match allow-list, comma-separated. No regex, no suffix matching.
CORS_ORIGIN=https://local.eslamramzy.dev
# --- Database ---
DATABASE_URL="file:./prisma/portfolio.db"
# --- Auth (openssl rand -base64 48) ---
JWT_SECRET=
JWT_REFRESH_SECRET=
CSRF_SECRET=
JWT_ACCESS_TTL=15m
JWT_REFRESH_TTL=7d
# Required for cross-subdomain cookies; must be the apex domain with a leading dot
COOKIE_DOMAIN=.local.eslamramzy.dev
# --- Bootstrap admin (used once) ---
ADMIN_EMAIL=
ADMIN_INITIAL_PASSWORD=
# --- Privacy ---
IP_HASH_SALT=
# --- Uploads ---
UPLOAD_DIR=./uploads
MAX_UPLOAD_BYTES=5242880
# --- Revalidation ---
REVALIDATE_SECRET=
# --- Optional SMTP (contact notifications; feature off when blank) ---
EMAIL_HOST=
EMAIL_PORT=
EMAIL_USER=
EMAIL_PASSWORD=
EMAIL_FROM=
# --- Toggles ---
ENABLE_API_DOCS=false
ENABLE_ANALYTICS=true
```

`config/env.ts` parses this with Zod at boot and **exits non-zero** on a missing or weak secret
(minimum 32 characters, and a refusal to start in production with a known placeholder value). A
misconfigured deploy should fail loudly at startup, not silently sign tokens with `undefined`.
