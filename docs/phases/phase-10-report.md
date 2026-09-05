# Phase 10 Report — Contact + Messages

**Status: complete.** Report format per brief §56.

---

## 1. What was implemented

The public contact pipeline (doc09 §8) was already fully built in an earlier phase — validation,
the 3/hour/IP rate limit, the honeypot field, the timing check, and a generic success response
regardless of outcome all pre-date this phase and needed no new work, confirmed by reading
`contactService.ts`/`contact.routes.ts`/`ContactForm.tsx` before starting. Phase 10's actual scope
was the two halves doc11's own task list called out as missing: the SMTP admin-notification email,
and the entire admin-side inbox (doc03 §5, doc07 §3).

| Area | Delivered |
|---|---|
| Backend — SMTP | `config/env.ts` gained five optional `EMAIL_*` fields (`HOST`/`PORT`/`USER`/`PASSWORD`/`FROM`) — a blank or absent `EMAIL_HOST` IS the "SMTP disabled" state, with no separate feature-flag boolean; `lib/mail.ts`'s `sendContactNotification()` builds `from`/`to`/`replyTo`/`subject` entirely through nodemailer's own structured `sendMail()` options (never a hand-built header string), catches every internal failure, and returns `boolean` rather than throwing — `contactService.ts` awaits it directly after persisting the message, so a slow or failing mail server can never turn a real submission into a user-visible error |
| Backend — admin messages module | `messageRepository.ts`/`messageService.ts`/`messageController.ts`/`routes/admin/messages.routes.ts` — hand-written, not `adminCrudFactory.ts`: there is no `create` at all (a row only ever arrives via the public form) and the only mutation is a fixed `UNREAD`/`READ`/`ARCHIVED` transition, never a free-form update. `readAt` is stamped on transition INTO `READ`, cleared on transition INTO `UNREAD`, and left untouched on transition INTO `ARCHIVED`. Every transition and every delete writes a verb-shaped audit action (`MESSAGE_MARK_READ`/`MESSAGE_MARK_UNREAD`/`MESSAGE_ARCHIVE`/`MESSAGE_DELETE`) |
| Backend — routes | Exactly doc03 §5's three endpoints: `GET /admin/messages` (`status`/`q`/`page` filters), `PATCH /admin/messages/:id/status`, `DELETE /admin/messages/:id` — CSRF-protected on both mutations, authorized per `message:read`/`update`/`delete` |
| Shared package | `MESSAGE_STATUSES`/`MessageStatus` (pre-existing), `ContactMessageAdminRow` DTO, `messageStatusUpdateSchema`, `messageAdminListQuerySchema` |
| Frontend — API client | `features/admin/messages/client.ts` — bespoke, matching `features/admin/media/client.ts`'s own reasoning; every status-change and delete mutation invalidates both its own list query AND `['admin', 'overview']`, the single query the Sidebar's unread badge and the Dashboard's counters both already read from |
| Frontend — Messages Inbox page | `/admin/messages` — search + status filter, a scrollable message list (unread rows bold, with an Unread/Read/Archived badge), and a detail pane that opens on click, auto-marks an `UNREAD` message `READ` the moment it's opened, and offers Mark read/unread, Archive, Delete (typed-confirmation using the sender's email — messages have no title to type), and a `mailto:` reply link (no in-app reply-sending, per doc07 §3). Below `lg`, the detail pane replaces the list entirely rather than sitting beside it, with its own back button |
| Sidebar | Messages flipped to `enabled: true` — the badge itself (`useOverview()`'s `unreadMessagesCount`) was already wired from Phase 7's own forward-looking preparation; this was a one-line change |
| Verification | A real Chromium (Playwright) pass against a live API + Next dev server, including a REAL unreachable-SMTP-host connection attempt (not mocked) proving the public submission still succeeds and is still persisted — see §3 |

## 2. Files created / modified

```
apps/api/src/config/env.ts                       + optionalTrimmedString helper, 5 EMAIL_* fields (+test)
apps/api/src/lib/mail.ts (+test)                                          new
apps/api/src/services/contactService.ts           + awaits sendContactNotification after persist
apps/api/.env.example                             SMTP comment updated (no longer "not yet read")
apps/api/package.json                             + nodemailer ^10.0.0 (patched; v9 and below carry
                                                     multiple high-severity CVEs — found via npm audit
                                                     on the default install, fixed before use)
apps/api/src/repositories/messageRepository.ts                           new
apps/api/src/services/messageService.ts                                  new
apps/api/src/controllers/admin/messageController.ts                      new
apps/api/src/routes/admin/messages.routes.ts                             new
apps/api/src/app.ts                               mount messages.routes
apps/api/tests/adminMessages.test.ts                                     new — 7 tests

packages/shared/src/schemas/message.ts (+test)                            new
packages/shared/src/schemas/query.ts              + messageAdminListQuerySchema (+test)
packages/shared/src/types/adminContent.ts         + ContactMessageAdminRow
packages/shared/src/index.ts                      + export schemas/message.js

apps/web/src/features/admin/messages/client.ts                           new — bespoke, not the generic factory
apps/web/src/app/(admin)/admin/messages/page.tsx (+test)                  new — the Messages Inbox
apps/web/src/features/admin/components/Sidebar.tsx    Messages enabled
apps/web/src/styles/_components.scss              + admin-messages-inbox* rules

apps/api/src/repositories/mediaRepository.ts, services/mediaService.ts,
  controllers/admin/mediaController.ts, routes/admin/media.routes.ts      addendum — see §4 item 1
packages/shared/src/schemas/media.ts (+test)                              addendum — see §4 item 1
apps/web/src/features/admin/media/client.ts, app/(admin)/admin/media/page.tsx
                                                                           addendum — see §4 item 1
apps/api/tests/adminMedia.test.ts                                        + 1 test (14 total)
```

## 3. Testing performed

- **Unit/integration (automated, part of the gate).** 759 tests passing at the end of the phase
  (170 `@portfolio/shared`, 437 `@portfolio/api`, 152 `@portfolio/web`) — up from Phase 9's
  161/423/146. `mail.test.ts` mocks `nodemailer` and asserts the notification's `from`/`to`/`replyTo`/
  `subject` are built entirely from structured `sendMail()` fields — including a dedicated test that
  injects a raw CRLF sequence (`"Hi\r\nBcc: attacker@evil.example"`) into the subject and confirms it
  reaches nodemailer's own `subject` option unmodified, proving the header-injection defence is
  nodemailer's field encoding, not any sanitization in this codebase — and a test proving
  `sendContactNotification` resolves `false`, never throws, when the transport rejects.
  `adminMessages.test.ts` covers list/filter/search, the full `UNREAD → READ → UNREAD` transition
  (asserting `readAt` is stamped then cleared, with the matching `MESSAGE_MARK_READ`/
  `MESSAGE_MARK_UNREAD` audit rows in order), archiving, a rejected out-of-enum status value, a 404
  for a nonexistent message, and delete with its own audit entry. The new `messages/page.test.tsx`
  exercises the Inbox directly (there is no separate extracted component the way `<MediaPicker>` is
  for Media) — empty state, unread badges scoped per-row (not confused with the status-filter
  dropdown's own "Unread" option text), status filtering, archiving, delete gated behind typed email
  confirmation, and the `mailto:` link's exact `href`.
- **Architectural lint rules** (`npm run lint:rules`): all 8 rules stayed green through every commit.
- **Real stack, real browser** (Chromium via Playwright, not simulated) — the Phase 10 exit
  criterion itself, against a freshly bootstrapped dev database and a live API dev server configured
  with a deliberately unreachable `EMAIL_HOST` (`smtp.invalid.example`) so the "email failure never
  fails the request" claim was proven against a real failed connection attempt, not a mock:
  - Filled out and submitted the real public `/contact` form (waiting past the 3-second timing-check
    floor first) and confirmed the generic "Thanks — your message has been sent" success message —
    while the API log, checked afterward, shows a real `WARN mail: failed to send the contact
    notification` for that same submission. The submission was not blocked or slowed by the failure.
  - Logged in as the freshly-bootstrapped admin (through the forced first-login password change),
    landed on `/admin`, and confirmed the Sidebar's Messages badge showed exactly 1 unread — the
    real `useOverview()` count, not a placeholder.
  - Opened `/admin/messages`, found the new message by searching its subject, and confirmed it showed
    the Unread badge and the correct sender name.
  - Clicked the row: the detail pane opened showing the full message body, and — with no separate
    action — the message's status flipped to `READ` (the pane's own action button changed from
    "Mark read" to "Mark unread") and the Sidebar's badge dropped from 1 to 0 on the next page load.
  - From the detail pane: marked it unread, then read again, then archived it — confirmed it then
    appeared when filtering the list to "Archived" and disappeared once the filter cleared to "All"
    only because the search box still scoped to its own subject.
  - Deleted it: confirmed the Confirm button stays disabled until the sender's exact email is typed
    into the confirmation dialog, enables once it matches, and the message is gone from every search
    afterward.
  - Queried the audit log directly afterward and confirmed the full ordered trail: two
    `MESSAGE_MARK_READ` rows a few milliseconds apart for the initial auto-mark-read (React 18/19
    Strict Mode's dev-only double-invoke of the effect — confirmed by `next.config.ts`'s own explicit
    `reactStrictMode: true` — not a bug; the mutation is idempotent and Strict Mode never double-
    invokes in a production build), then `MESSAGE_MARK_UNREAD`, `MESSAGE_MARK_READ`,
    `MESSAGE_ARCHIVE`, and `MESSAGE_DELETE`, each exactly once outside the initial double-fire.
  - 20 of 20 scripted assertions passed in the final run.

## 4. Problems found and fixed

Ordered as found. Every one below was caught by something real — a failing test, a real npm audit
finding, or a real browser/API session — never reasoned about and left unverified.

1. **Re-reading doc03 §5 before starting this phase surfaced two real API-contract gaps in the
   already-shipped Phase 9 media module.** `mediaUpdateSchema` required `altText` on every PATCH,
   with no way to change `kind` at all — doc03 documents both fields as independently optional. Fixed
   as a bounded addendum before starting Phase 10's own work: `mediaRepository.updateAltText` became
   `update(id, data)` (using the existing `stripUndefined()` helper against Prisma's own rejection of
   an explicit `undefined`-valued key), a new dedicated `GET /admin/media/:id/usages` endpoint was
   added (doc03 documents usage as its own endpoint, not folded into the read response), and the
   Media Library page gained an inline kind-reclassification `<Form.Select>` per card. Consistent with
   this session's standing rule: a real, documented conformance gap gets closed as soon as it's
   found, not left for "later" just because the current phase's main deliverable is elsewhere.
2. **`nodemailer`'s default-installed version (9.x) carries multiple high-severity CVEs** — SMTP
   command injection, CRLF header injection via the Transport name and via `List-*` header comments,
   `jsonTransport` bypassing `disableFileAccess`/`disableUrlAccess`, improper TLS certificate
   validation, and a raw-option SSRF bypass — found immediately via `npm audit` after the initial
   install, directly on-topic for this phase's own mail-header-injection concern (doc09 §8). Fixed by
   pinning `nodemailer@^10.0.0` (the patched major version) instead, and removing the now-redundant
   `@types/nodemailer` package once confirmed v10 ships its own bundled `.d.ts` files.
3. **Mocking `config/env.ts` in `mail.test.ts` broke `logger.ts`** with "No 'isProduction' export is
   defined on the mock" — `mail.ts` imports `logger.ts`, which reads other `env` exports beyond the
   five new `EMAIL_*` fields, and a full-replacement mock only supplied those five. Fixed with the
   `importOriginal` pattern (spread `actual.env`, override only the fields the test needs) rather than
   hand-listing every field `logger.ts` happens to read.
4. **A stale bootstrap admin password blocked the very first login attempt during E2E
   verification.** The dev-preview SQLite file this phase's `.env` pointed to still carried a changed
   password from an earlier phase's own verification pass (confirmed via a direct `curl` login attempt
   returning `401 Invalid email or password` before any browser was involved) — not a Phase 10 bug,
   but it meant the scripted browser pass needed to handle the forced first-login password-change
   redirect (`/admin/change-password`) rather than assume a direct `/admin` landing. Fixed by
   re-running migrations and the bootstrap script against a fresh database file for this phase's own
   verification pass, and updating the E2E script to go through the real change-password flow.
