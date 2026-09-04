import { describe, expect, it } from 'vitest';
import { reorderSchema } from './reorder.js';

describe('reorderSchema', () => {
  it('accepts a valid ordered array', () => {
    const result = reorderSchema.safeParse([
      { id: 3, displayOrder: 0 },
      { id: 1, displayOrder: 1 },
      { id: 2, displayOrder: 2 },
    ]);
    expect(result.success).toBe(true);
  });

  it('rejects an empty array (nothing to reorder)', () => {
    expect(reorderSchema.safeParse([]).success).toBe(false);
  });

  it('rejects a negative displayOrder', () => {
    expect(reorderSchema.safeParse([{ id: 1, displayOrder: -1 }]).success).toBe(false);
  });

  it('rejects an entry missing id', () => {
    expect(reorderSchema.safeParse([{ displayOrder: 0 }]).success).toBe(false);
  });
});
