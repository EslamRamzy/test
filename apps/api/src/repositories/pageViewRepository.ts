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
 * There is deliberately no read from `analytics_daily` here — nothing in
 * this codebase populates that rollup table yet (no cron/job infrastructure
 * exists for it), so querying it would just return empty. Computing
 * directly from `page_views` is correct today and is what "don't build
 * ahead of need" (doc's own recurring principle, e.g. `rateLimit.ts`'s
 * upload-limiter deferral) argues for; a future rollup job could populate
 * `analytics_daily` and this file would switch to reading it once the
 * volume actually justifies it.
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
    WHERE created_at >= ${range.from.toISOString()} AND created_at <= ${range.to.toISOString()}
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
    WHERE created_at >= ${range.from.toISOString()} AND created_at <= ${range.to.toISOString()}
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
    WHERE created_at >= ${range.from.toISOString()} AND created_at <= ${range.to.toISOString()}
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
    WHERE created_at >= ${range.from.toISOString()} AND created_at <= ${range.to.toISOString()}
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
