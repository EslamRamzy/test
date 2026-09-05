/**
 * `jest-axe` ships no types of its own, and `@types/jest-axe` targets Jest's
 * own `Matchers` interface (this project's runner is vitest — see
 * `vitest-axe.d.ts` for the matching `Assertion` augmentation). Deliberately
 * a plain global SCRIPT file — no top-level import/export — because a
 * `declare module` shim for a package with NO existing types has to live in
 * a script file to properly override real (typeless) module resolution;
 * inside a file that's itself a module (any top-level import), the same
 * block stopped shimming the package at all, verified empirically.
 */
declare module 'jest-axe' {
  export function axe(html: Element | string, options?: unknown): Promise<unknown>;
  export const toHaveNoViolations: { toHaveNoViolations: (results: unknown) => unknown };
}
