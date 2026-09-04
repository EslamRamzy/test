import type { AdminOverviewDto } from '@portfolio/shared';
import { countAllForAdmin as countAllArticlesForAdmin } from '../repositories/articleRepository.js';
import { findRecent as findRecentAuditLogs } from '../repositories/auditLogRepository.js';
import { countUnreadForAdmin } from '../repositories/contactMessageRepository.js';
import { countAllForAdmin as countAllProjectsForAdmin } from '../repositories/projectRepository.js';
import { countOpenForAdmin } from '../repositories/securityFindingRepository.js';

const RECENT_ACTIVITY_LIMIT = 10;

/**
 * `GET /admin/overview` (docs/architecture/03 §3, docs/architecture/07 §3:
 * "Counter cards (§21), recent activity from audit logs"). Every counter is
 * a live `COUNT(*)` over ALL statuses — unlike the public `/stats`
 * endpoint's published-only counts — computed fresh on every call, per doc
 * 07 §6's "No fake data: every counter is a real query".
 *
 * The specific four counters (projects, articles, unread messages, open
 * findings) are this implementation's own reading of "counter cards" —
 * doc 07 names the CONCEPT, not the exact metric set, the same kind of
 * documented interpretation `statsService.ts` already made for the public
 * `/stats` endpoint.
 */
export async function getOverview(): Promise<AdminOverviewDto> {
  const [projectsCount, articlesCount, unreadMessagesCount, openFindingsCount, recentLogs] =
    await Promise.all([
      countAllProjectsForAdmin(),
      countAllArticlesForAdmin(),
      countUnreadForAdmin(),
      countOpenForAdmin(),
      findRecentAuditLogs(RECENT_ACTIVITY_LIMIT),
    ]);

  return {
    projectsCount,
    articlesCount,
    unreadMessagesCount,
    openFindingsCount,
    recentActivity: recentLogs.map((log) => ({
      id: log.id,
      action: log.action,
      entityType: log.entityType,
      entityId: log.entityId,
      actorName: log.user?.name ?? null,
      createdAt: log.createdAt.toISOString(),
    })),
  };
}
