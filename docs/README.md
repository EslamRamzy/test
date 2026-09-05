# Eslam Ramzy — Portfolio Platform · Documentation

> **Status: Phase 13 of 16 complete** — analytics + audit UI. "Research first" found that most of
> doc11 Phase 13's own deliverable list was already shipped, ahead of schedule, as part of Phase 8's
> "Settings, Profile, Audit Logs, Analytics endpoints/pages": the schema, the beacon endpoint, both
> admin read endpoints, the daily-rotating salted-hash IP scheme, and both admin UI pages. What
> genuinely did not exist: the beacon fetcher was dead code (built, never called by a single public
> page); nothing populated `analytics_daily` at all (no rollup job existed); and `ENABLE_ANALYTICS`,
> documented since Phase 1, was read nowhere. This phase closed exactly those three gaps —
> `<AnalyticsBeacon>` now renders on all 12 public pages, a nightly rollup + 90-day purge job runs in
> `server.ts`, and the env flag actually gates collection — plus found and fixed a real, pre-existing
> bug along the way: `pageViewRepository.ts`'s raw SQL date comparisons silently mis-included/excluded
> rows landing exactly on a range boundary (a `+00:00` vs. `Z` UTC-suffix string-comparison mismatch),
> fixed with SQLite's own `datetime()` normalisation across all five affected queries. Both new exit
> criteria — "no raw IP anywhere in the database" and "audit viewer has no write path" — are now
> asserted by test, not just inspected by reading the code, and the rollup/purge was verified against
> real seeded data spanning the 90-day retention boundary, not just mocked. See the
> [Phase 13 report](phases/phase-13-report.md), the
> [Phase 12 report](phases/phase-12-report.md), the
> [Phase 11 report](phases/phase-11-report.md), and the
> [Amber Signal redesign report](design/amber-signal-redesign.md). Phase 14 (Testing hardening) is
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
| 10 | [Contact + messages](phases/phase-10-report.md) |
| 11 | [Search + command palette](phases/phase-11-report.md) |
| 12 | [SEO, performance, accessibility, CSP](phases/phase-12-report.md) |
| 13 | [Analytics + audit UI](phases/phase-13-report.md) |

## Design

| Document | Purpose |
|---|---|
| [Amber Signal redesign](design/amber-signal-redesign.md) | Approved visual identity applied to the Phase 6 public site — tokens, components, real bugs found and fixed |

## How to review

1. Read **00** first — it lists everything I found wrong, missing, or ambiguous in the brief.
2. Read **12** for the decisions taken and the few still open.
3. Everything between 01 and 11 is the design, corrected in place as implementation revealed real
   issues (each correction is marked inline, e.g. doc 02's Prisma 7 driver-adapter note).
