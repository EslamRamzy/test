#!/usr/bin/env node
/**
 * Verifies that the architectural ESLint rules actually fire.
 *
 * These rules are the enforcement mechanism for the layering contract in
 * docs/architecture/01 §5 and 08 §3 — a rule that only lives in a document gets
 * violated. But a lint rule that is silently inactive is worse than no rule at
 * all, because it looks like protection.
 *
 * This exists because of a real bug found in Phase 1: flat-config `rules`
 * entries override rather than merge, so a later block scoped to
 * `services/**` silently discarded the `@prisma/client` restriction set by an
 * earlier `apps/api/src/**` block. Everything still linted clean.
 *
 * Each case below writes a probe file that SHOULD be rejected, runs ESLint on
 * it, and fails if the expected rule did not report.
 */
import { execFileSync } from 'node:child_process';
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

/** @type {{name: string, file: string, source: string, rule: string}[]} */
const cases = [
  {
    name: 'services may not import Prisma',
    file: 'apps/api/src/services/__lint_probe.ts',
    source: "import { PrismaClient } from '@prisma/client';\nexport const probe = PrismaClient;\n",
    rule: 'no-restricted-imports',
  },
  {
    name: 'services may not import express',
    file: 'apps/api/src/services/__lint_probe_http.ts',
    source: "import express from 'express';\nexport const probe = express;\n",
    rule: 'no-restricted-imports',
  },
  {
    name: 'middleware may not import Prisma',
    file: 'apps/api/src/middleware/__lint_probe.ts',
    source: "import { PrismaClient } from '@prisma/client';\nexport const probe = PrismaClient;\n",
    rule: 'no-restricted-imports',
  },
  {
    name: 'controllers may not import Prisma',
    file: 'apps/api/src/controllers/__lint_probe_prisma.ts',
    source: "import { PrismaClient } from '@prisma/client';\nexport const probe = PrismaClient;\n",
    rule: 'no-restricted-imports',
  },
  {
    name: 'controllers may not import repositories',
    file: 'apps/api/src/controllers/__lint_probe.ts',
    source:
      "import { findAll } from '../repositories/projectRepository.js';\nexport const probe = findAll;\n",
    rule: 'no-restricted-imports',
  },
  {
    name: 'public controllers may not import admin repository functions',
    file: 'apps/api/src/controllers/public/__lint_probe.ts',
    source:
      "import { findAnyByIdForAdmin } from '../../repositories/projectRepository.js';\nexport const probe = findAnyByIdForAdmin;\n",
    rule: 'no-restricted-syntax',
  },
  {
    name: 'components may not import the API client',
    file: 'apps/web/src/components/__lint_probe.tsx',
    source:
      "import { getProject } from '@/lib/api/publicClient';\nexport const probe = getProject;\n",
    rule: 'no-restricted-imports',
  },
  {
    name: 'dangerouslySetInnerHTML is confined to the markdown renderer',
    file: 'apps/web/src/components/__lint_probe_html.tsx',
    source:
      "export const Probe = () => <div dangerouslySetInnerHTML={{ __html: '<b>x</b>' }} />;\n",
    rule: 'no-restricted-syntax',
  },
];

/** Runs ESLint on one file and returns its reported rule ids. */
function rulesReportedFor(file) {
  try {
    execFileSync('npx', ['eslint', '--format', 'json', '--no-warn-ignored', file], {
      cwd: root,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    return [];
  } catch (error) {
    // ESLint exits non-zero when it reports errors; the JSON is still on stdout.
    const stdout = error.stdout ?? '';
    if (!stdout.trim().startsWith('[')) {
      throw new Error(`ESLint failed to run on ${file}:\n${error.stderr ?? error.message}`, {
        cause: error,
      });
    }
    return JSON.parse(stdout).flatMap((result) => result.messages.map((message) => message.ruleId));
  }
}

let failed = 0;

for (const testCase of cases) {
  const absolute = join(root, testCase.file);
  mkdirSync(dirname(absolute), { recursive: true });
  writeFileSync(absolute, testCase.source);

  try {
    const reported = rulesReportedFor(testCase.file);
    if (reported.includes(testCase.rule)) {
      console.log(`  ok   ${testCase.name}`);
    } else {
      failed += 1;
      console.error(
        `  FAIL ${testCase.name}\n       expected rule "${testCase.rule}", got [${reported.join(', ') || 'none'}]`,
      );
    }
  } finally {
    rmSync(absolute, { force: true });
  }
}

if (failed > 0) {
  console.error(`\n${failed} architectural lint rule(s) are not active.`);
  process.exit(1);
}

console.log(`\nAll ${cases.length} architectural lint rules are active.`);
