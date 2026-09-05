import * as analyticsDailyRepository from '../repositories/analyticsDailyRepository.js';
import * as pageViewRepository from '../repositories/pageViewRepository.js';

/**
 * The nightly rollup + purge doc09 §10 / doc11 Phase 13 describe: "Raw
 * `page_views` rows are rolled up nightly into `analytics_daily` and
 * deleted after 90 days." Kept as plain, directly-testable functions with
 * no timer of their own — `jobs/scheduler.ts` is the only thing that calls
 * `runNightlyRollup()` on a schedule, and it is wired into `server.ts`
 * alone (never `app.ts`), so nothing here needs fake-timer gymnastics in
 * tests: a test just calls these functions directly, the same way it would
 * any other service.
 */

const RETENTION_DAYS = 90;

/** UTC midnight for whatever calendar day `date` falls on — the rollup's own day boundary, and the unit every `analytics_daily.day` value is stored in. */
export function startOfUtcDay(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

export interface RollupDayResult {
  day: string;
  groupsWritten: number;
}

/**
 * Aggregates one UTC calendar day's `page_views` into `analytics_daily`.
 * Idempotent by construction — re-running for a day that already has rows
 * recomputes the same groups from the same raw data and `upsert`s over the
 * existing rows rather than accumulating duplicates, so a rollup that runs
 * twice (a retried cron tick, a manual re-run after fixing a bug) is always
 * safe.
 */
export async function rollupDay(day: Date): Promise<RollupDayResult> {
  const dayStart = startOfUtcDay(day);
  const dayEnd = new Date(dayStart.getTime() + 24 * 60 * 60 * 1000);

  const groups = await pageViewRepository.aggregateForDay(dayStart, dayEnd);

  for (const group of groups) {
    await analyticsDailyRepository.upsert({
      day: dayStart,
      path: group.path,
      entityType: group.entityType,
      entityId: group.entityId,
      views: group.views,
      uniqueVisitors: group.uniqueVisitors,
    });
  }

  return { day: dayStart.toISOString(), groupsWritten: groups.length };
}

export interface PurgeResult {
  cutoff: string;
  deletedCount: number;
}

/** Deletes raw `page_views` rows older than the retention window — independent of the rollup above, so old data a nightly run somehow missed still ages out on schedule. */
export async function purgeOldPageViews(
  retentionDays: number = RETENTION_DAYS,
): Promise<PurgeResult> {
  const cutoff = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000);
  const deletedCount = await pageViewRepository.deleteOlderThan(cutoff);
  return { cutoff: cutoff.toISOString(), deletedCount };
}

export interface NightlyRollupResult {
  rollup: RollupDayResult;
  purge: PurgeResult;
}

/**
 * What actually runs once a night: yesterday's own UTC day (the last day
 * guaranteed to be fully complete regardless of what time the job runs),
 * then the 90-day purge. Rolling up "yesterday" specifically — not "today
 * so far" — means a page view recorded an hour before the job runs is never
 * rolled up into a partial, still-growing day.
 */
export async function runNightlyRollup(now: Date = new Date()): Promise<NightlyRollupResult> {
  const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const rollup = await rollupDay(yesterday);
  const purge = await purgeOldPageViews();
  return { rollup, purge };
}
