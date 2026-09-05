import '@testing-library/jest-dom/vitest';
import { expect } from 'vitest';
import { toHaveNoViolations } from 'jest-axe';

// jest-axe ships a Jest-shaped matcher object, not a vitest-specific entry
// point — `expect.extend` is the same API vitest exposes for exactly this
// (docs/architecture/06 §10: "jest-axe runs in component tests").
expect.extend(toHaveNoViolations);
