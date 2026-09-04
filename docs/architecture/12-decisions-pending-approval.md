# 12 — Decisions

## Decisions taken (approved 2026-09-04)

| # | Decision | Chosen |
|---|---|---|
| **D1** | API topology | **Two origins** — `eslamramzy.dev` + `api.eslamramzy.dev` *(not my recommendation; adopted as instructed)* |
| **D2** | UI framework | **Bootstrap 5 SCSS source + custom token layer** + `react-bootstrap` |
| **D3** | Deployment | **Linux VPS + Docker Compose + Caddy** |
| **D4** | Meaning of `/security` | **Security Research only.** Project assessments render inside the case study at `/projects/[slug]#security` |
| **D8** | Authoring format | **Markdown** (GFM) with a split-pane editor, HTML stripped by the sanitiser |
| **D5** | Case-study body | **Hybrid** — §7 fields as columns + `visible_sections` order/visibility + `project_sections` for custom sections |
| **D10** | Language | **English only.** No i18n framework, no translation tables, no RTL layer |
| **D11** | `Program.cs` | **Deleted** in Phase 2 |

### What D1 changed in the design

I described this option as requiring `SameSite=None`. That was wrong and worth correcting, because
it makes the decision better than it looked: `eslamramzy.dev` and `api.eslamramzy.dev` are
cross-origin but **same-site**, and `SameSite` is evaluated per registrable domain. `Strict` still
works; `None` is never used.

The real costs, now designed for:

1. **CORS is load-bearing**, not defence in depth — exact-match allow-list, no reflection, no suffix
   matching, plus an independent `Origin` check on mutations (doc 09 §3).
2. **`__Host-` is lost** — cookies need `Domain=.eslamramzy.dev`, which the prefix forbids.
   `__Secure-` is used instead (doc 04 §1).
3. **Cookie tossing becomes a real threat** (T2b) — any subdomain can set cookies on the parent.
   Mitigated by no-wildcard DNS, **signed HMAC** CSRF tokens rather than plain double-submit,
   server-side session binding, and `Origin` checks (doc 01 §3, doc 04 §5).
4. **Preflight on every mutation** — `Access-Control-Max-Age: 600`, and `credentials: 'include'`
   centralised in one client module.
5. **Local dev must mirror the subdomains** (`local.eslamramzy.dev` + `api.local.eslamramzy.dev` via
   `/etc/hosts` and local TLS). Developing on bare `localhost` ports would hide exactly the bugs
   this topology introduces.

**Hard constraint:** the API must remain a subdomain of the site's apex domain. Moving it to a
different registrable domain would make it genuinely cross-site and force `SameSite=None`.

Documents updated for these decisions: 00, 01, 03, 04, 06, 08, 09, 11.

---

## Still open

Each has my recommendation. **Answering "all defaults" accepts every remaining recommendation.**
Nothing here blocks Phase 2; each is settled inside the phase that needs it.

### ~~D1 — API topology~~ · DECIDED: two origins
See "Decisions taken" above.

### ~~D2 — UI framework~~ · DECIDED: Bootstrap + SCSS tokens
See above. A deliberate design pass in Phase 6 is what makes this work; I will show you the visual direction before building all 12 pages on top of it.

### ~~D3 — Deployment~~ · DECIDED: VPS + Docker Compose + Caddy
See above. **Still needed from you:** the domain name (`eslamramzy.dev` is currently a placeholder) and, since D1 splits the API onto `api.<domain>`, confirmation that you control DNS for it.

### ~~D4 — Meaning of `/security`~~ · DECIDED: Security Research only

`/security` and `/security/[slug]` list Security **Research** entries. A project's security
assessment renders inside its case study at `/projects/[slug]#security`, with a "Security tested"
filter on the projects list. Two separate admin modules, no slug collisions.

### ~~D5 — Project case-study body~~ · DECIDED: hybrid

Three mechanisms, with a clear division of responsibility so the redundancy stays harmless:

