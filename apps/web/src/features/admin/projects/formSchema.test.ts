import { describe, expect, it } from 'vitest';
import { projectFormSchema, toProjectWirePayload } from './formSchema';

describe('projectFormSchema', () => {
  it('accepts every optional field empty, including the case-study body and features', () => {
    const result = projectFormSchema.safeParse({
      title: 'Portfolio Platform',
      slug: 'portfolio-platform',
      shortDescription: 'A thing I built.',
      category: 'WEB_APP',
      coverMediaId: '',
      publishedAt: '',
      features: [],
    });
    expect(result.success).toBe(true);
  });

  it('validates feature entries and https-only URL fields', () => {
    expect(
      projectFormSchema.safeParse({
        title: 'X',
        slug: 'x',
        shortDescription: 'Y',
        category: 'WEB_APP',
        githubUrl: 'http://insecure.example.com',
      }).success,
    ).toBe(false);
  });
});

describe('toProjectWirePayload', () => {
  it('converts coverMediaId and publishedAt to their wire shapes', () => {
    const payload = toProjectWirePayload({
      title: 'Portfolio Platform',
      slug: 'portfolio-platform',
      shortDescription: 'A thing I built.',
      category: 'WEB_APP',
      coverMediaId: '2',
      publishedAt: '2024-01-15T10:30',
    });
    expect(payload.coverMediaId).toBe(2);
    expect(payload.publishedAt).toBe(new Date('2024-01-15T10:30').toISOString());
  });

  it('leaves empty optional fields as undefined', () => {
    const payload = toProjectWirePayload({
      title: 'Portfolio Platform',
      slug: 'portfolio-platform',
      shortDescription: 'A thing I built.',
      category: 'WEB_APP',
      coverMediaId: '',
      publishedAt: '',
    });
    expect(payload.coverMediaId).toBeUndefined();
    expect(payload.publishedAt).toBeUndefined();
  });
});
