import { describe, expect, it } from 'vitest';
import {
  articleListQuerySchema,
  projectListQuerySchema,
  searchQuerySchema,
  securityResearchListQuerySchema,
  technologyListQuerySchema,
} from './query.js';

describe('projectListQuerySchema', () => {
  it('applies defaults with no query params', () => {
    const result = projectListQuerySchema.parse({});
    expect(result).toEqual({ page: 1, pageSize: 12, sort: 'displayOrder', order: 'asc' });
  });

  it('coerces and clamps pagination, and coerces boolean filters', () => {
    const result = projectListQuerySchema.parse({
      page: '2',
      pageSize: '999',
      featured: 'true',
      securityTested: 'false',
    });
    expect(result.page).toBe(2);
    expect(result.pageSize).toBe(50);
    expect(result.featured).toBe(true);
    expect(result.securityTested).toBe(false);
  });

  it('rejects a sort key outside the allow-list', () => {
    expect(() => projectListQuerySchema.parse({ sort: 'id; DROP TABLE projects' })).toThrow();
  });

  it('rejects an unknown query param (mass-assignment style)', () => {
    expect(() => projectListQuerySchema.parse({ status: 'DRAFT' })).toThrow();
  });
});

describe('articleListQuerySchema', () => {
  it('defaults sort to publishedAt desc', () => {
    const result = articleListQuerySchema.parse({});
    expect(result.sort).toBe('publishedAt');
    expect(result.order).toBe('desc');
  });

  it('validates category/tag as slugs', () => {
    expect(() => articleListQuerySchema.parse({ category: 'Not A Slug!' })).toThrow();
    expect(articleListQuerySchema.parse({ category: 'web-dev' }).category).toBe('web-dev');
  });
});

describe('securityResearchListQuerySchema', () => {
  it('rejects a category outside RESEARCH_CATEGORIES', () => {
    expect(() => securityResearchListQuerySchema.parse({ category: 'EXPLOIT' })).toThrow();
  });

  it('accepts a valid category', () => {
    expect(securityResearchListQuerySchema.parse({ category: 'WRITEUP' }).category).toBe('WRITEUP');
  });
});

describe('technologyListQuerySchema', () => {
  it('accepts an empty query', () => {
    expect(technologyListQuerySchema.parse({})).toEqual({});
  });
});

describe('searchQuerySchema', () => {
  it('rejects a query under 2 characters', () => {
    expect(() => searchQuerySchema.parse({ q: 'a' })).toThrow();
  });

  it('applies the default limit and clamps an over-large one', () => {
    expect(searchQuerySchema.parse({ q: 'security' }).limit).toBe(20);
    expect(searchQuerySchema.parse({ q: 'security', limit: '9999' }).limit).toBe(50);
  });

  it('rejects a type outside the allow-list', () => {
    expect(() => searchQuerySchema.parse({ q: 'security', type: 'users' })).toThrow();
  });
});
