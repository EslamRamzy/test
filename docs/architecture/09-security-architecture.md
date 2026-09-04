# 09 — Security Architecture

The platform is a security portfolio. It has to survive the pentest you are going to run on it
(§45, §57). Design goal: **be easy to test and hard to break.**

---

## 1. Threat model

| # | Asset | Threat | Primary control |
|---|---|---|---|
| T1 | Admin account | Credential stuffing, brute force, user enumeration | Argon2id, dual rate limit, lockout, constant-time + identical failure responses (doc 04) |
| T2 | Session | Token theft via XSS, CSRF, token replay | `HttpOnly` `__Secure-` cookies, `SameSite=Strict`, CSP, rotation + reuse detection |
| T2b | Session | **Cookie tossing / fixation from a sibling subdomain** (introduced by D1's `Domain=.eslamramzy.dev`) | No wildcard DNS, signed HMAC CSRF tokens, server-side session binding, `Origin` checks (doc 01 §3) |
| T3 | Unpublished content | Draft leakage through the API or search | Status filter in the repository layer; separate admin-only functions; FTS5 indexes published rows only |
| T4 | Database | SQL injection | Prisma parameterisation; the only raw SQL is FTS5, parameterised and input-constrained |
| T5 | Public site visitors | Stored XSS via admin-authored markdown | Markdown-only authoring, `rehype-sanitize` allow-list, CSP without `unsafe-inline` |
| T6 | Server filesystem | Malicious upload, path traversal, RCE via uploaded file | MIME + magic-byte + extension triple check, server-generated names, non-executable storage, re-encode images |
| T7 | Contact form | Spam, injection, mail-header injection, DoS | Rate limit, honeypot, timing check, strict validation, no user input in headers |
| T8 | Audit trail | Tampering to hide actions | Append-only; no update/delete endpoint; written inside the mutation transaction |
| T9 | Secrets | Leakage into git, logs, error responses, audit metadata | env-only, Zod fail-fast, log redaction, generic 500s, gitleaks in CI |
| T10 | Visitor privacy | Over-collection through analytics | No raw IP stored; salted daily hash; no cookies for analytics; no third-party scripts |
| T11 | Availability | Request flood, huge payloads, slowloris | Rate limits, 1 MB body cap, upload cap, proxy timeouts |
| T12 | Supply chain | Vulnerable/malicious dependency | Lockfile committed, `npm audit` + Dependabot in CI, minimal dependency count |
| T13 | Own security findings | Publishing an unfixed live vulnerability | Open CRITICAL/HIGH findings can never be made public (doc 05 §4) |

## 2. HTTP security headers

Set by `helmet` at the API and by `next.config.ts` for the web app; the reverse proxy adds HSTS.

```
Content-Security-Policy: default-src 'self';
  script-src 'self' 'nonce-{random}';        # no unsafe-inline, no unsafe-eval
  style-src 'self' 'nonce-{random}';
  img-src 'self' data: blob: https://api.eslamramzy.dev;
  font-src 'self';
  connect-src 'self' https://api.eslamramzy.dev;
  frame-ancestors 'none';
  form-action 'self';
  base-uri 'self';
  object-src 'none';
  upgrade-insecure-requests
Strict-Transport-Security: max-age=63072000; includeSubDomains; preload
X-Content-Type-Options: nosniff
X-Frame-Options: DENY
Referrer-Policy: strict-origin-when-cross-origin
Permissions-Policy: camera=(), microphone=(), geolocation=(), interest-cohort=()
Cross-Origin-Opener-Policy: same-origin
Cross-Origin-Resource-Policy: same-origin
X-Powered-By: <removed>
```

CSP is nonce-based, not hash-based, because Next.js injects inline bootstrap scripts; the nonce is
generated per request in `middleware.ts` and threaded through. It is deployed in
`Content-Security-Policy-Report-Only` first (Phase 11), then enforced once the report endpoint is
quiet — an enforced CSP that breaks the site is worse than a measured rollout.

## 3. CORS — a load-bearing control (decision D1)

With two origins, CORS is no longer defence in depth: it is what stands between an arbitrary website
and an authenticated request to the API.

```ts
cors({
  origin: env.CORS_ORIGIN.split(','),   // explicit allow-list; NEVER a reflected origin
  credentials: true,
  methods: ['GET','POST','PATCH','PUT','DELETE','OPTIONS'],
  allowedHeaders: ['Content-Type','X-CSRF-Token'],
  exposedHeaders: ['X-Request-Id'],
  maxAge: 600,                          // one preflight per 10 min, not per request
})
```

Rules, each of which is a real finding if broken:

- **Never `origin: true`** and never reflect the request's `Origin`. Combined with
  `credentials: true` that is equivalent to disabling the same-origin policy — and it is the single
  most common CORS misconfiguration.
- **Never `origin: '*'` with credentials** (browsers reject it, but the attempt signals confusion).
- The allow-list is exact-match, from `CORS_ORIGIN`. **No regex, no `endsWith('.eslamramzy.dev')`** —
  a suffix check matches `evil-eslamramzy.dev` and is a classic bypass.
- `null` origin is rejected (it is what sandboxed iframes and some local files send).
- An `Origin` check runs **independently** of the CORS middleware on every state-changing request,
  because CORS protects browsers, not tools — and a request with no `Origin` at all must not be
  treated as trusted on a mutating route.

An integration test asserts each of these: a disallowed origin gets no
`Access-Control-Allow-Origin`, and a mutation carrying a foreign `Origin` is rejected outright.

## 4. Rate limiting (§32)

`express-rate-limit` with an in-memory store (correct for a single instance; a comment marks the
Redis swap point should it ever scale). Keyed by `IP + route bucket`, with the IP taken from a
**trusted-proxy-aware** source — `app.set('trust proxy', 1)` with exactly one hop, never `true`,
which would let a client forge `X-Forwarded-For` and evade every limit.

| Bucket | Window | Max | Note |
|---|---|---|---|
| `auth:login` | 15 min | 5 per IP **and** 5 per email | Dual key |
| `auth:refresh` | 15 min | 30 | |
| `contact` | 60 min | 3 per IP | + 10/day global cap |
| `analytics` | 1 min | 60 | Cheap endpoint, still capped |
| `search` | 1 min | 30 | FTS queries are the most expensive public read |
| `upload` | 60 min | 20 | |
| `public:read` | 15 min | 300 | |
| `admin` | 15 min | 600 per user | |

`429` responses include `Retry-After` and are audited when they hit an auth bucket.

## 5. Input validation (§31)

Every request is validated by a Zod schema before it reaches a controller: `body`, `query`, `params`
and file metadata. Rules:

- **`.strict()` on all write schemas** — unknown keys are rejected, not stripped. This is the
  anti-mass-assignment control: `viewCount`, `publishedAt`, `id`, `authorId`, `role` are not in the
  input schemas, so a request containing them fails visibly.
- Length caps on every string (there is no unbounded text field), array caps on every list.
- URLs restricted to `https:` (and `http:` in dev) via a shared `httpsUrlSchema` — this blocks
  `javascript:`, `data:` and `vbscript:` from reaching an `href`, which is a stored-XSS vector that
  markdown sanitisation alone does not cover for `githubUrl` / `liveUrl` / social links.
- Sort and filter keys validated against per-resource allow-lists — never interpolated into a query.
- `page`/`pageSize` coerced and clamped (`pageSize ≤ 50`) so a caller cannot request 1,000,000 rows.
- Email normalised to lowercase before lookup and storage.

## 6. Output handling / XSS

Authoring format is **Markdown** (assumption A3, decision **D8**), rendered server-side:

```
remark-parse → remark-gfm → remark-rehype (allowDangerousHtml: false)
             → rehype-sanitize (explicit allow-list)
             → rehype-shiki (highlighting)
             → rehype-stringify
```

- Raw HTML in markdown is **dropped**, not escaped-and-rendered.
- The sanitiser schema is an explicit allow-list of tags and attributes; `on*` handlers, `style`,
  `srcset` and unknown protocols are excluded. Link `href` is protocol-checked; external links get
  `rel="noopener noreferrer nofollow"` and `target="_blank"`.
- `dangerouslySetInnerHTML` appears in exactly **one** file (`lib/markdown/render.tsx`), fed only by
  the pipeline above. An ESLint rule forbids it everywhere else — so the review surface for XSS is a
  single function, permanently.
- React escapes everything else by default; no `innerHTML`, no `eval`, no dynamic `<script>`.

If you later want a WYSIWYG (**D8**), the same sanitiser must run **server-side on save** as well as
on render — client-side sanitisation is decoration.

## 7. File uploads (§24)

| Control | Implementation |
|---|---|
| Type allow-list | `image/jpeg`, `image/png`, `image/webp`, `image/avif`, `application/pdf` (certificates) |
| Real type check | Magic bytes verified with `file-type`, not the client `Content-Type` and not the extension |
| Extension | Derived from the **detected** type, never from the uploaded filename |
| Size | 5 MB per file, enforced by multer **and** by the proxy |
| Count | One file per request |
| Filename | Server-generated `{sha256[:16]}-{nanoid}.{ext}`; the original name is stored sanitised for display only |
| Path traversal | The original name never touches the filesystem path; the destination is a fixed directory joined with the generated name and re-checked with `path.resolve().startsWith(UPLOAD_DIR)` |
| Image re-encode | `sharp` re-encodes and strips EXIF (removes GPS/camera metadata and any polyglot payload) |
| Storage | `/data/uploads`, outside the web roots, mounted `noexec` where possible |
| Serving | Through a route that sets `Content-Type` from the stored value, `X-Content-Type-Options: nosniff`, `Content-Disposition: inline` for images / `attachment` for PDFs |
| SVG | **Rejected.** SVG is an XSS vector (it can carry `<script>`) and is not worth the risk here |
| Access | Upload requires `ADMIN`; reads are public but only for files referenced by published content |
| Storage exhaustion | Upload rate limit + a total-storage check before write |

## 8. Contact form (§19)

Validation (name 2–100, email format, subject 3–150, message 10–5000), rate limit (3/hour/IP),
**honeypot** field hidden from users, and a **timing check** (a submission under 3 seconds after
render is almost certainly a bot). Stored in the database; the response is always a generic success
after ~equal time, so the endpoint is not a probe for anything. If SMTP notification is enabled, the
user's input is used **only in the body**, never in headers (`From`/`Reply-To`/`Subject` are built
from validated values) — mail-header injection is the classic bug here. Email failure never fails
the request; the message is already persisted.

