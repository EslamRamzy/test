# 06 — Frontend Architecture

Next.js 15 (App Router) · React 19 · TypeScript strict · Bootstrap 5 (SCSS source) · `react-bootstrap`.

---

## 1. Rendering strategy

The default is a **Server Component**. A component becomes `'use client'` only when it needs state,
effects, or browser APIs — and then it is pushed as far down the tree as possible so the interactive
island stays small.

| Route | Rendering | Revalidation |
|---|---|---|
| `/` | Static + RSC data | On-demand tags: `home`, `projects`, `articles`, `stats` |
| `/about` | Static | `profile`, `skills` |
| `/projects` | Static shell + server-side filtering via `searchParams` | `projects` |
| `/projects/[slug]` | SSG via `generateStaticParams`, `dynamicParams: true` | `project:{slug}` |
| `/articles`, `/articles/[slug]` | Same as projects | `article:{slug}` |
| `/security`, `/security/[slug]` | Same | `research:{slug}` |
| `/certifications`, `/experience` | Static | `cv` |
| `/contact` | Static shell + client form | — |
| `/admin/*` | **Fully dynamic**, `export const dynamic = 'force-dynamic'`, `no-store` | never cached |

Filtering and pagination are **URL state** (`?page=2&tag=react`), not React state: shareable,
back-button correct, crawlable, and it keeps the list a Server Component. No client-side data store
is needed for the public site at all.

## 2. Route tree

```
apps/web/src/app/
├── (public)/
│   ├── layout.tsx              Header · Footer · ThemeProvider · CommandPalette
│   ├── page.tsx                Homepage (10 sections, §6)
│   ├── about/page.tsx
│   ├── projects/
│   │   ├── page.tsx            list + filters
│   │   └── [slug]/
│   │       ├── page.tsx        case study
│   │       ├── opengraph-image.tsx
│   │       └── not-found.tsx
│   ├── articles/[slug]/…
│   ├── security/[slug]/…
│   ├── certifications/page.tsx
│   ├── experience/page.tsx
│   ├── contact/page.tsx
│   └── search/page.tsx
├── (admin)/admin/
│   ├── layout.tsx              Sidebar · Topbar · AuthGuard · Toaster
│   ├── login/page.tsx          (outside the admin layout)
│   └── …                       one folder per module (doc 07)
├── api/revalidate/route.ts     on-demand ISR, shared-secret protected
├── sitemap.ts · robots.ts · manifest.ts
├── global-error.tsx · not-found.tsx
└── globals.scss
```

Route groups keep the public and admin layouts completely separate (§20: the dashboard must be
visibly and structurally distinct), with no shared chrome.

## 3. Directory layout inside `apps/web/src`

```
app/           routes only — no business logic, no fetch bodies
components/
  ui/          Button, Card, Badge, Tag, Modal, EmptyState, Skeleton…  (design system)
  layout/      Header, Footer, Sidebar, Container, Section
  seo/         JsonLd, MetaBuilders
features/      vertical slices: projects/, articles/, security/, contact/, search/, admin-*/
  <feature>/
    components/   feature-specific UI
    hooks/        useProjectFilters…
    api.ts        typed calls into lib/api
    types.ts      re-exports from @portfolio/shared
hooks/         cross-feature: useTheme, useMediaQuery, useDebounce, useHotkey
lib/
  api/         client.ts (browser) · serverClient.ts (RSC) · endpoints.ts
  markdown/    render + sanitize pipeline
  utils/       cn, formatDate, readingTime, slugify
  seo/         metadata builders
styles/        _tokens.scss, _bootstrap-overrides.scss, _themes.scss, globals.scss
types/         app-local types only; domain types come from @portfolio/shared
```

**Rule (§4):** components render. They never call `fetch` directly and never contain business rules.
Data enters through `lib/api` in a Server Component or through a hook in a client island.

## 4. Data fetching

```ts
// lib/api/publicClient.ts — used by Server Components
export async function getProject(slug: string) {
  const res = await fetch(`${API_INTERNAL_URL}/api/v1/projects/${slug}`, {
    next: { tags: [`project:${slug}`], revalidate: 3600 },
  });
  if (res.status === 404) return null;              // → notFound()
  if (!res.ok) throw new ApiError(res);             // → error.tsx
  return unwrap(projectSchema, await res.json());   // runtime-validated against the shared schema
}
```

Because the API is a separate origin (decision D1), the **browser** client sets
`credentials: 'include'` on every request and attaches `X-CSRF-Token` on mutations; a request
missing either silently loses its cookies and returns `401`. Both are set once in
`lib/api/client.ts` so no call site can forget. Server Components are unaffected — they call the
internal address directly and forward cookies explicitly (doc 04 §7).

Responses are parsed with the **same Zod schema the API validates against**. If the backend ever
returns a shape the frontend does not expect, it fails loudly at the boundary instead of producing
`undefined is not an object` deep in a component tree.

Every list page has `loading.tsx` (skeletons matching the real layout — no spinners, no layout
shift) and `error.tsx`. Every detail page calls `notFound()` on a `null`, which renders the styled
404 rather than a crash.

## 5. Design system

Bootstrap is the **grid, utilities and accessible component primitives** — not the visual identity.
Two layers on top:

