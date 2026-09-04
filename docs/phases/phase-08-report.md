# Phase 8 Report — Content Management

**Status: complete.** Report format per brief §56.

---

## 1. What was implemented

Every deliverable in docs/architecture/11's Phase 8 list: admin CRUD for all 13 modules, publish
workflow + readiness checks, reordering, the project tabbed editor (incl. security assessments,
the 15-test checklist, and findings), the markdown editor, tags/categories, and on-demand
revalidation on publish.

| Area | Delivered |
|---|---|
| Backend — schemas | Zod create/update schemas for every Phase 8 entity added to `@portfolio/shared` (technology, skill/skillCategory, certification, experience, education, timeline, socialLink, tag, articleCategory, article, securityResearch, project + its 4 sub-resource schemas, securityAssessment + tests + finding, siteSetting, profile) |
| Backend — generic CRUD factory | `services/adminCrudFactory.ts` + `controllers/admin/crudFactory.ts` — one repository/service/controller shape shared by every simple resource, avoiding 10 near-identical hand-written CRUD stacks |
| Backend — 10 simple CRUD+reorder modules | Technologies, Skill Categories, Skills, Certifications, Experience, Education, Timeline, Social Links, Tags (no reorder — no `displayOrder` column), Article Categories |
| Backend — on-demand revalidation | `lib/revalidate.ts` — `POST {PUBLIC_SITE_URL}/api/revalidate` with a shared secret, called after every publish/unpublish/archive/update-while-published, best-effort (never fails the admin request) |
| Backend — Articles + Security Research | Full CRUD + publish/unpublish/archive/duplicate workflow, each with its own readiness check (doc07 §4) |
| Backend — Projects | CRUD + reorder + publish workflow + the tabbed-editor endpoint group: `PUT .../technologies`, `POST/PATCH/DELETE .../images*`, `PATCH .../sections` (doc07 §8's visibility manager), `POST .../featured` |
| Backend — Security assessments/tests/findings | Nested creation under a project, direct addressing thereafter; the 15-item fixed test checklist upsert; the "never public while an OPEN CRITICAL/HIGH finding exists" rule enforced at write time, not just at read time |
| Backend — Settings/Profile/Audit Logs/Analytics | Grouped settings bulk-update; singleton profile; read-only paginated audit log; read-only analytics overview (totals, a time series, top projects/articles, referrer hosts) |
| Frontend — shared building blocks | `<DataTable>`, `<ResourceToolbar>`, `<EntityForm>`, `<StatusBadge>`, `<PublishControls>`, `<SortableList>` (keyboard up/down, not drag-and-drop), `<MarkdownEditor>`, `<TagInput>`, plus the generic `createAdminResourceClient`/`createAdminResourceHooks`/`createPublishActionHooks` factories that make a new module "a schema, a column definition, a field definition, and a route file" (doc07 §2), matching the backend's own factory pattern |
| Frontend — 10 simple modules | List/Create/Edit for every one of them, reusing `<AdminResourceListPage>` (the shared List screen, including a `statusFilter` used later by the publish-workflow resources) |
| Frontend — Articles | List/Create/Edit, `<MarkdownEditor>`, tag combobox, category select, scheduled `publishedAt`, publish workflow with readiness-check errors mapped onto the edit form |
| Frontend — Security Research | Same shape as Articles, plus a `references` repeater and a fixed-enum category select |
| Frontend — Projects | The full tabbed editor: Overview · Case Study (+ the section visibility/order manager) · Technologies · Media · Security (assessments, tests checklist, findings) · SEO (a read-only preview — no dedicated SEO columns exist to edit) |
| Frontend — Settings/Profile/Audit Logs/Analytics | A type-aware bulk settings form, a singleton profile form, a filtered read-only audit log table, a read-only analytics dashboard (tables, not charts — no charting library is installed) |
| Sidebar | 11 of doc07 §51's 14 modules enabled (Media and Messages remain disabled — both are Phase 9/10 scope, never in this phase's task list); Profile and Analytics (which doc07 §51 excludes from the sidebar entirely) reached from a link on Settings instead |
| Verification | A real Chromium (Playwright) pass creating a project, an article, and a security research entry entirely through `/admin`, publishing each, and confirming all three render correctly on the public site with real audit-log entries for every step — see §3 |

## 2. Files created / modified

Roughly 150 files across nine commits. Summarized by area rather than listed individually:

