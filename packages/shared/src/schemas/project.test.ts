import { describe, expect, it } from 'vitest';
import {
  projectCreateSchema,
  projectFeaturedInputSchema,
  projectImageCreateSchema,
  projectSectionsUpdateSchema,
  projectTechnologiesInputSchema,
  projectUpdateSchema,
} from './project.js';

describe('projectCreateSchema', () => {
  const valid = {
    title: 'Portfolio Platform',
    slug: 'portfolio-platform',
    shortDescription: 'A personal portfolio, admin dashboard, and REST API.',
    category: 'WEB_APP',
  };

  it('accepts the minimal valid shape', () => {
    expect(projectCreateSchema.safeParse(valid).success).toBe(true);
  });

  it('rejects an invalid category', () => {
    expect(projectCreateSchema.safeParse({ ...valid, category: 'GAME' }).success).toBe(false);
  });

  it('rejects a status field — publish/unpublish/archive own that', () => {
    expect(projectCreateSchema.safeParse({ ...valid, status: 'PUBLISHED' }).success).toBe(false);
  });

  it('accepts a features repeater', () => {
    expect(
      projectCreateSchema.safeParse({
        ...valid,
        features: [{ title: 'Real-time search', description: 'FTS5-backed' }],
      }).success,
    ).toBe(true);
  });

  it('rejects a non-https githubUrl', () => {
    expect(
      projectCreateSchema.safeParse({ ...valid, githubUrl: 'http://github.com/x/y' }).success,
    ).toBe(false);
  });
});

describe('projectUpdateSchema', () => {
  it('makes every field optional, including category', () => {
    expect(projectUpdateSchema.safeParse({}).success).toBe(true);
  });
});

describe('projectTechnologiesInputSchema', () => {
  it('accepts an array of technology ids, including an empty array (clear all)', () => {
    expect(projectTechnologiesInputSchema.safeParse({ technologyIds: [1, 2, 3] }).success).toBe(
      true,
    );
    expect(projectTechnologiesInputSchema.safeParse({ technologyIds: [] }).success).toBe(true);
  });
});

describe('projectImageCreateSchema', () => {
  it('requires mediaId', () => {
    expect(projectImageCreateSchema.safeParse({ caption: 'Screenshot' }).success).toBe(false);
    expect(projectImageCreateSchema.safeParse({ mediaId: 1 }).success).toBe(true);
  });
});

describe('projectFeaturedInputSchema', () => {
  it('requires a boolean featured value', () => {
    expect(projectFeaturedInputSchema.safeParse({ featured: true }).success).toBe(true);
    expect(projectFeaturedInputSchema.safeParse({ featured: 'yes' }).success).toBe(false);
  });
});

describe('projectSectionsUpdateSchema', () => {
  it('accepts a mix of built-in (no title/body) and custom (with title/body) sections', () => {
    const result = projectSectionsUpdateSchema.safeParse([
      { sectionKey: 'problem', visible: true, displayOrder: 0 },
      {
        sectionKey: 'custom-notes',
        title: 'Extra Notes',
        body: 'Some markdown content.',
        visible: true,
        displayOrder: 1,
      },
    ]);
    expect(result.success).toBe(true);
  });
});
