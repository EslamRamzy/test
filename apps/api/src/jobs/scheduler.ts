import { runNightlyRollup } from '../services/analyticsRollupService.js';

/**
 * The one background job this API runs (doc09 §10 / Phase 13's "nightly
 * rollup + 90-day purge"). Deliberately NOT `node-cron` or any job-queue
 * library — a single daily task needs neither cron-expression parsing nor
 * persistence across restarts, and a plain `setInterval` is exactly as
 * reliable for that as a heavier dependency would be on a single-instance
 * deployment (doc01's own topology — no worker pool, no queue broker). "Run
 * once at boot, then every 24h from boot time" rather than "wait for local
 * midnight" is the same reasoning: this site's traffic does not need
 * calendar-precise rollup timing, and boot-relative scheduling is simpler
 * to reason about and to test.
 *
 * Wired into `server.ts` ALONE, never `app.ts` — `app.ts`'s `createApp()`
 * is what every test in this repo imports (`tests/*.test.ts`,
 * `services/*.test.ts`), so a job started there would fire during every
 * test run, racing real test data with a real rollup/purge. Keeping it out
 * of `createApp()` entirely means the job simply never exists in a test
 * process, and `runNightlyRollup()` itself — the part that actually matters
 * — stays a plain, directly-callable, directly-testable function with no
 * timer of its own to fake.
 */
const ONE_DAY_MS = 24 * 60 * 60 * 1000;

export interface Scheduler {
  stop: () => void;
}

/**
 * A failed rollup must never crash the process — this is best-effort
 * housekeeping, not a request in flight. Logged and retried on the next
 * tick rather than surfaced anywhere a real visitor would see it.
 */
async function runOnce(): Promise<void> {
  try {
    const result = await runNightlyRollup();
    // eslint-disable-next-line no-console -- replaced by the pino logger in Phase 3; this file predates that migration for the same reason server.ts's own console calls do
    console.log(
      `Analytics rollup: ${String(result.rollup.groupsWritten)} group(s) for ${result.rollup.day}, ` +
        `purged ${String(result.purge.deletedCount)} page_views row(s) older than ${result.purge.cutoff}`,
    );
  } catch (error) {
    // eslint-disable-next-line no-console -- see above
    console.error('Analytics rollup failed — will retry on the next scheduled tick', error);
  }
}

/** Starts the scheduler and returns a handle to stop it (used by server.ts's own shutdown handler). */
export function startAnalyticsRollupScheduler(): Scheduler {
  void runOnce();
  const interval = setInterval(() => void runOnce(), ONE_DAY_MS);
  return { stop: () => clearInterval(interval) };
}
