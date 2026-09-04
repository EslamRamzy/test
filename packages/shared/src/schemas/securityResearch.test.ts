import { describe, expect, it } from 'vitest';
import { securityResearchCreateSchema, securityResearchUpdateSchema } from './securityResearch.js';

describe('securityResearchCreateSchema', () => {
  const valid = {
    title: 'IDOR Testing Methodology',
    slug: 'idor-testing-methodology',
    content: 'Full writeup content.',
    category: 'METHODOLOGY',
  };

  it('accepts the minimal valid shape', () => {
    expect(securityResearchCreateSchema.safeParse(valid).success).toBe(true);
  });

  it('rejects an invalid category', () => {
    expect(securityResearchCreateSchema.safeParse({ ...valid, category: 'BLOGPOST' }).success).toBe(
      false,
    );
  });

  it('rejects a status field, same reasoning as articles', () => {
    expect(securityResearchCreateSchema.safeParse({ ...valid, status: 'PUBLISHED' }).success).toBe(
      false,
    );
  });

  it('accepts a references repeater and rejects a malformed reference URL', () => {
    expect(
      securityResearchCreateSchema.safeParse({
        ...valid,
        references: [{ label: 'OWASP Testing Guide', url: 'https://owasp.org/testing' }],
      }).success,
    ).toBe(true);
    expect(
      securityResearchCreateSchema.safeParse({
        ...valid,
        references: [{ label: 'Bad', url: 'not a url' }],
      }).success,
    ).toBe(false);
  });
});

describe('securityResearchUpdateSchema', () => {
  it('makes every field, including category, optional', () => {
    expect(securityResearchUpdateSchema.safeParse({}).success).toBe(true);
    expect(securityResearchUpdateSchema.safeParse({ title: 'New Title' }).success).toBe(true);
  });
});