```
apps/api/src/{schemas via @portfolio/shared, repositories, services, controllers/admin,
  routes/admin}/*                       10 simple modules + articles + securityResearch + projects
                                         + assessments/findings + settings/profile/auditLogs/analytics
apps/api/src/lib/revalidate.ts          new — on-demand revalidation
apps/api/src/middleware/csrf.ts         retrofitted onto every Phase 8 mutating route (see §4.1)
apps/api/tests/*                        one integration-test file per module + revalidate + CSRF probe

apps/web/src/lib/api/{adminClient,adminResource,ApiError}.ts   requestPaginated, generic resource
                                                                 client factory, ApiError.details
apps/web/src/features/admin/components/{DataTable,ResourceToolbar,EntityForm,StatusBadge,
  PublishControls,SortableList,MarkdownEditor,TagInput,AdminResourceListPage}.tsx (+tests)  new
apps/web/src/features/admin/lib/{adminResourceHooks,formValues,useEditResourceForm,
  useResourceFormSubmit,applyApiErrors,slugify}.ts (+tests)                                 new
apps/web/src/features/admin/{technologies,skillCategories,skills,certifications,experience,
  education,timeline,socialLinks,tags,articleCategories}/*      new — 10 simple modules
apps/web/src/features/admin/{articles,securityResearch,projects}/*                          new
apps/web/src/features/admin/{settings,profile,auditLogs,analytics}/*                        new
apps/web/src/app/(admin)/admin/{technologies,skill-categories,skills,certifications,
  experience,education,timeline,social-links,tags,article-categories,articles,
  security-research,projects,settings,profile,audit-logs,analytics}/**/page.tsx             new
apps/web/src/features/admin/components/Sidebar.tsx              11 modules enabled
apps/web/src/styles/_components.scss                            + admin shared building blocks

packages/shared/src/schemas/*.ts         new — one file per Phase 8 entity
packages/shared/src/types/adminContent.ts + one Row/DTO interface per admin CRUD endpoint
```

## 3. Testing performed

- **Unit/integration (automated, part of the gate).** 679 tests passing at the end of the phase
  (148 `@portfolio/shared`, 390 `@portfolio/api`, 141 `@portfolio/web`) — up from Phase 7's 93/314/34.
  Every backend module has a real HTTP integration test against a real SQLite database (not
  mocked); every new frontend shared building block, form-schema wire-payload conversion, and the
  one genuinely non-trivial pure-logic piece (`ProjectSectionsManager`'s built-in/custom section
  merge and ordering) has a dedicated test. Per-page component tests were deliberately NOT written
  for the ~40 List/Create/Edit pages themselves — thin, mechanically similar wiring over
  already-tested primitives, verified instead by strict TypeScript across every field mapping,
  `lint:rules`, and a real production build on every commit.
- **Architectural lint rules** (`npm run lint:rules`): all 8 rules (services/controllers/middleware
  Prisma isolation, public/admin repository separation, `dangerouslySetInnerHTML` confinement to
  the markdown renderer, components forbidden from importing the API client directly) stayed green
  through every commit, including after the Articles module's `<MarkdownEditor>` was added.
- **Real stack, real browser** (Chromium via Playwright, not simulated) — the Phase 8 exit
  criterion itself:
  - Logged in as the real bootstrap admin account against a live API + Next dev server.
  - Created an Article entirely through `/admin/articles/new` (title, slug, excerpt, category,
    cover media id, markdown content, a brand-new tag created inline via `<TagInput>`), published
    it, and confirmed `/articles/{slug}` renders the title, content, and tag correctly.
  - Created a Security Research entry the same way (`/admin/security-research/new`), published it,
    confirmed `/security/{slug}` renders correctly.
  - Created a Project (`/admin/projects/new`: title, slug, short + full description, category,
    cover media id), assigned a technology on the Technologies tab (its own `PUT .../technologies`
    mutation, separate from the main form), then published it — the readiness check (cover image +
    ≥1 technology + case-study content) passed on the first attempt because the form's own field
    requirements were followed — and confirmed `/projects/{slug}` renders the title, description,
    and the assigned technology's badge correctly.
  - Confirmed `/admin/audit-logs` shows a complete, correctly-ordered trail for every action taken:
    `Tag create`, `Article create`, `Article publish`, `Research create`, `Research publish`,
    `Project create`, `Project technologies update`, `Project publish` — each attributed to the
    real admin actor with a real timestamp.
  - Reopened the published project's Edit page and confirmed every field round-tripped correctly
    from the database (title, slug, both descriptions, category, cover media id, the scheduled
    publish date correctly converted back to local `datetime-local` format, and the Published
    status badge with the correct Unpublish/Archive/Duplicate actions for that state).

## 4. Problems found and fixed

Ordered as found. Every one below was caught by something real — a failing test, a real TypeScript
error, a real browser session, or a probe request — never reasoned about and left unverified.

