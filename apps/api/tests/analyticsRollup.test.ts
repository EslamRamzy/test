import { afterEach, describe, expect, it } from 'vitest';
import { prisma } from '../src/config/prisma.js';
import {
  purgeOldPageViews,
  rollupDay,
  startOfUtcDay,
} from '../src/services/analyticsRollupService.js';

/**
 * doc09 §10 / doc11 Phase 13: "Raw `page_views` rows are rolled up nightly
 * into `analytics_daily` and deleted after 90 days." `fileParallelism:
 * false` (vitest.config.ts) means no other test file's rows exist in the
 * shared database while this one runs, so seeding at a fixed, arbitrary
 * historical day (nowhere near any other file's "now"-based data) is enough
 * isolation — no extra marker/tag needed the way `contact.test.ts` needs
 * one for a database other files' "recent" queries could otherwise see.
 */

const TEST_DAY = new Date('2024-06-15T00:00:00.000Z');
const NEXT_DAY = new Date('2024-06-16T00:00:00.000Z');
const PREV_DAY_VIEW = new Date('2024-06-14T23:59:59.999Z');

async function seedPageView(overrides: {
  path: string;
  createdAt: Date;
  visitorHash: string;
  entityType?: string;
  entityId?: number;
}) {
  return prisma.pageView.create({
    data: {
      path: overrides.path,
      entityType: overrides.entityType ?? null,
      entityId: overrides.entityId ?? null,
      referrerHost: null,
      visitorHash: overrides.visitorHash,
      createdAt: overrides.createdAt,
    },
  });
}

afterEach(async () => {
  await prisma.pageView.deleteMany({ where: { path: { startsWith: '/rollup-test' } } });
  await prisma.analyticsDaily.deleteMany({ where: { path: { startsWith: '/rollup-test' } } });
});

describe('rollupDay', () => {
  it('aggregates views + unique visitors per (path, entityType, entityId), scoped to exactly one UTC day', async () => {
    // Same path, 3 views, 2 distinct visitors — 1 repeats.
    await seedPageView({ path: '/rollup-test/a', createdAt: TEST_DAY, visitorHash: 'v1' });
    await seedPageView({
      path: '/rollup-test/a',
      createdAt: new Date(TEST_DAY.getTime() + 3600_000),
      visitorHash: 'v1',
    });
    await seedPageView({
      path: '/rollup-test/a',
      createdAt: new Date(TEST_DAY.getTime() + 7200_000),
      visitorHash: 'v2',
    });
    // A different group entirely — an entity-bearing project page.
    await seedPageView({
      path: '/rollup-test/projects/foo',
      createdAt: TEST_DAY,
      visitorHash: 'v3',
      entityType: 'PROJECT',
      entityId: 42,
    });
    // Boundary cases: one view just before the day starts, one exactly at
    // the day's own end (= the NEXT day's midnight) — neither belongs to
    // TEST_DAY's rollup; both prove the interval is `[dayStart, dayEnd)`,
    // not inclusive on the wrong side.
    await seedPageView({ path: '/rollup-test/a', createdAt: PREV_DAY_VIEW, visitorHash: 'v4' });
    await seedPageView({ path: '/rollup-test/a', createdAt: NEXT_DAY, visitorHash: 'v5' });

    const result = await rollupDay(TEST_DAY);

    expect(result.day).toBe(TEST_DAY.toISOString());
    expect(result.groupsWritten).toBe(2);

    const rowA = await prisma.analyticsDaily.findFirst({
      where: { day: TEST_DAY, path: '/rollup-test/a', entityType: null, entityId: null },
    });
    expect(rowA?.views).toBe(3);
    expect(rowA?.uniqueVisitors).toBe(2);

    const rowProject = await prisma.analyticsDaily.findFirst({
      where: {
        day: TEST_DAY,
        path: '/rollup-test/projects/foo',
        entityType: 'PROJECT',
        entityId: 42,
      },
    });
    expect(rowProject?.views).toBe(1);
    expect(rowProject?.uniqueVisitors).toBe(1);

    // The boundary views must never have been folded into TEST_DAY's count.
    expect(rowA?.views).not.toBe(4);
  });

  it('is idempotent — re-running the same day updates in place, never duplicates', async () => {
    await seedPageView({ path: '/rollup-test/b', createdAt: TEST_DAY, visitorHash: 'v1' });

    await rollupDay(TEST_DAY);
    // A second view lands before the re-run — the whole point of re-running
    // a day (a retried tick) is picking up whatever is there NOW.
    await seedPageView({
      path: '/rollup-test/b',
      createdAt: new Date(TEST_DAY.getTime() + 60_000),
      visitorHash: 'v2',
    });
    await rollupDay(TEST_DAY);

    const rows = await prisma.analyticsDaily.findMany({
      where: { day: TEST_DAY, path: '/rollup-test/b' },
    });
    expect(rows).toHaveLength(1);
    expect(rows[0]?.views).toBe(2);
    expect(rows[0]?.uniqueVisitors).toBe(2);
  });

  it('accepts any timestamp within the day, not just exact UTC midnight', async () => {
    await seedPageView({
      path: '/rollup-test/c',
      createdAt: new Date('2024-06-15T18:30:00.000Z'),
      visitorHash: 'v1',
    });

    await rollupDay(new Date('2024-06-15T09:15:00.000Z'));

    const row = await prisma.analyticsDaily.findFirst({
      where: { day: TEST_DAY, path: '/rollup-test/c' },
    });
    expect(row?.views).toBe(1);
  });
});

describe('startOfUtcDay', () => {
  it('truncates to UTC midnight regardless of the time-of-day component', () => {
    expect(startOfUtcDay(new Date('2024-06-15T23:59:59.999Z')).toISOString()).toBe(
      '2024-06-15T00:00:00.000Z',
    );
    expect(startOfUtcDay(new Date('2024-06-15T00:00:00.000Z')).toISOString()).toBe(
      '2024-06-15T00:00:00.000Z',
    );
  });
});

describe('purgeOldPageViews', () => {
  it('deletes rows older than the retention window and keeps everything else', async () => {
    const old = await seedPageView({
      path: '/rollup-test/purge-old',
      createdAt: new Date(Date.now() - 200 * 24 * 60 * 60 * 1000),
      visitorHash: 'v1',
    });
    const recent = await seedPageView({
      path: '/rollup-test/purge-recent',
      createdAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
      visitorHash: 'v2',
    });

    const result = await purgeOldPageViews(90);

    expect(result.deletedCount).toBeGreaterThanOrEqual(1);
    expect(await prisma.pageView.findUnique({ where: { id: old.id } })).toBeNull();
    expect(await prisma.pageView.findUnique({ where: { id: recent.id } })).not.toBeNull();
  });

  it('defaults to a 90-day window when called with no argument', async () => {
    const justOver90 = await seedPageView({
      path: '/rollup-test/purge-default',
      createdAt: new Date(Date.now() - 91 * 24 * 60 * 60 * 1000),
      visitorHash: 'v1',
    });

    await purgeOldPageViews();

    expect(await prisma.pageView.findUnique({ where: { id: justOver90.id } })).toBeNull();
  });
});
