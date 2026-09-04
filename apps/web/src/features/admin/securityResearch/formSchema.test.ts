import { describe, expect, it } from 'vitest';
import { securityResearchFormSchema, toSecurityResearchWirePayload } from './formSchema';

describe('securityResearchFormSchema', () => {
  it('accepts empty coverMediaId/publishedAt and empty tag/reference lists', () => {
    const result = securityResearchFormSchema.safeParse({
      title: 'IDOR Testing',
      slug: 'idor-testing',
      content: 'Body',
      category: 'RESEARCH',
      coverMediaId: '',
      publishedAt: '',
      tagIds: [],
      references: [],
    });
    expect(result.success).toBe(true);
  });

  it('requires category (no default in the schema itself)', () => {
    const result = securityResearchFormSchema.safeParse({
      title: 'IDOR Testing',
      slug: 'idor-testing',
      content: 'Body',
    });
    expect(result.success).toBe(false);
  });

  it('validates each reference has a label and an https url', () => {
    const result = securityResearchFormSchema.safeParse({
      title: 'IDOR Testing',
      slug: 'idor-testing',
      content: 'Body',
      category: 'RESEARCH',
      references: [{ label: '', url: 'not-a-url' }],
    });
    expect(result.success).toBe(false);
  });
});

describe('toSecurityResearchWirePayload', () => {
  it('converts coverMediaId, publishedAt, and tag objects to their wire shapes', () => {
    const payload = toSecurityResearchWirePayload({
      title: 'IDOR Testing',
      slug: 'idor-testing',
      content: 'Body',
      category: 'RESEARCH',
      coverMediaId: '4',
      publishedAt: '2024-01-15T10:30',
      tagIds: [{ id: 9, name: 'IDOR', slug: 'idor' }],
      references: [{ label: 'OWASP', url: 'https://owasp.org' }],
    });
    expect(payload.coverMediaId).toBe(4);
    expect(payload.publishedAt).toBe(new Date('2024-01-15T10:30').toISOString());
    expect(payload.tagIds).toEqual([9]);
    expect(payload.references).toEqual([{ label: 'OWASP', url: 'https://owasp.org' }]);
  });
});