1. **CSRF protection was missing from every Phase 8 admin mutating route** — a genuine security
   gap, not a style issue. Proven with a probe test (a bogus CSRF token still returned `201
   Created`). Fixed by adding the `csrfProtection` middleware to all ten new route files' POST/
   PATCH/PUT/DELETE handlers. Found this early enough (during the backend CRUD-factory build) that
   every subsequent module was built with it from the start.
2. **Next.js 16.3.4 changed `revalidateTag()`'s call signature** — confirmed by reading the
   installed package's own compiled source, not assumed from changelog text: a second argument
   (`{ expire: 0 }`) is now required to match the classic single-argument immediate-invalidation
   behavior the revalidation route handler needs.
3. **A Prisma `create`/`update` input union-type ambiguity, twice** (`experienceRepository.ts`,
   then `projectRepository.ts`) — under `exactOptionalPropertyTypes`, TypeScript silently picked
   the wrong arm of Prisma's two-member `CreateInput`/`UpdateInput` union when a repository's `data`
   object mixed plain scalar fields with a union-typed relation-write spread. Fixed with an explicit
   `Prisma.XUncheckedCreateInput`/`UncheckedUpdateInput` annotation on the constructed object in
   both places.
4. **`idParamSchema` alone silently stripped `imageId`** from a nested project-image delete route,
   because `validate()` REPLACES `req.params` with the parsed object rather than merging into it.
   Fixed with a dedicated `projectImageParamSchema` (`{id, imageId}`) added to `packages/shared`.
5. **A generic Zod-schema-transformation helper's return type was wrong in a way three of its four
   uses never exposed.** `withFieldOverrides` (swaps a field of a shared schema for a client-side
   variant — e.g. `isoDateAsDate` back to a plain date-only string for a native `<input
   type="date">`) initially returned the ORIGINAL field's type unchanged, only correct by
   coincidence for every date-only override (input and output type are both `string` there, so a
   `zodResolver`/`useForm` mismatch never surfaced). The bug only became a real, caught TypeScript
   error when Certifications' `certificateMediaId` needed a genuinely different override type
   (`number` → `string`) — real compiler errors, not a design walkthrough, forced the fix: the
   return type now correctly reflects the override's own type via a mapped type. This is also why
   every "id/date typed as string on the form, real type on the wire" field in this phase converts
   at a dedicated `toXWirePayload()` step rather than via the schema's own `.transform()` — a
   transform whose OUTPUT type differs from its INPUT type would hit the identical class of
   mismatch against `<EntityForm>`'s `UseFormReturn<TFieldValues>`, which assumes no raw-vs-resolved
   split.
6. **`coverMediaId`/`certificateMediaId` were initially scoped OUT of the UI entirely** (Certifications,
   in the first pass) as a "no media picker yet" trim. Revisited against doc11's own exit criterion
   — "every field of every entity is editable from the UI" — and corrected: both are now plain
   numeric-id inputs (referencing an existing `Media` row by id), genuinely editable today even
   without Phase 9's picker. This mattered beyond consistency for Articles specifically:
   `coverMediaId` is one of `Article`'s own publish-readiness checks, so without SOME way to set it,
   an article created through `/admin` could never actually be published — exactly the gap the
   Phase 8 exit criterion exercises.
7. **The admin bootstrap account's password no longer matched `.env`'s `ADMIN_INITIAL_PASSWORD`**
   when the real-browser verification pass (§3) first tried to log in — a real login flow from an
   earlier phase's own verification had already changed it. Reset directly against the local dev
   database using the project's own `hashPassword` helper (a local, disposable SQLite file, not a
   shared or production credential) rather than working around it with a stale assumption.
8. A handful of smaller TypeScript/lint fixes caught the same way as every prior phase: an
   `AdminResourceListPage.test.tsx` mock typed too loosely for a mismatched-but-structurally-close
   union (`as unknown as X`, not a real type hole); an `import type` fix where every use of a schema
   import was a `typeof` type-position reference, never a runtime call; a Playwright browser
   executable-path mismatch between the globally installed `playwright` package's expected revision
   and the pre-fetched Chromium build in this container (worked around with an explicit
   `executablePath`, not by downloading a second browser).

## 5. Technical decisions

