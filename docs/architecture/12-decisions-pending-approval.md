# 12 — Decisions Pending Your Approval

Each decision has my recommendation. **Answering "all defaults" accepts every recommendation** and
I start Phase 1 immediately. Anything you change, I revise the affected docs first.

Items **D1–D4 and D8 are blocking** — they change schema or structure and would be expensive to undo
later. The rest can be decided during their phase, but earlier is cheaper.

---

### D1 — API topology *(blocking)*
How should the browser reach the Express API?

- **★ Recommended: one origin.** Next.js `rewrites()` proxies `/api/*` → Express. Cookies are
  first-party, `SameSite=Strict`, no CORS in normal operation. Express stays directly reachable on
  its own port for pentesting.
- Alternative: separate origins (`api.eslamramzy.dev`) → requires `SameSite=None`, full CORS,
  weaker CSRF posture. Only worth it if you want the API publicly branded as a separate service.

### D2 — UI framework *(blocking)*
The brief specifies Bootstrap; the visual direction (premium/minimal/elegant) is not Bootstrap's
default look (review C2).

- **★ Recommended: keep Bootstrap**, but consume the SCSS source with a custom token layer and use
  `react-bootstrap` for interactive components. Satisfies the stated stack; requires a deliberate
  design pass in Phase 6.
- Alternative: Tailwind + Radix primitives — faster to reach a distinctive look, but **changes your
  stated tech stack**, so I will not do it without an explicit instruction.

### D3 — Deployment target *(blocking — determines Dockerfiles, storage, backups)*
SQLite + local uploads require a **persistent writable volume**, which rules out Vercel/Netlify.

- **★ Recommended: a Linux VPS** (Hetzner/DigitalOcean/Contabo) with Docker Compose + Caddy.
  Full control, cheap, and it is a genuinely relevant thing to show on a security portfolio.
- Alternatives: Fly.io with a volume · Railway with a volume · a home server behind a tunnel.
- Please also confirm the **domain name** (I have used `eslamramzy.dev` as a placeholder).

### D4 — Meaning of `/security` *(blocking — affects routes, schema and admin IA)*
- **★ Recommended:** `/security` = Security **Research** only (matches §5). Project security
  assessments render inside the project case study at `/projects/[slug]#security`, with a
  "Security tested" filter on the projects list.
- Alternative: a combined security hub listing both research and per-project assessments.

### D5 — Project case-study body: fixed columns or flexible sections?
§7 lists Architecture/Challenges/Solutions as project fields; §8 wants admin-controlled sections.

- **★ Recommended: hybrid.** Keep the §7 fields as real columns (queryable, matches the brief
  literally), plus a `visible_sections` order/visibility list **and** a `project_sections` table for
  custom sections you invent later. Slightly redundant, maximally flexible.
- Alternative A: columns only — simplest, but adding a new section type later needs a migration.
- Alternative B: sections only — cleanest model, but deviates from §7's explicit field list.

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

### D8 — Content authoring format *(blocking — determines the whole XSS posture)*
- **★ Recommended: Markdown** (GFM: tables, code fences, task lists) with a split-pane editor and
  live preview. Raw HTML dropped by the sanitiser. Portable, diffable, and structurally safe.
- Alternative: a WYSIWYG producing HTML — nicer for non-technical authors, but it makes your own
  admin a stored-XSS vector and requires server-side sanitisation of every save. For a developer
  writing technical articles with code samples, Markdown is also simply better.

### D9 — Contact email notification
- **★ Recommended: optional and off by default.** Messages are always stored in the DB; if
  `EMAIL_*` is configured, a notification is sent. The form never fails because SMTP is down.
- Do you want it enabled at launch? If so, which provider (Gmail SMTP is rate-limited and fragile;
  Resend/Postmark/SES are more reliable)?

### D10 — Language / i18n
- **★ Recommended: English only** for v1. No i18n framework — it doubles the content model and
  every admin form.
- If you want **Arabic or bilingual**, tell me **now**: it changes the database (translation tables
  or per-locale columns), routing (`/[locale]/…`), and every admin editor. Retrofitting later is a
  large, expensive refactor. RTL support would also change the entire CSS layer.

### D11 — The existing `Program.cs`
The repository currently contains an unrelated C# hello-world. I have not touched it.
- **★ Recommended:** delete it in Phase 1 (it will confuse language detection and tooling).
- Alternatives: keep it, or move it to an `archive/` folder.

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

1. **Answers to D1–D4 and D8** (or "all defaults").
2. **The profile photo** — I will wire it as a `media` row referenced by `profiles.avatar_media_id`,
   replaceable from Admin → Settings. It will never be hardcoded in a component.
3. **Domain name** (or confirmation to keep `eslamramzy.dev` as a placeholder).
4. **Your professional headline and a short bio** for the seed data — or a placeholder, editable
   from the admin later.
5. **Your real social links** (GitHub, LinkedIn, email) for the seeded `social_links` rows.

Nothing else blocks Phase 1.
