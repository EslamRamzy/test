# Phase 11 Report — Search + Command Palette

**Status: complete.** Report format per brief §56.

---

## 1. What was implemented

The FTS5 search backend (index maintenance triggers, the `GET /search` endpoint, bm25 ranking,
draft isolation) turned out to already be fully built and fully tested — Phase 2 shipped the
triggers and virtual table ahead of schedule, and Phase 5 shipped the endpoint itself, confirmed by
reading `search-index.test.ts`/`search.test.ts` before starting any new work (same "research first"
principle Phase 10 applied to the contact form). Phase 11's real, new scope was the command palette
doc06 §39 describes — which did not exist at all — plus a design pass on the `/search` page, the
one public route the Amber Signal redesign had skipped.

| Area | Delivered |
|---|---|
| Backend | Nothing new — verified against doc03/doc09's own documented contract exactly (`q` 2–100 chars, `type` enum, `limit`; `searchLimiter` 30/min matching doc09 §4's table) and doc11's own exit criterion (`search-index.test.ts` already covers publish→findable, unpublish→not-findable, archive→not-findable, edit→re-indexed, delete→removed, across projects/articles/research/technologies) |
| Frontend — browser search client | `lib/api/client.ts` gained `searchContent()` — a browser-side `GET /search` call, separate from `endpoints.ts`'s server-only `search()` (which uses `API_INTERNAL_URL`, unreachable from a Client Component) |
| Frontend — `<CommandPalette>` | doc06 §39 exactly: `⌘K`/`Ctrl+K` opens it; **Navigate** (About, Projects, Articles, Security, Certifications, Experience, Contact); **More** (social links from the `social_links` table, plus a theme toggle reusing the existing `useTheme()` hook); a debounced-250ms live search grouped by entity type once 2+ characters are typed. Built on `react-bootstrap`'s `Modal` (the same primitive `ConfirmDialog` already uses) for `role="dialog"`/`aria-modal`/focus trap/`Esc`-close/focus-restore "for free"; a flat, index-based command list drives `↑`/`↓`/`Enter` regardless of which section an item renders in; an `aria-live` region announces the result count |
| Frontend — `<CommandPaletteLauncher>` | The tiny always-mounted half: a single `window` `keydown` listener for the shortcut. The heavy half (`<CommandPalette>`, `react-bootstrap`'s `Modal`, the search wiring) is `next/dynamic({ ssr: false })`, and — critically — never even RENDERED until the very first shortcut press, so it costs nothing on first paint, not just nothing to hydrate |
| Frontend — `/search` page | Given a design pass: `.search-page*` classes replacing the page's original plain-Bootstrap markup, matching the palette's own result-badge treatment (the teal `--color-accent-2` used for the badge, same as `<CommandPalette>`'s result icons) |
| Public layout | `<CommandPaletteLauncher>` mounted once in `app/(public)/layout.tsx`, reusing the SAME `getProfile()` call `Header`/`Footer` already consume for its social links — no second fetch |
| Verification | A real Chromium (Playwright) pass against a live API + Next dev server: opened the palette with a real `Ctrl+K` keypress, confirmed every static action and the seeded `social_links` row render, searched for seeded content and confirmed live, debounced, grouped results, navigated to a result with `↑`/`Enter`, confirmed `Esc` closes it, confirmed a query matching nothing shows the empty state, and confirmed the redesigned `/search` page renders correctly — see §3 |

## 2. Files created / modified

```
apps/web/src/lib/api/client.ts                    + searchContent() (browser-side GET /search)
apps/web/src/features/command-palette/CommandPalette.tsx (+test)         new
apps/web/src/features/command-palette/CommandPaletteLauncher.tsx         new
apps/web/src/app/(public)/layout.tsx              mount <CommandPaletteLauncher>
apps/web/src/app/(public)/search/page.tsx          redesigned onto .search-page* classes
apps/web/src/styles/_components.scss              + command-palette*, search-page* rules
```

## 3. Testing performed

- **Unit/integration (automated, part of the gate).** 766 tests passing at the end of the phase
  (170 `@portfolio/shared`, 437 `@portfolio/api` — both unchanged, confirming no backend regression
  — and 159 `@portfolio/web`, up from Phase 10's 152). `CommandPalette.test.tsx` (7 tests): the
  dialog carries `aria-modal="true"`; every static action renders with no query typed, including the
  dynamic social link (from a prop, not fetched by the component itself) and the theme toggle;
  typing narrows the static actions to matching labels; the live search is genuinely debounced (not
  called until 250ms elapse, confirmed by asserting zero calls immediately after typing) and renders
  results grouped under their entity-type label; a query under the 2-character minimum never calls
  search even after the debounce elapses (matching the API's own `searchQuerySchema` floor); the
  result count is announced; `↑`/`↓` move the active item (asserted via `aria-selected`) and `Enter`
  activates whichever item is highlighted — including a real state change (the theme actually
  flipping to `dark`) for the theme-toggle case, not just a callback spy.
- **Architectural lint rules** (`npm run lint:rules`): all 8 rules stayed green — `<CommandPalette>`
  lives outside `features/admin/`, so the "components may not import the API client" boundary rule
  (scoped to the admin UI) doesn't apply to its `searchContent()` import, confirmed by the rule
  still passing rather than assumed.
- **Real stack, real browser** (Chromium via Playwright, not simulated) — the Phase 11 exit
  criterion itself, against a freshly bootstrapped + seeded dev database (the seed script's own
  published project, article, and security-research entry) with one real `social_links` row added
  for the "dynamic social links" check:
  - Confirmed `.command-palette` is entirely absent from the DOM on first page load — not just
    invisible, genuinely never rendered — proving the `next/dynamic` code-split costs nothing until
    the first `Ctrl+K`.
  - Pressed `Ctrl+K` for real; the dialog appeared with `aria-modal="true"`, all seven navigation
    actions, the seeded GitHub link (real `href`, `target="_blank"`), and the theme toggle.
  - Typed a query matching the seeded project; live, debounced results appeared grouped under a
    "Projects" label within ~250ms, sourced from the real `GET /search` endpoint.
  - Pressed `Enter` on the highlighted result and landed on the project's real detail page
    (`/projects/portfolio-platform`) — the dialog closed itself on that navigation.
  - Confirmed `Esc` closes the dialog, and a query matching nothing renders the empty state rather
    than stale results.
  - Confirmed the redesigned `/search?q=security` page renders the new badge/title/snippet markup
    with real results, and that zero unexpected console errors occurred across the whole pass.
  - 12 of 12 scripted assertions passed in the final run.

## 4. Problems found and fixed

Ordered as found.

1. **Faking every timer global broke the debounced-search test, not the component.** The
   established `vi.useFakeTimers()` pattern (`ResourceToolbar.test.tsx`'s own precedent) fakes every
   timer-ish global by default, which also fakes the mechanisms React's own scheduler uses to flush
   effects between renders — fine for a purely synchronous debounce callback, but this component's
   debounce triggers a SECOND async chain (a state update, then a real `.then()`, then another state
   update), which stalled indefinitely under the default fake-timer scope. Fixed by scoping
   `vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })` to exactly what the component's own
   debounce uses, leaving React's scheduler running in real time, and wrapping every
   `vi.advanceTimersByTimeAsync()` call in `act()` so the resulting renders flush synchronously
   before the next assertion runs.
2. **`useTheme()` throws in any test environment with no `data-theme` attribute already set** — it
   falls back to `window.matchMedia`, which jsdom does not implement at all. Not a bug in the hook
   itself (a real browser always has `matchMedia`), but the very first thing that needed a stub
   before `<CommandPalette>` could render in a test at all — added a `vi.stubGlobal('matchMedia', ...)`
   returning a minimal fake `MediaQueryList`.
3. **A stale, pre-Phase-11 Next.js Data Cache entry from an earlier `npm run build`, sharing the same
   `.next` directory with `next dev`, served an EMPTY `socialLinks` array during E2E verification** —
   confirmed by comparing a direct `curl` to the API (which correctly returned the seeded GitHub
   link) against the web app's own rendered HTML (which didn't), then confirming `Footer` — code this
   phase never touched — was equally affected. Not a Phase 11 bug: a full `rm -rf .next` (not just
   `.next/cache`) before restarting the dev server resolved it, and the real E2E pass afterward
   confirmed the palette's own social-link rendering was correct all along.

## 5. Technical decisions

| Decision | Rationale |
|---|---|
| `<CommandPalette>` is built on `react-bootstrap`'s `Modal`, not a hand-rolled dialog | `ConfirmDialog` already establishes this as the codebase's own accessible-dialog primitive (focus trap, `Esc`-close, focus-restore, correct ARIA roles, all built in) — reimplementing that from scratch for one more dialog would only risk a worse, duplicate version of what's already proven |
| The dynamic-import boundary is the RENDER of `<CommandPalette>` itself (gated behind `everOpened`), not just its `show` prop | `next/dynamic`'s import fires the first time React actually renders the component — toggling `show` on an always-rendered element would load the whole feature (and `react-bootstrap`'s `Modal`) on every page's first paint regardless of whether the visitor ever presses the shortcut, defeating doc06 §7's own "costs nothing on first paint" |
| Static actions are filtered by the SAME typed query as the live search, rather than only appearing when the query is empty | Doc06 §39 lists "Actions" and "Search" as two distinct capabilities without saying they're mutually exclusive; showing both together (typing "git" narrows straight to GitHub, "proj" straight to the Projects nav action) is the standard command-palette pattern (VS Code, Linear, GitHub) and costs nothing extra since the static list is a plain in-memory filter |
| Keyboard navigation uses one running index across every section rather than per-group indices | `↑`/`↓` need to feel like ONE list to the visitor regardless of how many labeled groups the sections span — a per-group index would either reset confusingly at each boundary or require tracking which group is "active" as a second piece of state for no benefit |
| `Enter` calls `.click()` on the currently-highlighted item's own DOM node, rather than each item's activation logic being duplicated in a keyboard handler | Every item already IS a real `<Link>`/`<a>`/`<button>` with its own correct `onClick` (navigate + close, open externally + close, toggle theme + close) — simulating a real click reuses that exact logic instead of a parallel "activate by index" switch statement that could drift out of sync with what a mouse click actually does |
| `/search`'s own redesign reuses `--color-accent-2` (teal) for its result badge, matching `<CommandPalette>`'s own result icons | The two surfaces show the literal same underlying data (`SearchResultDto`) — using the same accent for "this is a search result" in both places is a small, deliberate visual echo between them, not an arbitrary color choice |

## 6. Known gaps

- **No visible, discoverable trigger for the palette beyond the keyboard shortcut** — doc06 §39
  specifies only `⌘K`/`Ctrl+K`; a visible "press ⌘K to search" affordance in the Navbar (the way
  GitHub's own navbar hints at its own command palette) is a reasonable future enhancement but is new
  UI doc06 doesn't call for, so it was left out rather than invented. The redesigned `/search` page's
  own subtitle does mention the shortcut, which is the one place doc06 leaves room for such a hint.
- **No cross-request prefetching of the palette's own JS chunk** — the very first `⌘K` a visitor
  presses pays the cost of fetching+parsing the dynamically-imported chunk before the dialog opens
  (a network round trip, typically well under 100ms on a real connection). Pre-warming it on hover
  over some other UI element would remove even that, but doc06 §7's own requirement is "costs
  nothing on first paint," not "zero latency on first open" — this satisfies the former without
  inventing a prefetch heuristic the doc never asked for.
- **The palette's live search has no loading indicator between typing and results appearing** — at
  a 250ms debounce plus a same-origin API round trip, this is rarely visible in practice, and doc06
  §39 does not call for one; matches `/search`'s own page, which has never had one either.

## 7. Blockers

**None.** Phase 11 (Search + command palette) is complete: the search backend's own doc11 exit
criterion (index consistency across every publish/unpublish/edit/delete transition, drafts never
appearing) was already fully met by Phase 2/5's work, re-verified rather than re-built; the command
palette meets doc06 §39 exactly, with its own keyboard and accessibility test coverage; and a real
browser session confirmed the whole flow end-to-end. Phase 12 (SEO + performance + accessibility)
can start immediately.