| Decision | Rationale |
|---|---|
| Generic `createAdminResourceClient`/`createAdminResourceHooks` factories, mirroring the backend's own `adminCrudFactory` | The whole point of doc07 §2's "a new module is a schema, a column definition, a field definition, and a route file" — without this, 10 simple modules would each hand-roll near-identical fetch + react-query wiring |
| `AdminResourceListPage` gained an optional `statusFilter`, used by all three publish-workflow resources | It's an ordinary filter wired into the query params, no different from any other `extraParams` — not a `<StatusBadge>`/`<PublishControls>` coupling, which stays out of the shared list page entirely (those live on the Edit page, since a readiness-gated publish action needs a real error surface, not a one-line row button) |
| Every "id/date typed as string on the form, real type on the wire" field converts via a dedicated `toXWirePayload()` function, never via a schema `.transform()` reused directly as the resolver | `<EntityForm>`'s `UseFormReturn<TFieldValues>` assumes the resolver's output type equals the form's own declared field type (no raw-vs-resolved split); a transform that changes the field's TYPE (not just its format) breaks that assumption — see §4.5 |
| Skills viewed one category at a time via a selector, not every category's skills in one flat list | `displayOrder` is only meaningful WITHIN a category, and the shared reorder logic recomputes order from the current page's row order — only correct when that page holds exactly one category's rows |
| Skill Categories / Article Categories / Tags have no dedicated Sidebar entry | Matches the backend routes' own comments and doc07 §51's own sidebar list exactly — reached from their parent module (Skills, Articles) or `<TagInput>`'s own create-or-select combobox instead |
| Project's Case Study tab's section visibility/order manager reconstructs full state from `visibleSectionsJson` (visible keys, in order) + `ProjectSection` rows (custom sections) | A hidden section's order isn't persisted anywhere else (the JSON column only ever lists VISIBLE keys) — this reconstruction is real, tested logic (`ProjectSectionsManager.test.ts`), not assumed correct |
| Security assessment/test/finding editing uses plain controlled state, not react-hook-form + zod | A deeply nested, one-off editor (unlike the primary resource forms) — standing up a third schema/override/wire-payload trio for four datetime fields across two small entities cost more than it returned |
| Project's SEO tab is a read-only preview, not an editable form | `Project` has no dedicated meta-title/meta-description columns (confirmed against `schema.prisma`) — an editable form there would invent fields that don't exist; doc07 §6's "no fake data" extends to not faking editability |
| Analytics rendered as tables, not charts | No charting library is installed in this project, and adding one for a single read-only dashboard isn't proportionate; every number a chart would plot is already a real table row |
| No Preview button in `<PublishControls>`; no drag-and-drop (`<SortableList>` uses keyboard up/down instead) | Both are documented scope trims from Phase 7/8's own building-block work: Preview needs D6's signed-token + Draft Mode feature (no backing endpoint in this phase's built scope); keyboard-only reordering matches doc07 §6's "Keyboard first" rule directly rather than adding a new dependency |
| Media and Messages stay `enabled: false` in the Sidebar | Doc11 places the media library in Phase 9 and the contact inbox in Phase 10 — neither was ever in this phase's task list; Profile and Analytics (built this phase) are reached from a link on Settings instead, since doc07 §51's own sidebar list excludes both by name |

## 6. Known gaps

- **No media library** — every `coverMediaId`/`certificateMediaId`/gallery-image field is a plain
  numeric id input, not a picker, pending Phase 9. A real image only renders on the public site if
  an admin already knows an existing `Media` row's id (e.g. the one the bootstrap script creates
  for the profile photo, reused in the verification pass) or one is added by some other means.
- **No `⌘K`/`⌘S` keyboard shortcuts, autosave-to-`localStorage`, or a `beforeunload` dirty-guard
  beyond `<EntityForm>`'s own** — doc07 §6 names all of these; `<EntityForm>` does implement a
  `beforeunload` guard while dirty, but the command palette and autosave-with-restore-prompt are
  not built. Noted as a gap in Phase 7's own report too; still not this phase's own task list.
- **No per-page component tests for the ~40 List/Create/Edit pages** — a deliberate scope choice
  (see §3), not an oversight, but it does mean a future field-mapping regression in one specific
  page (as opposed to a shared building block) would only be caught by typecheck/build/manual
  verification, not a fast automated test.
- **Bulk actions** (doc07 §2's List-screen description: "search · status filter · sort ·
  pagination · **bulk actions**") were not built for any module — every action (delete, publish,
  reorder) operates on one row at a time.

## 7. Blockers

**None.** Phase 9 (Media management) can start immediately — every `coverMediaId`/similar field
already has its wire format and UI slot ready; Phase 9's own picker only needs to replace the
plain numeric input, not introduce a new field. Phase 10 (Contact + messages) and Phase 11
(Search + command palette) are similarly unblocked: the Sidebar's `Messages` entry and the
`⌘K` palette both already have their intended slot, disabled/absent rather than half-built.
