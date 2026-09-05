# Eslam Ramzy — Portfolio Platform · Documentation

> **Status: Phase 9 of 16 complete** — the media library: a secure upload pipeline (magic-byte type
> detection via `file-type`, never the client `Content-Type` or filename; a five-type allow-list;
> `sharp` re-encode that auto-orients from EXIF and then strips it along with every other metadata
> block), `GET /uploads/:filename` as the one place bytes are served (correct headers, an admin
> session bypassing the "published content only" access rule everyone else gets), a
> `<MediaPicker>` shared building block, and a full Media Library admin page (grid, drag-drop
> upload, kind filter, alt-text editing, on-demand usage lookup, reference-blocked deletion). Every
> `coverMediaId`/`certificateMediaId`/`avatarMediaId`/`resumeMediaId`/gallery-image field Phase 8
> shipped as a plain numeric-id input — a documented gap in that phase's own report — now uses the
> picker. Verified against a real browser and a real API: an image uploaded inline through
> `<MediaPicker>` while creating a project renders on the published public page via `next/image`;
> deletion is blocked while referenced and succeeds once it isn't; the profile photo is replaceable
> from Settings; a real audit trail exists for upload/update/delete. A schema gap was fixed along
> the way (see the phase report §4) — Security Research covers had no fitting `Media.kind` before
> this phase; `RESEARCH_COVER` was added to the enum and the CHECK constraint. See the
> [Phase 9 report](phases/phase-09-report.md), the
> [Phase 8 report](phases/phase-08-report.md), the
> [Phase 7 report](phases/phase-07-report.md), and the
> [Amber Signal redesign report](design/amber-signal-redesign.md). Phase 10 (Contact + messages) is
> unblocked. No open decisions remain that block current work — see
> [12](architecture/12-decisions-pending-approval.md) for the small number still open (including D12,
> two-factor authentication — proposed, never approved, not implemented), none of which gate the
> next phase.

## Documents

| # | Document | Purpose |
|---|---|---|
| 00 | [Architecture Review](architecture/00-architecture-review.md) | Requirements review, conflicts found, gaps, assumptions |
| 01 | [System Architecture](architecture/01-system-architecture.md) | Components, runtime topology, request flows, deployment |
| 02 | [Database Architecture](architecture/02-database-architecture.md) | ERD, entity relationships, full schema, indexes, migrations |
| 03 | [API Architecture](architecture/03-api-architecture.md) | REST conventions, response envelope, full endpoint catalogue |
| 04 | [Authentication Architecture](architecture/04-authentication-architecture.md) | JWT, refresh rotation, cookies, session lifecycle |
| 05 | [Authorization Architecture](architecture/05-authorization-architecture.md) | RBAC model, enforcement points, ownership rules |
| 06 | [Frontend Architecture](architecture/06-frontend-architecture.md) | Next.js App Router, rendering strategy, design system |
| 07 | [Admin Architecture](architecture/07-admin-architecture.md) | Dashboard structure, module pattern, editorial workflow |
| 08 | [Folder Structure](architecture/08-folder-structure.md) | Monorepo layout and rationale for deviations |
| 09 | [Security Architecture](architecture/09-security-architecture.md) | Threat model, controls, secrets, hardening baseline |
| 10 | [Testing Strategy](architecture/10-testing-strategy.md) | Test pyramid, tooling, coverage targets, security testing |
| 11 | [Implementation Plan](architecture/11-implementation-plan.md) | 16 phases, deliverables, exit criteria |
| 12 | [Decisions](architecture/12-decisions-pending-approval.md) | Decisions taken (D1, D2, D3, D8) + **what is still open** |

## Phase reports

| Phase | Report |
|---|---|
| 1 | [Project setup](phases/phase-01-report.md) |
| 2 | [Database + migrations](phases/phase-02-report.md) |
| 3 | [Backend foundation](phases/phase-03-report.md) |
| 4 | [Authentication + authorization](phases/phase-04-report.md) |
| 5 | [Public API](phases/phase-05-report.md) |
| 6 | [Public website](phases/phase-06-report.md) |
| 7 | [Admin shell](phases/phase-07-report.md) |
| 8 | [Content management](phases/phase-08-report.md) |
| 9 | [Media management](phases/phase-09-report.md) |

## Design

| Document | Purpose |
|---|---|
| [Amber Signal redesign](design/amber-signal-redesign.md) | Approved visual identity applied to the Phase 6 public site — tokens, components, real bugs found and fixed |

## How to review

1. Read **00** first — it lists everything I found wrong, missing, or ambiguous in the brief.
2. Read **12** for the decisions taken and the few still open.
3. Everything between 01 and 11 is the design, corrected in place as implementation revealed real
   issues (each correction is marked inline, e.g. doc 02's Prisma 7 driver-adapter note).
