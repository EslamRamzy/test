# 03 — API Architecture

REST over HTTPS, JSON only. Versioned by path prefix from day one: **`/api/v1`**, exposed publicly
through the Next.js rewrite as `/api/*`.

---

## 1. Response envelope (§30)

**Success**

```json
{ "success": true, "data": { } }
```

**Success with pagination**

```json
{
  "success": true,
  "data": [ ],
  "meta": { "page": 1, "pageSize": 12, "total": 47, "totalPages": 4 }
}
```

**Error**

```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Request validation failed",
    "details": [ { "field": "email", "message": "Invalid email address" } ]
  }
}
```

`details` is present **only** for `VALIDATION_ERROR`, and only echoes the caller's own field names —
never database columns, file paths, or driver text. In production, `500` responses are always
exactly `{"code":"INTERNAL_ERROR","message":"An unexpected error occurred","requestId":"..."}`.
The `requestId` is logged server-side with the full stack, so a real error is traceable without
leaking anything (§30).

### Error codes

| Code | HTTP | Meaning |
|---|---|---|
| `VALIDATION_ERROR` | 400 | Zod rejected body/query/params/file |
| `UNAUTHENTICATED` | 401 | Missing/invalid/expired access token |
| `TOKEN_EXPIRED` | 401 | Access token expired — client should call `/auth/refresh` |
| `FORBIDDEN` | 403 | Authenticated but not permitted |
| `CSRF_FAILED` | 403 | Missing or mismatched CSRF token |
| `NOT_FOUND` | 404 | Absent **or** not visible to the caller (drafts return 404, never 403) |
| `METHOD_NOT_ALLOWED` | 405 | — |
| `CONFLICT` | 409 | Slug taken, media still referenced, optimistic-lock mismatch |
| `PAYLOAD_TOO_LARGE` | 413 | Upload over limit |
| `UNSUPPORTED_MEDIA_TYPE` | 415 | Disallowed MIME |
| `RATE_LIMITED` | 429 | Includes `Retry-After` |
| `INTERNAL_ERROR` | 500 | Never detailed |

> **Draft leakage rule:** an unpublished resource returns `404 NOT_FOUND` to unauthenticated
> callers. Returning `403` would confirm the resource exists and leak the slug of unreleased work.

---

## 2. Conventions

| Topic | Rule |
|---|---|
| Casing | JSON is `camelCase`; the DB is `snake_case`; mapping happens in Prisma `@map` |
| Dates | ISO-8601 UTC strings (`2026-09-04T10:00:00.000Z`) |
| Public identifiers | `slug` for public reads; numeric `id` for admin writes |
| Pagination | `?page=1&pageSize=12`, `pageSize` capped at **50**, default 12 |
| Sorting | `?sort=publishedAt&order=desc` — sort keys validated against an **allow-list** per resource (never interpolated) |
| Filtering | Explicit named params only (`?category=web&tag=react&featured=true`). No generic query-object filters — that is an injection and DoS surface |
| Partial update | `PATCH` with a partial Zod schema; `PUT` reserved for full replacement |
| Idempotency | `PUT`/`DELETE` idempotent; `POST` is not |
| Concurrency | Admin `PATCH` accepts `If-Unmodified-Since` / `updatedAt` and returns `409` on mismatch (prevents silent overwrite in two open tabs) |
| Content negotiation | `application/json` only; `multipart/form-data` on the upload endpoint only |
| Trailing slashes | Rejected/redirected once at the proxy |

---

## 3. Public API (unauthenticated, read-only)

All list endpoints return **published** content only, enforced in the repository.

