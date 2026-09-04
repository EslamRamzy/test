/**
 * Admin API response shapes (docs/architecture/03 §3, docs/architecture/07).
 * Counterpart to `publicContent.ts` — see that file's header for why these
 * are plain interfaces, not Zod schemas: they describe trusted,
 * server-authoritative OUTPUT the service layer already built correctly,
 * not untrusted input needing runtime validation.
 *
 * This file starts small on purpose — only the shapes Phase 7 (Admin
 * shell) actually needs. The full admin CRUD DTOs (one per module) arrive
 * with Phase 8, alongside the endpoints that return them.
 */

/**
 * `GET /admin/overview`'s counter cards (docs/architecture/07 §3: "Counter
 * cards (§21)") — every count is a real `COUNT(*)` over ALL statuses
 * (unlike the public `/stats` endpoint, which only counts published rows),
 * computed fresh on every call.
 */
export interface AdminOverviewDto {
  projectsCount: number;
  articlesCount: number;
  unreadMessagesCount: number;
  openFindingsCount: number;
  recentActivity: AuditLogEntryDto[];
}

export interface AuditLogEntryDto {
  id: number;
  action: string;
  entityType: string | null;
  entityId: number | null;
  /** Null when the acting user has since been deleted (`onDelete: SetNull`) or the action had no actor (e.g. a failed login attempt). */
  actorName: string | null;
  createdAt: string;
}
