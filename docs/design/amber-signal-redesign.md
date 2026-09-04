# Amber Signal — Public Site Redesign

**Status: complete.** Implements the approved "Amber Signal" design concept (an Artifact
presented for review, then approved) against the already-complete Phase 6 public site. Report
format follows the same conventions as the numbered phase reports.

---

## 1. What was implemented

Every concept area from the approved design pitch, against the real Phase 6 site (same API,
same routes, same content — this is a visual/interaction redesign, not new functionality):

| Area | Delivered |
|---|---|
| Design tokens | New color system (amber `--color-accent` for the everyday identity, cyan `--color-accent-2` reserved exclusively for the Security register), `next/font/google`-self-hosted Unbounded (display) / IBM Plex Sans (body) / IBM Plex Mono (mono/metadata), an expanded spacing/radius/shadow scale, and a 5-name motion system (`fade-up/in/scale/left/right` + stagger) |
| Navbar | Transparent over the hero, blurred + bordered after a scroll threshold; a custom 3-bar hamburger (react-bootstrap's own SVG toggle icon is baked to the light theme's stroke color and is invisible in dark mode — see §4); full-screen mobile menu with a staggered link reveal |
| Hero | Asymmetric text/portrait grid, a geometric (not circular) portrait frame with a grid backdrop and open corner brackets, a staged CSS entrance sequence that plays once on load |
| About | One large statement (`shortBio`/`fullBio`, never fabricated copy) plus up to four capability "pillars" — real skill-category names/icons reused from the same `home.skillCategories` data `SkillsPreview` already fetches, not an invented fixed list |
| Skills | Interactive category tabs replacing the flat grid; switching category remounts the list (`key={category.id}`) so the stagger-in CSS animation replays every time |
| Projects | One large "featured" project (`home.featuredProjects[0]`) plus a smaller grid; `ProjectCard` gained a hover lift/border-highlight/image-zoom/arrow-move, all `transform`/`opacity`/`border-color`, fast and subtle |
| Security | The one place `--color-accent-2` (cyan) is used — enforced by a single `.tone-security` class (`_themes.scss`) that nothing outside Security may reach for — plus an abstract animated scan-line sweep over a technical grid panel, deliberately not a terminal/Matrix effect |
| Articles | One featured article with its cover image, then a plain editorial list (title/category/date/reading-time) where hover moves the title and arrow rather than lifting a card |
| Journey/Timeline | Unchanged structure, now stagger-revealed via `Reveal`'s new `stagger` variant instead of appearing as one block |
| Contact | Homepage CTA restyled as a display-type statement + glow-on-hover button; the `/contact` page itself rebuilt as the concept's "statement left, form right" asymmetric layout |
| Footer | Reduced to two rows — brand + tagline + social, then copyright + nav — replacing the single-row original |
| Custom cursor | Desktop-only (`(hover: hover) and (pointer: fine)`, `prefers-reduced-motion` also excluded), grows and shows a `VIEW`/`READ` label over project/article links, native cursor only ever hidden after the component confirms it can actually run |
| Page transitions | A light fade + vertical move on every route change, via a client wrapper keyed on `usePathname()` — no animation library, a remount is what replays the CSS |

## 2. Files created / modified