| Method | Path | Notes |
|---|---|---|
| GET | `/api/v1/profile` | Singleton profile + avatar + social links + public settings |
| GET | `/api/v1/stats` | Homepage counters (§6.2) — computed, cached 5 min |
| GET | `/api/v1/projects` | `?page&pageSize&category&technology&featured&securityTested&sort` |
| GET | `/api/v1/projects/:slug` | Full case study, visible sections, public findings only |
| GET | `/api/v1/projects/:slug/related` | Same category / shared technologies, max 3 |
| GET | `/api/v1/technologies` | `?category` |
| GET | `/api/v1/skills` | Grouped by category, visible only |
| GET | `/api/v1/articles` | `?page&pageSize&category&tag&sort` |
| GET | `/api/v1/articles/:slug` | + related articles |
| GET | `/api/v1/articles/categories` | |
| GET | `/api/v1/tags` | Used tags with counts |
| GET | `/api/v1/security` | Security **Research** list (see review C6) |
| GET | `/api/v1/security/:slug` | Research detail + references |
| GET | `/api/v1/certifications` | Visible only |
| GET | `/api/v1/experience` | + achievements + technologies |
| GET | `/api/v1/education` | |
| GET | `/api/v1/timeline` | |
| GET | `/api/v1/social-links` | Enabled only |
| GET | `/api/v1/search?q=&type=&limit=` | FTS5, `q` 2–100 chars, `type` ∈ projects/articles/research/technologies |
| GET | `/api/v1/sitemap-data` | Slugs + `updatedAt` for `sitemap.ts` |
| POST | `/api/v1/contact` | Rate-limited, honeypot + timing check |
| POST | `/api/v1/analytics/view` | Fire-and-forget beacon, heavily rate-limited, returns `204` |
| GET | `/api/v1/health` · `/health/ready` | Liveness / readiness |

## 4. Auth API

| Method | Path | Auth | Notes |
|---|---|---|---|
| POST | `/api/v1/auth/login` | — | 5/15 min per IP **and** per email; generic failure message |
| POST | `/api/v1/auth/refresh` | refresh cookie | Rotates the token; reuse detection revokes the family |
| POST | `/api/v1/auth/logout` | access | Revokes the presented refresh token, clears cookies |
| POST | `/api/v1/auth/logout-all` | access | Revokes every token for the user |
| GET | `/api/v1/auth/me` | access | Current user (id, email, name, role) |
| POST | `/api/v1/auth/change-password` | access | Requires the current password; revokes all other sessions |
| GET | `/api/v1/auth/csrf` | — | Issues the double-submit CSRF token |

There is **no** registration endpoint, no public password-reset endpoint (§25). Recovery is a
server-side CLI script (**D7**).

## 5. Admin API (authenticated + `ADMIN`)

Every module below follows the identical shape, which is why the admin can be built quickly:

```
GET    /api/v1/admin/{resource}          list  (?page,pageSize,q,status,sort — includes drafts)
POST   /api/v1/admin/{resource}          create
GET    /api/v1/admin/{resource}/:id      read
PATCH  /api/v1/admin/{resource}/:id      update
DELETE /api/v1/admin/{resource}/:id      delete
PATCH  /api/v1/admin/{resource}/reorder  bulk display_order  [{id, displayOrder}]
```

Applied to: `projects`, `articles`, `security-research`, `skills`, `skill-categories`,
`technologies`, `certifications`, `experience`, `education`, `timeline`, `social-links`,
`article-categories`, `tags`.

**Publishing (content resources only)**

```
POST /api/v1/admin/{resource}/:id/publish
POST /api/v1/admin/{resource}/:id/unpublish     → back to DRAFT
POST /api/v1/admin/{resource}/:id/archive
POST /api/v1/admin/{resource}/:id/duplicate
```

**Project-specific**

```
PUT    /api/v1/admin/projects/:id/technologies      { technologyIds: number[] }
POST   /api/v1/admin/projects/:id/images            { mediaId, caption }
PATCH  /api/v1/admin/projects/:id/images/reorder
DELETE /api/v1/admin/projects/:id/images/:imageId
PATCH  /api/v1/admin/projects/:id/sections          section visibility + order
POST   /api/v1/admin/projects/:id/featured          { featured: boolean }
```

**Security assessments**

```
GET|POST         /api/v1/admin/projects/:id/assessments
GET|PATCH|DELETE /api/v1/admin/assessments/:id
PUT              /api/v1/admin/assessments/:id/tests        upsert the 15-test checklist
GET|POST         /api/v1/admin/assessments/:id/findings
PATCH|DELETE     /api/v1/admin/findings/:id
```

**Media**