1. **Columns** for the fields the brief names explicitly in §7 — `problem`, `solution`,
   `architecture`, `challenges`, `solutions_detail`, `lessons_learned`, `deployment_notes`,
   plus `security_summary` and `testing_summary`. These are queryable and match the brief literally.
2. **`visible_sections`** (a JSON array of ordered section keys on `projects`) controls **which**
   built-in sections render and **in what order**, per project (§8).
3. **`project_sections`** holds sections you invent later that have no column — a custom key, a
   title and a markdown body. Adding one never needs a migration.

Rendering rule, so the two never conflict: the case-study renderer walks `visible_sections` in
order. A key that names a built-in reads its column; any other key reads its `project_sections` row.
A built-in whose column is empty is skipped even if listed, so a half-filled project never renders
an empty heading.

### D6 — Draft preview
Do you want to view unpublished content on the real public layout before publishing?

- **★ Recommended: yes** — a signed, 15-minute, single-entity preview token + Next.js Draft Mode.
  Roughly half a day. Without it, "publish and check" is the only workflow.

### D7 — Admin account recovery
With one admin and no email reset, a forgotten password or a lockout is unrecoverable without server
access.

- **★ Recommended:** a server-side CLI (`npm run admin:reset-password`, `npm run admin:unlock`).
  No public endpoint, no new attack surface.
- Alternative: an email-based reset flow — more convenient, meaningfully more attack surface on a
  single-admin site.

### ~~D8 — Authoring format~~ · DECIDED: Markdown
See above. Full XSS pipeline in doc 09 §6.

### D9 — Contact email notification
- **★ Recommended: optional and off by default.** Messages are always stored in the DB; if
  `EMAIL_*` is configured, a notification is sent. The form never fails because SMTP is down.
- Do you want it enabled at launch? If so, which provider (Gmail SMTP is rate-limited and fragile;
  Resend/Postmark/SES are more reliable)?

### ~~D10 — Language / i18n~~ · DECIDED: English only

No i18n framework, no per-locale columns or translation tables, no `/[locale]/…` routing, no RTL
layer. Recorded as a deliberate choice rather than an omission: adding a second language later is a
schema change plus a rewrite of every admin editor, not a configuration flag.

### ~~D11 — `Program.cs`~~ · DECIDED: deleted

Removed at the start of Phase 2. It was an unrelated C# hello-world that would have skewed GitHub's
language detection and confused tooling.

### D12 — Two-factor authentication for the admin
Not in the brief. On a security-focused portfolio, a TOTP second factor on the single admin account
is both a real control and a good thing to be able to point at.
- **★ Recommendation: add it in Phase 4** (~half a day: `otplib`, a `users.totp_secret` column,
  recovery codes). Say no and I will leave it out — I will not build unrequested features (§ "do not
  invent features").

---

## Additional ideas — NOT part of the plan, listed only for your judgement

Per your instruction, I have not designed or scheduled any of these. Say the word and I will spec
them properly; otherwise they are noise and I will not mention them again.

1. RSS/Atom feed for articles and research (cheap, high value for technical writing).
2. Reading progress bar + table of contents on long articles/case studies.
3. `/uses` page (tools, hardware, setup) — popular in developer portfolios.
4. A public, versioned changelog of the portfolio itself.
5. Auto-generated PDF résumé from the Experience/Education/Skills tables — one source of truth for
   your CV instead of a separate document.
6. A "now" section on the homepage driven by a single site setting.

---

## What I need from you to start

1. Nothing blocks the current phase. **D6, D7, D9 and D12** are settled inside the phases that need
   them (Draft preview and account recovery in Phase 4, contact email in Phase 10, TOTP in Phase 4).
2. **The profile photo** — I will wire it as a `media` row referenced by `profiles.avatar_media_id`,
   replaceable from Admin → Settings. It will never be hardcoded in a component.
3. **Domain name**, plus confirmation you control DNS for the `api.` subdomain (required by D1).
4. **Your professional headline and a short bio** for the seed data — or a placeholder, editable
   from the admin later.
5. **Your real social links** (GitHub, LinkedIn, email) for the seeded `social_links` rows.

Phase 1 is complete and Phase 2 is unblocked.
