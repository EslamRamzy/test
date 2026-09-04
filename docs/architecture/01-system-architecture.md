# 01 — System Architecture

## 1. Design principles

1. **Content is data, never code.** No content-shaped value is hardcoded in a component.
2. **The server is the authority.** Draft filtering, authorization and validation are enforced in
   the backend. The UI hiding something is a convenience, never a control.
3. **One direction of dependency.** `routes → controllers → services → repositories → db`.
   A layer never reaches back up. Repositories never import services.
4. **One source of truth for shapes.** Zod schemas in `packages/shared` generate the types used by
   both sides.
5. **Simple beats clever.** (§50)

---

## 2. Component diagram

```mermaid
graph TB
    subgraph Client["Browser"]
        PUB["Public Site<br/>RSC + islands"]
        ADM["Admin SPA<br/>client components"]
    end

    subgraph Edge["Reverse Proxy — Caddy/Nginx :443"]
        TLS["TLS · HSTS · compression"]
    end

    subgraph Web["Next.js 15 · Node · :3000"]
        RSC["Server Components<br/>data fetching"]
        RH["rewrites: /api/* → backend"]
        SEO["sitemap.ts · robots.ts · OG images"]
    end

    subgraph Api["Express 5 · Node · :4000"]
        MW["Middleware chain<br/>helmet · cors · rate-limit · auth · validate"]
        CTRL["Controllers"]
        SVC["Services (business logic)"]
        REPO["Repositories (Prisma)"]
        STOR["StorageAdapter"]
    end

    subgraph Data["Persistent volume"]
        DB[("SQLite<br/>portfolio.db · WAL")]
        FTS[("FTS5 search_index")]
        FILES[("/uploads")]
    end

    PUB --> TLS
    ADM --> TLS
    TLS --> Web
    RSC -->|server-side fetch| Api
    ADM -->|fetch /api/*| RH --> Api
    MW --> CTRL --> SVC --> REPO --> DB
    SVC --> STOR --> FILES
    SVC --> FTS
    REPO --> FTS
```

**Why two processes and not Next.js API routes?**
The brief requires it, and it earns its keep here: §45 demands the API be independently
security-tested (Burp, ZAP, `supertest`). A standalone Express surface with its own middleware chain
is far easier to point a scanner at, and keeps auth/authorization logic in one auditable place
rather than spread across route handlers. The cost is one extra process and the cookie topology
handled below.

---

## 3. Runtime topology

Both processes sit behind **one public origin**. Next.js proxies the API path:

```
https://eslamramzy.dev/            → Next.js  (SSR/SSG pages)
https://eslamramzy.dev/api/*       → Next.js rewrite → Express :4000
https://eslamramzy.dev/uploads/*   → Express static (or proxy direct) with cache headers
```

Consequences, all positive:

- Cookies are **first-party** → `SameSite=Strict`, `Secure`, `HttpOnly`, `__Host-` prefix.
- No CORS preflight in normal operation (CORS middleware still configured, denying by default).
- One TLS certificate, one domain in CSP.

`localhost` development mirrors this exactly (`next dev` proxies to `localhost:4000`), so there is no
"works in dev, breaks in prod" cookie class of bug.

---

## 4. Request flows

### 4.1 Public page — `/projects/[slug]`

```mermaid
sequenceDiagram
    participant B as Browser
    participant N as Next.js (RSC)
    participant E as Express
    participant D as SQLite

    B->>N: GET /projects/my-app
    N->>E: GET /api/projects/my-app  (server fetch, revalidate tag "project:my-app")
    E->>E: validate params (Zod)
    E->>D: findFirst where slug AND status=PUBLISHED
    D-->>E: row (+ relations)
    E-->>N: { success: true, data: {...} }
    N->>N: render RSC → HTML + generateMetadata()
    N-->>B: streamed HTML (cached until revalidateTag)
    B->>N: POST /api/analytics/view (beacon, non-blocking)
```

Draft filtering happens in the **repository**, not the page. A draft project returns `404` from the
API, so there is no code path where an unpublished item can leak.

### 4.2 Admin mutation — publish a project

```mermaid
sequenceDiagram
    participant A as Admin UI
    participant E as Express
    participant S as Service
    participant D as SQLite
    participant N as Next.js

    A->>E: POST /api/admin/projects/12/publish  (cookie + X-CSRF-Token)
    E->>E: rateLimit → csrf → authenticate(JWT) → authorize(ADMIN) → validate
    E->>S: projectService.publish(12, actor)
    S->>D: tx: update status/publishedAt · upsert search_index · insert audit_log
    D-->>S: ok
    S->>N: POST /api/revalidate (shared secret) tags: project:slug, projects, home
    S-->>E: project
    E-->>A: { success: true, data }
```