```
POST   /api/v1/admin/media          multipart, single file, ≤5 MB
GET    /api/v1/admin/media          ?page,kind,q
PATCH  /api/v1/admin/media/:id      alt text, kind
DELETE /api/v1/admin/media/:id      409 + usage list if referenced
GET    /api/v1/admin/media/:id/usages
```

**Messages · Settings · Profile · Audit · Analytics**

```
GET    /api/v1/admin/messages                 ?status,q,page
PATCH  /api/v1/admin/messages/:id/status      { status: UNREAD|READ|ARCHIVED }
DELETE /api/v1/admin/messages/:id
GET    /api/v1/admin/settings                 grouped
PATCH  /api/v1/admin/settings                 bulk [{key,value}]
GET|PATCH /api/v1/admin/profile
GET    /api/v1/admin/audit-logs               ?action,entityType,userId,from,to,page   (read-only, no writes/deletes)
GET    /api/v1/admin/overview                 dashboard counters (§21)
GET    /api/v1/admin/analytics                ?from,to,groupBy  page/project/article views, top content
POST   /api/v1/admin/preview-token            { entityType, id } → short-lived signed token (D6)
```

**Audit logs are append-only.** There is no update or delete endpoint, by design — an audit trail an
admin can edit is not an audit trail.

---

## 6. Middleware order (this order matters)

```
requestId
 → pino-http (redacted)
 → helmet
 → cors (allow-list, credentials)
 → cookieParser
 → express.json({ limit: '1mb' })         ← body limit BEFORE parsing
 → rateLimit (per-route bucket)
 → csrf (state-changing methods only)
 → authenticate (protected routes)
 → authorize(role)
 → validate({ params, query, body })       ← Zod; replaces req.* with parsed output
 → controller
 → notFoundHandler
 → errorHandler                            ← last, always
```

Validation runs **after** auth so that unauthenticated callers cannot probe the schema shape, and
rate limiting runs **before** auth so brute-force attempts are cheap to reject.

---

## 7. Validation (§31)

One Zod schema per operation, in `packages/shared/schemas/`, used by:
the API (`validate` middleware) → the admin forms (`zodResolver`) → the generated TS types.

```ts
// packages/shared/schemas/project.ts
export const projectCreateSchema = z.object({
  title:            z.string().trim().min(3).max(120),
  slug:             slugSchema.optional(),          // generated if absent
  shortDescription: z.string().trim().min(10).max(300),
  fullDescription:  z.string().max(50_000).optional(),
  category:         projectCategorySchema,
  status:           contentStatusSchema.default('DRAFT'),
  featured:         z.boolean().default(false),
  githubUrl:        httpsUrlSchema.optional(),      // https only, no javascript:/data:
  liveUrl:          httpsUrlSchema.optional(),
  technologyIds:    z.array(z.number().int().positive()).max(30).default([]),
}).strict();                                        // unknown keys are rejected, not stripped
export type ProjectCreateInput = z.infer<typeof projectCreateSchema>;
```

`.strict()` everywhere on write schemas — this is what stops mass-assignment. A client cannot set
`viewCount`, `publishedAt`, `id` or `authorId` by adding them to the body; the request is rejected
outright rather than silently ignored, so the attempt is visible in logs.

Query and route params are validated with coercion (`z.coerce.number()`), because everything from
the URL is a string.

---

## 8. OpenAPI (§48)

The spec is **generated** from the Zod schemas via `zod-to-openapi` — a hand-maintained YAML would
drift within a week. Served at `/api/v1/docs` (Swagger UI), **disabled in production by default**
(`ENABLE_API_DOCS=false`) and behind admin auth when enabled. The generated `openapi.json` is
committed so the API surface is diffable in code review.

## 9. Rate limits (summary — full table in doc 09)

| Bucket | Limit |
|---|---|
| `POST /auth/login` | 5 / 15 min per IP + per email |
| `POST /auth/refresh` | 30 / 15 min per IP |
| `POST /contact` | 3 / hour per IP, 10 / day global |
| `POST /analytics/view` | 60 / min per IP |
| `POST /admin/media` | 20 / hour |
| Public GET | 300 / 15 min per IP |
| Admin (other) | 600 / 15 min per user |