## 9. Secrets (§32, §42)

- Only in environment variables. Never in source, never in the repo, never in an audit log, never
  in an error response, never in a client bundle.
- `NEXT_PUBLIC_*` is treated as public by definition — nothing sensitive ever gets that prefix.
- `config/env.ts` refuses to boot on a missing secret, a secret shorter than 32 characters, or a
  known placeholder value in production.
- `pino` redaction list: `password`, `passwordHash`, `token`, `refreshToken`, `authorization`,
  `cookie`, `set-cookie`, `x-csrf-token`.
- `gitleaks` runs as a pre-commit hook and as a CI job on every push.
- Rotation procedure documented; bumping `JWT_SECRET` invalidates all access tokens, and clearing
  `refresh_tokens` invalidates all sessions.

## 10. Privacy-preserving analytics (§40)

- **No raw IPs stored anywhere.** `visitor_hash = sha256(ip + userAgent + dailySalt)` where the salt
  rotates every 24 h — this gives a usable unique-visitor count while making the value
  non-reversible and non-linkable across days.
- Same treatment for `ip_hash` on contact messages and audit logs (retained for abuse
  investigation, not identification).
- Referrer stored as **host only**, never the full URL (full referrers leak search queries and
  private page paths).
- No cookies, no fingerprinting, no third-party analytics script, no cross-site tracking.
- Raw `page_views` rows are rolled up nightly into `analytics_daily` and **deleted after 90 days**.

## 11. Error handling (§30)

Production `500` responses are always `{"code":"INTERNAL_ERROR","message":"An unexpected error occurred","requestId":"..."}`.
No stack traces, no SQL, no file paths, no dependency versions. The full error is logged server-side
against the same `requestId`. `NODE_ENV=development` gets the stack in the response, and the code
path that decides this is a single function with its own unit test — because "detailed errors leaked
in prod" is one of the most common findings in exactly this kind of app.

## 12. Dependency security (§32)

Lockfile committed; `npm audit --audit-level=high` fails CI; Dependabot weekly; every new dependency
justified in the PR (age, maintenance, transitive count); `npm ci --ignore-scripts` in Docker builds;
Node pinned in `.nvmrc` and the Dockerfile; distroless/slim runtime image running as a non-root user.

## 13. Deliberately out of scope for v1

Stated so it is a decision, not an oversight: WAF, bot management beyond rate limiting, 2FA/TOTP for
the admin (**worth adding — flagged as D12**), a public security.txt (trivial, will add in Phase 11),
subresource integrity (no third-party scripts to protect), and certificate pinning.
