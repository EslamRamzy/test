# Eslam Ramzy — Portfolio Platform

A personal portfolio platform: a public site, a full admin dashboard, and a REST API over SQLite.
The goal is that adding a project, article or security writeup never requires touching source code.

> **Status: Phase 1 of 16 — project setup.**
> The architecture is designed and approved; see [`docs/`](docs/README.md).
> There is no application feature code yet. The public pages, admin dashboard, database and API
> arrive in Phases 2–13 per the [implementation plan](docs/architecture/11-implementation-plan.md).

---

## Architecture

Full design documents live in [`docs/architecture/`](docs/architecture/). Start with the
[review](docs/architecture/00-architecture-review.md) — it records the conflicts and gaps found in
the original requirements and how each was resolved.

```
Browser
  ├── https://eslamramzy.dev       →  Next.js   (public site + /admin)
  └── https://api.eslamramzy.dev   →  Express   (REST API)
                                        ↓
                          Services → Repositories → SQLite
```

Two origins on the same registrable domain (decision D1). They are cross-origin, so CORS is a
load-bearing control, but **same-site**, so `SameSite=Strict` cookies still work and `SameSite=None`
is never used. See [system architecture §3](docs/architecture/01-system-architecture.md) for the
full consequences — including why cookies use the `__Secure-` prefix rather than `__Host-`.

## Tech stack

| Layer | Choice |
|---|---|
| Frontend | Next.js 16 (App Router), React 19, TypeScript, Bootstrap 5 (SCSS source) |
| Backend | Node.js 22, Express 5, TypeScript |
| Database | SQLite (WAL) via Prisma — *Phase 2* |
| Auth | JWT access cookie + rotating opaque refresh tokens, Argon2id — *Phase 4* |
| Testing | Vitest, Supertest, Testing Library, Playwright |
| Tooling | npm workspaces, ESLint (flat), Prettier |

## Repository layout

```
apps/
  api/        Express API — routes → controllers → services → repositories
  web/        Next.js public site and admin dashboard
packages/
  shared/     Zod schemas, domain constants and API types used by BOTH apps
docs/         Architecture, API and security documentation
scripts/      Repository tooling
```

`packages/shared` is the single source of truth for payload shapes: the API validates with the same
schemas the admin forms use, so the two sides cannot drift.
See [folder structure](docs/architecture/08-folder-structure.md) for the rationale.

## Requirements

- Node.js 22 (`.nvmrc`)
- npm 10

## Getting started

```bash
npm install
cp .env.example .env      # then fill in the values
npm run dev               # API on :4000, web on :3000
```

### Local hosts entry (required)

Local development mirrors the production two-origin topology. Add to `/etc/hosts`:

```
127.0.0.1   local.eslamramzy.dev   api.local.eslamramzy.dev
```

Developing against bare `localhost:3000` / `localhost:4000` would be a *different* cookie topology
(no `Domain` attribute, different secure-context rules) and would hide exactly the class of bug the
two-origin decision introduces until it reached production.

## Scripts

| Command | Description |
|---|---|
| `npm run dev` | Run both apps in watch mode |
| `npm run build` | Build shared, API and web |
| `npm run typecheck` | TypeScript across all workspaces |
| `npm run lint` | ESLint, zero warnings tolerated |
| `npm run lint:rules` | Assert the architectural lint rules actually fire |
| `npm run format` / `format:check` | Prettier |
| `npm test` | Unit and integration tests |
| `npm run audit:deps` | Fail on high-severity advisories |

### `npm run lint:rules`

The layering contract (only repositories touch Prisma; services never import Express; components
never fetch; `dangerouslySetInnerHTML` is confined to the markdown renderer) is enforced by ESLint
rather than by convention. But a lint rule that is silently inactive looks like protection and is
not — during Phase 1 the Prisma restriction was being discarded because flat-config `rules` entries
override rather than merge, and everything still linted clean. `scripts/verify-lint-rules.mjs`
writes a probe file per rule and fails if the expected violation is not reported. It runs in CI.

## Environment variables

See [`.env.example`](.env.example) — every variable is documented there. Secrets are never committed
and never appear in source, logs, error responses or audit records
([security architecture §9](docs/architecture/09-security-architecture.md)).

`apps/api/src/config/env.ts` parses the environment at boot with Zod and **exits non-zero** on
invalid input, so a misconfigured deploy fails loudly instead of running in an undefined state.

> **`NEXT_PUBLIC_API_URL` is inlined at build time, not read at runtime.** It must be set when the
> web image is *built* (a Docker build arg), not only in the container environment — otherwise the
> browser bundle points at the localhost fallback.

## Testing

```bash
npm test                       # all workspaces
npm run test:coverage          # with coverage
npm test -w @portfolio/api     # one workspace
```

Test strategy, coverage gates and the security testing workflow:
[testing strategy](docs/architecture/10-testing-strategy.md).

## Security

The platform is a security portfolio, so it is built to be pentested:
[security architecture](docs/architecture/09-security-architecture.md) covers the threat model,
headers and CSP, CORS, rate limits, upload controls, the XSS posture, secrets handling and
privacy-preserving analytics.

To report a vulnerability, use the contact form once the site is live.

## Deployment

Docker Compose on a VPS behind Caddy, with one persistent volume holding the SQLite file and
uploaded media (decision D3). `docker-compose.yml`, `Dockerfile.api` and `Dockerfile.web` are
present but **not yet verified end to end** — building and running them is a Phase 16 exit
criterion, along with the backup/restore runbook.

## License

Not yet licensed. All rights reserved.