```
apps/web/src/styles/_tokens.scss                new palette, type scale, spacing/radius/shadow,
                                                  motion tokens — full rewrite
apps/web/src/styles/_bootstrap-overrides.scss    new Sass literals (font vars now `var()`
                                                  references — see §5), new light accent
apps/web/src/styles/_theme-vars.scss             --bs-*-rgb updated; .btn-outline-secondary's
                                                  override moved out of the dark-only mixin (§4)
apps/web/src/styles/_themes.scss                 new --bs-primary-rgb; .tone-security added
apps/web/src/styles/_components.scss             new — ~1000 lines, one section per component
                                                  concern (navbar/hero/about/skills/projects/
                                                  security/articles/journey/contact/footer/
                                                  cursor/page-transition)
apps/web/src/styles/globals.scss                 + components.scss import; Motion System
                                                  reveal-* variants (was one .reveal class)

apps/web/src/app/layout.tsx                      next/font/google self-hosting (3 fonts)
apps/web/src/app/(public)/layout.tsx              + CustomCursor, PageTransition
apps/web/src/app/(public)/contact/page.tsx        rebuilt — asymmetric statement + form
apps/web/src/app/(public)/security/page.tsx       + .tone-security
apps/web/src/app/(public)/security/[slug]/page.tsx + .tone-security

apps/web/src/components/layout/Header.tsx         rewritten — scroll state, custom toggle,
                                                    full-screen mobile menu
apps/web/src/components/layout/Footer.tsx         rewritten — two-row minimal layout
apps/web/src/components/layout/CustomCursor.tsx   new
apps/web/src/components/layout/PageTransition.tsx new
apps/web/src/components/ui/Reveal.tsx             + variant prop (up/in/scale/left/right/stagger)

apps/web/src/features/home/components/Hero.tsx           rewritten — asymmetric, staged entrance
apps/web/src/features/home/components/AboutPreview.tsx   rewritten — statement + pillars
apps/web/src/features/home/components/SkillsPreview.tsx  rewritten — client component, tabs
apps/web/src/features/home/components/FeaturedProjects.tsx  rewritten — lead + grid
apps/web/src/features/home/components/SecurityPreview.tsx   rewritten — .tone-security, scan line
apps/web/src/features/home/components/ArticlesPreview.tsx   rewritten — lead + editorial list
apps/web/src/features/home/components/Journey.tsx        rewritten — Reveal stagger variant
apps/web/src/features/home/components/ContactCta.tsx     rewritten — display statement + glow CTA
apps/web/src/features/projects/components/ProjectCard.tsx   + hover interactions, data-cursor
apps/web/src/features/security/components/ResearchCard.tsx  + hover interactions, data-cursor
apps/web/src/features/contact/components/ContactForm.tsx     + spinner, glow CTA class

apps/web/src/hooks/useReveal.ts                   unchanged (already generic — no edit needed)
```

## 3. Testing performed

Same real-stack workflow as Phase 6: a migrated + bootstrapped + seeded disposable SQLite DB, a
live API on :4000, the web app built with `output: 'standalone'` and run as `node server.js` (not
`next start`), verified against that live stack — not assumed from the CSS alone.

