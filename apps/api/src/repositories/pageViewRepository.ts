import { prisma } from '../config/prisma.js';

/**
 * Admin analytics reads (docs/architecture/03 §5: "?from,to,groupBy —
 * page/project/article views, top content"; doc07 §3: "Views over time, top
 * projects, top articles, referrer hosts"). Raw SQL for the date-bucketed
 * series only — the same exception `searchRepository.ts`'s own header
 * documents (Prisma's query builder has no GROUP-BY-truncated-date
 * primitive); every value interpolated below is a bound `$queryRaw`
 * parameter, never spliced into the SQL text, including the `strftime`
 * format string itself (chosen from the fixed `groupBy` enum, but bound
 * the same safe way regardless).
 *
 * `analytics_daily` is now populated (Phase 13's nightly rollup,
 * `analyticsRollupService.ts`), but the admin overview above still reads
 * directly from raw `page_views` rather than the rollup table — the same
 * "don't build ahead of need" reasoning as before: a portfolio site's own
 * traffic volume doesn't yet justify a second query path, and `page_views`
 * stays complete for the full 90-day retention window the rollup honours.
 * A future switch to reading `analytics_daily` is still a fine idea once
 * volume actually calls for it; `aggregateForDay` below exists purely to
 * feed rows INTO that table, not to read them back out of it.
 *
 * Every `created_at` comparison below wraps BOTH sides in SQLite's own
 * `datetime()` — a real, verified bug (found while testing Phase 13's
 * rollup, which compares against exact day boundaries far more often than
 * the admin dashboard's own `from`/`to` ever line up with a real row): the
 * SQLite column is stored as TEXT ending in `+00:00` (confirmed directly —
 * `SELECT typeof(created_at), CAST(created_at AS TEXT) ...`), but
 * `Date.prototype.toISOString()` produces a `Z`-suffixed string instead.
 * Lexicographically, `'+00:00'` sorts BEFORE `'Z'`, so a plain `created_at
 * >= '...Z'` string comparison silently EXCLUDES a row whose timestamp is
 * exactly equal to the bound, and a plain `created_at <= '...Z'` silently
 * INCLUDES a row that lands exactly on the NEXT interval's own start —
 * every boundary is off by one string-sort position in exactly the wrong
 * direction. `datetime(...)` on both sides normalises the format before
 * comparing, which is unaffected by which ISO8601 UTC suffix either side
 * happens to use.
 */

const STRFTIME_FORMAT: Record<'day' | 'week' | 'month', string> = {
  day: '%Y-%m-%d',
  week: '%Y-W%W',
  month: '%Y-%m',
};

export interface AnalyticsRange {
  from: Date;
  to: Date;
}

interface RawSeriesRow {
  bucket: string;
  views: bigint;
  unique_visitors: bigint;
}

export interface SeriesPoint {
  bucket: string;
  views: number;
  uniqueVisitors: number;
}

export async function findSeries(
  range: AnalyticsRange,
  groupBy: 'day' | 'week' | 'month',
): Promise<SeriesPoint[]> {
  const format = STRFTIME_FORMAT[groupBy];
  const rows = await prisma.$queryRaw<RawSeriesRow[]>`
    SELECT strftime(${format}, created_at) AS bucket,
           COUNT(*) AS views,
           COUNT(DISTINCT visitor_hash) AS unique_visitors
    FROM page_views
    WHERE datetime(created_at) >= datetime(${range.from.toISOString()})
      AND datetime(created_at) <= datetime(${range.to.toISOString()})
    GROUP BY bucket
    ORDER BY bucket ASC
  `;
  return rows.map((row) => ({
    bucket: row.bucket,
    views: Number(row.views),
    uniqueVisitors: Number(row.unique_visitors),
  }));
}

export async function findTotals(
  range: AnalyticsRange,
): Promise<{ totalViews: number; uniqueVisitors: number }> {
  const rows = await prisma.$queryRaw<[{ views: bigint; unique_visitors: bigint }]>`
    SELECT COUNT(*) AS views, COUNT(DISTINCT visitor_hash) AS unique_visitors
    FROM page_views
    WHERE datetime(created_at) >= datetime(${range.from.toISOString()})
      AND datetime(created_at) <= datetime(${range.to.toISOString()})
  `;
  const row = rows[0];
  return { totalViews: Number(row?.views ?? 0), uniqueVisitors: Number(row?.unique_visitors ?? 0) };
}

