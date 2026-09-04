import { describe, expect, it } from 'vitest';
import { articleFormSchema, toArticleWirePayload } from './formSchema';

describe('articleFormSchema', () => {
  it('accepts empty coverMediaId, categoryId, publishedAt, and an empty tag list', () => {
    const result = articleFormSchema.safeParse({
      title: 'A Post',
      slug: 'a-post',
      content: 'Body',
      coverMediaId: '',
      categoryId: '',
      publishedAt: '',
      tagIds: [],
    });
    expect(result.success).toBe(true);
  });

  it('rejects a datetime-local value that fails to parse', () => {
    const result = articleFormSchema.safeParse({
      title: 'A Post',
      slug: 'a-post',
      content: 'Body',
      publishedAt: 'not-a-date',
    });
    expect(result.success).toBe(false);
  });
});

describe('toArticleWirePayload', () => {
  it('converts coverMediaId/categoryId strings to numbers, publishedAt to a full ISO instant, and tag objects to ids', () => {
    const payload = toArticleWirePayload({
      title: 'A Post',
      slug: 'a-post',
      content: 'Body',
      coverMediaId: '3',
      categoryId: '5',
      publishedAt: '2024-01-15T10:30',
      tagIds: [
        { id: 1, name: 'XSS', slug: 'xss' },
        { id: 2, name: 'CSRF', slug: 'csrf' },
      ],
    });
    expect(payload.coverMediaId).toBe(3);
    expect(payload.categoryId).toBe(5);
    expect(payload.publishedAt).toBe(new Date('2024-01-15T10:30').toISOString());
    expect(payload.tagIds).toEqual([1, 2]);
  });

  it('leaves empty optional fields as undefined and omits tagIds when not provided', () => {
    const payload = toArticleWirePayload({
      title: 'A Post',
      slug: 'a-post',
      content: 'Body',
      coverMediaId: '',
      categoryId: '',
      publishedAt: '',
    });
    expect(payload.coverMediaId).toBeUndefined();
    expect(payload.categoryId).toBeUndefined();
    expect(payload.publishedAt).toBeUndefined();
    expect(payload.tagIds).toBeUndefined();
  });
});