5. A handful of smaller fixes caught by the compiler or linter directly, same as every prior phase:
   `mail.ts`'s `createTransport()` initially read `env.EMAIL_HOST` inside its own body, which
   `exactOptionalPropertyTypes` correctly flagged since the function's caller (not TypeScript) is what
   actually guarantees it's defined by that point — fixed by making `host: string` a required
   parameter, narrowed by the one caller before ever invoking it; an `import()` type used inline in a
   test violated `consistent-type-imports` — fixed with a named `import type * as EnvModule`; an
   `eslint-disable-next-line react-hooks/exhaustive-deps` comment in the new Inbox page referenced a
   rule this project has never enabled (confirmed by running eslint directly, which reported
   "Definition for rule ... was not found") — removed rather than left as a dead, misleading comment.

## 5. Technical decisions

| Decision | Rationale |
|---|---|
| `messageRepository.ts`/`messageService.ts`/`messageController.ts` are NOT built on `adminCrudFactory.ts` | There is no `create` at all (a row only ever arrives via the public contact form) and the only mutation is a fixed three-value status transition, never a free-form update — the generic factory's shape doesn't fit, same reasoning as Media's own hand-written module |
| A blank/absent `EMAIL_HOST` IS the "SMTP disabled" state, with no separate boolean flag | Matches `bootstrap.ts`'s pre-existing blank-`ADMIN_NAME` convention exactly; a second flag that could disagree with whether `EMAIL_HOST` is actually set would be a real footgun for no benefit |
| The admin-notification recipient is `EMAIL_USER ?? EMAIL_FROM`, with no separate "notify" address env var | No such variable exists in the documented `.env.example`, and this project has exactly one admin — the SMTP account's own mailbox is the only sensible destination |
| `sendContactNotification()` is awaited directly in `contactService.ts`, not fire-and-forgotten | It never throws (every internal failure is caught and turned into a `false` return), so awaiting it only sequences the attempt without risking the caller's own success path — mirrors the pre-existing `revalidateTags()` helper's identical contract |
| `readAt` is left untouched on a transition INTO `ARCHIVED` | An archived message's read history doesn't change just because it left the inbox — only `READ`/`UNREAD` transitions are about read state at all |
| The Messages Inbox's detail pane holds the full selected row as local state, kept current via the mutation's own success callback, rather than deriving "selected" from the live filtered list | The list is filtered by status; marking an `UNREAD` message read while the "Unread" filter is active would otherwise make the row vanish from the underlying query the instant the auto-mark-read effect resolves, snapping the pane shut before the visitor had a chance to read it |
| Delete's typed-confirmation uses the sender's email, not a "title" | A contact message has no title field to type — the email is the closest unique, human-typeable identifier a visitor would recognize, same spirit as every other module's confirm-by-title convention |
| The Messages Inbox page is bespoke, not `<AdminResourceListPage>` | doc03 defines no single-message `GET` endpoint — the "detail pane" is a second view of the same row the list already fetched, not a page navigation the way every other module's `/[id]` edit route is |

