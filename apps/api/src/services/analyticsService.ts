import type { AnalyticsAdminQuery, AnalyticsViewInput } from '@portfolio/shared';
import * as articleRepository from '../repositories/articleRepository.js';
import * as pageViewRepository from '../repositories/pageViewRepository.js';
import * as projectRepository from '../repositories/projectRepository.js';
import { hashIp } from '../utils/hashIp.js';

export interface AnalyticsContext {
  ip: string;
  userAgent: string | undefined;
}

/** Fire-and-forget page-view beacon (docs/architecture/03 §3, §09 §10) — no raw IP is ever stored, only its daily-rotating hash. */
export async function recordView(input: AnalyticsViewInput, ctx: AnalyticsContext): Promise<void> {
  await pageViewRepository.create({
    path: input.path,
    entityType: input.entityType,
    entityId: input.entityId,
    referrerHost: input.referrerHost,
    visitorHash: hashIp(ctx.ip, ctx.userAgent),
  });
}

// --- Admin (docs/architecture/03 §5: "GET /admin/analytics ?from,to,groupBy") -

const DEFAULT_RANGE_DAYS = 30;
const TOP_CONTENT_LIMIT = 10;

function resolveRange(query: AnalyticsAdminQuery): pageViewRepository.AnalyticsRange {
  const to = query.to ?? new Date();
  const from = query.from ?? new Date(to.getTime() - DEFAULT_RANGE_DAYS * 24 * 60 * 60 * 1000);
  return { from, to };
}

interface TopContentEntry {
  entityId: number;
  slug: string;
  title: string;
  views: number;
}

/** Joins page-view entity ids back to their current slug/title — a project or article can be renamed after the views it earned, so this always reflects the CURRENT title, not what it was called on the day of the view. An id with no matching row (the project/article was since deleted) is silently dropped. */
async function resolveTopContent(
  rows: pageViewRepository.TopContentRow[],
  lookup: (ids: number[]) => Promise<Array<{ id: number; slug: string; title: string }>>,
): Promise<TopContentEntry[]> {
  if (rows.length === 0) return [];
  const titles = await lookup(rows.map((row) => row.entityId));
  const titleById = new Map(titles.map((row) => [row.id, row]));
  const entries: TopContentEntry[] = [];
  for (const row of rows) {
    const match = titleById.get(row.entityId);
    if (match)
      entries.push({
        entityId: row.entityId,
        slug: match.slug,
        title: match.title,
        views: row.views,
      });
  }
  return entries;
}

export interface AnalyticsOverview {
  from: string;
  to: string;
  totalViews: number;
  uniqueVisitors: number;
  series: pageViewRepository.SeriesPoint[];
  topProjects: TopContentEntry[];
  topArticles: TopContentEntry[];
  topReferrerHosts: pageViewRepository.ReferrerHostRow[];
}

export async function getAnalyticsOverview(query: AnalyticsAdminQuery): Promise<AnalyticsOverview> {
  const range = resolveRange(query);

  const [totals, series, topProjectViews, topArticleViews, topReferrerHosts] = await Promise.all([
    pageViewRepository.findTotals(range),
    pageViewRepository.findSeries(range, query.groupBy),
    pageViewRepository.findTopContent(range, 'PROJECT', TOP_CONTENT_LIMIT),
    pageViewRepository.findTopContent(range, 'ARTICLE', TOP_CONTENT_LIMIT),
    pageViewRepository.findTopReferrerHosts(range, TOP_CONTENT_LIMIT),
  ]);

  const [topProjects, topArticles] = await Promise.all([
    resolveTopContent(topProjectViews, projectRepository.findTitlesByIds),
    resolveTopContent(topArticleViews, articleRepository.findTitlesByIds),
  ]);

  return {
    from: range.from.toISOString(),
    to: range.to.toISOString(),
    totalViews: totals.totalViews,
    uniqueVisitors: totals.uniqueVisitors,
    series,
    topProjects,
    topArticles,
    topReferrerHosts,
  };
}
