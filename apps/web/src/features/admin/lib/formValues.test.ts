import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import {
  emptyStringsToUndefined,
  optionalDateOnlySchema,
  optionalDatetimeLocalStringSchema,
  optionalPositiveIntStringSchema,
  parseOptionalDatetimeLocal,
  parseOptionalPositiveInt,
  toDateInputValue,
  toDatetimeLocalInputValue,
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

describe('optionalPositiveIntStringSchema', () => {
  it('accepts a whole-number string or undefined, rejects anything else', () => {
    expect(optionalPositiveIntStringSchema.safeParse('42').success).toBe(true);
    expect(optionalPositiveIntStringSchema.safeParse(undefined).success).toBe(true);
    expect(optionalPositiveIntStringSchema.safeParse('abc').success).toBe(false);
    expect(optionalPositiveIntStringSchema.safeParse('-1').success).toBe(false);
  });

  // On its own, an empty string doesn't match `/^\d+$/` — turning `''` into
  // `undefined` is `emptyStringsToUndefined`'s job, applied by every module
  // that uses this schema, not something this schema does by itself.
  it('rejects an empty string on its own; composes with emptyStringsToUndefined to accept one', () => {
    expect(optionalPositiveIntStringSchema.safeParse('').success).toBe(false);

    const wrapped = emptyStringsToUndefined(
      z.object({ certificateMediaId: optionalPositiveIntStringSchema }),
    );
    const result = wrapped.safeParse({ certificateMediaId: '' });
    expect(result.success).toBe(true);
    expect(result.success && result.data.certificateMediaId).toBeUndefined();
  });
});

describe('parseOptionalPositiveInt', () => {
  it('parses a numeric string to a number', () => {
    expect(parseOptionalPositiveInt('42')).toBe(42);
  });

  it('returns undefined for an empty string or undefined', () => {
    expect(parseOptionalPositiveInt('')).toBeUndefined();
    expect(parseOptionalPositiveInt(undefined)).toBeUndefined();
  });
});

describe('optionalDatetimeLocalStringSchema', () => {
  it('accepts a datetime-local value or undefined, rejects an unparseable string', () => {
    expect(optionalDatetimeLocalStringSchema.safeParse('2024-01-15T10:30').success).toBe(true);
    expect(optionalDatetimeLocalStringSchema.safeParse(undefined).success).toBe(true);
    expect(optionalDatetimeLocalStringSchema.safeParse('not-a-date').success).toBe(false);
  });
});

describe('toDatetimeLocalInputValue and parseOptionalDatetimeLocal', () => {
  it('round-trips a UTC instant through the local input format', () => {
    const iso = '2024-01-15T10:30:00.000Z';
    const local = toDatetimeLocalInputValue(iso);
    expect(local).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/);
    expect(parseOptionalDatetimeLocal(local)).toBe(new Date(local).toISOString());
  });

  it('returns an empty string / undefined for an unset value', () => {
    expect(toDatetimeLocalInputValue(null)).toBe('');
    expect(toDatetimeLocalInputValue(undefined)).toBe('');
    expect(parseOptionalDatetimeLocal(undefined)).toBeUndefined();
    expect(parseOptionalDatetimeLocal('')).toBeUndefined();
  });
});
