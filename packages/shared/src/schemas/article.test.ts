import { describe, expect, it } from 'vitest';
import { articleCreateSchema, articleUpdateSchema } from './article.js';

describe('articleCreateSchema', () => {
  const valid = {
    title: 'Building a Secure Contact Form',
    slug: 'building-a-secure-contact-form',
    content: '# Intro\n\nSome real content.',
  };

  it('accepts the minimal valid shape', () => {
    expect(articleCreateSchema.safeParse(valid).success).toBe(true);
  });

  it('rejects a status field — the editorial workflow owns that, not this schema', () => {
    const result = articleCreateSchema.safeParse({ ...valid, status: 'PUBLISHED' });
    expect(result.success).toBe(false);
  });

  it('rejects a client-supplied readingTimeMinutes — always server-computed', () => {
    const result = articleCreateSchema.safeParse({ ...valid, readingTimeMinutes: 1 });
    expect(result.success).toBe(false);
  });

  it('rejects a client-supplied authorId — always the acting admin, from req.user', () => {
    const result = articleCreateSchema.safeParse({ ...valid, authorId: 1 });
    expect(result.success).toBe(false);
  });

  it('accepts a future publishedAt (scheduling)', () => {
    const result = articleCreateSchema.safeParse({
      ...valid,
      publishedAt: '2099-01-01T00:00:00.000Z',
    });
    expect(result.success).toBe(true);
  });

  it('accepts tagIds as a plain array of ids', () => {
    expect(articleCreateSchema.safeParse({ ...valid, tagIds: [1, 2, 3] }).success).toBe(true);
  });
});

describe('articleUpdateSchema', () => {
  it('accepts an empty object (no-op update) and a single-field patch', () => {
    expect(articleUpdateSchema.safeParse({}).success).toBe(true);
    expect(articleUpdateSchema.safeParse({ title: 'New Title' }).success).toBe(true);
  });
});
