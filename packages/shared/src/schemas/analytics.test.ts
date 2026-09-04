import { describe, expect, it } from 'vitest';
import { analyticsViewSchema } from './analytics.js';

describe('analyticsViewSchema', () => {
  it('accepts a minimal valid beacon', () => {
    expect(analyticsViewSchema.safeParse({ path: '/projects/foo' }).success).toBe(true);
  });

  it('accepts a full beacon with entity info and referrer host', () => {
    const result = analyticsViewSchema.safeParse({
      path: '/projects/foo',
      entityType: 'PROJECT',
      entityId: 1,
      referrerHost: 'google.com',
    });
    expect(result.success).toBe(true);
  });

  it('rejects an empty path', () => {
    expect(analyticsViewSchema.safeParse({ path: '' }).success).toBe(false);
  });

  it('rejects an entityType outside the allow-list', () => {
    expect(analyticsViewSchema.safeParse({ path: '/x', entityType: 'USER' }).success).toBe(false);
  });

  it('rejects an unknown field, e.g. a client-supplied ip', () => {
    expect(analyticsViewSchema.safeParse({ path: '/x', ip: '1.2.3.4' }).success).toBe(false);
  });
});