interface RawTopContentRow {
  entity_id: bigint;
  views: bigint;
}

export interface TopContentRow {
  entityId: number;
  views: number;
}

export async function findTopContent(
  range: AnalyticsRange,
  entityType: 'PROJECT' | 'ARTICLE',
  limit: number,
): Promise<TopContentRow[]> {
  const rows = await prisma.$queryRaw<RawTopContentRow[]>`
    SELECT entity_id, COUNT(*) AS views
    FROM page_views
    WHERE datetime(created_at) >= datetime(${range.from.toISOString()})
      AND datetime(created_at) <= datetime(${range.to.toISOString()})
      AND entity_type = ${entityType} AND entity_id IS NOT NULL
    GROUP BY entity_id
    ORDER BY views DESC
    LIMIT ${limit}
  `;
  return rows.map((row) => ({ entityId: Number(row.entity_id), views: Number(row.views) }));
}

interface RawReferrerRow {
  referrer_host: string;
  views: bigint;
}

export interface ReferrerHostRow {
  referrerHost: string;
  views: number;
}

export async function findTopReferrerHosts(
  range: AnalyticsRange,
  limit: number,
): Promise<ReferrerHostRow[]> {
  const rows = await prisma.$queryRaw<RawReferrerRow[]>`
    SELECT referrer_host, COUNT(*) AS views
    FROM page_views
    WHERE datetime(created_at) >= datetime(${range.from.toISOString()})
      AND datetime(created_at) <= datetime(${range.to.toISOString()})
      AND referrer_host IS NOT NULL
    GROUP BY referrer_host
    ORDER BY views DESC
    LIMIT ${limit}
  `;
  return rows.map((row) => ({ referrerHost: row.referrer_host, views: Number(row.views) }));
}

export interface CreatePageViewInput {
  path: string;
  entityType: 'PROJECT' | 'ARTICLE' | 'RESEARCH' | 'PAGE' | undefined;
  entityId: number | undefined;
  referrerHost: string | undefined;
  visitorHash: string;
}

export function create(input: CreatePageViewInput) {
  return prisma.pageView.create({
    data: {
      path: input.path,
      entityType: input.entityType ?? null,
      entityId: input.entityId ?? null,
      referrerHost: input.referrerHost ?? null,
      visitorHash: input.visitorHash,
    },
  });
}

interface RawDailyAggregateRow {
  path: string;
  entity_type: string | null;
  entity_id: number | null;
  views: bigint;
  unique_visitors: bigint;
}

export interface DailyAggregateRow {
  path: string;
  entityType: string | null;
  entityId: number | null;
  views: number;
  uniqueVisitors: number;
}

/**
 * The nightly rollup's own read (doc09 §10 — "Raw `page_views` rows are
 * rolled up nightly into `analytics_daily`"): every distinct (path,
 * entityType, entityId) group that had at least one view within
 * `[dayStart, dayEnd)` — a half-open interval so a view landing exactly on
 * `dayEnd` (the next day's own midnight) is never double-counted between
 * two adjacent days.
 */
export async function aggregateForDay(dayStart: Date, dayEnd: Date): Promise<DailyAggregateRow[]> {
  const rows = await prisma.$queryRaw<RawDailyAggregateRow[]>`
    SELECT path, entity_type, entity_id,
           COUNT(*) AS views,
           COUNT(DISTINCT visitor_hash) AS unique_visitors
    FROM page_views
    WHERE datetime(created_at) >= datetime(${dayStart.toISOString()})
      AND datetime(created_at) < datetime(${dayEnd.toISOString()})
    GROUP BY path, entity_type, entity_id
  `;
  return rows.map((row) => ({
    path: row.path,
    entityType: row.entity_type,
    entityId: row.entity_id === null ? null : Number(row.entity_id),
    views: Number(row.views),
    uniqueVisitors: Number(row.unique_visitors),
  }));
}

/** The purge half of the same retention rule — "deleted after 90 days" (doc09 §10). Returns the count actually removed, for the rollup job's own log line. */
export async function deleteOlderThan(cutoff: Date): Promise<number> {
  const result = await prisma.pageView.deleteMany({ where: { createdAt: { lt: cutoff } } });
  return result.count;
}
