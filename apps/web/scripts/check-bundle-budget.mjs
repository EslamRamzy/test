#!/usr/bin/env node
/**
 * Bundle budget check (docs/architecture/06 §9: "< 120 KB gzipped first-load
 * JS on public routes, checked in CI"). Run after `next build` —
 * `.next/diagnostics/route-bundle-stats.json` is Next's own per-route
 * accounting of exactly which JS chunks a route's first load requires; this
 * script gzips each of those real files from disk and sums them, rather than
 * trusting the stats file's own `firstLoadUncompressedJsBytes` (uncompressed
 * — the wrong unit for a "gzipped" budget) or approximating a compression
 * ratio.
 *
 * Only PUBLIC routes are budgeted, matching doc06 §9's own wording — the
 * admin is an authenticated tool, not a page a stranger's first visit needs
 * to stay lean for, and its own editors (markdown, tabbed forms) are already
 * the heaviest legitimate JS in the app.
 */
import { gzipSync } from 'node:zlib';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const WEB_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const BUDGET_BYTES = 120 * 1024;
const STATS_PATH = join(WEB_ROOT, '.next/diagnostics/route-bundle-stats.json');

function isPublicRoute(route) {
  return !route.startsWith('/admin') && route !== '/_not-found' && route !== '/_global-error';
}

function gzipSizeOf(chunkPath, cache) {
  const cached = cache.get(chunkPath);
  if (cached !== undefined) return cached;
  const bytes = readFileSync(join(WEB_ROOT, chunkPath));
  const size = gzipSync(bytes, { level: 9 }).length;
  cache.set(chunkPath, size);
  return size;
}

function main() {
  let stats;
  try {
    stats = JSON.parse(readFileSync(STATS_PATH, 'utf8'));
  } catch (error) {
    console.error(`Could not read ${STATS_PATH} — run "npm run build" first.\n${String(error)}`);
    process.exitCode = 1;
    return;
  }

  const gzipCache = new Map();
  const rows = stats
    .filter((route) => isPublicRoute(route.route))
    .map((route) => {
      const gzipBytes = route.firstLoadChunkPaths.reduce(
        (total, chunkPath) => total + gzipSizeOf(chunkPath, gzipCache),
        0,
      );
      return { route: route.route, gzipBytes };
    })
    .sort((a, b) => b.gzipBytes - a.gzipBytes);

  const overBudget = rows.filter((row) => row.gzipBytes > BUDGET_BYTES);

  console.log(
    `Public-route first-load JS, gzipped (budget: ${(BUDGET_BYTES / 1024).toFixed(0)} KB)\n`,
  );
  for (const row of rows) {
    const kb = (row.gzipBytes / 1024).toFixed(1);
    const flag = row.gzipBytes > BUDGET_BYTES ? '  OVER BUDGET' : '';
    console.log(`  ${kb.padStart(7)} KB  ${row.route}${flag}`);
  }

  if (overBudget.length > 0) {
    console.error(
      `\n${String(overBudget.length)} route(s) exceed the ${(BUDGET_BYTES / 1024).toFixed(0)} KB gzipped budget.`,
    );
    process.exitCode = 1;
    return;
  }

  console.log(`\nAll ${String(rows.length)} public routes are under budget.`);
}

main();
