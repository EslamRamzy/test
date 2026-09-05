# Phase 12 Report — SEO, Performance, Accessibility, CSP

**Status: complete, with one honestly-documented exit-criterion miss.** Report format per brief §56.

---

## 1. What was implemented

"Research first" (the same principle Phases 10–11 applied) found that most of doc06 §8–9's SEO
surface was already shipped by earlier phases: `generateMetadata()`, dynamic OpenGraph images,
`sitemap.ts`/`robots.ts`, and `BreadcrumbList`/`BlogPosting`/`Article`/`SoftwareSourceCode` JSON-LD
all existed before this phase started. Phase 12's real, new scope was: canonical URLs on the routes
that didn't have one yet, `/.well-known/security.txt`, an actual jest-axe/component-level
accessibility pass (with three real bugs found and fixed), a bundle-budget measurement tool (which
found a real, unresolved gap — see §4), and the entire nonce-based CSP implementation doc09 §2
describes, which did not exist at all before this phase.

| Area | Delivered |
|---|---|
| Canonical URLs | Every public route missing one (`/`, `/about`, `/projects`, `/articles`, `/security`, `/certifications`, `/experience`, `/contact`, `/search`) now sets `alternates: { canonical }`; the three detail routes already had theirs |
| Root layout OpenGraph defaults | `generateMetadata()` in `app/layout.tsx` gained `openGraph`/`twitter` defaults (`siteName`, `type: 'website'`, `summary_large_image`) — Next's metadata merge is shallow per top-level key, so the three detail pages that define their own `openGraph` had to repeat `siteName` themselves rather than inherit it |
| `security.txt` | `app/.well-known/security.txt/route.ts` — `Contact` from the profile's public email (fallback: `/contact`), a 2027 `Expires`, and a `Canonical` URL |
| Structured data — real gaps found and fixed | The article/security-research `BlogPosting`/`Article` JSON-LD was missing `image` and `author`, both required/recommended by Google's own Article structured-data guidelines — both now included conditionally (present cover image / successful profile fetch) |
| Accessibility tooling | `jest-axe` installed; two custom ambient `.d.ts` files (one script, one module — see §4) bridge it into vitest's `Assertion` interface, since `@types/jest-axe` targets Jest's own `Matchers` interface instead |
| Accessibility bugs found and fixed | `CommandPalette`, `ConfirmDialog`, and `MediaPicker` all wrapped `react-bootstrap`'s `Modal` with no accessible name (`aria-dialog-name` axe rule) — `ConfirmDialog` in particular backs every destructive admin action site-wide. All three now carry an `aria-label` |
| Bundle budget tooling | `scripts/check-bundle-budget.mjs` — gzips each public route's real first-load chunk files from disk (not the uncompressed number Next's own diagnostics report, and not an approximated ratio) and sums them against doc06 §9's 120 KB budget; wired into CI as an informational (`continue-on-error`) step — see §4 for why it does not hard-fail the build |
| Nonce-based CSP | `proxy.ts` generates a fresh nonce per request, builds doc09 §2's directive list, and sets it on both the request (so Next's own renderer applies the nonce to its framework-injected scripts) and the response; `app/layout.tsx` `await connection()`s to force the whole app dynamic (nonces don't work on statically-rendered pages) and applies the nonce to its own inline theme-init script; verified report-only, then flipped to enforced, both against a real headless-browser pass — see §3 |
| API's own CSP | `helmet`'s CSP in `apps/api/src/app.ts` is no longer left at its default — a static, maximally restrictive policy (no nonce needed: the API never renders HTML with inline scripts) |

## 2. Files created / modified

```
apps/web/src/app/layout.tsx                          + openGraph/twitter defaults, nonce + connection()
apps/web/src/app/(public)/page.tsx                    + canonical
apps/web/src/app/(public)/about/page.tsx              + canonical
apps/web/src/app/(public)/projects/page.tsx           + canonical
apps/web/src/app/(public)/articles/page.tsx           + canonical
apps/web/src/app/(public)/security/page.tsx           + canonical
apps/web/src/app/(public)/certifications/page.tsx     + canonical
apps/web/src/app/(public)/experience/page.tsx         + canonical
apps/web/src/app/(public)/contact/page.tsx             + canonical
apps/web/src/app/(public)/search/page.tsx              + canonical (base path, not the query string)
apps/web/src/app/(public)/projects/[slug]/page.tsx    + siteName repeated in own openGraph
apps/web/src/app/(public)/articles/[slug]/page.tsx    + siteName repeated; + image/author on BlogPosting JSON-LD
apps/web/src/app/(public)/security/[slug]/page.tsx    + siteName repeated; + image/author on Article JSON-LD
apps/web/src/app/.well-known/security.txt/route.ts    new
apps/web/src/proxy.ts                                 rewritten — nonce + CSP, alongside existing /admin redirect
apps/web/src/proxy.test.ts                            new — 11 tests
apps/web/scripts/check-bundle-budget.mjs              new
apps/web/package.json                                 + jest-axe devDependency, + check:bundle-budget script
apps/web/vitest.setup.ts                              + jest-axe matcher registration
apps/web/src/types/jest-axe.d.ts                       new — script-file shim for the untyped package
apps/web/src/types/vitest-axe.d.ts                     new — module-file Assertion augmentation
apps/web/src/features/command-palette/CommandPalette.tsx        + aria-label on Modal
apps/web/src/features/command-palette/CommandPalette.test.tsx   + axe test
apps/web/src/features/admin/components/ConfirmDialog.tsx        + aria-label on Modal
apps/web/src/features/admin/components/ConfirmDialog.test.tsx   + axe test
apps/web/src/features/admin/components/MediaPicker.tsx           + aria-label on Modal
apps/web/src/features/admin/components/MediaPicker.test.tsx      + axe test
apps/web/next.config.ts                               + experimental.optimizePackageImports
apps/api/src/app.ts                                    helmet CSP: explicit restrictive policy, not the default
.github/workflows/ci.yml                               + bundle-budget step (continue-on-error, see §4)
docs/architecture/09-security-architecture.md          CSP section rewritten to match the verified, shipped policy
```

## 3. Testing performed

- **Unit/integration (automated, part of the gate).** 780 tests passing at the end of the phase
  (170 `@portfolio/shared`, 437 `@portfolio/api` — both unchanged, confirming no backend regression —
  and 173 `@portfolio/web`, up from Phase 11's 159: 11 new `proxy.test.ts` tests covering CSP header
  presence/shape, the per-request-fresh nonce, and that the pre-existing `/admin` redirect logic is
  unaffected; 3 new axe tests on `CommandPalette`/`ConfirmDialog`/`MediaPicker`).
- **Real browser, CSP report-only pass.** Built and started the production server against a real API
  + seeded dev database; a headless Chromium (Playwright) pass across all 12 public routes plus
  `/admin/login` plus the command palette (opened via a real `Ctrl+K`), with the CSP shipped as
  `Content-Security-Policy-Report-Only`, showed no genuine violations (only the browser's own,
  expected notice that `upgrade-insecure-requests` is a no-op under report-only).
- **Real browser, CSP enforced pass.** Flipped to the enforcing header and repeated the same pass,
  this time also asserting on `requestfailed` events and each page's rendered body text (to catch a
  silent, blocked-resource render failure that a console-only check could miss). The FIRST attempt
  (nonce-based `style-src`, matching doc09 §2's literal original text) surfaced 248 real violations
  across every route — see §4. After the fix, the same pass showed **zero violations, zero failed
  requests, and every page (plus the command palette dialog) rendering real content** — this is the
  policy that shipped.
- **Real browser, Lighthouse SEO/Accessibility.** Ran against the same live server: home, about,
  contact, both list and detail pages for articles/projects/security, certifications, and experience
  all scored **100/100 SEO and 100/100 Accessibility** (comfortably over the ≥95 exit criterion). The
  home page's very first Lighthouse run scored 92 SEO (missing meta description) — re-ran once per
  this session's own "confirm a flake before treating it as a bug" rule, and the second run scored
  100; a direct `curl` throughout confirmed the meta tag was present in the raw HTML the whole time,
  so this was Lighthouse's own first-run timing, not a real regression. `/search` alone scored 66 SEO
  — entirely explained by its Phase 11-decided, still-correct `noindex` (`is-crawlable` audit), which
  Lighthouse's SEO category penalizes on principle regardless of intent; not a Phase 12 regression.
- **Structured data — Google Rich Results Test blocked, substituted.** `search.google.com` and
  `validator.schema.org` are both unreachable from this environment (egress proxy: "connect_rejected
  — organization policy"). Substituted with the strongest available offline equivalent: fetched the
  ACTUAL rendered JSON-LD from a live seeded article (`/articles/building-a-secure-contact-form`) and
  project (`/projects/portfolio-platform`) page via `curl` against the real API + web app, confirmed
  both blocks are syntactically valid JSON, and checked each against Google's own documented
  required/recommended properties for `Article`/`BlogPosting` and `BreadcrumbList` from first
  principles — this is what surfaced the missing `image`/`author` fix in §1.
- **Architectural lint rules** (`npm run lint:rules`): all 8 rules stayed green.
- **Full gate**: `format:check`, `lint`, `lint:rules`, `typecheck`, `test`, `build`, `audit:deps` (0
  vulnerabilities) all pass. `check:bundle-budget` does not — see §4.

## 4. Problems found and fixed

Ordered as found.

1. **Next's metadata merge is shallow per top-level key, not deep.** Adding `openGraph` defaults to
   the root layout's `generateMetadata()` was silently discarded on the three detail pages, which
   already define their own (partial) `openGraph` object — a route's own key REPLACES the parent's
   entirely rather than merging into it (confirmed against Next's own bundled docs). Fixed by
   repeating `siteName` in each of the three detail pages' own `openGraph`.
2. **`@types/jest-axe` targets Jest's `Matchers` interface, not vitest's `Assertion` interface.**
   Uninstalled it and wrote two separate ambient `.d.ts` files instead of one: a plain global SCRIPT
   file (no top-level import) to shim the untyped `jest-axe` package itself, and a MODULE file (a
   load-bearing `import 'vitest'`) to augment vitest's real `Assertion` interface. Combining both
   concerns in one file broke one or the other depending on which form was used — root-caused by
   empirically toggling the import line in isolation, not guessed at.
3. **`jest-axe`'s `axe()` hangs forever under fake timers.** `CommandPalette.test.tsx`'s `beforeEach`
   scopes `vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })` for its own debounce tests;
   axe-core's internal `run()` also uses real `setTimeout` to chunk its work, so with those faked and
   never advanced, its promise never resolved. Fixed with `vi.useRealTimers()` as the first line of
   that one test.
4. **Three real, previously-unknown accessibility bugs**, found purely because the new jest-axe
   tooling caught them: `CommandPalette`, `ConfirmDialog`, and `MediaPicker` all wrap
   `react-bootstrap`'s `Modal` (`role="dialog" aria-modal="true"`) with no accessible name at all —
   `aria-dialog-name`. `ConfirmDialog` is the one shared primitive behind every destructive admin
   action in the app. Fixed with an `aria-label` on each.
5. **All 12 public routes measured 65–70% over doc06 §9's 120 KB gzipped budget** (196–204 KB) once
   the bundle-budget tool could actually measure it. Chunk-level investigation traced ~144 KB of that
   to two dominant chunks carrying pure React 19/Next.js 16 framework markers (`hydrateRoot`,
   `createRoot`, `useSyncExternalStore`, `startTransition`) with zero `react-bootstrap`/`@restart`/
   `popper` strings — i.e. framework baseline weight, not application code. Adding
   `experimental.optimizePackageImports: ['react-bootstrap']` to `next.config.ts` (verified: the
   codebase already imports it by subpath everywhere it controls the import site, but the package's
   OWN internal modules still re-import siblings through its barrel `index`) measured a real ~42 KB
   gzipped reduction per route (203.7 KB → 162.1 KB on the home page) — a genuine, if partial, fix.
   `@tanstack/react-query` and `react-hook-form` were tried in the same list and measured a verified
   ZERO effect (both already correctly code-split away from public routes), so they were left out
   rather than kept for a no-op. The remaining gap (156–162 KB, still over budget) is the React
   19/Next.js 16 client hydration runtime itself — confirmed by re-checking the same two dominant
   chunks post-optimization: still present, still carrying the same framework markers, now with zero
   `react-bootstrap` component names (`Modal`/`Navbar`/`Dropdown`) left in them at all, meaning the
   earlier bloat WAS partly `react-bootstrap`-caused mixing, and what remains is a hard,
   framework-version-inherent floor this phase cannot close through application-level changes alone.
   **Documented as an accepted, unresolved exit-criterion miss** (§6), not silently patched by
   raising `BUDGET_BYTES` to force a pass.
6. **A strict, literal implementation of doc09 §2's `style-src 'self' 'nonce-{random}'` broke 248
   real cases across every route** — a CSP nonce only ever covers `<style>` ELEMENTS, never inline
   `style="..."` ATTRIBUTES (confirmed via Chromium's own violation message: "hashes do not apply to
   event handlers, style attributes... unless the 'unsafe-hashes' keyword is present" — nonces carry
   the same restriction). This app has no `<style>` elements, only attributes: React's `style={{...}}`
   (77 call sites, mostly per-item computed values a build-time hash allow-list cannot cover) and
   shiki's syntax-highlighted code spans (per-token colours, `lib/markdown/render.ts`). Fixed by
   dropping the nonce from `style-src` for `'unsafe-inline'` instead, keeping `script-src` strict with
   no `unsafe-inline`/`unsafe-eval` in production — which is what doc09's own threat model (T5: script
   injection via markdown) actually guards against; `rehype-sanitize` already strips `style` from
   every markdown-sourced node except shiki's own trusted output, so this adds no attacker-reachable
   surface. Re-verified after the fix: zero violations. `docs/architecture/09-security-architecture.md`
   updated to match, with the reasoning inline rather than silently diverging from what's documented.
7. **The article/security-research `BlogPosting`/`Article` JSON-LD was missing `image` and `author`**
   — both required/recommended by Google's Article structured-data guidelines — found while
   substituting for the blocked Rich Results Test (§3). Fixed conditionally (present cover image /
   successful profile fetch), matching the existing `description`/`datePublished` conditional pattern
   in the same object.

## 5. Technical decisions

| Decision | Rationale |
|---|---|
| Full nonce-based CSP, accepting the loss of static/ISR rendering site-wide (`await connection()` in the root layout) | Doc09 §2 is unambiguous, and Phase 12's own exit criterion gates SEO/A11y Lighthouse scores, not a Performance score — the user's own answer to the trade-off question was "no preference," which this session read as deferring to the documented decision rather than inventing a smaller, undocumented compromise |
| `style-src` uses `'unsafe-inline'`, not a nonce, while `script-src` stays strict | See problem 6 above — a nonce cannot cover inline style ATTRIBUTES at all, only elements, and this codebase has no `<style>` elements, only attributes, in two places that can't be reasonably eliminated in this phase's scope (dynamic per-item computed styles, syntax-highlighted code) |
| The API's CSP is a static policy with no nonce, distinct from the web app's | The API never renders HTML with inline scripts (pure JSON + file-serving), so there is nothing a nonce would protect there that a maximally restrictive static policy doesn't already cover more simply |
| Bundle-budget CI step is `continue-on-error: true`, not a hard gate | The measured gap (§4) is a verified framework-version floor, not a regression this phase's own changes caused or can close by itself — failing CI on a documented, structural gap would either force a dishonest budget-number change or block every future PR for a reason outside that PR's control; the real numbers stay visible on every run instead |
| Rich Results Test substituted with manual validation against Google's documented schema, using real rendered JSON-LD | `search.google.com`/`validator.schema.org` are both blocked by this environment's egress policy (organization policy, not a transient failure) — the honest response is a stronger offline equivalent, not silently skipping the check or claiming a live pass that didn't happen |

## 6. Known gaps

- **Bundle budget: 156–162 KB gzipped first-load JS on public routes vs. doc06 §9's 120 KB budget**,
  after a genuine, verified ~20% reduction (§4, problem 5). The remaining gap traces to React
  19/Next.js 16's own client hydration runtime — a framework-version floor, not application code —
  and is not closed by this phase. Options for a future phase: revisit the 120 KB figure against what
  this exact framework combination can realistically hit, or a framework-version change; neither is
  in Phase 12's scope. The CI step reports the real number on every run rather than failing silently
  or being disabled.
- **Google Rich Results Test itself was never actually run** — this environment's egress policy
  blocks it. Substituted with manual validation against Google's own documented requirements using
  real rendered output (§3), which is the strongest available check here, but is not the same as the
  live tool's own verdict. Worth a real run outside this environment before considering the structured
  data fully signed off.
- **`SoftwareSourceCode` (the projects' own JSON-LD type) is not itself a Google-recognized rich
  result type** — its `BreadcrumbList` sibling on the same page is, and is valid; the
  `SoftwareSourceCode` block itself was left as-is (not given the same `image`/`author` treatment as
  `Article`/`BlogPosting`) since doing so would not change Rich Results eligibility for that page, and
  the exit criterion names "a project and an article" specifically.

## 7. Blockers

**None outright**, though §6's bundle-budget gap is an accepted, unresolved miss against Phase 12's
own exit criterion rather than a blocker to closing the phase — CSP is enforced with zero verified
console violations across every public route (plus `/admin/login` and the command palette), Lighthouse
SEO/Accessibility scores 100/100 on every real content route (the one exception, `/search`, is
explained entirely by its own, correct, Phase-11-decided `noindex`), and the structured-data gaps
found while substituting for the blocked Rich Results Test are fixed. Phase 13 (Security Testing) can
start immediately.
