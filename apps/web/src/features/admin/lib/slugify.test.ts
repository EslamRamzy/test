import { describe, expect, it } from 'vitest';
import { slugify } from './slugify';

describe('slugify', () => {
  it('lowercases and hyphenates spaces', () => {
    expect(slugify('Hello World')).toBe('hello-world');
  });

  it('collapses runs of non-alphanumeric characters into a single hyphen', () => {
    expect(slugify('XSS & CSRF!!')).toBe('xss-csrf');
  });

  it('trims leading and trailing hyphens', () => {
    expect(slugify('  --Leading and trailing--  ')).toBe('leading-and-trailing');
  });

  it("matches slugSchema's own regex for a range of real inputs", () => {
    const pattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
    for (const input of ['IDOR Testing', 'SQL Injection 101', 'API Security', 'C++']) {
      expect(slugify(input)).toMatch(pattern);
    }
  });
});
