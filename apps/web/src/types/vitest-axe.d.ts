/**
 * Augments vitest's own `Assertion` interface with jest-axe's
 * `toHaveNoViolations` matcher (docs/architecture/06 §10) — the same shape
 * `@testing-library/jest-dom/vitest` already provides for its own matchers.
 * Deliberately a MODULE, not a global script (the top-level `import` below
 * is load-bearing) — a `declare module 'vitest' { ... }` block in a script
 * file REPLACES vitest's real exports instead of merging into them, which
 * silently broke every other test file's `describe`/`it`/`expect` the one
 * time this was tried without the import.
 */
import 'vitest';

declare module 'vitest' {
  interface Assertion<T = unknown> {
    toHaveNoViolations(): T extends object ? void : never;
  }
}