## 6. Known gaps

- **No in-app reply-sending** — doc07 §3 explicitly scopes this to v1: the only reply mechanism is
  the `mailto:` link, which hands off to the admin's own mail client. A real in-app reply (composing
  and sending a response through the same SMTP configuration) is out of scope until a future phase
  revisits it, if ever.
- **No bulk message actions** (bulk archive, bulk delete) — matches every other module's own noted
  gap; messages follow the same one-row-at-a-time pattern.
- **No dedicated component-level extraction for the Messages Inbox** the way `<MediaPicker>` is for
  Media — the whole inbox (list, filters, detail pane) lives in one page file and is tested directly
  at that level, since doc07 §3 does not call for reusing any of its pieces (a detail pane, a status
  toggle) anywhere else the way a media picker is reused across a dozen unrelated forms.
- **The real SMTP-success path (a message actually delivered by a real mail server) was not
  exercised end-to-end** — this sandbox has no outbound SMTP access to verify against, only a
  deliberately-failing connection attempt (see §3). The success path itself is covered by
  `mail.test.ts`'s mocked assertions of the exact fields passed to `sendMail()`.

## 7. Blockers

**None.** Phase 10 (Contact + messages) is complete: the public contact pipeline persists every
submission regardless of SMTP outcome, an admin is notified by email when SMTP is configured and
reachable, and the admin inbox supports the full doc07 §3 workflow (unread/read/archived, a detail
pane, mark read/unread, archive, delete, `mailto:` reply) with a complete audit trail. Every module
in doc07 §51's 14-item Sidebar list is now enabled. Phase 11 (Search + command palette) can start
immediately.
