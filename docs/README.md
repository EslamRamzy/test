# Eslam Ramzy — Portfolio Platform · Documentation

> **Status: Phase 6 of 16 complete** — the full public website (all 12 routes, the 10 homepage
> sections, the case-study renderer, the sanitized markdown pipeline, light/dark theming with no
> flash) renders entirely from the real Phase 5 API, zero hardcoded content. Lighthouse ≥ 90 on
> Performance/Accessibility/Best Practices/SEO (three of four at 100 on `/projects`; the one
> non-100 elsewhere traces to a disposable test-environment gap, not a code defect — see the
> report) and axe reports zero violations across all 12 routes in both themes. See the
> [Phase 6 report](phases/phase-06-report.md). Phase 7 (Admin shell) is unblocked. No open
> decisions remain that block current work — see
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

## How to review

1. Read **00** first — it lists everything I found wrong, missing, or ambiguous in the brief.
2. Read **12** for the decisions taken and the few still open.
3. Everything between 01 and 11 is the design, corrected in place as implementation revealed real
   issues (each correction is marked inline, e.g. doc 02's Prisma 7 driver-adapter note).
