# Phase 9 Report — Media Management

**Status: complete.** Report format per brief §56.

---

## 1. What was implemented

Every deliverable in docs/architecture/11's Phase 9 list: the upload endpoint with the full doc09
§7 control set, `sharp` re-encode + EXIF strip, the media library UI, `<MediaPicker>` integration
across every module that references a `Media` row, alt text, usage tracking, reference-blocked
deletion, and static serving with correct headers.

| Area | Delivered |
|---|---|
| Backend — upload pipeline | `lib/mediaProcessing.ts` — real magic-byte type detection (`file-type`, never the client `Content-Type` or filename), an allow-list of exactly five types (JPEG/PNG/WebP/AVIF/PDF), a `sharp` re-encode that auto-orients from EXIF and then discards it along with every other metadata block, `lib/mediaUpload.ts` (multer, memory storage, size-limited, one file per request), `lib/uploadPath.ts` |
| Backend — media repository + service | `mediaRepository.ts` (list/filter/search, usage lookup across all six referencing relations, public-visibility check, storage total), `mediaService.ts` (upload orchestration with checksum-dedup and a storage-exhaustion check before write, update, reference-blocked delete) — deliberately NOT built on `adminCrudFactory.ts`, same reasoning as Projects' own bespoke services |
| Backend — routes | `POST/GET/PATCH/DELETE /admin/media`, all CSRF-protected, rate-limited (the `upload` bucket doc09 §4 always specified, 20/hour, finally mounted), authorized per `media:read`/`upload`/`update`/`delete` |
| Backend — static serving | `GET /uploads/:filename` — the ONLY place a file's bytes are served; `Content-Type` from the STORED value, `nosniff`, `Content-Disposition: attachment` for a PDF vs `inline` for an image; access control: an authenticated admin session bypasses entirely (previewing a draft's own cover), everyone else only gets a file referenced by published content (or the profile's always-public avatar/résumé, or a visible certification) — the same "draft leakage rule" 404 (never 403) for both "doesn't exist" and "not yet public" |
| Backend — schema fix | `RESEARCH_COVER` added to `MEDIA_KINDS` and the `media.kind` CHECK constraint — Security Research covers had no fitting kind before this phase |
| Frontend — `<MediaPicker>` | The shared building block doc07 §2 names ("modal browser over the media library + inline upload + alt-text prompt") — a trigger + thumbnail, a modal with a drag-drop zone, kind filter, search, a paginated grid, and an inline pending-upload step (local preview, alt-text field, confirm) before the file is actually POSTed |
| Frontend — Media Library page | `/admin/media` — grid, drag-drop upload, filter by kind, inline alt-text editing, an on-demand usage list per item, and reference-blocked deletion (the server's own 409 message surfaces directly; a typed-confirm dialog guards the delete either way) |
| Frontend — retrofit | Every `coverMediaId`/`certificateMediaId`/`avatarMediaId`/`resumeMediaId`/gallery-image field that Phase 8 shipped as a plain numeric-id text input (a documented gap in that phase's own report) now uses `<MediaPicker>`: Certifications, Articles, Security Research, Projects (cover + gallery, the gallery panel also gained real thumbnails), Profile (avatar + résumé) |
| Sidebar | Media flipped to `enabled: true` — the last of doc07 §51's 14 modules besides Messages (Phase 10) |
| Verification | A real Chromium (Playwright) pass against a live API + Next dev server: uploaded an image directly through the library, uploaded another inline through `<MediaPicker>` while creating a project, published that project and confirmed the cover renders on the public site via `next/image`/`/uploads/*`, confirmed deletion is blocked while referenced and succeeds once it isn't, confirmed the profile page's avatar/résumé pickers, and confirmed a real audit trail for upload and delete — see §3 |

## 2. Files created / modified

```
apps/api/src/config/env.ts                       + UPLOAD_DIR, MAX_UPLOAD_BYTES
apps/api/src/lib/{mediaProcessing,mediaUpload,uploadPath}.ts (+tests)     new
apps/api/src/repositories/mediaRepository.ts                              new
apps/api/src/services/mediaService.ts (+test)                            new
apps/api/src/controllers/admin/mediaController.ts                        new
apps/api/src/routes/admin/media.routes.ts                                new
apps/api/src/routes/uploads.routes.ts                                    new — GET /uploads/:filename
apps/api/src/middleware/rateLimit.ts              + uploadLimiter (20/hour, doc09 §4)
apps/api/src/app.ts                               mount media.routes + uploads.routes
apps/api/tests/adminMedia.test.ts                                        new — 13 tests
apps/api/vitest.config.ts                         + UPLOAD_DIR test env var (its own .tmp dir)
apps/api/prisma/schema.prisma, prisma/migrations/20260904015904_init/migration.sql
                                                   + RESEARCH_COVER to the media.kind CHECK
package.json (api)                                + sharp, multer, file-type, @types/multer

packages/shared/src/schemas/media.ts (+test)                              new
packages/shared/src/schemas/query.ts              + mediaAdminListQuerySchema (+test)
packages/shared/src/constants/content.ts          + RESEARCH_COVER to MEDIA_KINDS
packages/shared/src/types/adminContent.ts         + MediaUsageRef

apps/web/src/lib/api/adminClient.ts               + mutateFormData (multipart uploads, no forced JSON content-type)
apps/web/src/lib/api/adminResource.ts             + export buildQueryString (reused by the media client)
apps/web/src/features/admin/media/client.ts                              new — bespoke, not the generic factory
apps/web/src/features/admin/components/MediaPicker.tsx (+test)           new
apps/web/src/app/(admin)/admin/media/page.tsx                            new — the Media Library
apps/web/src/features/admin/components/Sidebar.tsx    Media enabled
apps/web/src/features/admin/{certifications,articles,securityResearch,projects}/*Fields.tsx,
  app/(admin)/admin/profile/page.tsx                  retrofitted onto <MediaPicker>
apps/web/src/features/admin/projects/ProjectMediaPanel.tsx    real thumbnails + <MediaPicker> for gallery adds
apps/web/src/styles/_components.scss              + admin-media-picker*, admin-media-library* rules
```

## 3. Testing performed

- **Unit/integration (automated, part of the gate).** 730 tests passing at the end of the phase
  (161 `@portfolio/shared`, 423 `@portfolio/api`, 146 `@portfolio/web`) — up from Phase 8's
  148/390/141. `mediaProcessing.test.ts` builds real fixture bytes with `sharp` itself (a solid-
  color PNG, a JPEG carrying a real EXIF orientation tag and a GPS field) rather than asserting
  against hand-crafted byte literals, and proves the EXIF-strip claim by reading the OUTPUT back
  through `sharp(...).metadata()` and asserting no `exif` key and no `orientation` key remain, with
  the auto-orient itself proven by the output's swapped width/height. `adminMedia.test.ts` is a
  real-HTTP integration suite covering doc10 §4's named upload matrix (valid image; `.php`/SVG/a
  disguised PE executable rejected; a doctored `Content-Type` header on a genuine PNG still
  succeeds — proving the pipeline never reads it; an oversized file rejected with `413`; a
  directory-traversal filename sanitised to a safe `originalName`), plus list/search/kind-filter,
  alt-text update, reference-blocked deletion (409, then success once unreferenced), and audit
  entries for upload/update/delete. A dedicated `describe('GET /uploads/:filename')` block covers
  the static route's own access control: 404 for a nonexistent file, 404 for an unauthenticated
  request to a file no published content references yet, 200 with the correct headers for the same
  request once its owning project is published, and 200 unconditionally for an authenticated admin
  regardless of publish state.
- **Architectural lint rules** (`npm run lint:rules`): all 8 rules stayed green through every
  commit.
- **Real stack, real browser** (Chromium via Playwright, not simulated) — the Phase 9 exit
  criterion itself, against a freshly bootstrapped + seeded dev database (a corrected
  `RESEARCH_COVER` media kind meant the applied migration had to be regenerated from scratch):
  - Logged in as the real bootstrap admin, went through the forced first-login password change,
    and confirmed the bootstrap profile photo (`prisma/bootstrap.ts`'s own seeded `Media` row) was
    already visible in `/admin/media`.
  - Uploaded a real PNG directly through the Media Library's drag-drop input and confirmed it
    appeared in the grid.
  - Created a new Project, opened `<MediaPicker>` on its cover-image field, uploaded a second real
    PNG inline (with alt text) without leaving the Create form, and confirmed the picker closed and
    the field held the new media id.
  - Added a technology, saved the case-study body, and published the project — the readiness check
    (cover + ≥1 technology + case-study content) passed on the first attempt.
  - Confirmed `/projects/{slug}` renders the cover image through `next/image` (an `<img>` with the
    exact alt text set during upload), served from `/uploads/*` on the API origin.
  - Attempted to delete the cover's `Media` row while the published project still referenced it —
    blocked with a 409 whose message named the referencing project, surfaced directly in the admin
    UI. Unpublished and deleted the project, then deleted the media row again — this time it
    succeeded (`remaining=0` cards for that search).
  - Confirmed `/admin/profile` offers `<MediaPicker>` for both the avatar and résumé fields.
  - Confirmed `/admin/audit-logs`, filtered to `entityType=MEDIA`, shows `Media upload` and
    `Media delete` entries for every action taken, each attributed to the real admin actor.
  - 18 of 18 assertions passed in the final run. Two of the failures along the way were real,
    useful signal, not test noise: an *actually correct* `409 still referenced` response the first
    few iterations kept tripping over because repeated debug runs reused the same fixture bytes
    (checksum-deduped to the same `Media` row) across several never-cleaned-up draft projects, and
    a self-defeating assertion that checked the page no longer mentioned a filename which the
    success TOAST itself repeated back (`"{name} deleted."`) — both diagnosed from screenshots
    taken at each step, not guessed at.

## 4. Problems found and fixed

Ordered as found. Every one below was caught by something real — a failing test, a real
TypeScript error, a real browser session, or a real 429 from the rate limiter — never reasoned
about and left unverified.

1. **`SecurityResearch` covers had no fitting `Media.kind`.** `MEDIA_KINDS` had `PROJECT_COVER` and
   `ARTICLE_COVER` but nothing for Security Research, confirmed by reading the migration's own CHECK
   constraint. Added `RESEARCH_COVER` to the shared constant and the constraint (a schema
   correction, not a new feature) — safe pre-launch (this project has never deployed; Phase 16 is
   the first production deploy) and consistent with the project's own single-init-migration
   convention to date.
2. **The upload dev/test directories needed their own isolation, the same way the DB file already
   had one.** `vitest.config.ts`'s test env only pinned `DATABASE_URL` to a `.tmp/` file before this
   phase — an upload test with no `UPLOAD_DIR` override would have written real files into
   `apps/api/uploads/`, a developer's own local dev store, on every CI run. Fixed by adding a
   dedicated `.tmp/vitest-uploads` test env var, mirroring the DB file's own reasoning exactly.
3. **`<EntityForm>`'s established string-form/number-wire pattern extended cleanly to
   `<MediaPicker>`, but needed a `Controller` bridge everywhere.** Every retrofitted field
   (`coverMediaId` etc.) is still a string on the form (Phase 8's `optionalPositiveIntStringSchema`
   convention, unchanged) while `<MediaPicker>` itself deals in real `number | null` — solved with a
   `Controller` wrapping the picker at each of the five call sites, converting `field.value` to
   `Number(...)` going in and back to `String(...)` going out, rather than changing the form schema
   or the picker's own contract to meet halfway.
4. **A checksum-dedup feature masked itself as a test bug, twice, during E2E verification.**
   `mediaService.upload`'s dedup-by-checksum (reusing an existing row for identical bytes, the same
   convention `prisma/bootstrap.ts` already established) is a real, intentional feature — but it
   meant every debug iteration's fixture upload (identical PNG bytes each time) kept returning the
   SAME `Media` row, and every iteration's own never-cleaned-up draft project kept a real reference
   to it. The resulting `409 still referenced by: P9 Verification Project` (repeated six times) was
   the CORRECT behavior given six real references, not a bug — diagnosed from a screenshot showing
   the actual toast text, then fixed by cleaning up the stray rows directly and giving each new
   fixture upload distinct pixel content going forward so unrelated test runs never collide again.
5. **A self-defeating test assertion**: `!bodyText.includes('p9-test-cover')` was meant to prove
   the file was gone from the library, but the DELETE SUCCESS toast itself reads
   `"p9-test-cover.png deleted."` — containing the exact substring the assertion searched for.
   Fixed by asserting on the actual DOM signal (zero `.admin-media-library__card` elements) instead
   of a body-text substring search, the same lesson `adminMedia.test.ts`'s own real-bytes-over-
   headers tests already apply: assert the real signal, not a proxy for it.
6. **The Project tabbed editor's Overview/Case-Study/Security tabs share ONE underlying form**
   (the `Project` row itself), confirmed by reading `[id]/page.tsx`: saving from ANY of those three
   tabs submits the whole row and redirects to the project list — same as Create — while
   Technologies/Media are genuinely separate relational sub-resources with their own endpoints and
   no redirect. The E2E script's first few iterations assumed a per-tab independent save (an
   incorrect assumption about how Phase 8 built this, not a Phase 9 bug) and had to be corrected to
   re-open the project after saving Case Study before continuing to the Technologies tab.
7. **The real `auth:login` rate limiter (5 attempts / 15 min / IP, doc09 §4) fired during
   iterative debugging** — a genuine, working security control, not a bug, confirmed by the exact
   `429`/`Retry-After` response and the login form's own "Too many attempts" message. Worked around
   during verification by restarting the API dev process between iterations (resets the in-memory
   store) and by short-circuiting the E2E script's own redundant first login attempt once the
   bootstrap password was already known to have changed, rather than disabling or loosening the
   limiter to make debugging more convenient.
8. **`prisma/bootstrap.ts`'s own upload-path resolution mishandled an absolute `UPLOAD_DIR`** — a
   real bug affecting the actual production configuration (`docker-compose.yml`'s `/data/uploads`,
   decision D3), found via a stray `apps/api/tmp/dev-preview-uploads/` directory that appeared
   after running bootstrap against this phase's own `.env` (which also sets an absolute path).
   `join(process.cwd(), env.UPLOAD_DIR)` — unlike `resolve()` — does not treat an absolute second
   argument as "start over from root"; it concatenates, landing the profile photo at
   `<cwd>/data/uploads` instead of `/data/uploads`. Predates this phase (`bootstrap.ts` is Phase 2),
   but this phase's own `lib/uploadPath.ts` already had to get this exact case right for
   `mediaService.ts`/the static route, and the same fix (`resolve` instead of `join`) applies here
   too — found and fixed rather than left as a latent bug now that the codebase actually exercises
   an absolute `UPLOAD_DIR` value in a phase's own verification pass for the first time.
9. A handful of smaller fixes caught the same way as every prior phase: `multer`'s own thrown
   errors are not `AppError` instances and would otherwise fall through to a masked generic 500 —
   wrapped in `mediaUploadMiddleware` to map `LIMIT_FILE_SIZE` to a real `413` and anything else to a
   `400` with a field-level message; `req.params['filename']`'s Express-5 type is
   `string | string[]`, narrowed explicitly before the repository lookup; Express 5's `ParamsDictionary`
   surfaced the same union-type shape the static route's filename param needed guarding against.

## 5. Technical decisions

| Decision | Rationale |
|---|---|
| `mediaRepository.ts`/`mediaService.ts` are NOT built on `adminCrudFactory.ts` | `create` is a real file upload with side effects (magic-byte validation, a disk write, checksum dedup), not a plain insert, and `remove` must check five other tables for a reference first — the generic factory's shape doesn't fit either, same reasoning as Projects' own bespoke tabbed-editor services |
| The Media Library page (`/admin/media`) is NOT built on `<AdminResourceListPage>` | Every other resource is a row of named fields edited on its own `/[id]` page; Media has no such fields beyond alt text, and its "create" is a file upload with no form to route to — the whole module lives on one page with its own grid, dropzone, and inline actions instead |
| `GET /uploads/:filename` is a hand-written route, not `express.static` | doc09 §7's exact header set (`Content-Type` from the STORED value, `nosniff`, a conditional `Content-Disposition`) needs per-request logic `express.static` doesn't expose cleanly, and the access-control check (admin bypass vs. published-only) has no equivalent in a static file server at all |
| The static route's access control re-implements a lightweight, non-throwing JWT check rather than reusing `middleware/authenticate.ts` | `authenticate` throws `UnauthenticatedError` on a missing/invalid token — exactly wrong here, where a missing/invalid token should fall through to the public-visibility check rather than reject the request |
| Storage-exhaustion cap is a hardcoded 5 GiB constant, not env-configurable | A personal-portfolio VPS volume, not a multi-tenant service — proportionate to doc09 §7's requirement ("a total-storage check before write") without inventing a new environment variable for a number that will not change in practice |
| The Media Library's own upload defaults every file to `kind: 'OTHER'` | The library page has no per-upload "what is this for" context the way a `<MediaPicker>` embedded in a specific field does (which already knows its own kind) — an admin can reclassify by re-uploading through the right field's picker if a specific kind matters, or simply leave it `OTHER` |
| `<MediaPicker>`'s own upload defaults to the field's `kind`, with no way to change it before uploading | Matches the field it's embedded in (a cover picker's upload is always going to become a cover) — the Media Library's own generic upload is the place to pick an arbitrary kind, not this one |
| Usage is shown on-demand (a "View usage" toggle per card, or the delete failure's own message), not an always-visible column | Avoids an N+1 usage query per row on the list view — the two moments an admin actually needs it (deciding whether to delete, or curiosity about a specific file) are exactly when it's fetched |
| `<MediaPicker>`'s upload accepts PDF (for `RESUME`) alongside images | The same allow-list `mediaProcessing.ts` enforces server-side — the field `accept` attribute is a UX nicety, not a second source of truth for what's actually allowed |

## 6. Known gaps

- **No jest-axe unit-level accessibility assertions on `<MediaPicker>`** — doc10 §4 names
  `jest-axe` for component tests, but this codebase has never actually installed or used it for any
  component in any phase (Phase 7/8's own axe verification ran via Playwright + axe-core against a
  real browser instead); adding it for this one component alone would be inconsistent with every
  other shared building block's own test file. `<MediaPicker>`'s real-browser accessibility (focus,
  keyboard reachability, contrast) was exercised as part of the Phase 9 E2E pass, not asserted by a
  dedicated automated a11y test.
- **No bulk media actions** (bulk delete, bulk re-kind) — matches Phase 8's own noted gap for
  every other module; media follows the same one-row-at-a-time pattern.
- **A media row that becomes orphaned by a failed mid-upload crash (file written, DB insert then
  fails) is not swept by any cleanup job** — documented as an accepted, cheap, self-healing
  consequence of writing the file before the DB row (`mediaService.ts`'s own comment): a retry with
  the same bytes reuses the same generated filename, and nothing ever references the stray file.
- **The 5 GiB storage cap is checked against the raw upload size, not the final re-encoded size** —
  conservative (the final size is usually smaller after re-compression), never wrong in the unsafe
  direction, but means the cap is not checked with byte-for-byte final precision.

## 7. Blockers

**None.** Phase 10 (Contact + messages) can start immediately — the Sidebar's `Messages` entry
already has its slot, disabled rather than half-built, matching every other not-yet-built module's
own convention. Media management's own doc11 exit criterion is fully met: the upload security
tests pass (type, magic bytes, size, traversal, SVG rejection all covered in `adminMedia.test.ts`
and `mediaProcessing.test.ts`), `next/image` renders uploads on the public site, and the profile
photo is replaceable from Settings through the same `<MediaPicker>` every other field uses.