```scss
// styles/_tokens.scss  — the visual identity, theme-switchable at runtime
:root {
  --color-bg: #ffffff;      --color-surface: #f7f8fa;   --color-border: #e6e8ec;
  --color-text: #16181d;    --color-text-muted: #5b6472;
  --color-accent: #2f6bff;  --color-accent-soft: #eaf0ff;
  --radius-sm: 6px; --radius-md: 10px; --radius-lg: 16px;
  --shadow-sm: 0 1px 2px rgb(16 24 40 / .06);
  --font-sans: "Inter", system-ui, sans-serif;
  --font-mono: "JetBrains Mono", ui-monospace, monospace;
}
[data-theme="dark"] {
  --color-bg: #0d0f14;      --color-surface: #14171f;   --color-border: #232733;
  --color-text: #e8eaf0;    --color-text-muted: #9aa3b2;
  --color-accent: #6b93ff;  --color-accent-soft: #18203a;
}
```

```scss
// styles/globals.scss
@use "tokens";
@use "bootstrap-overrides";            // $ variables set BEFORE the import below
@use "bootstrap/scss/bootstrap" with ($enable-shadows: false, $enable-gradients: false);
```

Only the Bootstrap modules actually used are imported, which keeps the CSS bundle small.

**Theme switching:** `data-theme` on `<html>`, persisted in `localStorage`, defaulting to
`prefers-color-scheme`. A tiny blocking inline script in `layout.tsx` sets the attribute before
first paint to avoid a flash of the wrong theme. `color-scheme` is set so native form controls and
scrollbars match.

**Motion:** 150–250 ms, `ease-out`, transform/opacity only (never layout properties). Entrance
animations are one-shot `IntersectionObserver` reveals, never looping. Everything is wrapped in
`@media (prefers-reduced-motion: reduce) { animation: none; transition: none; }`.

Per §2: gradients are subtle and used at most twice per page; glass effects appear only on the
sticky header; no neon, no glow, no permanent animation.

## 6. Homepage composition (§6)

Ten Server Components fed by **one** aggregate call, `GET /api/v1/home`, rather than nine round
trips: Hero, QuickStats, AboutPreview, SkillsPreview, FeaturedProjects, SecurityPreview,
ArticlesPreview, Journey (timeline), ContactCta, Footer.

All counters in QuickStats come from `GET /api/v1/stats` — computed with `COUNT(*)` over published
rows. **No hardcoded numbers anywhere** (§6.2). A section with no data does not render an empty
shell; it is omitted, and the layout stays coherent.

## 7. Command palette (§39)

`⌘K` / `Ctrl+K`, one client island mounted in the public layout, code-split with
`next/dynamic({ ssr: false })` so it costs nothing on first paint.

- Actions: navigate (About, Projects, Articles, Security, Certifications, Experience, Contact),
  external (GitHub, LinkedIn — sourced from the `social_links` table, not hardcoded), theme toggle.
- Search: debounced 250 ms against `GET /api/v1/search?q=`, results grouped by type, server-side.
  The browser never downloads a content index (§38).
- Accessibility: `role="dialog" aria-modal="true"`, focus trap, focus restored on close, `Esc`
  closes, `↑/↓` + `Enter` navigate, `aria-live` announces the result count, visible focus ring.

## 8. SEO (§34)

- `generateMetadata()` per route from database content — title, description, canonical,
  OpenGraph, Twitter card.
- `opengraph-image.tsx` per project/article using `next/og` — generated from the row, so every
  share card is correct without manual asset work.
- JSON-LD: `Person` (home/about), `SoftwareSourceCode`/`CreativeWork` (projects),
  `BlogPosting` (articles), `BreadcrumbList` (all detail pages).
- `sitemap.ts` reads published slugs + `updatedAt` from the API; `robots.ts` allows all public
  routes and **disallows `/admin`, `/api`, `/search`**.
- Semantic HTML: one `<h1>` per page, `<article>`/`<section>`/`<nav>`/`<time datetime>`, heading
  levels never skipped.

## 9. Performance (§35)

| Technique | Application |
|---|---|
| `next/image` | All media; AVIF/WebP; explicit `sizes`; `priority` on the hero only |
| Fonts | `next/font` self-hosted, `display: swap`, preloaded subset — no render-blocking CDN request |
| Code splitting | Command palette, syntax highlighter, admin editor all `next/dynamic` |
| Server Components | Markdown rendering and syntax highlighting happen on the server — zero KB of highlighter shipped to the browser |
| Pagination | 12 per page on every list |
| Bundle budget | < 120 KB gzipped first-load JS on public routes, checked in CI with `@next/bundle-analyzer` |
| Targets | LCP < 2.0 s, CLS < 0.05, INP < 200 ms on a throttled mobile profile |

## 10. Accessibility (§36)

Semantic landmarks; skip-to-content link; visible focus rings (never `outline: none` without a
replacement); every form control has a `<label>`; errors linked via `aria-describedby` and announced
in a live region; all images carry `alt` from `media.alt_text` (decorative images get `alt=""`);
4.5:1 contrast minimum verified in both themes; full keyboard operability including the palette,
modals and the admin tables; `aria-*` used only where semantics are genuinely absent.
`jest-axe` runs in component tests and `@axe-core/playwright` on every E2E page (doc 10).

## 11. Responsive (§37)

Mobile-first. Breakpoints: 576 / 768 / 992 / 1200 / 1400 (Bootstrap defaults; no custom scale
without reason). Content column capped at 1200 px with generous gutters on large screens rather
than stretching to 2560 px. Admin tables become stacked cards below `md`. Touch targets ≥ 44 px.
Tested at 320 px minimum width.
