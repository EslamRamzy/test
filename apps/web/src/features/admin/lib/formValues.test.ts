import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import {
  emptyStringsToUndefined,
  optionalDateOnlySchema,
  toDateInputValue,
  withFieldOverrides,
} from './formValues';

describe('toDateInputValue', () => {
  it('slices a full ISO datetime down to the date-only prefix', () => {
    expect(toDateInputValue('2022-06-01T00:00:00.000Z')).toBe('2022-06-01');
  });

  it('returns an empty string for null or undefined', () => {
    expect(toDateInputValue(null)).toBe('');
    expect(toDateInputValue(undefined)).toBe('');
  });
});

describe('emptyStringsToUndefined', () => {
  const schema = z
    .object({
      name: z.string().trim().min(1).max(100),
      website: z.string().trim().max(200).optional(),
    })
    .strict();

  it('lets an empty optional field validate by treating "" as undefined', () => {
    const wrapped = emptyStringsToUndefined(schema);
    const result = wrapped.safeParse({ name: 'Alice', website: '' });
    expect(result.success).toBe(true);
    expect(result.success && result.data.website).toBeUndefined();
  });

  it('still validates a present value against the original field schema', () => {
    const wrapped = emptyStringsToUndefined(schema);
    const result = wrapped.safeParse({ name: '', website: '' });
    expect(result.success).toBe(false);
  });
});

describe('withFieldOverrides', () => {
  const schema = z
    .object({
      name: z.string().trim().min(1).max(100),
      startDate: z.iso.date().transform((v) => new Date(v)),
    })
    .strict();

  it('replaces a field with the override schema, keeping the output type a plain string', () => {
    const clientSchema = withFieldOverrides(schema, { startDate: z.iso.date() });
    const result = clientSchema.safeParse({ name: 'Alice', startDate: '2022-06-01' });
    expect(result.success).toBe(true);
    expect(result.success && result.data.startDate).toBe('2022-06-01');
  });

  it('composes with emptyStringsToUndefined so an optional date can be cleared', () => {
    const overridden = withFieldOverrides(schema, { startDate: optionalDateOnlySchema });
    const clientSchema = emptyStringsToUndefined(overridden);
    const result = clientSchema.safeParse({ name: 'Alice', startDate: '' });
    expect(result.success).toBe(true);
    expect(result.success && result.data.startDate).toBeUndefined();
  });
});