The transaction boundary is the **service**, and it always covers: the write, the search-index
update, and the audit log. If any of the three fails, none is committed.

---

## 5. Layer contract

| Layer | May do | May **not** do |
|---|---|---|
| Route | Bind path + method to middleware and one controller method | Contain logic, touch Prisma |
| Middleware | Cross-cutting: authn, authz, validation, rate limit, CSRF, logging | Know about entities |
| Controller | Map HTTP ↔ domain: read validated input, call one service, shape the response | Business rules, Prisma access |
| Service | Business rules, transactions, authorization decisions, audit, search index, events | Know about `req`/`res`/HTTP status codes |
| Repository | Prisma queries, `status` filtering, selection/pagination | Business rules, throw HTTP errors |
| Prisma client | Single shared instance, WAL pragmas set at startup | — |

Errors travel as typed `AppError` subclasses (`NotFoundError`, `ValidationError`, `ForbiddenError`,
`ConflictError`) thrown from services; one error middleware maps them to status codes and the error
envelope. Services never import `express`.

---

## 6. Cross-cutting concerns

| Concern | Where it lives |
|---|---|
| Validation | `middleware/validate.ts` + shared Zod schemas (body/query/params/files) |
| AuthN | `middleware/authenticate.ts` — verifies access JWT, loads user, attaches `req.user` |
| AuthZ | `middleware/authorize.ts` (coarse: role) + service-level checks (fine) |
| Audit | `services/auditService.ts`, called inside the same transaction as the mutation |
| Rate limit | `middleware/rateLimit.ts` — per-route buckets (doc 09) |
| Errors | `middleware/errorHandler.ts` — last in chain, no stack traces in production |
| Logging | `pino` structured logs with a redaction list (`password`, `token`, `cookie`, `authorization`) |
| Config | `config/env.ts` — Zod-parsed `process.env`, **fails fast at boot** if invalid |
| Search index | `services/searchService.ts`, invoked by content services after commit |
| Cache invalidation | `services/revalidationService.ts` → Next.js on-demand revalidation |

---

## 7. Caching and revalidation

| Content | Strategy |
|---|---|
| Public pages (home, lists, detail) | RSC + `fetch(..., { next: { tags: [...] } })`, revalidated **on demand** at publish |
| `generateStaticParams` | Published slugs at build time; `dynamicParams: true` for anything newer |
| Sitemap / robots | Regenerated on the same revalidation tags |
| Admin | `no-store` everywhere. Never cached, `Cache-Control: no-store, private` |
| Uploads | `Cache-Control: public, max-age=31536000, immutable` (filenames are content-hashed) |
| API responses | No HTTP cache for admin; `s-maxage` only on public GETs |

Time-based revalidation is a fallback (`revalidate: 3600`), not the primary mechanism — the admin
publishing an article should see it live immediately, not in an hour.

---

## 8. Deployment

```mermaid
graph LR
    subgraph VPS["Linux VPS"]
        C["Caddy :443<br/>TLS · HSTS · headers"]
        W["web container :3000"]
        A["api container :4000"]
        V[("volume: /data<br/>portfolio.db + uploads")]
        B["backup cron<br/>sqlite3 .backup → /backups"]
    end
    Internet --> C --> W
    C --> A
    A --- V
    B --- V
```

- `docker-compose.yml` with two services + one named volume. No database container (SQLite is a file).
- Health endpoints: `GET /api/health` (liveness) and `/api/health/ready` (DB reachable + migrations applied).
- Migrations run as a one-shot `prisma migrate deploy` step on container start, before the API listens.
- Zero-downtime is explicitly **not** a goal for a personal portfolio — a 3-second restart is fine.

---

## 9. What is deliberately deferred

| Deferred | Reserved seam |
|---|---|
| PostgreSQL | Prisma provider swap + enum promotion; no raw SQL outside FTS5, which is isolated in `searchRepository.ts` |
| S3/R2 object storage | `StorageAdapter` interface |
| GitHub API integration | `projects.github_url` column + an unimplemented `GithubService` boundary |
| Email delivery | `MailerAdapter` with a `NoopMailer` default |
| Multi-user / EDITOR role | `users.role` column + `authorize()` middleware already role-aware |
| i18n | Not seamed. Retrofitting is expensive — decide now (**D10**) |
