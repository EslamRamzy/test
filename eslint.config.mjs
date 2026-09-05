import js from '@eslint/js';
import prettier from 'eslint-config-prettier';
import globals from 'globals';
import tseslint from 'typescript-eslint';

/**
 * Flat config `rules` entries OVERRIDE rather than merge, so a later block that
 * sets `no-restricted-imports` silently discards an earlier one. Every
 * api-scoped block must therefore re-state this restriction explicitly.
 */
const NO_DIRECT_PRISMA = {
  name: '@prisma/client',
  message: 'Only repositories may access Prisma. Go through a repository module.',
};

/**
 * Flat ESLint config for the whole monorepo.
 *
 * The architectural import rules in the second half are the point of this file.
 * A layering rule that only lives in a document gets violated; these fail CI
 * instead (docs/architecture/08 §3).
 */
export default tseslint.config(
  {
    ignores: [
      '**/node_modules/**',
      '**/dist/**',
      '**/.next/**',
      '**/coverage/**',
      '**/*.tsbuildinfo',
      'apps/api/prisma/migrations/**',
    ],
  },

  js.configs.recommended,
  ...tseslint.configs.recommended,

  {
    languageOptions: {
      ecmaVersion: 2023,
      sourceType: 'module',
      globals: { ...globals.node },
    },
    rules: {
      'no-console': 'error',
      eqeqeq: ['error', 'always', { null: 'ignore' }],
      'no-implicit-coercion': 'error',
      'prefer-const': 'error',
      'object-shorthand': 'error',
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
      '@typescript-eslint/consistent-type-imports': [
        'error',
        { prefer: 'type-imports', fixStyle: 'inline-type-imports' },
      ],
    },
  },

  // ---------------------------------------------------------------------------
  // Security-relevant rules
  // ---------------------------------------------------------------------------
  {
    files: ['apps/web/src/**/*.{ts,tsx}'],
    languageOptions: {
      globals: { ...globals.browser, ...globals.node },
    },
    rules: {
      // XSS review surface: raw HTML injection is confined to the single
      // markdown renderer, which is exempted below (docs/architecture/09 §6).
      'no-restricted-properties': [
        'error',
        {
          object: 'window',
          property: 'eval',
          message: 'eval is forbidden.',
        },
      ],
      'no-restricted-syntax': [
        'error',
        {
          selector: 'JSXAttribute[name.name="dangerouslySetInnerHTML"]',
          message:
            'dangerouslySetInnerHTML is only permitted in src/lib/markdown/render.tsx, which sanitises its input.',
        },
      ],
    },
  },
  {
    files: ['apps/web/src/lib/markdown/**/*.tsx'],
    rules: { 'no-restricted-syntax': 'off' },
  },

  // ---------------------------------------------------------------------------
  // Backend layering (docs/architecture/01 §5)
  // ---------------------------------------------------------------------------
  {
    // Only repositories may reach the ORM. Keeps data access auditable in one
    // layer and keeps a future PostgreSQL move to a single directory.
    files: ['apps/api/src/**/*.ts'],
    ignores: ['apps/api/src/repositories/**', 'apps/api/src/config/prisma.ts'],
    rules: {
      'no-restricted-imports': ['error', { paths: [NO_DIRECT_PRISMA] }],
    },
  },
  {
    // Services hold business logic and must stay HTTP-agnostic, so they can be
    // unit-tested without constructing a request.
    files: ['apps/api/src/services/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          paths: [
            NO_DIRECT_PRISMA,
            {
              name: 'express',
              message: 'Services must not know about HTTP. Map requests in a controller.',
            },
          ],
          patterns: [
            {
              group: ['**/controllers/**', '**/routes/**'],
              message: 'Services must not depend on the HTTP layer.',
            },
          ],
        },
      ],
    },
  },
  {
    // Controllers map HTTP to services; putting queries here bypasses the
    // service layer's transactions, authorization checks and audit logging.
    files: ['apps/api/src/controllers/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          paths: [NO_DIRECT_PRISMA],
          patterns: [
            {
              group: ['**/repositories/**'],
              message: 'Controllers must call services, never repositories directly.',
            },
          ],
        },
      ],
    },
  },
  {
    // Structural protection against draft leakage: the admin-only repository
    // functions are named *ForAdmin and are unreachable from public routes
    // (docs/architecture/05 §5).
    files: ['apps/api/src/controllers/public/**/*.ts', 'apps/api/src/routes/public/**/*.ts'],
    rules: {
      'no-restricted-syntax': [
        'error',
        {
          selector: 'ImportSpecifier[imported.name=/ForAdmin$/]',
          message:
            'Public code must not import admin repository functions — they do not filter by status.',
        },
      ],
    },
  },

  // ---------------------------------------------------------------------------
  // Frontend layering: components render, they do not fetch.
  // ---------------------------------------------------------------------------
  {
    files: ['apps/web/src/components/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['**/lib/api/**', '@/lib/api/*'],
              message:
                'Components must not fetch. Pass data in from a Server Component or a feature hook.',
            },
          ],
        },
      ],
    },
  },

  // ---------------------------------------------------------------------------
  // Tests and tooling
  // ---------------------------------------------------------------------------
  {
    files: [
      '**/*.test.{ts,tsx}',
      '**/tests/**/*.ts',
      '**/*.config.{ts,mts,mjs}',
      '**/vitest.setup.ts',
      // Repository tooling: writing to stdout is these scripts' whole purpose.
      'scripts/**/*.mjs',
      // Standalone CLI scripts (bootstrap, seed, admin recovery, bundle budget) — same reasoning.
      'apps/api/prisma/*.ts',
      'apps/api/scripts/*.ts',
      'apps/web/scripts/*.mjs',
    ],
    rules: {
      'no-console': 'off',
      '@typescript-eslint/no-non-null-assertion': 'off',
    },
  },

  prettier,
);