| Gate | Result |
|---|---|
| `format:check` / `lint` / `lint:rules` | pass |
| `typecheck` | pass, whole monorepo |
| `test` | pass — 424 tests (311 API + 93 shared + 20 web), no regressions; no new component tests were added (same gap Phase 6's report already noted) |
| `build` | pass — real `next build` against the live API |
| `audit:deps` | pass — 0 vulnerabilities |

- **All 12 routes** return `200` against the real standalone server.
- **`@axe-core/playwright`**, every route × both themes: **0 violations** on the final pass — the
  first full sweep after the redesign found 25 (all real, all fixed and re-verified; see §4), a
  second sweep after the first round of fixes found 3 more (also real, also fixed; see §4), and
  every affected route was individually re-checked after each fix rather than trusted on
  reasoning alone (`/projects`, `/articles`, `/security`, `/contact`, `/` and `/certifications`
  each got a dedicated re-run).
- **Lighthouse** (desktop preset): **Performance 100, Accessibility 100, Best Practices 100, SEO
  100** on `/security/idor-testing-methodology` (the page that surfaced the light-mode accent
  contrast bug — confirmed clean after the fix) and on `/projects`/`/articles` (the pages that
  surfaced the `.btn-outline-secondary` bug). The homepage holds at Best Practices 96 for the same
  reason as Phase 6's report: a disposable local test environment's uploads directory is missing
  the file a seeded DB row references — not a code defect, and not something this redesign
  touched.
- **320px viewport**, all 12 routes: **0 horizontal overflow** on the final pass — the first pass
  found real overflow on `/contact` (§4).
- Manual screenshot comparison, both themes, for every redesigned section (Navbar at rest and
  scrolled, Hero, mobile full-screen menu open, Projects featured+grid, Security scan panel,
  About/Skills/Journey/Contact/Footer) — actually looked at, not assumed correct from the CSS.

## 4. Problems found and fixed

Every one below was caught by something real (a build, a live server, an axe/Lighthouse pass, a
320px viewport, a screenshot) — none were reasoned about and left unverified.

1. **The light-mode accent (`#b87a1e`) was picked by reasoning from a DIFFERENT color's contrast
   math, not by computing this one.** The design-concept Artifact had verified a candidate blue
   accent's contrast during earlier exploration; that verified number got carried over into the
   comment justifying the final amber choice without re-running it for amber specifically. A real
   Lighthouse run against the security detail page caught it: 3.3:1 against `--color-bg`, 3.6:1
   against white, both short of WCAG AA's 4.5:1. Recomputed properly this time and corrected to
   `#835914` (4.9:1+ against `--color-bg`, `--color-surface`, AND `--color-accent-soft` — the
   tightest of the three, since a tab/badge's own tinted fill sits closer in lightness to the
   accent than the page background does). The same reasoning-not-computing mistake had also left
   `--color-accent-2` (cyan) and `--color-severity-high`/`-medium` all short of AA in light mode;
   all three were corrected the same way, verified with the same script, not assumed to be fine
   by analogy to the accent fix.
2. **`.navbar`, `.btn-outline-secondary` and other Bootstrap components locally redeclare their
   own `--bs-*` custom properties inside their own ruleset** (a pattern already documented from
   Phase 6's own dark-mode work), which shadows a value set only on an ancestor selector. This
   redesign's `.btn-outline-secondary` fix inherited Phase 6's DARK-only override — safe there,
   but a second axe run against the redesign's new LIGHT `--color-bg` (`#f4f5f8`, not pure white
   like Phase 6's) caught the SAME component failing again: Bootstrap's fixed `#6c757d` measured
   4.3:1 against it. Fixed by moving the override out of the dark-only mixin into an unconditional
   rule — `--color-text-muted` clears 4.5:1 against both themes' background, so one rule replaces
   what would otherwise need a light-mode duplicate.
3. **Real horizontal scroll at 320px on `/contact`.** Diagnosed first as the `.row`/`.container`
   gutter mismatch Phase 6 already found and fixed (both `Hero.tsx` and `contact/page.tsx` reused
   a `g-5` utility class, which only overrides the row's OWN `--bs-gutter-x`, not the ancestor
   `.container`'s separate copy) — that fix (`g-4 g-lg-5`, matching `.container`'s own default at
   the base breakpoint) was applied to both, but `/contact` kept overflowing. The real cause was
   different and more specific: this redesign's own new `.contact-page` CSS class used the
   `padding` SHORTHAND (`padding: var(--space-8) 0 var(--space-9)`), which set `padding-left`/
   `padding-right` to `0` — silently overwriting Bootstrap's own `.container` padding rule, since
   both classes land on the SAME element (`<div className="container contact-page">`) and this
   redesign's own stylesheet loads after Bootstrap's. With zero container padding, there was
   nothing left to absorb the row's negative margin at all. Fixed by using `padding-top`/
   `padding-bottom` only, never the shorthand, on any class that might share an element with
   `.container` — a real, self-inflicted bug distinct from the gutter-mismatch pattern it first
   looked like, caught only because the 320px check was re-run after the first fix rather than
   trusted to have resolved it.
4. **`.reveal`'s IntersectionObserver-driven entrance still works correctly on real scroll**
   (re-verified, not just assumed to still hold after `Reveal.tsx` gained the `variant` prop) —
   a full-page Playwright screenshot without a real incremental scroll can again show below-the-
   fold sections at `opacity: 0`, the same known Phase 6 screenshot-tooling artifact, not a
   regression; confirmed via direct DOM `getComputedStyle` inspection (`opacity: "1"` on every
   section) rather than re-litigating the same investigation from scratch.
5. Carried over from Phase 6, re-verified rather than re-discovered: `next/image`'s SSRF guard
   needing `dangerouslyAllowLocalIP` for the local API's `localhost` origin; the standalone-server
   (`node server.js`, not `next start`) requirement for dynamic OG-image routes to actually work.

## 5. Technical decisions

| Decision | Rationale |
|---|---|
| `next/font/google` (self-hosted), not a `<link>` to fonts.googleapis.com | Closes a gap Phase 6's own report flagged as pending ("self-hosted, display:swap, preloaded subset" — doc 06 §9); also the reason the three font Sass variables in `_bootstrap-overrides.scss` had to become `var()` references instead of literal family names — `next/font`'s self-hosted files register under an internally-generated hash, not the literal font name, so a hardcoded `'IBM Plex Sans'` would have silently missed the self-hosted file and fallen through to the system font |
| `.tone-security` is the ONLY sanctioned way to reach `--color-accent-2` | The design brief was explicit that cyan's rarity is what gives it meaning ("ظهوره النادر هو اللي يديله معنى") — a single class, applied to exactly three places (`SecurityPreview`, `/security`, `/security/[slug]`), makes that enforceable rather than a convention that drifts |
| `AboutPreview`'s four "pillars" reuse real skill-category names, not an invented fixed list | The design concept's example copy ("Full-Stack Development, Security, Problem Solving, Continuous Learning") is illustrative, not literal content to hardcode — Phase 6's "zero hardcoded content" exit criterion still applies to a visual redesign of the same site; `home.skillCategories` (already fetched for `SkillsPreview` on the same page) is the real, admin-managed equivalent |
| `SkillsPreview` became a client component | The category-tab interaction needs local UI state; the data itself is still fetched server-side and passed in as a prop — no new client-side data fetching was introduced |
| Custom cursor hides the native pointer only via a class the component adds itself after confirming both media-query guards pass | A visitor with JS disabled, or genuinely on a touch device that still matches a loose guard, never loses their cursor — the "off" state is the default, not a fallback |
| No numbered index markers (01/02/03/04) on the About pillars | Skill categories have no genuine order between them (unlike, say, a timeline) — numbering them would be exactly the decorative-not-informative pattern the design process explicitly warns against |

## 6. Known gaps

Unchanged from Phase 6's own report, still accurate after this redesign:

- First-load JS still measures roughly the same order of magnitude as Phase 6's own measurement
  (`react-bootstrap`'s `Navbar`/`Nav` remain the likely largest contributor) — not re-chased down
  this pass; `@next/bundle-analyzer` is still not wired into CI.
- Still no component-level (RTL) tests for anything in `components/`/`features/` — this redesign
  touched many of those files further without adding coverage for them.
- Bootstrap's `.dropdown`/`.modal`/`.list-group`/`.popover`/`.tooltip`/`.offcanvas`/`.accordion`/
  `.toast` still share the same local-`--bs-*`-redeclaration risk documented in Phase 6's report;
  still unused anywhere in this app, still worth checking the first time one of them is reached
  for.
- **Visual review by you** — the design concept was approved as a direction before implementation
  began, but the finished, implemented result is worth a second look now that it's real pages
  rendering real data, not a static mockup.

## 7. Blockers

**None.** The public site's visual identity is now the approved "Amber Signal" direction end to
end, on the same data and routes Phase 6 already built. Phase 7 (Admin shell) can proceed — the
design concept's own Admin/Mobile sections (§19-20) describe a calmer, denser, less-animated
application of the SAME token system, which this redesign's `_tokens.scss`/`_components.scss`
foundation is already positioned to support without another token rewrite.
